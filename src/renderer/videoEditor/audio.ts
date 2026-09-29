// 超级录屏音频：采集、混音、编码
// 见 docs/develop/superRecorderAudio.md
import store from "../../../lib/store/renderStore";

/** 系统内录在 录屏.音频.设备列表 中的占位 id，与 recorder.ts 保持一致 */
export const sysAudioId = "00";

const sysKey = "sys";

const opusSampleRates = [8000, 12000, 16000, 24000, 48000];

const audioBitrate = 128000;

/** 录制得到的音频（opus 编码块 + 时间轴换算信息） */
export type SrcAudio = {
    chunks: EncodedAudioChunk[];
    sampleRate: number;
    numberOfChannels: number;
    /** chunk 时间戳换算到视频时间轴（0 为首个视频帧）的偏移，单位 µs */
    originUs: number;
};

type LevelListener = (level: number) => void;

type AudioSource = {
    node: MediaStreamAudioSourceNode;
    gain: GainNode;
    stream: MediaStream;
    /** 由本模块申请的流，移除时需要停止设备 */
    owned: boolean;
    active: boolean;
};

function planarF32(data: AudioData) {
    const frames = data.numberOfFrames;
    const channels = data.numberOfChannels;
    const planes: Float32Array[] = [];
    if (data.format === "f32-planar") {
        for (let i = 0; i < channels; i++) {
            const p = new Float32Array(frames);
            data.copyTo(p, { format: "f32-planar", planeIndex: i });
            planes.push(p);
        }
        return planes;
    }
    const all = new Float32Array(frames * channels);
    data.copyTo(all, { format: "f32", planeIndex: 0 });
    for (let i = 0; i < channels; i++) {
        const p = new Float32Array(frames);
        for (let j = 0; j < frames; j++) p[j] = all[j * channels + i];
        planes.push(p);
    }
    return planes;
}

/** 线性插值重采样，仅用于把非 opus 支持的采样率（如 44100）转到 48000 */
function resample(p: Float32Array, rate: number, target: number) {
    if (rate === target || p.length === 0) return p;
    const len = Math.max(1, Math.round((p.length * target) / rate));
    const out = new Float32Array(len);
    const ratio = rate / target;
    for (let i = 0; i < len; i++) {
        const x = i * ratio;
        const i0 = Math.min(Math.floor(x), p.length - 1);
        const i1 = Math.min(i0 + 1, p.length - 1);
        const a = x - i0;
        out[i] = p[i0] * (1 - a) + p[i1] * a;
    }
    return out;
}

function rmsOf(p: Float32Array) {
    let sum = 0;
    for (let i = 0; i < p.length; i++) sum += p[i] * p[i];
    return Math.sqrt(sum / Math.max(1, p.length));
}

function toPlanarAudioData(
    planes: Float32Array[],
    sampleRate: number,
    timestamp: number,
) {
    const frames = planes[0].length;
    const channels = planes.length;
    const data = new Float32Array(frames * channels);
    for (let c = 0; c < channels; c++) data.set(planes[c], c * frames);
    const audioData = new AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: channels,
        timestamp,
        data,
    });
    return audioData;
}

export class AudioCapture {
    private ctx: AudioContext | null = null;
    private dest: MediaStreamAudioDestinationNode | null = null;
    private sources = new Map<string, AudioSource>();
    private reader: ReadableStreamDefaultReader<AudioData> | null = null;
    private loopPromise: Promise<void> | null = null;
    private encoder: AudioEncoder | null = null;
    private chunks: EncodedAudioChunk[] = [];
    private outRate = 0;
    private outChannels = 0;
    private sourceId = "";
    private stopped = false;
    private levelCbs: LevelListener[] = [];
    private systemPromise: Promise<boolean> | null = null;
    private systemStream: MediaStream | null = null;
    private extraVideos: MediaStreamTrack[] = [];
    /** 视频帧时间戳与 perf.now 的最小偏差，µs */
    private vOff = Number.POSITIVE_INFINITY;
    /** 音频时间戳与 perf.now 的最小偏差，µs */
    private aOff = Number.POSITIVE_INFINITY;

    setSourceId(id: string) {
        this.sourceId = id;
    }

    onLevel(cb: LevelListener) {
        this.levelCbs.push(cb);
    }

    private emitLevel(level: number) {
        for (const cb of this.levelCbs) cb(level);
    }

    private anyActive() {
        for (const s of this.sources.values()) if (s.active) return true;
        return false;
    }

    /** 每个视频帧读取时调用，用于校准音画时钟 */
    noteVideoTs(ts: number) {
        this.vOff = Math.min(this.vOff, ts - performance.now() * 1000);
    }

    has(key: string) {
        return this.sources.has(key);
    }

    isActive(key: string) {
        return this.sources.get(key)?.active ?? false;
    }

    micKey(deviceId: string) {
        return `mic:${deviceId}`;
    }

    get sysKey() {
        return sysKey;
    }

    /** 当前启用的输入，用于持久化到 录屏.音频.设备列表 */
    activeIds() {
        const ids: string[] = [];
        for (const [key, s] of this.sources) {
            if (!s.active) continue;
            if (key === sysKey) ids.push(sysAudioId);
            else if (key.startsWith("mic:")) ids.push(key.slice(4));
        }
        return ids;
    }

    /** 从设置恢复麦克风选择 */
    async initFromSettings() {
        const list = store.get("录屏.音频.设备列表");
        for (const id of list) {
            if (id !== sysAudioId) await this.setMic(id, true);
        }
    }

    /** 录制开始时主 流 里附带的系统内录音轨（不归本模块管理生命周期） */
    setSystemTrack(
        track: MediaStreamTrack | null,
        stream: MediaStream,
        active: boolean,
    ) {
        if (!track) return;
        this.systemStream = stream;
        if (this.sources.has(sysKey) || this.systemPromise) return;
        this.addSource(sysKey, stream, false, active);
    }

    async setMic(deviceId: string, on: boolean) {
        if (this.stopped) return false;
        const key = this.micKey(deviceId);
        if (!on) {
            this.setActive(key, false);
            this.removeSource(key);
            return true;
        }
        if (this.sources.has(key)) {
            this.setActive(key, true);
            return true;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: deviceId } },
                video: false,
            });
            this.addSource(key, stream, true, true);
            return true;
        } catch (e) {
            console.error("超级录屏：获取麦克风失败", deviceId, e);
            return false;
        }
    }

    async setSystem(on: boolean) {
        if (this.stopped) return false;
        const s = this.sources.get(sysKey);
        if (!on) {
            this.setActive(sysKey, false);
            if (s?.owned) {
                this.removeSource(sysKey);
                this.systemPromise = null;
            }
            return true;
        }
        if (s) {
            this.setActive(sysKey, true);
            return true;
        }
        if (this.systemStream) {
            this.addSource(sysKey, this.systemStream, false, true);
            return true;
        }
        if (!this.sourceId) return false;
        if (!this.systemPromise) this.systemPromise = this.fetchSystem();
        const ok = await this.systemPromise;
        if (!ok) this.systemPromise = null;
        return ok;
    }

    setActive(key: string, on: boolean) {
        const s = this.sources.get(key);
        if (!s) return;
        s.active = on;
        s.gain.gain.value = on ? 1 : 0;
        if (!this.anyActive()) this.emitLevel(0);
        const ctx = this.ctx;
        if (ctx?.state === "suspended") {
            ctx.resume().catch((e) => console.warn(e));
        }
    }

    /**
     * 中途开启系统内录：补一次桌面采集，其视频轨需要保留到录制结束
     * （停止它可能连带停止同一采集会话的音频）
     */
    private async fetchSystem() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                // @ts-ignore
                audio: {
                    // @ts-ignore
                    mandatory: { chromeMediaSource: "desktop" },
                },
                video: {
                    // @ts-ignore
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: this.sourceId,
                    },
                },
            });
            this.extraVideos.push(...stream.getVideoTracks());
            this.addSource(sysKey, stream, true, true);
            return true;
        } catch (e) {
            console.error("超级录屏：获取系统音频失败", e);
            return false;
        }
    }

    private ensureCtx() {
        if (!this.ctx) {
            this.ctx = new AudioContext();
            this.dest = this.ctx.createMediaStreamDestination();
        }
        if (this.ctx.state === "suspended") {
            const ctx = this.ctx;
            ctx.resume()
                .then(() => {
                    const state: string = ctx.state;
                    if (state !== "running")
                        console.warn(
                            "超级录屏：AudioContext 未运行，音频可能无法录制",
                        );
                })
                .catch((e) => console.warn(e));
        }
        return this.ctx;
    }

    private addSource(
        key: string,
        stream: MediaStream,
        owned: boolean,
        active: boolean,
    ) {
        if (this.stopped) return;
        this.removeSource(key);
        const ctx = this.ensureCtx();
        const node = ctx.createMediaStreamSource(stream);
        const gain = ctx.createGain();
        gain.gain.value = active ? 1 : 0;
        node.connect(gain);
        gain.connect(this.dest as MediaStreamAudioDestinationNode);
        this.sources.set(key, { node, gain, stream, owned, active });
        this.startReader();
    }

    private removeSource(key: string) {
        const s = this.sources.get(key);
        if (!s) return;
        this.sources.delete(key);
        s.node.disconnect();
        s.gain.disconnect();
        if (s.owned) for (const t of s.stream.getTracks()) t.stop();
        if (!this.anyActive()) this.emitLevel(0);
    }

    private startReader() {
        if (this.reader || this.stopped) return;
        const track = this.dest?.stream.getAudioTracks()[0];
        if (!track) return;
        this.reader = new MediaStreamTrackProcessor({
            track,
        }).readable.getReader();
        this.loopPromise = this.readLoop(this.reader);
    }

    private async ensureEncoder() {
        if (this.encoder) return this.encoder;
        const config: AudioEncoderConfig = {
            codec: "opus",
            sampleRate: this.outRate,
            numberOfChannels: this.outChannels,
            bitrate: audioBitrate,
        };
        try {
            const support = await AudioEncoder.isConfigSupported(config);
            if (!support.supported) {
                console.warn(
                    "超级录屏：不支持 opus 编码，本次录制无音频",
                    config,
                );
                return null;
            }
        } catch (e) {
            console.error(e);
            return null;
        }
        const encoder = new AudioEncoder({
            output: (c) => this.chunks.push(c),
            error: (e) => console.error("Audio encode error:", e),
        });
        encoder.configure(config);
        this.encoder = encoder;
        return encoder;
    }

    private async readLoop(reader: ReadableStreamDefaultReader<AudioData>) {
        while (!this.stopped) {
            const { done, value } = await reader.read();
            if (done || !value) break;
            const ts = value.timestamp;
            this.aOff = Math.min(this.aOff, ts - performance.now() * 1000);
            const inRate = value.sampleRate;
            if (!this.outRate) {
                this.outRate = opusSampleRates.includes(inRate)
                    ? inRate
                    : 48000;
                this.outChannels = Math.max(
                    1,
                    Math.min(value.numberOfChannels, 2),
                );
            }
            let planes = planarF32(value);
            value.close();
            if (planes.length > this.outChannels)
                planes = planes.slice(0, this.outChannels);
            this.emitLevel(rmsOf(planes[0]));
            if (inRate !== this.outRate)
                planes = planes.map((p) => resample(p, inRate, this.outRate));
            const encoder = await this.ensureEncoder();
            if (!encoder || this.stopped) break;
            if (encoder.encodeQueueSize > 8) continue; // 背压：丢弃，播放时为静音
            const data = toPlanarAudioData(planes, this.outRate, ts);
            encoder.encode(data);
            data.close();
        }
    }

    /**
     * 停止录制：先同步释放设备，再等待编码完成。
     * @param firstVideoTs 首个视频帧时间戳（原始采集时钟），用于换算音画时间轴
     */
    async stop(firstVideoTs?: number): Promise<SrcAudio | null> {
        this.stopped = true;
        const reader = this.reader;
        this.reader = null;
        if (reader) {
            try {
                await reader.cancel();
            } catch (e) {
                console.error(e);
            }
        }
        if (this.loopPromise) {
            try {
                await this.loopPromise;
            } catch (e) {
                console.error(e);
            }
            this.loopPromise = null;
        }
        const encoder = this.encoder;
        this.encoder = null;
        if (encoder) {
            try {
                await encoder.flush();
                encoder.close();
            } catch (e) {
                console.error(e);
            }
        }
        for (const s of this.sources.values()) {
            if (s.owned) for (const t of s.stream.getTracks()) t.stop();
            else for (const t of s.stream.getAudioTracks()) t.stop();
        }
        for (const t of this.extraVideos) t.stop();
        this.sources.clear();
        this.extraVideos = [];
        if (this.ctx) {
            try {
                await this.ctx.close();
            } catch (e) {
                console.error(e);
            }
            this.ctx = null;
            this.dest = null;
        }
        if (
            this.chunks.length === 0 ||
            firstVideoTs === undefined ||
            !Number.isFinite(this.vOff) ||
            !Number.isFinite(this.aOff)
        ) {
            return null;
        }
        return {
            chunks: this.chunks,
            sampleRate: this.outRate,
            numberOfChannels: this.outChannels,
            originUs: this.aOff + firstVideoTs - this.vOff,
        };
    }
}

export const audioCapture = new AudioCapture();

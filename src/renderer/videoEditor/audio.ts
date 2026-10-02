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

/** 解码录制音频，放到源时间轴上（0 为首个视频帧），返回的 PCM 只应临时使用 */
export async function decodeSrcAudio(
    audio: SrcAudio,
    durationMs: number,
): Promise<AudioBuffer | null> {
    if (audio.chunks.length === 0) return null;
    const { sampleRate, numberOfChannels, originUs } = audio;
    // 多留 1 秒，容纳最后一个视频帧之后的音频
    const length = Math.max(
        1,
        Math.ceil((durationMs / 1000) * sampleRate) + sampleRate,
    );
    const planes = Array.from(
        { length: numberOfChannels },
        () => new Float32Array(length),
    );
    let nextIdx = 0;
    const decoder = new AudioDecoder({
        output: (d) => {
            const ms = (d.timestamp - originUs) / 1000;
            let start = Math.round((ms / 1000) * sampleRate);
            let skip = 0;
            if (start < 0) {
                skip = -start;
                start = 0;
            }
            if (start < nextIdx) {
                skip += nextIdx - start;
                start = nextIdx;
            }
            const inPlanes = planarF32(d);
            const frames = d.numberOfFrames;
            d.close();
            if (skip >= frames || start >= length) return;
            const n = Math.min(frames - skip, length - start);
            for (let c = 0; c < planes.length; c++) {
                const p = inPlanes[Math.min(c, inPlanes.length - 1)];
                if (!p) continue;
                planes[c].set(p.subarray(skip, skip + n), start);
            }
            nextIdx = Math.max(nextIdx, start + n);
        },
        error: (e) => console.error("Audio decode error:", e),
    });
    decoder.configure({
        codec: "opus",
        sampleRate,
        numberOfChannels,
    });
    try {
        for (let i = 0; i < audio.chunks.length; i++) {
            // 分批 flush，避免解码队列积压
            if (i > 0 && i % 250 === 0) await decoder.flush();
            decoder.decode(audio.chunks[i]);
        }
        await decoder.flush();
    } catch (e) {
        console.error(e);
    }
    decoder.close();
    if (nextIdx === 0) return null;
    const buffer = new AudioBuffer({
        length,
        numberOfChannels,
        sampleRate,
    });
    for (let c = 0; c < planes.length; c++) buffer.copyToChannel(planes[c], c);
    return buffer;
}

function sliceBuffer(
    buf: AudioBuffer,
    startMs: number,
    durMs: number,
    padFrames = 0,
) {
    const sr = buf.sampleRate;
    const start = Math.max(0, Math.round((startMs / 1000) * sr));
    if (start >= buf.length) return null;
    const len = Math.max(
        1,
        Math.min(Math.round((durMs / 1000) * sr), buf.length - start),
    );
    const out = new AudioBuffer({
        length: len + padFrames,
        numberOfChannels: buf.numberOfChannels,
        sampleRate: sr,
    });
    const tmp = new Float32Array(len);
    for (let c = 0; c < buf.numberOfChannels; c++) {
        tmp.fill(0);
        buf.copyFromChannel(tmp, c, start);
        out.copyToChannel(tmp, c);
    }
    return out;
}

/** 变速段尾部越界保护（ms），见 timeStretch */
const stretchGuardMs = 50;
/** 上一段尾部塌陷后，下一段开头的淡入时长（ms），避免接缝爆音 */
const seamFadeMs = 40;

/**
 * WSOLA 时间伸缩：把 src 的前 srcLen 帧拉伸到 outFrames 帧且保持音高（变速不改变调）。
 * 分析帧在输出内按 1:1 推进，尾部会读到 srcLen 之后，故调用方需在 srcLen 之后
 * 留出越界保护（下一段源音频，缺失时为静音），读取不得越过 src.length。
 * 长段落会周期性让出事件循环，避免卡住界面。
 */
async function timeStretch(
    src: AudioBuffer,
    srcLen: number,
    outFrames: number,
): Promise<AudioBuffer> {
    const sr = src.sampleRate;
    const nch = src.numberOfChannels;
    const xLen = src.length;
    const frames = Math.max(1, outFrames);
    const out = new AudioBuffer({
        length: frames,
        numberOfChannels: nch,
        sampleRate: sr,
    });
    if (srcLen <= 0 || xLen === 0) return out;

    // 分析帧 ~43ms：短了盖不住基频周期，长了抹掉瞬态；耗时 ∝ 帧长 × 输出帧数
    let frame = 1 << Math.max(6, Math.floor(Math.log2(0.043 * sr)));
    const cap =
        1 << Math.max(6, Math.floor(Math.log2(Math.min(srcLen, frames))));
    if (frame > cap) frame = cap;
    while (frame > 8 && srcLen + frame > xLen) frame >>= 1;
    if (srcLen + frame > xLen) return out;

    const half = frame >> 1;
    const radius = Math.max(1, half >> 1); // ±10.7ms，覆盖 ≥47Hz 基频的相位搜索
    const dec = sr < 32000 ? 2 : frames > 16_000_000 ? 8 : 4;
    const lDec = Math.max(1, Math.floor(half / dec));
    const maxA = srcLen;

    const chans: Float32Array[] = [];
    for (let c = 0; c < nch; c++) chans.push(src.getChannelData(c));
    const x0 = chans[0];

    // 粗搜索用的降采样信号，盒式平滑抗混叠
    const box = dec * 2;
    const dLen = Math.floor(xLen / dec) + 1;
    const d = new Float32Array(dLen);
    for (let i = 0; i < dLen; i++) {
        const c = i * dec;
        const a = Math.max(0, c - box);
        const b = Math.min(xLen, c + box);
        if (b <= a) continue;
        let s = 0;
        for (let j = a; j < b; j++) s += x0[j];
        d[i] = s / (b - a);
    }

    const win = new Float32Array(frame);
    for (let i = 0; i < frame; i++)
        win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / frame);

    const ha = (half * srcLen) / frames;
    const kFrames = Math.ceil(frames / half);

    // 参考信号取上一分析帧的后半，候选需与它在重叠区相位对齐
    const search = (nominal: number, aPrev: number): number => {
        const r0 = aPrev + half;
        const i0 = Math.min(Math.max(0, Math.floor(r0 / dec)), dLen - lDec);
        const rm = r0 - i0 * dec;
        let jMin = Math.floor((nominal - radius - rm) / dec);
        let jMax = Math.ceil((nominal + radius - rm) / dec);
        if (jMin < 0) jMin = 0;
        const jLimit = Math.min(Math.floor((maxA - rm) / dec), dLen - lDec);
        if (jMax > jLimit) jMax = jLimit;
        let bestJ = Math.round((nominal - rm) / dec);
        if (bestJ < jMin) bestJ = jMin;
        if (bestJ > jMax) bestJ = jMax;
        if (jMin <= jMax) {
            let refSq = 0;
            for (let t = 0; t < lDec; t++) {
                const v = d[i0 + t];
                refSq += v * v;
            }
            if (refSq > 1e-12) {
                let csq = 0;
                for (let t = 0; t < lDec; t++) {
                    const v = d[jMin + t];
                    csq += v * v;
                }
                let bestScore = Number.NEGATIVE_INFINITY;
                for (let j = jMin; j <= jMax; j++) {
                    if (j > jMin) {
                        const add = d[j + lDec - 1];
                        const sub = d[j - 1];
                        csq += add * add - sub * sub;
                    }
                    if (csq <= 1e-12) continue;
                    let dot = 0;
                    for (let t = 0; t < lDec; t++) dot += d[j + t] * d[i0 + t];
                    const score = dot / Math.sqrt(csq * refSq);
                    if (score > bestScore) {
                        bestScore = score;
                        bestJ = j;
                    }
                }
            }
        }
        // 全速率细搜索，消除抽取栅格的量化误差
        let bestP = Math.min(maxA, Math.max(0, bestJ * dec + rm));
        let refSqF = 0;
        for (let m = 0; m < half; m++) {
            const v = x0[r0 + m];
            refSqF += v * v;
        }
        if (refSqF > 1e-12) {
            const p0 = bestJ * dec + rm;
            const qStart = Math.max(0, p0 - dec);
            let q = qStart;
            const qEnd = Math.min(maxA, p0 + dec);
            let csqF = 0;
            for (let m = 0; m < half; m++) {
                const v = x0[q + m];
                csqF += v * v;
            }
            let bestScore = Number.NEGATIVE_INFINITY;
            for (; q <= qEnd; q++) {
                if (q > qStart) {
                    const add = x0[q + half - 1];
                    const sub = x0[q - 1];
                    csqF += add * add - sub * sub;
                }
                if (csqF <= 1e-12) continue;
                let dot = 0;
                for (let m = 0; m < half; m++) dot += x0[q + m] * x0[r0 + m];
                const score = dot / Math.sqrt(csqF * refSqF);
                if (score > bestScore) {
                    bestScore = score;
                    bestP = q;
                }
            }
        }
        return bestP;
    };

    const outs: Float32Array[] = [];
    for (let c = 0; c < nch; c++) outs.push(out.getChannelData(c));

    let aPrev = 0;
    for (let k = 0; k < kFrames; k++) {
        const syn = k * half;
        const a = k === 0 ? 0 : search(k * ha, aPrev);
        aPrev = a;
        for (let c = 0; c < nch; c++) {
            const xi = chans[c];
            const o = outs[c];
            for (let n = 0; n < frame; n++) {
                const idx = syn + n;
                if (idx >= frames) break;
                o[idx] += xi[a + n] * win[n];
            }
        }
        if ((k & 1023) === 1023) await new Promise((r) => setTimeout(r, 0));
    }
    // Hann 50% 叠加和恒为 1，仅首帧前半无前邻，单独除一次窗
    for (let c = 0; c < nch; c++) {
        const o = outs[c];
        for (let s = 0; s < frames; s++) {
            const w = s < half ? win[s] : 1;
            if (w > 1e-6) o[s] /= w;
            else o[s] = 0;
        }
    }
    return out;
}

function fadeIn(buf: AudioBuffer, ms: number) {
    const n = Math.min(buf.length, Math.round((ms / 1000) * buf.sampleRate));
    if (n <= 1) return;
    for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < n; i++)
            d[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
    }
}

/**
 * 按编辑结果把源音频变换到输出时间轴：
 * 删除的帧区间不发声，变速区间用 WSOLA time-stretch 保持音高（不改变调）。
 * 时间线口径必须与 getFrameXs 一致。
 * @param frameXs getFrameXs 的结果
 * @param srcTimes 每个源帧的时间（ms）
 * @param srcDurationMs 源视频时长（ms）
 */
export async function buildTransAudio(
    audio: SrcAudio,
    frameXs: { timestamp: number; isRemoved: boolean }[],
    srcTimes: number[],
    srcDurationMs: number,
): Promise<AudioBuffer | null> {
    const src = await decodeSrcAudio(audio, srcDurationMs);
    if (!src) return null;
    // frameXs 的时间戳与 EncodedVideoChunk 一致为 µs，这里统一转成 ms
    const frames = frameXs.map((f) => ({
        timestamp: f.timestamp / 1000,
        isRemoved: f.isRemoved,
    }));
    const segments: {
        srcStart: number;
        srcDur: number;
        outStart: number;
        outDur: number;
    }[] = [];
    let totalMs = 0;
    let cur: (typeof segments)[0] | null = null;
    const push = () => {
        if (cur) segments.push(cur);
        cur = null;
    };
    for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        if (f.isRemoved) {
            push();
            continue;
        }
        totalMs = Math.max(totalMs, f.timestamp);
        const outDur = (frames[i + 1]?.timestamp ?? f.timestamp) - f.timestamp;
        const srcStart = srcTimes[i] ?? 0;
        const srcDur = (srcTimes[i + 1] ?? srcStart) - srcStart;
        if (outDur <= 0 || srcDur <= 0) {
            push();
            continue;
        }
        // 相邻且速度相同的帧合并成一段，避免逐帧建节点
        if (cur && Math.abs(cur.srcDur / cur.outDur - srcDur / outDur) < 1e-6) {
            cur.srcDur += srcDur;
            cur.outDur += outDur;
            continue;
        }
        push();
        cur = { srcStart, srcDur, outStart: f.timestamp, outDur };
    }
    push();
    if (segments.length === 0 || totalMs <= 0) return null;
    const sr = src.sampleRate;
    const length = Math.max(1, Math.ceil((totalMs / 1000) * sr));
    const ctx = new OfflineAudioContext(src.numberOfChannels, length, sr);
    const padFrames = Math.round((stretchGuardMs / 1000) * sr);
    let fadeNext = false;
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const start = Math.round((seg.srcStart / 1000) * sr);
        const srcLen = Math.max(
            1,
            Math.min(Math.round((seg.srcDur / 1000) * sr), src.length - start),
        );
        const outFrames = Math.max(1, Math.round((seg.outDur / 1000) * sr));
        const stretch = srcLen !== outFrames;
        const next = segments[i + 1];
        // 越界保护只能取下一段的源音频；中间隔着删除区间时不能越界
        const guard =
            stretch && next && next.srcStart - seg.srcStart - seg.srcDur < 1
                ? stretchGuardMs
                : 0;
        const slice = sliceBuffer(
            src,
            seg.srcStart,
            seg.srcDur + guard,
            stretch ? padFrames : 0,
        );
        if (!slice) continue;
        if (fadeNext) fadeIn(slice, seamFadeMs);
        fadeNext = stretch && guard === 0;
        const node = ctx.createBufferSource();
        node.buffer = stretch
            ? await timeStretch(
                  slice,
                  Math.min(srcLen, slice.length),
                  outFrames,
              )
            : slice;
        node.connect(ctx.destination);
        node.start(seg.outStart / 1000);
    }
    return await ctx.startRendering();
}

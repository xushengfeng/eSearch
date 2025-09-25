/// <reference types="vite/client" />

import {
    initStyle,
    getImgUrl,
    setTitle,
    Class,
    cssColor,
    cssVar,
} from "../root/root";
import {
    button,
    check,
    dynamicSelect,
    ele,
    image,
    input,
    label,
    p,
    trackPoint,
    txt,
} from "dkh-ui";
import { t } from "../../../lib/translate/translate";
import { view } from "dkh-ui";

import store from "../../../lib/store/renderStore";
initStyle(store);

setTitle(t("录屏"));

type VideoData = {
    video: EncodedVideoChunk[];
    audio: EncodedAudioChunk[][];
};

let recordData: VideoData | null = null;

// 时间单位品牌类型
type Seconds = number & { __unit: "s" };
type Milliseconds = number & { __unit: "ms" };
type Microseconds = number & { __unit: "us" };

// 构造函数
function seconds(val: number): Seconds {
    return val as Seconds;
}
function milliseconds(val: number): Milliseconds {
    return val as Milliseconds;
}
function microseconds(val: number): Microseconds {
    return val as Microseconds;
}

// 转换函数
function sToMs(s: Seconds): Milliseconds {
    return milliseconds(s * 1000);
}
function msToS(ms: Milliseconds): Seconds {
    return seconds(ms / 1000);
}
function usToS(us: Microseconds): Seconds {
    return seconds(us / 1_000_000);
}
function sToUs(s: Seconds): Microseconds {
    return microseconds(s * 1_000_000);
}
function msToUs(ms: Milliseconds): Microseconds {
    return microseconds(ms * 1000);
}
function usToMs(us: Microseconds): Milliseconds {
    return milliseconds(us / 1000);
}

function mathSub<T extends number>(a: T, b: T): T {
    return (a - b) as T;
}
// WebCodecs多音轨录制器
class WebCodecsRecorder {
    /** 安全减法，保持类型 */
    private mathSub<T extends number>(a: T, b: T): T {
        return (a - b) as T;
    }
    private videoTrack: MediaStreamVideoTrack;
    private audioTracks: MediaStreamAudioTrack[];
    private videoEncoder: VideoEncoder;
    private audioEncoders: AudioEncoder[] = [];
    private videoChunks: EncodedVideoChunk[] = [];
    private audioChunksList: EncodedAudioChunk[][] = [];
    public state: "inactive" | "recording" | "paused" = "inactive";
    public ondataavailable?: (data: VideoData) => void;
    public onstop?: () => void;
    public rect: [number, number, number, number];
    /** 录制基准时间（微秒） */
    private startTimestamp: Microseconds = microseconds(0);
    /** 暂停累计时长（微秒） */
    private pausedDuration: Microseconds = microseconds(0);
    /** 暂停开始时间（微秒） */
    private pauseStart: Microseconds = microseconds(0);

    constructor(
        stream: MediaStream,
        videoConfig: VideoEncoderConfig,
        audioConfig?: AudioEncoderConfig,
        rect?: [number, number, number, number],
    ) {
        this.videoTrack = stream.getVideoTracks()[0];
        this.audioTracks = audioConfig ? stream.getAudioTracks() : [];
        this.videoEncoder = new VideoEncoder({
            output: (chunk) => this.videoChunks.push(chunk),
            // todo 警告大小
            error: (e) => console.error("VideoEncoder error", e),
        });
        this.videoEncoder.configure(videoConfig);
        if (audioConfig) {
            this.audioTracks.forEach((track, idx) => {
                this.audioChunksList[idx] = [];
                const encoder = new AudioEncoder({
                    output: (chunk) => this.audioChunksList[idx].push(chunk),
                    error: (e) => console.error("AudioEncoder error", e),
                });
                encoder.configure(audioConfig);
                this.audioEncoders[idx] = encoder;
            });
        }
        this.rect = rect ?? [0, 0, 0, 0];
    }

    async start() {
        this.state = "recording";
        // 录制基准时间（微秒）
        this.startTimestamp = microseconds(performance.now() * 1000);
        this.pausedDuration = microseconds(0);
        this.pauseStart = microseconds(0);
        // 视频帧处理
        const videoReader = new MediaStreamTrackProcessor({
            track: this.videoTrack,
        }).readable.getReader();
        const [cropX, cropY, cropW, cropH] = this.rect;
        const processVideo = async () => {
            while (this.state === "recording") {
                const { value, done } = await videoReader.read();
                if (done) break;
                const frame = value;
                // 计算真实录制时间戳
                const nowUs = microseconds(performance.now() * 1000);
                const timestamp = this.mathSub(nowUs, this.startTimestamp);
                const realTimestamp = this.mathSub(
                    timestamp,
                    this.pausedDuration,
                );
                if (cropW > 0 && cropH > 0) {
                    // 真实裁切，生成新帧
                    const bitmap = await createImageBitmap(
                        frame,
                        cropX,
                        cropY,
                        cropW,
                        cropH,
                    );
                    const canvas = new OffscreenCanvas(cropW, cropH);
                    const ctx = canvas.getContext("2d")!;
                    ctx.drawImage(bitmap, 0, 0, cropW, cropH);
                    const croppedFrame = new VideoFrame(canvas, {
                        timestamp: realTimestamp,
                    });
                    this.videoEncoder.encode(croppedFrame);
                    croppedFrame.close();
                    bitmap.close();
                } else {
                    // 重新生成 VideoFrame，修正 timestamp
                    const newFrame = new VideoFrame(frame, {
                        timestamp: realTimestamp,
                    });
                    this.videoEncoder.encode(newFrame);
                    newFrame.close();
                }
                frame.close();
            }
        };
        processVideo();
        // 多音频轨道处理
        this.audioTracks.forEach((track, idx) => {
            const reader = new MediaStreamTrackProcessor({
                track,
            }).readable.getReader();
            const encoder = this.audioEncoders[idx];
            const processAudio = async () => {
                while (this.state === "recording") {
                    const { value, done } = await reader.read();
                    if (done) break;
                    // 计算真实录制时间戳
                    const nowUs = microseconds(performance.now() * 1000);
                    const timestamp = this.mathSub(nowUs, this.startTimestamp);
                    const realTimestamp = microseconds(
                        timestamp - this.pausedDuration,
                    );
                    // todo
                    // 重新生成 AudioData，修正 timestamp
                    if (value.format !== null) {
                        // 获取每个 channel 的数据
                        const channels = value.numberOfChannels;
                        const frames = value.numberOfFrames;
                        const sampleRate = value.sampleRate;
                        const buffers: Array<Float32Array> = [];
                        for (let ch = 0; ch < channels; ch++) {
                            const buf = new Float32Array(frames);
                            value.copyTo(buf, { planeIndex: ch });
                            buffers.push(buf);
                        }
                        // 重新构造 AudioData（如需同步 timestamp，可用自定义 PCM 编码器，否则直接用 value）
                        // 这里只能将 timestamp 逻辑交由后续处理，WebCodecs 不允许直接构造 AudioData
                        // 所以此处直接编码原始 value，后续解码/播放时用 timestamp 逻辑同步
                        encoder.encode(value);
                    } else {
                        encoder.encode(value);
                    }
                }
            };
            processAudio();
        });
    }

    stop() {
        this.state = "inactive";
        this.videoEncoder.flush();
        for (const enc of this.audioEncoders) enc.flush();
        this.ondataavailable?.({
            video: this.videoChunks,
            audio: this.audioChunksList,
        });
        this.onstop?.();
    }

    pause() {
        if (this.state !== "recording") return;
        this.state = "paused";
        // 记录暂停开始时间
        this.pauseStart = microseconds(performance.now() * 1000);
    }

    resume() {
        if (this.state === "paused") {
            // 累计暂停时长
            const nowUs = microseconds(performance.now() * 1000);
            this.pausedDuration = microseconds(
                this.pausedDuration + (nowUs - this.pauseStart),
            );
            this.state = "recording";
        }
    }
}

let recorder: WebCodecsRecorder;

/** 临时保存的原始视频位置 */
let tmpPath: string;
/** 转换 */
let output: string;

let sS = false;
let stop = false;

const clipTime = Number(store.get("录屏.转换.分段")) * 1000;

const timeL: number[] = [];
function pTime() {
    const t = Date.now();
    timeL.push(t);
    let d = 0;
    for (let i = 0; i < timeL.length; i += 2) {
        if (timeL[i + 1]) d += timeL[i + 1] - timeL[i];
    }
}
function setTime(t: string) {
    renderSend("recordTime", [t]);
    timeEl.sv(t);
}
function getTime() {
    if (recorder.state === "recording") {
        let t = 0;
        for (let i = 1; i < timeL.length - 1; i += 2) {
            t += timeL[i] - timeL[i - 1];
        }
        t += Date.now() - (timeL.at(-1) as number);
        const s = Math.trunc(t / 1000);
        const m = Math.trunc(s / 60);
        const h = Math.trunc(m / 60);
        setTime(
            `${h === 0 ? "" : `${h}:`}${m - 60 * h}:${String(
                s - 60 * m,
            ).padStart(2, "0")}`,
        );
    }
}

type mimeType =
    | "mp4"
    | "webm"
    | "gif"
    | "mkv"
    | "mov"
    | "avi"
    | "ts"
    | "mpeg"
    | "flv";
const lastType = store.get("录屏.转换.格式") as mimeType;

const audioStreamS = new Map<string, MediaStream>();
let stream: MediaStream;

const sysAudioName = "00";

let rect: [number, number, number, number];

import {
    Output,
    WebMOutputFormat,
    Mp4OutputFormat,
    BufferTarget,
    EncodedVideoPacketSource,
    EncodedPacket,
    EncodedAudioPacketSource,
} from "mediabunny";

// biome-ignore format:
const spawn = require("node:child_process").spawn as typeof import("child_process").spawn;
const fs = require("node:fs") as typeof import("fs");
const os = require("node:os") as typeof import("os");
const path = require("node:path") as typeof import("path");
import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import type { IconType } from "../../iconTypes";
import { typedEntries } from "../../../lib/utils";
let pathToFfmpeg = "ffmpeg";
if (process.platform === "win32" || process.platform === "darwin") {
    const p = path.join(__dirname, "..", "..", "lib", "ffmpeg");
    const n = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    pathToFfmpeg = path.join(p, n);
}
// todo 在导出检测
const start = spawn(pathToFfmpeg, ["-version"]);
start.on("error", () => {
    const m =
        process.platform === "linux"
            ? t("请安装FFmpeg，并确保软件可使用ffmpeg命令")
            : t("请重新安装软件，或进行反馈");
    renderSend("dialogMessage", [
        {
            message: `${t("FFmpeg用于处理视频，但现在软件无法使用它")}\n${m}`,
            buttons: [t("取消")],
        },
    ]);
});
console.log(pathToFfmpeg);

function cameraStreamF(b: boolean) {
    renderSend("recordCamera", [b]);
}

/** 通过绝对时间设定视频和其相对时间 */
function setPlayT(time: Milliseconds) {
    videoEl.currentTime = msToS(time);
}

function getAudioNames() {
    const names = Array.from(audioStreamS.keys());
    if (recordSysAudio) names.push(sysAudioName);
    return names;
}

function showControl() {
    playEl.sv(true);
    if (cameraEl.gv) cameraStreamF(false);
    settingEl.style({ display: "none" });
    mEl.style({ backgroundColor: cssColor.bg });
    videoPEl.style({ transform: "" });
    saveEl.el.disabled = false;
    renderSend("windowMax", []);
}

function getAvailableDuration() {
    return (jdtEl.gv.max -
        (jdtEl.gv.startTrim + jdtEl.gv.endTrim)) as Milliseconds;
}

function clipV() {
    tStartEl.sv(milliseconds(0));
    tEndEl.sv(milliseconds(0));

    tTEl.sv(tFormat(getAvailableDuration()));
    tNtEl.sv(tFormat(milliseconds(0)));
}

function tFormat(x: Milliseconds) {
    const t = x;
    const s = Math.trunc(t / 1000);
    const m = Math.trunc(s / 60);
    const h = Math.trunc(m / 60);
    return `${h === 0 ? "" : `${h}:`}${m - 60 * h}:${String(s - 60 * m).padStart(2, "0")}.${String(
        t % 1000,
    ).slice(0, 1)}`;
}

function videoPlay() {
    setPlayT(tStartEl.gv);
    videoEl.play();
}

/**
 * 对首个GOP进行重新解码编码，实现精确剪辑
 * @param gopChunks GOP内所有chunk
 * @param startUs 剪辑起始时间（微秒）
 * @param decoderConfig 解码器配置
 * @returns 重新编码后的chunk数组
 */
async function reencodeGopForStart(
    gopChunks: EncodedVideoChunk[],
    startUs: Microseconds,
    decoderConfig: VideoDecoderConfig,
): Promise<EncodedVideoChunk[]> {
    // 解码GOP所有chunk
    const frames: VideoFrame[] = [];
    // todo ai 说这样写promise就这样吧，以后在处理
    await new Promise<void>((resolve) => {
        const decoder = new VideoDecoder({
            output: (frame) => frames.push(frame),
            error: (e) => console.error("GOP解码错误", e),
        });
        decoder.configure(decoderConfig);
        for (const chunk of gopChunks) decoder.decode(chunk);
        decoder.flush().then(resolve);
    });
    // 只保留 timestamp >= startUs 的帧
    const filteredFrames = frames.filter(
        (f) => (f.timestamp as Microseconds) >= startUs,
    );
    // 重新编码
    const encoded: EncodedVideoChunk[] = [];
    await new Promise<void>((resolve) => {
        const encoder = new VideoEncoder({
            output: (chunk) => encoded.push(chunk),
            error: (e) => console.error("GOP编码错误", e),
        });
        encoder.configure({
            ...decoderConfig,
            width: filteredFrames[0]?.displayWidth ?? 1280,
            height: filteredFrames[0]?.displayHeight ?? 720,
        });
        for (const frame of filteredFrames) encoder.encode(frame);
        encoder.flush().then(resolve);
    });
    for (const f of frames) f.close();
    return encoded;
}

async function clipVideoData(
    data: VideoData,
    start: Milliseconds,
    end: Milliseconds,
) {
    // 视频部分：只保留涉及的GOP（关键帧及其后续帧）
    const videoChunks = data.video;
    // 找到起始关键帧
    const startUs = msToUs(start);
    const endUs = msToUs(end);
    let startIdx = 0;
    let endIdx = videoChunks.length - 1;
    for (let i = 0; i < videoChunks.length; i++) {
        const chunk = videoChunks[i];
        if (chunk.timestamp >= startUs && chunk.type === "key") {
            startIdx = i;
            break;
        }
    }
    for (let i = startIdx; i < videoChunks.length; i++) {
        const chunk = videoChunks[i];
        if (chunk.timestamp > endUs && chunk.type === "key") {
            endIdx = i - 1;
            break;
        }
    }
    // GOP优化：如果 startUs > 第一个关键帧 timestamp，则对首GOP重新解码编码
    let clippedVideo: EncodedVideoChunk[] = [];
    const decoderConfig = {
        codec: "vp8",
        hardwareAcceleration: "no-preference",
    } as const;
    if (startIdx > 0 && startUs > videoChunks[startIdx].timestamp) {
        // 找到首GOP所有chunk
        const gopStart = startIdx;
        let gopEnd = startIdx;
        for (let i = gopStart + 1; i <= endIdx; i++) {
            if (videoChunks[i].type === "key") {
                gopEnd = i - 1;
                break;
            }
            gopEnd = i;
        }
        // 重新解码编码首GOP
        // 注意：此处为异步，需在调用处 await
        // 其余GOP直接保留
        const beforeGop = videoChunks.slice(startIdx, gopEnd + 1);
        // 重新编码首GOP
        const reencoded = await reencodeGopForStart(
            beforeGop,
            startUs,
            decoderConfig,
        );
        clippedVideo = reencoded.concat(
            videoChunks.slice(gopEnd + 1, endIdx + 1),
        );
    } else {
        clippedVideo = videoChunks.slice(startIdx, endIdx + 1);
    }
    // 音频部分：按时间裁剪
    const clippedAudio: EncodedAudioChunk[][] = [];
    for (const trackChunks of data.audio) {
        const arr = trackChunks.filter(
            (chunk) => chunk.timestamp >= startUs && chunk.timestamp <= endUs,
        );
        clippedAudio.push(arr);
    }
    return {
        video: clippedVideo,
        audio: clippedAudio,
    };
}

async function clipAndSave(data: VideoData, filepath: string) {
    // todo
    const rdata = await clipVideoData(
        data,
        milliseconds(tStartEl.gv),
        milliseconds(tEndEl.gv),
    );
    if (格式El.el.gv === "mp4") {
        await saveMp4(rdata, filepath);
    }
}

async function saveMp4(data: VideoData, filepath: string) {
    const exportPath = filepath;
    const output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget(),
    });

    // @ts-expect-error
    const videoSource = new EncodedVideoPacketSource(codec);
    output.addVideoTrack(videoSource, {
        frameRate: srcRate,
    });

    const audioSources: EncodedAudioPacketSource[] = [];
    for (const trackChunks of data.audio) {
        const audioSource = new EncodedAudioPacketSource("opus");
        output.addAudioTrack(audioSource);
        audioSources.push(audioSource);
    }

    await output.start();

    for (const [_, chunk] of data.video.entries()) {
        await videoSource.add(EncodedPacket.fromEncodedChunk(chunk), {
            decoderConfig: {
                ...decoderVideoConfig,
                codedWidth: outputV.width,
                codedHeight: outputV.height,
            },
        });
    }
    for (const trackChunks of data.audio) {
        const audioSource = audioSources.shift()!;
        for (const [_, chunk] of trackChunks.entries()) {
            await audioSource.add(EncodedPacket.fromEncodedChunk(chunk), {});
        }
    }
    await output.finalize();
    const { buffer } = output.target;
    if (buffer) {
        fs.writeFileSync(exportPath, Buffer.from(buffer)); // todo stream
        console.log("saved mp4");
        renderSend("ok_save", [exportPath, true]);
    } else {
        // todo
    }
}

async function save() {
    store.set("录屏.转换.格式", 格式El.el.gv);
    const t = renderSendSync("recordSavePath", [格式El.el.gv]);
    if (t && recordData) {
        clipAndSave(recordData, t);
    }
}

function updataPrEl() {}

function iconEl(src: IconType) {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}
function iconBEl(src: IconType) {
    return button().add(image(getImgUrl(`${src}.svg`), "icon").class("icon"));
}

class time_i extends HTMLElement {
    _value = 0;
    _min = 0;
    _max = Number.POSITIVE_INFINITY;
    // 用函数实现input的+-控件，支持value读写、step/max/min
    _step = 1;
    _inputView = this.createInputView();
    createInputView() {
        const container = document.createElement("span");
        const minus = document.createElement("button");
        minus.textContent = "-";
        const plus = document.createElement("button");
        plus.textContent = "+";
        container.appendChild(minus);
        container.appendChild(plus);
        let _value = this._value;
        let _step = this._step;
        let _max = this._max;
        let _min = this._min;
        const obj = {
            el: container,
            get value() {
                return _value;
            },
            set value(v: number) {
                _value = Math.max(_min, Math.min(_max, Number(v)));
            },
            get step() {
                return _step;
            },
            set step(v: number) {
                _step = Number(v) || 1;
            },
            get max() {
                return _max;
            },
            set max(v: number) {
                _max = Number(v) || 0;
            },
            get min() {
                return _min;
            },
            set min(v: number) {
                _min = Number(v) || 0;
            },
            addEventListener(
                ...args: Parameters<typeof container.addEventListener>
            ) {
                container.addEventListener(...args);
            },
        };
        minus.onclick = () => {
            obj.value = obj.value - obj.step;
            obj.el.dispatchEvent(new Event("input"));
        };
        plus.onclick = () => {
            obj.value = obj.value + obj.step;
            obj.el.dispatchEvent(new Event("input"));
        };
        return obj;
    }

    connectedCallback() {
        const i = document.createElement("span");
        i.classList.add(Class.mono);
        this.appendChild(i);
        i.innerHTML = `<span contenteditable="true"></span>:<span contenteditable="true"></span>:<span contenteditable="true"></span>.<span contenteditable="true"></span>`;
        this._inputView = this.createInputView();
        this.appendChild(this._inputView.el);
        this._inputView.max = this._max;
        this._inputView.min = this._min;
        this._inputView.value = this._value;
        const [h, m, s, ss] = i.querySelectorAll("span");

        h.onfocus = () => {
            this._inputView.step = 3600000;
        };
        m.onfocus = () => {
            this._inputView.step = 60000;
        };
        s.onfocus = () => {
            this._inputView.step = 1000;
        };
        ss.onfocus = () => {
            this._inputView.step = 1;
        };

        h.oninput = () => {
            r(h, "0", Number.POSITIVE_INFINITY);
        };
        m.oninput = () => {
            r(m, "00", 60);
        };
        s.oninput = () => {
            r(s, "00", 60);
        };
        ss.oninput = () => {
            r(ss, "000", 1000);
        };
        /**
         *
         * @param {HTMLSpanElement} el
         * @param {string} dv
         * @param {number} max
         */
        const r = (el: HTMLSpanElement, dv: string, max: number) => {
            if (Number.isNaN(Number(el.innerText))) {
                el.innerText = "";
            } else {
                let tf = false;
                switch (el) {
                    case ss:
                        tf = 0 <= this.n(ss) && this.n(ss) < max;
                        break;
                    case s:
                        tf = 0 <= this.n(s) && this.n(s) < max;
                        break;
                    case m:
                        tf = 0 <= this.n(m) && this.n(m) < max;
                        break;
                    case h:
                        tf = 0 <= this.n(h) && this.n(h) < max;
                        break;
                }
                if (tf) {
                    if (
                        this.sum_value() > this._max ||
                        this.sum_value() < this._min
                    ) {
                        el.innerText = dv;
                        this._inputView.value = this.sum_value();
                    } else {
                        this._value = this.sum_value();
                        this._inputView.value = this.sum_value();
                    }
                } else {
                    el.innerText = dv;
                    this._inputView.value = this.sum_value();
                }
            }
        };

        this._inputView.addEventListener("input", () => {
            this.set_value(this._inputView.value);
            this.dispatchEvent(new Event("input"));
        });
    }

    n(el: HTMLSpanElement) {
        return Number(el.innerText);
    }

    set_value(v: number) {
        this._value = v;
        const tn = v % 1000;
        const sn = Math.trunc(v / 1000);
        const mn = Math.trunc(sn / 60);
        const hn = Math.trunc(mn / 60);
        const [h, m, s, ss] =
            // @ts-ignore
            this.querySelector("span").querySelectorAll("span");
        h.innerText = String(hn);
        m.innerText = String(mn - 60 * hn);
        s.innerText = String(sn - 60 * mn).padStart(2, "0");
        ss.innerText = String(Math.round(tn)).padStart(3, "0");
    }

    sum_value() {
        const [h, m, s, ss] =
            // @ts-ignore
            this.querySelector("span").querySelectorAll("span");
        const [hn, mn, sn, ssn] = [h, m, s, ss].map((v) => this.n(v));
        const v = hn * 3600000 + mn * 60000 + sn * 1000 + ssn;
        return v;
    }

    get value() {
        return this._value;
    }
    set value(v: number) {
        this.set_value(v);
        this.setAttribute("value", String(v));
        if (this._inputView) this._inputView.value = v;
    }
    get max() {
        return this._max;
    }
    set max(x) {
        const v = Number(x) || 0;
        this._max = v;
        this.setAttribute("max", String(v));
        if (this._inputView) this._inputView.max = v;
    }
    get min() {
        return this._min as Milliseconds;
    }
    set min(x) {
        const v = Number(x) || 0;
        this._max = v;
        this.setAttribute("min", String(v));
        if (this._inputView) this._inputView.min = v;
    }
    get gv() {
        return this.value as Milliseconds;
    }
    sv(v: Milliseconds) {
        this.value = v;
    }
    set svc(v: Milliseconds) {
        this.value = v;
    }
}

window.customElements.define("time-i", time_i);

const mEl = view("y")
    .style({
        width: "100vw",
        height: "100vh",
        alignItems: "center",
        overflow: "hidden",
        padding: cssVar("o-padding"),
    })
    .addInto();
const startStop = button()
    .add(iconEl("start_record").style({ filter: "none" }))
    .style({ width: "80px", height: "80px" })
    .on("click", () => {
        if (sS) {
            if (!recordSysAudio) {
                // 下面是用来移除系统音频
                const audioTracks = stream.getAudioTracks();
                for (const i of audioTracks) {
                    i.stop();
                    stream.removeTrack(i);
                }
            }
            for (const a of audioStreamS.values()) {
                for (const i of a.getAudioTracks()) stream.addTrack(i);
            }
            recorder.start();
            startStop
                .clear()
                .add(iconEl("stop_record").style({ filter: "none" }));
            settingEl
                .clear()
                .add([
                    startStop,
                    view("x")
                        .add([timeEl, cancelEl])
                        .style({ alignItems: "center" }),
                ]);
            pTime();
            setInterval(getTime, 500);
            sS = false;
            renderSend("recordStart", []);
        } else {
            stop = true;
            recorder.stop();
            for (const i of stream.getTracks()) {
                i.stop();
            }
            for (const s of audioStreamS.values())
                for (const t of s.getTracks()) {
                    t.stop();
                }

            pTime();
        }
    });

const timeEl = txt().class(Class.mono);
const cancelEl = iconBEl("close").on("click", () => {
    recorder.stop();
    for (const i of stream.getTracks()) {
        i.stop();
    }
    for (const s of audioStreamS.values())
        for (const t of s.getTracks()) {
            t.stop();
        }

    renderSend("recordStop", []);
    renderSend("windowClose", []);
});

const cameraEl = check("camera").on("click", () => {
    try {
        cameraStreamF(cameraEl.gv);
        store.set("录屏.摄像头.开启", cameraEl.gv);
    } catch (e) {
        console.error(e);
    }
});
const micList = view("y");

const 格式El = dynamicSelect();
const types: mimeType[] = [
    "mp4",
    "webm",
    "gif",
    "mkv",
    "mov",
    "ts",
    "mpeg",
    "flv",
];
格式El.setList(types.map((i) => ({ value: i, text: i })));
格式El.el.el.value = lastType;

const settingEl = view("y")
    .style({
        position: "fixed",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: cssColor.bg,
    })
    .class(Class.gap)
    .add([
        startStop,
        view("y")
            .add([
                view("y").add([t("选择输入音频"), micList]),
                view("y").add([t("摄像头"), label([cameraEl, t("开启")])]),
            ])
            .class(Class.gap),
    ])
    .addInto();

const waitTip = ele("dialog")
    .add([
        p(t("等待录屏权限和录音权限获取")),
        p(t("或者在系统设置手动批准权限")),
    ])
    .addInto();
waitTip.el.showModal();

const videoPEl = view("y")
    .style({
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 0,
        minWidth: 0,
    })
    .addInto(mEl);

// WebCodecs 播放器组件
class WebCodecsPlayer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private audioCtx: AudioContext | null = null;
    private videoDecoder: VideoDecoder | null = null;
    private audioDecoders: AudioDecoder[] = [];
    private audioBuffers: AudioBuffer[] = [];
    private audioBufferSource: AudioBufferSourceNode | null = null;
    private videoChunks: EncodedVideoChunk[] = [];
    private audioChunksList: EncodedAudioChunk[][] = [];
    private playing = false;
    private rafId: number | null = null;
    private _duration: Seconds = seconds(0);
    private _currentTime: Seconds = seconds(0);
    private startTime: Milliseconds = milliseconds(0);
    private currentFrameIdx = -1;
    private lastKeyFrameIdx = 0;
    private lastDecodedFrame: VideoFrame | null = null;
    private decodeQueue: number[] = [];
    private isDecoding = false;
    public onended?: () => void;
    public onplay?: () => void;
    public onpause?: () => void;
    public ontimeupdate?: () => void;

    constructor(parent: HTMLElement) {
        this.canvas = document.createElement("canvas");
        this.canvas.style.maxWidth = "100%";
        this.canvas.style.maxHeight = "100%";
        this.ctx = this.canvas.getContext("2d")!;
        parent.appendChild(this.canvas);
    }

    async setVideoData(data: VideoData, width = 1280, height = 720) {
        this.videoChunks = data.video;
        this.audioChunksList = data.audio;
        this.audioBuffers = [];
        this.currentFrameIdx = -1;
        this._currentTime = seconds(0);
        this.canvas.width = width;
        this.canvas.height = height;
        this.lastDecodedFrame?.close();
        this.lastDecodedFrame = null;
        this.decodeQueue = [];
        this.isDecoding = false;
        if (!this.videoDecoder) {
            this.videoDecoder = new VideoDecoder({
                output: (frame) => this.handleDecodedFrame(frame),
                error: (e) => console.error("VideoDecoder error", e),
            });
        }
        this.videoDecoder.configure(decoderVideoConfig);
        await this.decodeAudio();
        if (this.videoChunks.length > 0) {
            const lastChunk = this.videoChunks.at(-1)!;
            this._duration = usToS(lastChunk.timestamp as Microseconds);
        } else {
            this._duration = seconds(0);
        }
    }

    // 按需解码关键帧到目标帧，解码队列驱动
    private handleDecodedFrame(frame: VideoFrame) {
        // 只保留当前帧
        if (this.lastDecodedFrame) this.lastDecodedFrame.close();
        this.lastDecodedFrame = frame;
        this.isDecoding = false;
    }

    private findKeyFrameIdx(idx: number): number {
        for (let i = idx; i >= 0; i--) {
            if (this.videoChunks[i].type === "key") return i;
        }
        return 0;
    }

    /**
     * 连续播放时从上次解码位置继续解码到目标帧，只有seek/跳转时才从关键帧头开始
     */
    private async decodeToFrame(
        idx: number,
        forceFlush = false,
    ): Promise<VideoFrame | null> {
        if (!this.videoChunks.length || !this.videoDecoder) return null;
        this.isDecoding = true;
        let startIdx: number;
        // seek/跳转时，从关键帧头开始
        if (forceFlush) {
            startIdx = this.findKeyFrameIdx(idx);
            // 关闭上一次帧
            if (this.lastDecodedFrame) {
                this.lastDecodedFrame.close();
                this.lastDecodedFrame = null;
            }
            await this.videoDecoder.flush();
        } else {
            // 连续播放时，从上次解码到的位置继续
            startIdx = this.currentFrameIdx;
            // 如果当前帧已经是目标帧，直接返回
            if (startIdx === idx && this.lastDecodedFrame) {
                this.isDecoding = false;
                return this.lastDecodedFrame;
            }
            startIdx++;
        }

        // 依次decode到目标帧
        for (let i = startIdx; i <= idx; i++) {
            this.videoDecoder.decode(this.videoChunks[i]);
        }
        this.isDecoding = false;
        if (!this.lastDecodedFrame) {
            console.warn(`decodeToFrame: 未能解码到目标帧 idx=${idx}`);
            return null;
        }
        return this.lastDecodedFrame;
    }

    private async decodeAudio() {
        if (this.audioChunksList.length === 0) return;
        this.audioBuffers = [];
        this.audioDecoders = [];
        if (!this.audioCtx) {
            this.audioCtx = new (
                window.AudioContext ||
                (
                    window as unknown as {
                        webkitAudioContext: typeof AudioContext;
                    }
                ).webkitAudioContext
            )();
        }
        // 只处理第一轨道
        const chunks = this.audioChunksList[0];
        const audioFrames: AudioData[] = [];
        await new Promise<void>((resolve) => {
            const decoder = new AudioDecoder({
                output: (frame: AudioData) => {
                    audioFrames.push(frame);
                },
                error: (e) => console.error("AudioDecoder error", e),
            });
            decoder.configure({
                codec: "opus",
                sampleRate: 48000,
                numberOfChannels: 2,
            });
            for (const chunk of chunks) {
                decoder.decode(chunk);
            }
            decoder.flush().then(resolve);
        });
        // 合并所有 AudioData 为一个 AudioBuffer
        if (audioFrames.length > 0) {
            const sampleRate = audioFrames[0].sampleRate;
            const channels = audioFrames[0].numberOfChannels;
            let totalLength = 0;
            for (const frame of audioFrames) {
                totalLength += frame.numberOfFrames;
            }
            const audioBuffer = this.audioCtx.createBuffer(
                channels,
                totalLength,
                sampleRate,
            );
            let offset = 0;
            for (const frame of audioFrames) {
                const frameChannels = Math.min(
                    frame.numberOfChannels,
                    audioBuffer.numberOfChannels,
                );
                for (let ch = 0; ch < frameChannels; ch++) {
                    let tmp: Float32Array;
                    try {
                        tmp = new Float32Array(frame.numberOfFrames);
                        frame.copyTo(tmp, { planeIndex: ch });
                        audioBuffer
                            .getChannelData(ch)
                            .set(tmp.subarray(0, frame.numberOfFrames), offset);
                    } catch {}
                }
                offset += frame.numberOfFrames;
            }
            this.audioBuffers = [audioBuffer];
        }
    }

    private pnow() {
        return performance.now() as Milliseconds;
    }

    private clamp<T extends number>(v: T, min: T, max: T) {
        return Math.max(min, Math.min(v, max)) as T;
    }

    private mathSub<T extends number>(a: T, b: T) {
        return (a - b) as T;
    }

    play() {
        if (this.playing) return;
        this.playing = true;
        this.startTime = this.mathSub(this.pnow(), sToMs(this._currentTime));
        // 音频播放
        if (this.audioBuffers.length > 0 && this.audioCtx) {
            if (this.audioBufferSource) {
                this.audioBufferSource.stop();
            }
            this.audioBufferSource = this.audioCtx.createBufferSource();
            this.audioBufferSource.buffer = this.audioBuffers[0];
            this.audioBufferSource.connect(this.audioCtx.destination);
            this.audioBufferSource.start(0, this._currentTime);
            this.audioBufferSource.onended = () => {
                this.pause();
                this.onended?.();
            };
        }
        this.rafId = requestAnimationFrame(() => this.renderLoop());
        this.onplay?.();
    }

    pause() {
        this.playing = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        if (this.audioBufferSource) {
            this.audioBufferSource.stop();
            this.audioBufferSource.disconnect();
            this.audioBufferSource = null;
        }
        this.onpause?.();
    }
    seek(time: Seconds) {
        // time 单位秒
        this._currentTime = this.clamp(time, seconds(0), this._duration);
        if (this.playing) {
            this.pause();
            this.play();
        } else {
        }
        this.renderFrame(true);
        this.currentFrameIdx = this.findFrameByTime(this._currentTime);
        this.ontimeupdate?.();
    }

    get duration() {
        return this._duration;
    }

    get currentTime(): Seconds {
        if (this.playing) {
            return msToS(this.mathSub(this.pnow(), this.startTime));
        }
        return this._currentTime;
    }
    set currentTime(t: Seconds) {
        this.seek(t);
    }

    private findFrameByTime(time: Seconds): number {
        // 输入秒，帧 timestamp 是微秒
        const us = sToUs(time);
        for (let i = 0; i < this.videoChunks.length; i++) {
            if (this.videoChunks[i].timestamp >= us) {
                return i;
            }
        }
        return this.videoChunks.length - 1;
    }

    // 视频帧渲染主循环
    private async renderLoop() {
        if (!this.playing) return;
        const now: Seconds = msToS(this.mathSub(this.pnow(), this.startTime));
        this.ontimeupdate?.();
        if (now >= this._duration) {
            this.pause();
            this.onended?.();
            return;
        }
        const idx = this.findFrameByTime(now);
        // 连续播放时不强制flush
        const frame = await this.decodeToFrame(idx, false);
        if (frame) {
            this.ctx.drawImage(
                frame,
                0,
                0,
                this.canvas.width,
                this.canvas.height,
            );
        }
        this.currentFrameIdx = idx;
        this.rafId = requestAnimationFrame(() => this.renderLoop());
    }

    // 兼容 seek/暂停时的单帧渲染
    private async renderFrame(force = false) {
        if (!this.playing && !force) return;
        const now: Seconds = this._currentTime;
        const idx = this.findFrameByTime(now);
        // seek/跳转时强制flush
        const frame = await this.decodeToFrame(idx, true);
        if (frame) {
            this.ctx.drawImage(
                frame,
                0,
                0,
                this.canvas.width,
                this.canvas.height,
            );
        }
        this.currentFrameIdx = idx;
    }
}

const videoEl = new WebCodecsPlayer(videoPEl.el);

videoEl.onpause = () => {
    playEl.sv(true);
};
videoEl.onplay = () => {
    playEl.sv(false);
};

videoEl.ontimeupdate = () => {
    tNtEl.sv(tFormat(sToMs(seconds(videoEl.currentTime))));
    jdtEl.sv({ value: sToMs(seconds(videoEl.currentTime)) });
};

videoEl.onended = () => {
    tNtEl.sv(tTEl.gv);
    jdtEl.sv({ value: jdtEl.gv.max });
};

// 相关方法适配
async function setVideo(videoData: VideoData) {
    await videoEl.setVideoData(videoData);
    jdtEl.sv({ max: sToMs(videoEl.duration), value: milliseconds(0) });
}

const sEl = view("y")
    .class(Class.smallSize)
    .class(Class.gap)
    .class()
    .style({ flexShrink: 0 })
    .addInto(mEl);

const jdtEl = (<T = Milliseconds>() => {
    const v = {
        max: 0,
        startTrim: 0,
        endTrim: 0,
        value: 0,
    };

    function limit(n: number) {
        return Math.max(
            0 + v.startTrim,
            Math.min(n, Number(v.max - v.endTrim)),
        );
    }
    function inputEvent() {
        el.el.dispatchEvent(new Event("input"));
    }

    const el = view()
        .style({
            position: "relative",
            height: "18px",
            width: "100%",
            overflow: "hidden",
        })
        .class(Class.deco);
    const startRm = view()
        .style({
            position: "absolute",
            height: "100%",
            backgroundColor: "black",
            left: 0,
            top: 0,
            pointerEvents: "none",
            borderRadius: cssVar("o-padding"),
        })
        .bindSet((n: number, el) => {
            const p = (n / v.max) * 100;
            el.style.width = `${p}%`;
        });
    const endRm = view()
        .style({
            position: "absolute",
            height: "100%",
            backgroundColor: "black",
            right: 0,
            top: 0,
            pointerEvents: "none",
            borderRadius: cssVar("o-padding"),
        })
        .bindSet((n: number, el) => {
            const p = (n / v.max) * 100;
            el.style.width = `${p}%`;
        });
    const nowPoint = view()
        .style({
            position: "absolute",
            height: "100%",
            width: "2px",
            backgroundColor: "red",
            pointerEvents: "none",
        })
        .bindSet((n: number, el) => {
            const p = (n / v.max) * 100;
            el.style.left = `calc(${p}% - 1px)`;
        });

    el.add([startRm, endRm, nowPoint]);

    trackPoint(el, {
        start: (e) => {
            return { data: { value: v.value }, x: 0, y: 0 };
        },
        ing: (p, _, { startData: { value } }) => {
            const n = limit((p.x / el.el.clientWidth) * v.max + value);
            nowPoint.sv(n);
            v.value = n;
            inputEvent();
        },
        end: (e, { moved }) => {
            if (!moved) {
                const x = e.clientX - el.el.getBoundingClientRect().left;
                const n = limit((x / el.el.clientWidth) * v.max);
                v.value = n;
                nowPoint.sv(n);
                inputEvent();
            }
        },
    });

    return el
        .bindGet(() => ({
            max: v.max as T,
            startTrim: v.startTrim as T,
            endTrim: v.endTrim as T,
            value: v.value as T,
        }))
        .bindSet(
            (nv: {
                max?: T;
                value?: T;
                startTrim?: T;
                endTrim?: T;
            }) => {
                if (nv.max !== undefined) {
                    v.max = nv.max as number;
                    const n = limit(v.value);
                    nowPoint.sv(n);
                }
                if (nv.value !== undefined) {
                    v.value = limit(nv.value as number);
                    nowPoint.sv(v.value);
                }
                if (nv.startTrim !== undefined) {
                    v.startTrim = nv.startTrim as number;
                    startRm.sv(v.startTrim);
                    const n = limit(v.value);
                    nowPoint.sv(n);
                }
                if (nv.endTrim !== undefined) {
                    v.endTrim = nv.endTrim as number;
                    endRm.sv(v.endTrim);
                    const n = limit(v.value);
                    nowPoint.sv(n);
                }
            },
        );
})().on("input", () => {
    setPlayT(jdtEl.gv.value);
});

const tStartEl = document.createElement("time-i") as time_i;
const tNtEl = txt();
const tTEl = txt();
const tEndEl = document.createElement("time-i") as time_i;

tStartEl.oninput = () => {
    const t = tStartEl.gv;
    videoEl.currentTime = msToS(t);
    tEndEl.max = jdtEl.gv.max;
    jdtEl.sv({ startTrim: t });
    tTEl.sv(tFormat(getAvailableDuration()));
};
tEndEl.oninput = () => {
    const t = tEndEl.gv;
    videoEl.currentTime = mathSub(videoEl.duration, msToS(t));
    tStartEl.max = jdtEl.gv.max;
    jdtEl.sv({ endTrim: t });
    tTEl.sv(tFormat(getAvailableDuration()));
};

const playEl = check("play", [iconEl("recume"), iconEl("pause")])
    .style({
        display: "inline-flex",
    })
    .on("change", () => {
        if (playEl.gv) {
            videoEl.pause();
        } else {
            videoPlay();
        }
    });

const saveEl = iconBEl("save")
    .attr({ disabled: true })
    .on("click", () => save());

const proEl = (id: string) => view().add(view());

const prTs = proEl("ts");

updataPrEl();

sEl.add([
    jdtEl,
    view("x")
        .class(Class.gap)
        .style({ alignItems: "center" })
        .add([
            t("裁切头："),
            tStartEl,
            tNtEl.class(Class.mono),
            txt(" / ").class(Class.mono),
            tTEl.class(Class.mono),
            playEl,
            t("裁切尾："),
            tEndEl,
        ]),
    view("x").class(Class.gap).add([saveEl, 格式El.el, prTs]),
]);

const devices = await navigator.mediaDevices.enumerateDevices();
const audioL = devices.filter((i) => i.kind === "audioinput");
const canSysAudio = store.get("录屏.音频.启用系统内录");
if (canSysAudio)
    micList.add(
        label([check(""), t("系统音频")])
            .on("input", (_, el) => {
                recordSysAudio = el.gv;
                store.set("录屏.音频.设备列表", getAudioNames());
            })
            .sv(store.get("录屏.音频.设备列表").includes(sysAudioName)),
    );

const audioRmb = store.get("录屏.音频.设备列表");

let recordSysAudio = audioRmb.includes(sysAudioName);

for (const i of audioL) {
    const el = label([check(""), i.label || i.deviceId]).sv(
        audioRmb.includes(i.deviceId),
    );
    set(el.gv);
    async function set(v: boolean) {
        if (v) {
            const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: i.deviceId },
                video: false,
            });
            audioStreamS.set(i.deviceId, audioStream);
        } else {
            const s = audioStreamS.get(i.deviceId);
            if (s) {
                for (const t of s.getTracks()) {
                    t.stop();
                }
            }
            audioStreamS.delete(i.deviceId);
        }
    }
    el.on("input", async () => {
        await set(el.gv);
        store.set("录屏.音频.设备列表", getAudioNames());
    });
    micList.add(el);
}
if (!canSysAudio && audioL.length === 0) {
    micList.add(t("无音频输入设备"));
}

if (store.get("录屏.摄像头.开启")) {
    try {
        cameraStreamF(true);
        cameraEl.sv(true);
    } catch (e) {
        console.error(e);
    }
}

const [codec, isDeAcc, isEnAcc] = ["vp8", false, false];
const decoderVideoConfig = {
    codec: codec,
    hardwareAcceleration: isDeAcc ? "prefer-hardware" : "no-preference",
} as const;
const encoderVideoConfig = {
    codec: codec,
    hardwareAcceleration: isEnAcc ? "prefer-hardware" : "no-preference",
} as const;
const baseCodec = "vp8";

const outputV = {
    width: 1280,
    height: 720,
};

const srcRate = store.get("录屏.转换.帧率");
const bitrate = store.get("录屏.转换.码率") * 1024 * 1024;

renderOn("recordInit", async ([sourceId, r, screen_w, screen_h]) => {
    waitTip.remove();
    rect = r;
    sS = true;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: canSysAudio // 可能会导致应用崩溃，所以添加这个设置
                ? {
                      // @ts-ignore
                      mandatory: {
                          chromeMediaSource: "desktop",
                      },
                  }
                : false,
            video: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: "desktop",
                    chromeMediaSourceId: sourceId,
                    minWidth: screen_w,
                    minHeight: screen_h,
                },
            },
        });
    } catch (e) {
        console.error(e);
    }
    if (!stream) return;

    const chunks: VideoData = {
        video: [],
        audio: [],
    };

    outputV.width = r[2];
    outputV.height = r[3];

    const videoTrack = stream.getVideoTracks()[0];
    const videoWidth = videoTrack.getSettings().width ?? screen.width;
    const videoHeight = videoTrack.getSettings().height ?? screen.height;
    recorder = new WebCodecsRecorder(
        stream,
        {
            ...encoderVideoConfig,
            width: videoWidth,
            height: videoHeight,
            framerate: srcRate,
            bitrate: bitrate,
        },
        { codec: "opus", sampleRate: 48000, numberOfChannels: 2 },
        r,
    );
    recorder.ondataavailable = (e) => {
        chunks.video = e.video;
        chunks.audio = e.audio;
    };
    const fileName = String(Date.now());
    tmpPath = path.join(os.tmpdir(), "eSearch/", fileName);
    output = path.join(tmpPath, "output");

    async function stopRecord() {
        showControl();
        await setVideo(chunks);
        recordData = chunks;
        clipV();
    }

    recorder.onstop = () => {
        renderSend("recordStop", []);
        stopRecord();
    };

    if (store.get("录屏.自动录制") === true) {
        let t = store.get("录屏.自动录制延时");
        function d() {
            if (recorder.state !== "inactive") return;
            setTime(String(t));
            setTimeout(() => {
                if (t === 0) {
                    startStop.el.click();
                } else {
                    t--;
                    d();
                }
            }, 1000);
        }
        d();
    }
});

renderOn("recordStartStop", () => {
    startStop.el.click();
});

renderOn("recordState", ([s]) => {
    if (s === "stop") {
        startStop.el.click();
    } else if (s === "pause") {
        if (recorder.state === "inactive") return;
        if (recorder.state === "recording") {
            recorder.pause();
            pTime();
        } else if (recorder.state === "paused") {
            recorder.resume();
            pTime();
        }
    }
});

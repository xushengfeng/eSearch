/// <reference types="vite/client" />

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
import { initStyle, getImgUrl, setTitle, Class, cssColor } from "../root/root";
import {
    button,
    check,
    dynamicSelect,
    ele,
    image,
    input,
    label,
    p,
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
let type = store.get("录屏.转换.格式") as mimeType;

const audioStreamS = new Map<string, MediaStream>();
let stream: MediaStream;

const sysAudioName = "00";

let rect: [number, number, number, number];

// biome-ignore format:
const spawn = require("node:child_process").spawn as typeof import("child_process").spawn;
const fs = require("node:fs") as typeof import("fs");
const os = require("node:os") as typeof import("os");
const path = require("node:path") as typeof import("path");
import { renderOn, renderSend } from "../../../lib/ipc";
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

function resize() {
    const p = {
        h: videoPEl.el.offsetHeight,
        w: videoPEl.el.offsetWidth,
    };
    const c = {
        h: vpEl.el.offsetHeight,
        w: vpEl.el.offsetWidth,
    };
    const k0 = p.h / p.w;
    const k1 = c.h / c.w;
    if (k0 >= k1) {
        console.log(p.w, c.w);
        // @ts-ignore
        vpEl.el.style.zoom = p.w / c.w;
    } else {
        // @ts-ignore
        vpEl.el.style.zoom = p.h / c.h;
    }
}

/** 通过绝对时间设定视频和其相对时间 */
function setPlayT(time: number) {
    videoEl.currentTime = time / 1000;
}

function getAudioNames() {
    const names = Array.from(audioStreamS.keys());
    if (recordSysAudio) names.push(sysAudioName);
    return names;
}

function showControl() {
    playEl.sv(true);
    if (cameraEl.gv) cameraStreamF(false);
    sEl.class("s_show");
    settingEl.style({ display: "none" });
    mEl.style({ backgroundColor: cssColor.bg });
    videoPEl.style({ transform: "" });
    segEl.remove();
    vpEl.style({
        width: `${rect[2]}px`,
        minWidth: `${rect[2]}px`,
        height: `${rect[3]}px`,
        minHeight: `${rect[3]}px`,
    });
    saveEl.el.disabled = false;
    renderSend("windowMax", []);

    setTimeout(() => {
        resize();
        mEl.style({ transition: "none" });
    }, 400);
}

function clipV() {
    tStartEl.sv(0);
    setEnd();

    tTEl.sv(tFormat(tEndEl.gv - tStartEl.gv));
    tNtEl.sv(tFormat(0));
}

/**
 *
 * @param x 输入秒
 */
function tFormat(x: number) {
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

function joinAndSave(data: VideoData, filepath: string) {
    // todo
}

async function save() {
    store.set("录屏.转换.格式", 格式El.el.gv);
    renderSend("recordSavePath", [type]); // todo 可以使用promise控制流程
}

const prText = {
    wait: {
        ts: "等待转换",
        clip: "等待裁剪",
        join: "等待合并",
    },
    running: {
        ts: "正在转换",
        clip: "正在裁剪",
        join: "正在合并",
    },
    ok: {
        ts: "转换完成",
        clip: "裁剪完成",
        join: "合并完成",
    },
    error: {
        ts: "转换失败",
        clip: "裁剪失败",
        join: "合并失败",
    },
};

for (const [_, v] of typedEntries(prText)) {
    for (const [j] of typedEntries(v)) {
        v[j] = t(v[j]);
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
    _max = 0;
    input = document.createElement("input");

    connectedCallback() {
        this._value = Number(this.getAttribute("value")) || 0;
        this._min = Number(this.getAttribute("min")) || 0;
        this._max = Number(this.getAttribute("max")) || 0;
        const i = document.createElement("span");
        this.appendChild(i);
        i.innerHTML = `<span contenteditable="true"></span>:<span contenteditable="true"></span>:<span contenteditable="true"></span>.<span contenteditable="true"></span>`;
        const 加减 = this.input;
        加减.type = "number";
        this.appendChild(加减);
        加减.max = this._max.toString();
        加减.min = this._min.toString();
        加减.value = this._value.toString();
        const [h, m, s, ss] = i.querySelectorAll("span");

        h.onfocus = () => {
            加减.step = "3600000";
        };
        m.onfocus = () => {
            加减.step = "60000";
        };
        s.onfocus = () => {
            加减.step = "1000";
        };
        ss.onfocus = () => {
            加减.step = "1";
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
                        加减.value = this.sum_value().toString();
                    } else {
                        this._value = this.sum_value();
                        加减.value = this.sum_value().toString();
                    }
                } else {
                    el.innerText = dv;
                    加减.value = this.sum_value().toString();
                }
            }
        };

        加减.oninput = () => {
            this.set_value(Number(加减.value));
            this.dispatchEvent(new Event("input"));
        };
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
        this.input.value = v.toString();
    }
    get max() {
        return this._max;
    }
    set max(x) {
        const v = Number(x) || 0;
        this._max = v;
        this.setAttribute("max", String(v));
        this.input.max = v.toString();
    }
    get min() {
        return this._min;
    }
    set min(x) {
        const v = Number(x) || 0;
        this._max = v;
        this.setAttribute("min", String(v));
        this.input.min = v.toString();
    }
    get gv() {
        return this.value;
    }
    sv(v: number) {
        this.value = v;
    }
    set svc(v: number) {
        this.value = v;
    }
}

window.customElements.define("time-i", time_i);

const mEl = view().attr({ id: "m" }).addInto();
const startStop = button()
    .add(iconEl("start_record").style({ filter: "none" }))
    .attr({ id: "start_stop" })
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
            格式El.el.style({ display: "none" });
            type = 格式El.el.gv as mimeType;
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

const cameraEl = check("camera")
    .attr({ id: "camera" })
    .on("click", () => {
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
格式El.el.el.value = type;

const settingEl = view("y")
    .style({
        position: "fixed",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
    })
    .class(Class.gap)
    .add([
        startStop,
        view("y")
            .add([
                view("y").add([t("格式"), 格式El.el]),
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

const videoPEl = view().attr({ id: "video" }).addInto(mEl);
const vpEl = view().attr({ id: "v_p" }).addInto(videoPEl);

// WebCodecs 播放器组件
class WebCodecsPlayer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private audioCtx: AudioContext | null = null;
    private videoDecoder: VideoDecoder | null = null;
    private audioDecoders: AudioDecoder[] = [];
    private videoFrames: VideoFrame[] = [];
    private audioBuffers: AudioBuffer[] = [];
    private audioBufferSource: AudioBufferSourceNode | null = null;
    private videoChunks: EncodedVideoChunk[] = [];
    private audioChunksList: EncodedAudioChunk[][] = [];
    private playing = false;
    private currentFrame = 0;
    private rafId: number | null = null;
    private _duration: Seconds = seconds(0);
    private _currentTime: Seconds = seconds(0);
    private startTime: Milliseconds = milliseconds(0);
    public onended?: () => void;

    constructor(parent: HTMLElement) {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d")!;
        parent.appendChild(this.canvas);
    }

    async setVideoData(data: VideoData, width = 1280, height = 720) {
        this.videoChunks = data.video;
        this.audioChunksList = data.audio;
        this.videoFrames = [];
        this.audioBuffers = [];
        this.currentFrame = 0;
        this._currentTime = seconds(0);
        this.canvas.width = width;
        this.canvas.height = height;
        // 解码视频
        await this.decodeVideo(width, height);
        // 解码音频
        await this.decodeAudio();
        // duration 统一为秒
        this._duration =
            this.videoFrames.length > 0
                ? usToS(this.videoFrames.at(-1)!.timestamp as Microseconds)
                : seconds(0);
    }

    private async decodeVideo(width: number, height: number) {
        return new Promise<void>((resolve) => {
            this.videoFrames = [];
            this.videoDecoder = new VideoDecoder({
                output: (frame) => {
                    this.videoFrames.push(frame);
                },
                error: (e) => console.error("VideoDecoder error", e),
            });
            this.videoDecoder.configure(decoderVideoConfig);
            for (const chunk of this.videoChunks) {
                this.videoDecoder.decode(chunk);
            }
            this.videoDecoder.flush().then(resolve);
        });
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
        // 启动视频帧渲染循环
        this.renderLoop();
    }

    pause() {
        this.playing = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
        if (this.audioBufferSource) {
            this.audioBufferSource.stop();
            this.audioBufferSource.disconnect();
            this.audioBufferSource = null;
        }
    }
    seek(time: Seconds) {
        // time 单位秒
        this._currentTime = this.clamp(time, seconds(0), this._duration);

        // 找到对应帧
        this.currentFrame = this.findFrameByTime(this._currentTime);
        console.log(time, this.currentFrame);
        if (this.playing) {
            this.pause();
            this.play();
        } else {
            this.renderFrame(true);
        }
    }

    get duration(): number {
        return this._duration;
    }

    get currentTime(): number {
        if (this.playing) {
            return msToS(this.mathSub(this.pnow(), this.startTime));
        }
        return this._currentTime;
    }
    set currentTime(t: number) {
        this.seek(t as Seconds);
    }

    private findFrameByTime(time: Seconds): number {
        // 输入秒，帧 timestamp 是微秒
        const us = sToUs(time);
        for (let i = 0; i < this.videoFrames.length; i++) {
            if ((this.videoFrames[i].timestamp as Microseconds) >= us) {
                return i;
            }
        }
        return this.videoFrames.length - 1;
    }

    // 视频帧渲染主循环
    private renderLoop() {
        if (!this.playing) return;
        const now: Seconds = msToS(this.mathSub(this.pnow(), this.startTime));
        if (now >= this._duration) {
            this.pause();
            this.onended?.();
            return;
        }
        const idx = this.findFrameByTime(now);
        const frame = this.videoFrames[idx];
        if (frame) {
            this.ctx.drawImage(
                frame,
                0,
                0,
                this.canvas.width,
                this.canvas.height,
            );
        }
        this.currentFrame = idx;
        this.rafId = requestAnimationFrame(() => this.renderLoop());
    }

    // 兼容 seek/暂停时的单帧渲染
    private renderFrame(force = false) {
        if (!this.playing && !force) return;
        const now: Seconds = this._currentTime;
        const idx = this.findFrameByTime(now);
        const frame = this.videoFrames[idx];
        if (frame) {
            this.ctx.drawImage(
                frame,
                0,
                0,
                this.canvas.width,
                this.canvas.height,
            );
        }
        this.currentFrame = idx;
    }
}

const segEl = view().attr({ id: "seg" }).addInto(vpEl);

// 替换 videoEl 为 WebCodecsPlayer
const videoEl = new WebCodecsPlayer(vpEl.el);

// 相关方法适配
async function setVideo(videoData: VideoData) {
    await videoEl.setVideoData(videoData);
}

const sEl = view().attr({ id: "s" }).class(Class.smallSize).addInto(mEl);

const jdtEl = input("range")
    .attr({ id: "jdt" })
    .bindGet((el) => Number(el.value))
    .bindSet((v: number, el) => {
        el.value = String(v);
    })
    .on("input", () => {
        setPlayT(jdtEl.gv);
    });

const tStartEl = document.createElement("time-i") as time_i;
tStartEl.id = "t_start";
const tNtEl = txt()
    .attr({ id: "t_nt" })
    .bindSet((v: string, el) => {
        el.innerText = v;
    });
const tTEl = txt()
    .attr({ id: "t_t" })
    .bindSet((v: string, el) => {
        el.innerText = v;
        el.setAttribute("t", v);
    })
    .bindGet((el) => {
        return el.getAttribute("t") ?? "";
    });
const tEndEl = document.createElement("time-i") as time_i;
tEndEl.id = "t_end";

tStartEl.oninput = () => {
    const t = tStartEl.gv / 1000;
    videoEl.currentTime = tEndEl.min = t;
    jdtEl.el.min = String(t);
    tTEl.sv(tFormat(tEndEl.gv - tStartEl.gv));
};
tEndEl.oninput = () => {
    const t = tEndEl.gv / 1000;
    videoEl.currentTime = tStartEl.max = t;
    jdtEl.el.max = String(t);
    tTEl.sv(tFormat(tEndEl.gv - tStartEl.gv));
};

const playEl = check("play", [iconEl("recume"), iconEl("pause")])
    .attr({ id: "v_play" })
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
const setEndEl = iconBEl("right").attr({ id: "b_t_end" }).on("click", setEnd);

function setEnd() {
    const max = videoEl.duration * 1000;
    jdtEl.attr({ max: String(max) });
    tEndEl.svc = tStartEl.max = tEndEl.max = max;
}

const saveEl = iconBEl("save")
    .attr({ id: "save", disabled: true })
    .on("click", () => save());

const proEl = (id: string) =>
    view()
        .class("pro_p")
        .add(
            view()
                .class("pro")
                .attr({ id: `pr_${id}` }),
        );

const prTs = proEl("ts");

updataPrEl();

sEl.add([
    jdtEl,
    ele("br"),
    t("开始时间："),
    tStartEl,
    tNtEl,
    " / ",
    tTEl,
    playEl,
    t("结束时间："),
    tEndEl,
    setEndEl,
    saveEl,
    prTs,
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

document.body.onresize = resize;

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

renderOn("recordSavePathReturn", ([arg]) => {});

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

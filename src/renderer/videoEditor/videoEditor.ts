import {
    type ElType,
    addClass,
    button,
    check,
    dynamicSelect,
    ele,
    frame,
    image,
    input,
    label,
    pack,
    select,
    spacer,
    trackPoint,
    txt,
    view,
} from "dkh-ui";
import store from "../../../lib/store/renderStore";
import {
    Class,
    cssColor,
    cssVar,
    getImgUrl,
    initStyle,
    setTitle,
} from "../root/root";

// biome-ignore format:
const { uIOhook, UiohookKey } = require("uiohook-napi") as typeof import("uiohook-napi");
type KeyCode = `${keyof typeof UiohookKey}`;
const fs = require("node:fs") as typeof import("fs");

import UPNG from "@pdf-lib/upng";
// @ts-expect-error
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import {
    AudioBufferSource,
    type AudioCodec,
    BufferTarget,
    EncodedPacket,
    EncodedVideoPacketSource,
    Mp4OutputFormat,
    Output,
    type OutputFormat,
    WebMOutputFormat,
    getFirstEncodableAudioCodec,
} from "mediabunny";

import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import { t } from "../../../lib/translate/translate";
import { typedEntries } from "../../../lib/utils";
import type { IconType } from "../../iconTypes";
import floydSteinberg from "../lib/dither";
import xhistory from "../lib/history";
import {
    type SrcAudio,
    audioCapture,
    buildTransAudio,
    sysAudioId,
} from "./audio";

initStyle(store);

setTitle(t("超级录屏"));

type superRecording = {
    time: number;
    isStart?: boolean;
    posi: { x: number; y: number };
    mousedown?: 0 | 1 | 2;
    mouseup?: 0 | 1 | 2;
    wheel?: boolean;
    keydown?: KeyCode;
    keyup?: KeyCode;
    wFoucus?: true;
    wBlur?: true;
}[];

type clip = {
    i: SrcId;
    rect: { x: number; y: number; w: number; h: number };
    transition: number; // 往前数
};

type uiData = {
    clipList: clip[];
    // [start, end]闭区间
    speed: { start: SrcId; end: SrcId; value: number }[];
    eventList: { start: SrcId; end: SrcId; value: unknown }[]; // todo
    remove: { start: SrcId; end: SrcId }[];
};

type FrameX = {
    rect: { x: number; y: number; w: number; h: number };
    timestamp: number;
    isKey?: true;
    event: unknown[];
    isRemoved: boolean;
};

type SrcId = number & { readonly __tag: unique symbol };
type TransId = number & { readonly __tag: unique symbol };

type baseType = (typeof outputType)[number]["type"];

const testMode: "getFrame" | "history" | false = false;

const sourceIdPromise = Promise.withResolvers<string>();

const zeroPoint = [0, 0] as const;

let lastUiData: uiData | null = null;
const lastTransOpt: { codec: string; size: string } = {
    codec: "",
    size: "0x0",
};

let lastEncodedChunks: (EncodedVideoChunk | null)[] = [];

/** 录制得到的音频，见 docs/develop/superRecorderAudio.md */
let srcAudio: SrcAudio | null = null;
/** 变换后的音频，与 transformCs 同一时间轴 */
let transAudio: AudioBuffer | null = null;
let lastAudioUi = "";

// 播放、导出
const outputV = {
    width: 0,
    height: 0,
};

// todo 节省内存，可以降低原始分辨率，像鼠标坐标也要缩小
// src原始分辨率
const v = {
    width: 0,
    height: 0,
};

const frameLength = store.get("录屏.超级录屏.关键帧间隔");

const srcRate = store.get("录屏.转换.帧率");
const bitrate = store.get("录屏.转换.码率") * 1024 * 1024;

const outputType = [
    { type: "gif", name: "gif" },
    // { type: "webp", name: "webp" }, // todo
    { type: "apng", name: "apng" },
    // { type: "avif", name: "avif" }, // todo
    { type: "webm", name: "webm" },
    { type: "mp4", name: "mp4" },
    // { type: "mkv", name: "mkv" },
    // { type: "mov", name: "mov" },
    // { type: "avi", name: "avi" },
    // { type: "ts", name: "ts" },
    // { type: "mpeg", name: "mpeg" },
    // { type: "flv", name: "flv" },
    { type: "png", name: "png" },
] as const;

const defaultSrcId = 0 as SrcId;

let isPlaying = false;
let playI: TransId = 0 as TransId;
let willPlayI: TransId = 0 as TransId;
let playTime = 0;

// let isEditClip = false;

let mousePosi: { x: number; y: number } = { x: 0, y: 0 };

/** 解码帧缓存上限（RGBA 字节），反复预览/跳转时免重复解码 */
const frameCacheLimit = 256 * 1024 * 1024;
/** 播放解码队列深度上限：超过说明供给跟不上消耗，拒排本轮（掉帧维持播放） */
const playQueueLimit = 10;

/** 一路独立的帧获取序列：自带解码器、缓存与调度状态，多路并用互不干扰 */
class frameGetter<Id extends number> {
    private tasks = new Map<
        number,
        ((canvas: OffscreenCanvas | null) => void)[]
    >();
    private willDecodeIs = new Set<number>();
    private lastAddDecodeI = -1;
    /** 已解码帧缓存（按字节限制的 LRU），命中后同步返回 */
    private frameCache = new Map<number, OffscreenCanvas>();
    private frameCacheSize = 0;
    private lastDecoderRebuild = 0;
    private decoder: VideoDecoder;
    /** 进行中的合批 flush，同一批请求共享 */
    private flushScheduled: Promise<void> | null = null;
    /** 连续播放输出直通回调：有 sink 时输出直接交给它绘制，
     * 不做 OffscreenCanvas 拷贝与入缓存（播放每帧拷贝是性能倒退） */
    private sink: ((frame: VideoFrame) => void) | null = null;

    constructor(private chunk: videoChunk<Id>) {
        this.decoder = this.#newDecoder();
        this.decoder.configure(decoderVideoConfig);
    }

    #newDecoder() {
        return new VideoDecoder({
            output: (frame) => this.#onOutput(frame),
            error: (e) => {
                console.error("Decode error:", e);
                // 解码器出错后不可用：先让挂起请求失败（调用方下次重试），
                // 再限时重建，否则之后所有请求都会失败
                this.#resetPending();
                const now = performance.now();
                if (now - this.lastDecoderRebuild > 1000) {
                    this.lastDecoderRebuild = now;
                    try {
                        this.decoder.close();
                    } catch (err) {
                        console.log(err);
                    }
                    this.decoder = this.#newDecoder();
                    this.decoder.configure(decoderVideoConfig);
                }
            },
        });
    }
    #onOutput(frame: VideoFrame) {
        const id = this.chunk.timestamp2Id(frame.timestamp) as number;
        if (id >= 0) this.willDecodeIs.delete(id);
        if (this.sink) {
            // 连续播放：直通绘制，不拷贝入缓存；sink 与本方法负责关闭帧
            try {
                this.sink(frame);
            } catch (e) {
                console.log(e);
            }
            frame.close();
            return;
        }
        if (id < 0) {
            frame.close();
            return;
        }
        const tasks = this.tasks.get(id);
        if (tasks && tasks.length > 0) {
            // 同一帧只绘制一次，缓存并共享给所有等待者
            const canvas = frameTrans2Canvas(frame);
            this.tasks.delete(id);
            this.#cachePut(id, canvas);
            for (const task of tasks) task(canvas);
        } else {
            // 没有请求者的中间帧不做 canvas 拷贝，直接丢弃，避免抢占播放资源
            frame.close();
        }
    }
    /** 作废全部挂起请求，避免解码状态残留导致永久等待 */
    #resetPending() {
        this.willDecodeIs.clear();
        this.lastAddDecodeI = -1;
        for (const tasks of this.tasks.values()) {
            for (const t of tasks) t(null);
        }
        this.tasks.clear();
    }
    /** 列表变化时由 videoChunk 调用：作废请求、清缓存并排空解码队列 */
    async reset() {
        this.#resetPending();
        this.frameCache.clear();
        this.frameCacheSize = 0;
        // flush 失败（解码器异常）不应让转换流程抛错
        await this.decoder.flush().catch((e) => console.log(e));
        // flush 期间残留的旧列表输出仍可能写入缓存，需再清一次
        this.frameCache.clear();
        this.frameCacheSize = 0;
        this.lastAddDecodeI = -1;
    }
    /** 合批 flush：同一执行块内的多个请求共享一次 flush，
     * flush 不夹在解码序列中间；且 flush 之后引擎要求从 k 帧开始，
     * 故 flush 排入时同步重置序列，之后的请求一律从 k 帧重排 */
    #queueFlush() {
        if (this.flushScheduled) return this.flushScheduled;
        const p = (async () => {
            // 等当前执行块结束，本批所有解码已排入队列
            await Promise.resolve();
            this.flushScheduled = null;
            const f = this.decoder.flush();
            // flush 之后必须以 k 帧开头，后续请求从 k 帧重排
            this.lastAddDecodeI = -1;
            await f.catch((e) => console.log(e));
        })();
        this.flushScheduled = p;
        return p;
    }
    /** 从 k 帧重新排入解码直到 to（flush 后的合法序列） */
    #decodeTo(to: number) {
        const list = this.chunk.list;
        const thisKey = list
            .slice(0, to + 1)
            .findLastIndex((c) => c.type === "key");
        this.lastAddDecodeI = -1;
        for (let j = Math.max(thisKey, 0); j <= to; j++) {
            const c = list[j];
            if (!c) continue;
            try {
                this.decoder.decode(c);
            } catch (e) {
                // 排入失败保持 k 帧起点，下一轮从 k 帧重来
                console.log("decode", e);
                return;
            }
            this.willDecodeIs.add(j);
        }
        this.lastAddDecodeI = to;
    }
    /** 把 i 及其必需的前序帧排入解码队列（保持顺序完整：同序列从已排位置
     * 的下一帧连续补全，不重复不跳过；跨 k 帧则从目标所在 k 帧完整排到 i）；
     * 返回 false 表示排入失败（解码器异常，error 回调会限时重建自愈） */
    #schedule(i: number): boolean {
        if (this.willDecodeIs.has(i)) return true;
        const prevLastAdd = this.lastAddDecodeI;
        // 要么在当前解码序列之后，要么在其他片段
        // 在当前解码序列之后，可以补充序列，在其他片段，则要重新添加序列（因为k帧已经不同了）
        const thisKey = this.chunk.list
            .slice(0, i + 1)
            .findLastIndex((c) => c.type === "key");

        const nowDecodingKey = this.chunk.list
            .slice(0, this.lastAddDecodeI + 1)
            .findLastIndex((c) => c.type === "key");

        // 同一 k 帧序列且目标在已排位置之后：从已排位置的下一帧顺序补全
        //（不重复已排帧，也不跳过中间帧）；否则（跨 k 帧或目标在已排位置前）
        // 必须从 i 所在 k 帧完整排到 i，保证参考链从 k 帧开始严格顺序
        const startI =
            thisKey === nowDecodingKey && i > this.lastAddDecodeI
                ? this.lastAddDecodeI + 1
                : Math.max(thisKey, 0);

        for (let j = startI; j <= i; j++) {
            const c = this.chunk.list[j];
            if (!c) continue;
            try {
                this.decoder.decode(c);
            } catch (e) {
                // 解码器异常（如 flush 后的 k 帧约束、或已被 error 关闭）：
                // 回滚已排位置，下轮从断点完整顺序重排，不留下半截序列状态
                console.log("decode", e);
                this.lastAddDecodeI = prevLastAdd;
                return false;
            }
            this.willDecodeIs.add(j);
        }

        this.lastAddDecodeI = i;
        return true;
    }
    /** 播放意图变更（跳转）时调用：丢弃解码队列中旧序列的残留帧，
     * 下次排帧从新位置所在 k 帧完整顺序重建——
     * 旧序列状态与新位置混杂（重复 delta、残留输出）是花屏的来源 */
    resetPlaySeq() {
        this.willDecodeIs.clear();
        this.lastAddDecodeI = -1;
        try {
            // 丢弃队列中未完成的旧序列解码
            this.decoder.reset();
            this.decoder.configure(decoderVideoConfig);
        } catch (e) {
            console.log(e);
        }
    }
    /** 设置连续播放的输出直通回调（null = 关闭，迟到输出直接作废） */
    setSink(fn: ((frame: VideoFrame) => void) | null) {
        this.sink = fn;
    }
    /** 连续播放排帧：只排解码不 flush（flush 会打断 GOP 连续 delta 序列），
     * 输出经 sink 直通绘制。返回 false = 队列积压或解码失败，
     * 调用方跳过本轮即“掉帧”，时间继续推进、维持播放 */
    playRequest(i: Id): boolean {
        if (i < 0 || i >= this.chunk.length) return false;
        // 解码供给跟不上消耗：拒排本轮，让队列消化后再排
        if (this.decoder.decodeQueueSize > playQueueLimit) return false;
        return this.#schedule(i);
    }
    #on(
        i: number,
        cb: (canvas: OffscreenCanvas | null) => void,
        signal?: AbortSignal,
    ): boolean {
        if (i < 0 || i >= this.chunk.length || signal?.aborted) {
            cb(null);
            return true;
        }
        // 支持抛弃：立即结算 null；已排入的解码无法撤销，其输出仍会进缓存
        //（Gop 依赖下该帧本来就必经），后续再要时可直接命中“转正”
        signal?.addEventListener("abort", () => cb(null), { once: true });
        const task = this.tasks.get(i) ?? [];
        task.push(cb);
        this.tasks.set(i, task);
        return this.#schedule(i);
    }
    async getFrame(index: Id, signal?: AbortSignal) {
        const cached = this.#cacheGet(index);
        if (cached) return cached;
        const { promise, resolve } =
            Promise.withResolvers<OffscreenCanvas | null>();
        let done = false;
        const ok = this.#on(
            index,
            (c) => {
                if (c) done = true;
                resolve(c);
            },
            signal,
        );
        let flushP = ok ? this.#queueFlush() : Promise.resolve();
        /** 等待所在批次的 flush；返回 false 表示请求已被抛弃 */
        const waitFlush = async () => {
            if (signal) {
                const a = Symbol();
                const r = await Promise.race([
                    flushP.catch(() => null),
                    new Promise<symbol>((res) =>
                        signal.addEventListener("abort", () => res(a), {
                            once: true,
                        }),
                    ),
                ]);
                return r !== a;
            }
            await flushP.catch((e) => console.log(e));
            return true;
        };
        if (!(await waitFlush())) return promise;

        // 按真正解码出的帧判断是否到达：引擎可能只回调了前面几帧
        //（decode 了但目标帧未输出），未到达则从 k 帧重排并多解码几帧重试
        for (let n = 1; n <= 3 && !done; n++) {
            if (signal?.aborted) return promise;
            console.log("decode incomplete, retry", index, n);
            this.#decodeTo(Math.min(index + n * 4, this.chunk.length - 1));
            flushP = this.#queueFlush();
            if (!(await waitFlush())) return promise;
        }
        // 仍未到达，兜底结算避免永久等待（已输出时为幂等空操作）
        resolve(null);
        return promise;
    }

    #cacheGet(i: number) {
        const canvas = this.frameCache.get(i);
        if (!canvas) return null;
        // 刷新 LRU 顺序
        this.frameCache.delete(i);
        this.frameCache.set(i, canvas);
        return canvas;
    }
    #cachePut(i: number, canvas: OffscreenCanvas) {
        const size = canvas.width * canvas.height * 4;
        this.#cacheDelete(i);
        if (size > frameCacheLimit) return;
        while (this.frameCacheSize + size > frameCacheLimit) {
            const oldest = this.frameCache.keys().next();
            if (oldest.done) break;
            this.#cacheDelete(oldest.value);
        }
        this.frameCache.set(i, canvas);
        this.frameCacheSize += size;
    }
    #cacheDelete(i: number) {
        const old = this.frameCache.get(i);
        if (!old) return;
        this.frameCacheSize -= old.width * old.height * 4;
        this.frameCache.delete(i);
    }
}

class videoChunk<Id extends number> {
    private srcList: (EncodedVideoChunk | null)[] = [];
    list: EncodedVideoChunk[] = [];

    private _timestamp2Id = new Map<number, number>();
    /** 本列表的各路帧获取序列，列表变化时逐一重置 */
    private getters = new Set<frameGetter<Id>>();
    private defGetter: frameGetter<Id> | null = null;

    constructor(_list: (EncodedVideoChunk | null)[]) {
        this.setList(_list);
    }
    async setList(_list: (EncodedVideoChunk | null)[]) {
        this.srcList = _list;
        this.list = [];
        for (const s of this.srcList) {
            if (s !== null) this.list.push(s);
        }
        this._timestamp2Id.clear();
        for (const [i, c] of this.list.entries()) {
            this._timestamp2Id.set(c.timestamp, i);
        }
        // 列表已换：各序列作废旧请求、清缓存并排空解码队列，避免残留状态挂起
        await Promise.all([...this.getters].map((g) => g.reset()));

        console.log(
            "size",
            `${this.#byte2mb(this.#sumChunckSize(this.list))}mb`,
        );
    }
    /** 新建一路独立的帧获取序列（独立解码器），供不同 UI 层互不干扰 */
    getGetter() {
        const g = new frameGetter(this);
        this.getters.add(g);
        return g;
    }
    /** 默认序列，供一次性/测试使用；界面各层请各自 getGetter 持有 */
    getFrame(index: Id, signal?: AbortSignal) {
        if (!this.defGetter) this.defGetter = this.getGetter();
        return this.defGetter.getFrame(index, signal);
    }
    get length() {
        return this.list.length;
    }
    frame2Id(frame: VideoFrame) {
        return this.timestamp2Id(frame.timestamp);
    }
    timestamp2Id(timestamp: number) {
        return (this._timestamp2Id.get(timestamp) ?? -1) as Id;
    }
    time2Id(time: number) {
        const i = this.list.findIndex((c) => c.timestamp >= ms2timestamp(time));
        if (i === -1) return (this.length - 1) as Id;
        return i as Id;
    }
    getTime(id: Id) {
        return timestamp2ms(this.list.at(id)?.timestamp ?? 0);
    }
    getDuration() {
        return this.getTime(-1 as Id);
    }
    entries() {
        return this.list.entries() as ArrayIterator<[Id, EncodedVideoChunk]>;
    }
    at(i: Id) {
        return this.list.at(i);
    }

    #sumChunckSize(chunks: EncodedVideoChunk[]) {
        return chunks.reduce((acc, cur) => acc + cur.byteLength, 0);
    }

    #byte2mb(byte: number) {
        return (byte / 1024 / 1024).toFixed(2);
    }
}

function uuid() {
    return crypto.randomUUID();
}

function MathClamp(min: number, value: number, max: number) {
    return Math.min(Math.max(min, value), max);
}

function getFreeMemory() {
    const mem = process.getSystemMemoryInfo();
    const sysFree = (mem.free + mem.swapFree) * 1024;
    // @ts-ignore
    const processFree = performance.memory.jsHeapSizeLimit;
    return Math.min(sysFree, processFree);
}

function frameTrans2Canvas(frame: VideoFrame) {
    const canvas = new OffscreenCanvas(frame.codedWidth, frame.codedHeight);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(frame, 0, 0);
    frame.close();
    return canvas;
}

function listLength() {
    return srcCs.length;
}

function initKeys(push: (x: Omit<superRecording[0], "time" | "posi">) => void) {
    const keyCodeMap = new Map<number, KeyCode>();
    for (const [i, v] of typedEntries(UiohookKey)) {
        keyCodeMap.set(v, String(i) as KeyCode);
    }

    uIOhook.on("keydown", (e) => {
        const k = keyCodeMap.get(e.keycode);
        if (k)
            push({
                keydown: k,
            });
    });

    uIOhook.on("keyup", (e) => {
        const k = keyCodeMap.get(e.keycode);
        if (k)
            push({
                keyup: k,
            });
    });

    const map = { 1: 0, 2: 1, 3: 2 } as const;

    uIOhook.on("mousedown", (e) => {
        push({
            mousedown: map[e.button as 1 | 2 | 3],
        });
    });
    uIOhook.on("mouseup", (e) => {
        push({
            mouseup: map[e.button as 1 | 2 | 3],
        });
    });

    uIOhook.on("wheel", (e) => {
        console.log(e.direction, e.rotation);
        push({ wheel: true });
    });

    uIOhook.on("mousemove", (e) => {
        mousePosi = { x: e.x, y: e.y };
        push({});
    });

    uIOhook.start();
}

async function afterRecord(chunks: EncodedVideoChunk[]) {
    transformTimeEl.sv(t("补帧中..."));
    // 补帧
    const m = new Map<number, number>();
    const d = Math.floor(ms2timestamp(1000 / srcRate));
    const firstTime = chunks.at(0)?.timestamp ?? 0;
    let index = 0;
    const frames = frameLength;
    const encodedChunks: EncodedVideoChunk[] = [];
    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            const t = frame.timestamp - firstTime;
            const sf = new VideoFrame(frame, { timestamp: t });
            encoder.encode(sf, { keyFrame: index % frames === 0 });
            sf.close();
            index++;
            for (let i = 1; i <= (m.get(frame.timestamp) ?? 0); i++) {
                const f = new VideoFrame(frame, { timestamp: t + d * i });
                encoder.encode(f, { keyFrame: index % frames === 0 });
                index++;
                f.close();
            }
            frame.close();
        },
        error: (e) => console.error("Encode error:", e),
    });
    const encoder = new VideoEncoder({
        output: (c: EncodedVideoChunk) => {
            encodedChunks.push(c);
            transformProgressEl.sv(encodedChunks.length / totalFrameCount);
        },
        error: (e) => console.error("Encode error:", e),
    });

    encoder.configure({
        ...encoderVideoConfig,
        framerate: srcRate,
        width: v.width,
        height: v.height,
    });
    decoder.configure(decoderVideoConfig);
    let lastTime = chunks[0].timestamp;
    for (const c of chunks) {
        const count = Math.round((c.timestamp - lastTime) / d);
        if (count > 1) {
            m.set(lastTime, count - 1);
        }
        lastTime = c.timestamp;
    }
    const totalFrameCount =
        chunks.length + m.values().reduce((a, b) => a + b, 0);
    for (const c of chunks) {
        if (c.type === "key") {
            await decoder.flush();
            await encoder.flush();
        }
        decoder.decode(c);
    }
    await decoder.flush();
    await encoder.flush();
    decoder.close();
    encoder.close();
    return encodedChunks;
}

let stopRecord: (cancel?: boolean) => void = () => {};

function ms2timestamp(t: number) {
    return t * 1000;
}

function timestamp2ms(t: number) {
    return t / 1000;
}

function numberPad(n: number, length = 2) {
    return n.toString().padStart(length, "0");
}

function formatTime(t: number) {
    const h = Math.floor(t / 3600000);
    const m = Math.floor((t % 3600000) / 60000);
    const s = Math.floor((t % 60000) / 1000);
    const ms = Math.floor(t % 1000);
    return `${numberPad(h)}:${numberPad(m)}:${numberPad(s)}.${numberPad(ms, 3)}`;
}

function mapKeysOnFrames(chunks: EncodedVideoChunk[], keys: superRecording) {
    const startTime = keys.find((k) => k.isStart)?.time;
    if (!startTime) {
        console.log(keys);
        throw new Error("no start key");
    }
    const newKeys = keys
        .map((i) => ({ ...i, time: i.time - startTime }))
        .filter((i) => i.time > 0);

    const time2Id = new Map<number, SrcId>();
    for (const k of newKeys) {
        const t = ms2timestamp(k.time);
        const chunk = chunks.findIndex(
            (c, i) =>
                c.timestamp <= t &&
                t < (chunks[i + 1]?.timestamp ?? Number.POSITIVE_INFINITY),
        );
        if (chunk === -1) continue;
        time2Id.set(k.time, chunk as SrcId);
    }

    // 获取关键时间
    const clipList: uiData["clipList"] = [];
    const rects: { w: number; h: number }[] = [
        { w: v.width / 3, h: v.height / 3 },
        { w: v.width, h: v.height },
    ]; // 从小到大排列

    function queryRect(points: { x: number; y: number }[]) {
        const minWidth =
            Math.max(...points.map((p) => p.x)) -
            Math.min(...points.map((p) => p.x));
        const minHeight =
            Math.max(...points.map((p) => p.y)) -
            Math.min(...points.map((p) => p.y));
        const rect =
            rects.find((r) => r.w >= minWidth && r.h >= minHeight) ??
            (rects.at(-1) as (typeof rects)[0]);

        const centerX = points.reduce((a, b) => a + b.x, 0) / points.length;
        const centerY = points.reduce((a, b) => a + b.y, 0) / points.length;
        const w = rect.w;
        const h = rect.h;
        const x = MathClamp(0, centerX - w / 2, v.width - w);
        const y = MathClamp(0, centerY - h / 2, v.height - h);
        return { x, y, w, h };
    }

    let lastK: (typeof newKeys)[0] | undefined = undefined;
    const nk = newKeys.filter((k) => "mousedown" in k || "mouseup" in k);
    const nk2: (typeof nk)[] = [];
    // 寻找up->down（两个press直接的间隔）>500ms
    for (const k of nk) {
        if ("mousedown" in k && k.time - (lastK?.time ?? 0) > 500) {
            nk2.push([]);
        }
        nk2.at(-1)?.push(k);
        lastK = k;
    }

    console.log(nk2);

    for (const k of nk2) {
        const chunk = time2Id.get(k[0].time);
        if (!chunk) continue;
        const rect = queryRect(k.map((i) => ({ x: i.posi.x, y: i.posi.y })));
        clipList.push({
            i: chunk as SrcId,
            rect,
            transition: ms2timestamp(400),
        });
    }

    const keyList = newKeys.filter((k) => "keydown" in k || "keyup" in k);
    const keyL: { key: KeyCode; start: number; end: number }[] = [];

    for (const k of keyList) {
        if (k.keydown) {
            keyL.push({ key: k.keydown, start: k.time, end: k.time });
        }
        if (k.keyup) {
            const kk = keyL.findLast((i) => i.key === k.keyup);
            if (kk) kk.end = k.time;
            else keyL.push({ key: k.keyup, start: k.time, end: k.time });
        }
    }

    // 区分输入和快捷键
    const isCtrl = (k: KeyCode) =>
        (
            [
                "Ctrl",
                "CtrlRight",
                "Alt",
                "AltRight",
                "Shift",
                "ShiftRight",
            ] as KeyCode[]
        ).includes(k);
    const ctrlKeys: (typeof keyL)[] = [];
    const normalKeys: typeof keyL = [];
    let ctrlLike: null | { start: number; end: number } = null;
    for (const i of keyL) {
        // 以第一个修饰键区间为快捷键区间，其他的键start在此都合并
        if (i.start > (ctrlLike?.end ?? Number.NEGATIVE_INFINITY))
            ctrlLike = null;
        if (isCtrl(i.key)) {
            if (!ctrlLike) {
                ctrlKeys.push([]);
                ctrlLike = { start: i.start, end: i.end };
            }
        }
        if (ctrlLike && ctrlLike.start <= i.start && i.start <= ctrlLike.end) {
            (ctrlKeys.at(-1) as typeof keyL).push(structuredClone(i));
        } else {
            normalKeys.push(i);
        }
    }
    const nCtrlKeys: { key: KeyCode[]; start: number; end: number }[] = [];
    for (const ks of ctrlKeys) {
        const l = ks.flatMap((i) => i.key ?? []);
        const start = Math.min(...ks.map((i) => i.start));
        const end = Math.max(...ks.map((i) => i.end));
        nCtrlKeys.push({ key: l, start, end });
    }
    console.log(keyL, ctrlKeys, nCtrlKeys, normalKeys);

    const speedList: uiData["speed"] = [];

    for (const [i, k] of normalKeys.entries()) {
        const lastKeyTime = normalKeys[i - 1]?.end ?? Number.NEGATIVE_INFINITY;
        if (k.start - lastKeyTime > 1000) {
            speedList.push({
                start: time2Id.get(k.start) as SrcId,
                end: time2Id.get(k.end) as SrcId,
                value: 3,
            });
        } else {
            const last = speedList.at(-1);
            if (!last) continue;
            last.end = time2Id.get(k.end) as SrcId;
        }
    }

    const removeList: uiData["remove"] = [];
    let wFoucus = false;
    for (const i of newKeys) {
        const index = time2Id.get(i.time) as SrcId;
        if (i.wFoucus) {
            removeList.push({ start: index, end: index });
            wFoucus = true;
        }
        if (i.wBlur) {
            if (removeList.length > 0) {
                (removeList.at(-1) as uiData["remove"][0]).end = index;
                wFoucus = false;
            }
        }
    }
    if (wFoucus && removeList.length > 0) {
        (removeList.at(-1) as uiData["remove"][0]).end = (chunks.length -
            1) as SrcId;
    }

    history.setDataF((uidata) => {
        uidata.clipList = clipList;
        uidata.speed = speedList;
        uidata.remove = removeList;
        return uidata;
    }, t("分析镜头位置、速度、删除"));
    history.apply();
}

function renderUiData(data: uiData) {
    timeLineClipEl.setData(data.clipList);
    timeLineSpeedEl.setData(data.speed);
    // @ts-ignore
    timeLineEventEl.setData(data.eventList);
    timeLineRemoveEl.setData(
        data.remove.map((r) => ({ start: r.start, end: r.end, value: null })),
    );
}

function getFrameXs(_data: uiData | null) {
    if (!_data) return [];
    const data: uiData = {
        clipList: _data.clipList.toSorted((a, b) => a.i - b.i),
        speed: _data.speed.toSorted((a, b) => a.start - b.start),
        eventList: _data.eventList.toSorted((a, b) => a.start - b.start),
        remove: _data.remove.toSorted((a, b) => a.start - b.start),
    };
    console.log(data);

    const frameList: FrameX[] = [];

    const speedMap = new Map<number, number>();
    for (const s of data.speed) {
        for (let i = s.start; i <= s.end; i++) speedMap.set(i, s.value);
    }

    const removeSet = new Set<number>();
    for (const r of data.remove) {
        for (let i = r.start; i <= r.end; i++) removeSet.add(i);
    }

    let nowTime = 0;
    const timeMap = new Map<number, number>();
    for (const [i, c] of srcCs.entries()) {
        const next = srcCs.at((i + 1) as SrcId);
        const duration = next ? next.timestamp - c.timestamp : 0;
        const speed = speedMap.get(i) ?? 1;
        const nd = duration / speed;
        timeMap.set(c.timestamp, nowTime);
        if (!removeSet.has(i)) nowTime += nd;
    }

    const getTime = (t: number) => timeMap.get(t) as number;

    const clipList = data.clipList.filter((c) => !removeSet.has(c.i));

    for (const [i, c] of srcCs.entries()) {
        const f: FrameX = {
            rect: { x: 0, y: 0, w: v.width, h: v.height },
            timestamp: getTime(c.timestamp) ?? 0,
            event: [],
            isRemoved: false,
        };

        f.isRemoved = removeSet.has(i);
        if (f.isRemoved) {
            frameList.push(f);
            continue;
        }

        // clip
        if (clipList.length > 0) {
            // 补充首尾，方便查找区间
            const firstClip = structuredClone(
                clipList.at(0) as uiData["clipList"][0],
            );
            firstClip.i = 0 as SrcId;
            const lastClip = structuredClone(
                clipList.at(-1) as uiData["clipList"][0],
            );
            lastClip.i = (listLength() - 1) as SrcId;
            const l = structuredClone(clipList);
            l.unshift(firstClip);
            l.push(lastClip);

            const bmClip = l.find((c) => c.i === i);
            if (bmClip) {
                f.rect = bmClip.rect;
            } else {
                const clipI = l.findLastIndex((c) => c.i < i);
                const clip = l[clipI];
                const nextClip = l[clipI + 1];
                const clipTime = getTime(
                    (srcCs.at(clip.i) as EncodedVideoChunk).timestamp,
                );
                const nextClipTime = getTime(
                    (srcCs.at(nextClip.i) as EncodedVideoChunk).timestamp,
                );
                const t = getTime(c.timestamp);
                f.rect = getClip(clip, clipTime, t, nextClip, nextClipTime);
            }
        }

        frameList.push(f);
    }

    for (let i = 0; i < frameList.length; i += frameLength) {
        for (let j = i; j < i + frameLength && j < frameList.length; j++) {
            const f = frameList[j];
            if (!f.isRemoved) {
                f.isKey = true;
                break;
            }
        }
    }

    console.log(frameList);

    return frameList;
}

function getClip(
    last: clip,
    lastT: number,
    t: number,
    next: clip,
    nextT: number,
) {
    const transition = Math.min(next.transition, nextT - lastT);
    if (t < nextT - transition || t > nextT) {
        return last.rect;
    }
    const v = easeOutQuint((t - (nextT - transition)) / transition);
    return {
        x: (1 - v) * last.rect.x + v * next.rect.x,
        y: (1 - v) * last.rect.y + v * next.rect.y,
        w: (1 - v) * last.rect.w + v * next.rect.w,
        h: (1 - v) * last.rect.h + v * next.rect.h,
    };
}

function easeOutQuint(x: number): number {
    return 1 - (1 - x) ** 5; // todo 更多 easing
}

/** 正在进行的转换；相同请求（参数 + ui 数据）直接加入，不打断它 */
let runningTransform: { key: string; promise: Promise<true | null> } | null =
    null;

async function transform(op?: Partial<typeof lastTransOpt>) {
    const key = JSON.stringify([op ?? null, history.getData()]);
    if (runningTransform?.key === key) return runningTransform.promise;

    lastTransformAbort?.abort();
    const { promise, resolve } = Promise.withResolvers<true | null>();
    for (const task of transformTask) {
        task(null);
    }
    transformTask.clear();
    transformTask.add(resolve);
    /** 只由本次 run 结算，避免旧 run 完成时唤醒新加入的等待者 */
    const waiters: ((value: true | null) => void)[] = [resolve];
    const myPromise = promise;
    runningTransform = { key, promise };

    lastTransformAbort = new AbortController();
    runTransform(op, lastTransformAbort.signal)
        .then(() => {
            for (const task of waiters) task(true);
        })
        .catch((e) => {
            console.log(e);
            // 出错时也要结算，避免调用方永远等待
            for (const task of waiters) task(null);
        })
        .finally(() => {
            if (runningTransform?.promise === myPromise)
                runningTransform = null;
            for (const task of waiters) transformTask.delete(task);
        });

    return promise;
}

async function runTransform(
    op?: Partial<typeof lastTransOpt>,
    signal = new AbortController().signal,
) {
    if (signal.aborted) return;

    const nowUi = history.getData();

    const joinOp = {
        codec: baseCodec,
        size: `${outputV.width}x${outputV.height}`,
        ...op,
    };

    const forceRerendAll = (() => {
        for (const [i, v] of typedEntries(joinOp)) {
            if (v !== lastTransOpt[i]) return true;
        }
        return false;
    })();
    if (!forceRerendAll) {
        if (JSON.stringify(nowUi) === JSON.stringify(lastUiData)) return;
    }
    console.trace("transform");
    const lastFrameXs = getFrameXs(lastUiData);
    const frameXs = getFrameXs(nowUi);

    const needEncode = forceRerendAll
        ? new Set(Array.from({ length: frameXs.length }, (_, i) => i))
        : diffFrameXs(lastFrameXs, frameXs);

    const needDecode = new Set<number>();

    const transformed = structuredClone(lastEncodedChunks);

    if (needEncode.size > 0) {
        transformTimeEl.sv(t("开始处理"));
        const Tdiff = performance.now();

        let runCount = 0;

        function run() {
            runCount++;
            transformProgressEl.sv(runCount / needDecode.size);
        }

        const decoder = new VideoDecoder({
            output: (frame: VideoFrame) => {
                // 解码 处理 编码
                const id = srcCs.timestamp2Id(frame.timestamp);
                const frameX = frameXs.at(id);
                if (!frameX || frameX?.isRemoved) {
                    if (!frameX) {
                        console.log(
                            `frame ${frame.timestamp} ${id} not found in uiData`,
                        );
                    }
                    run();
                    frame.close();
                    return;
                }
                const nFrame = transformX(frame, frameX);
                encoder.encode(nFrame.frame, { keyFrame: nFrame.isKey });
                nFrame.frame.close();
            },
            error: (e) => console.error("Decode error:", e),
        });
        const encoder = new VideoEncoder({
            output: (c: EncodedVideoChunk) => {
                const id = srcCs.timestamp2Id(c.timestamp);
                if (id === -1) {
                    console.log("no id", c.timestamp);
                    return;
                }
                transformed[id] = c;
                run();
            },
            error: (e) => console.error("Encode error:", e),
        });
        const c = codecMap.get(joinOp.codec);
        if (!c) {
            // todo 提示不支持
            return;
        }
        encoder.configure({
            codec: c.codec,
            hardwareAcceleration: c.isEnAcc
                ? "prefer-hardware"
                : "no-preference",
            width: outputV.width,
            height: outputV.height,
            framerate: srcRate,
        });
        decoder.configure(decoderVideoConfig);

        let inThisClip = false;
        for (let i = srcCs.length - 1; i >= 0; i--) {
            if (needEncode.has(i)) inThisClip = true;
            if (inThisClip) needDecode.add(i);
            if (srcCs.at(i as SrcId)?.type === "key") inThisClip = false;
        }

        for (const chunk of Array.from(needDecode)
            .toSorted((a, b) => a - b)
            .map((i) => srcCs.at(i as SrcId) as EncodedVideoChunk)) {
            if (chunk.type === "key") {
                if (signal.aborted) break;
                await decoder.flush();
                await encoder.flush();
            }
            decoder.decode(chunk);
        }

        let aborted = false;
        function abort() {
            if (aborted) return;
            aborted = true;
            console.log("transform abort");
            try {
                decoder.close();
                encoder.close();
            } catch (e) {
                console.log(e);
            }
        }

        signal.addEventListener("abort", abort);
        // addEventListener 不会补发已发生的 abort，此时需手动清理
        if (signal.aborted) abort();

        if (!signal.aborted) {
            /**@see {@link ../../docs/develop/superRecorder.md#转换（编辑）} */
            try {
                await decoder.flush();
                await encoder.flush();
            } catch (e) {
                // flush 期间被关闭会抛错，交由 abort 清理即可
                if (!signal.aborted) throw e;
            }
            signal.removeEventListener("abort", abort);
            if (!aborted) {
                decoder.close();
                encoder.close();
            }

            const Tend = performance.now();

            transformTimeEl.sv(
                `${t("处理帧数：")}${needDecode.size} ${t("处理：")}${((Tend - Tdiff) / needDecode.size).toFixed(0)}ms/f ${t("总耗时：")}${((Tend - Tdiff) / 1000).toFixed(0)}s`,
            );
        }
    }

    if (signal.aborted) return;

    for (const [i, v] of typedEntries(joinOp)) if (v) lastTransOpt[i] = v;
    lastUiData = nowUi;

    trans2srcM.clear();
    src2transM.clear();

    let transCount = 0;
    for (const [i, f] of frameXs.entries()) {
        trans2srcM.set(transCount, i);
        src2transM.set(i, transCount);
        if (f.isRemoved) transformed[i] = null;
        else transCount++;
    }

    console.log(trans2srcM, src2transM);

    lastEncodedChunks = transformed.map((chunk, i) => {
        if (chunk === null) return null;
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        return new EncodedVideoChunk({
            data: data,
            timestamp: frameXs.at(i)?.timestamp ?? 0,
            type: chunk.type,
        });
    });

    await transformCs.setList(lastEncodedChunks);

    await updateAudio(nowUi, frameXs);
}

/** 让音频跟随编辑（删除、变速），失败时退化为无音频，不影响视频流程 */
async function updateAudio(nowUi: uiData, frameXs: FrameX[]) {
    try {
        const uiJson = JSON.stringify(nowUi);
        if (uiJson === lastAudioUi) return;
        if (!srcAudio) {
            transAudio = null;
            return;
        }
        const srcTimes: number[] = [];
        for (let i = 0; i < srcCs.length; i++) {
            srcTimes.push(srcCs.getTime(i as SrcId));
        }
        transAudio = await buildTransAudio(
            srcAudio,
            frameXs,
            srcTimes,
            srcCs.getDuration(),
        );
        lastAudioUi = uiJson;
    } catch (e) {
        console.error("超级录屏：音频变换失败", e);
        transAudio = null;
    }
}

function diffFrameXs(old: FrameX[], now: FrameX[]) {
    const oldIds = getFrameXsIds(old);
    const nowIds = getFrameXsIds(now);
    const needReRender = new Set<number>();
    for (const [i, nid] of nowIds.entries()) {
        const oid = oldIds.at(i);
        if (!oid) {
            needReRender.add(i);
            continue;
        }
        if (nid.id !== oid.id) {
            needReRender.add(i);
        }
    }
    const keys = now.flatMap((f, i) => (f.isKey ? i : []));
    keys.push(now.length);
    // gop结尾是remove，那就不用渲染那块，进行trim
    for (let i = 0; i < keys.length - 1; i++) {
        for (let j = keys[i + 1] - 1; j >= keys[i]; j--) {
            if (now[j].isRemoved) {
                needReRender.delete(j);
            } else {
                break;
            }
        }
    }
    // 某个帧变，encode需要，前面的帧们要渲染，后面的帧们依赖前面的，所以整个gop都重新渲染
    const needEncode = new Set<number>();
    for (const x of needReRender) {
        if (needEncode.has(x)) continue;
        const sI = keys.findLastIndex((i) => i <= x);
        for (let i = keys[sI]; i < keys[sI + 1]; i++) needEncode.add(i);
    }
    console.log(needReRender, needEncode);

    return needEncode;
}

function getFrameXsIds(frameXs: FrameX[]) {
    const ids: Omit<FrameX, "timestamp">[] = [];
    for (const f of frameXs) {
        ids.push({
            event: f.event,
            isRemoved: f.isRemoved,
            rect: f.rect,
            isKey: f.isKey,
        });
    }
    return ids.map((i) => {
        const id = JSON.stringify(i);
        return { id, isRemoved: i.isRemoved };
    });
}

function transformX(frame: VideoFrame, frameX: FrameX) {
    const t = renderFrameX(frame, frameX);
    const canvas = t.canvas;
    const nFrame = new VideoFrame(canvas, {
        timestamp: frame.timestamp,
    });
    return { frame: nFrame, isKey: t.isKey };
}

function renderFrameX(frame: VideoFrame, frameX: FrameX) {
    const canvas = new OffscreenCanvas(outputV.width, outputV.height);
    const ctx = canvas.getContext("2d")!;
    const clip = frameX.rect;
    ctx.drawImage(
        frame,
        clip.x,
        clip.y,
        clip.w,
        clip.h,
        ...zeroPoint,
        outputV.width,
        outputV.height,
    );
    frame.close();
    return { canvas, isKey: Boolean(frameX.isKey) };
}

async function afterTrans() {
    const oldI = Math.min(willPlayI, transformCs.length - 1) as TransId;
    // 主画面 / 预览轴 / 帧轴相互独立，并行加载
    await Promise.all([
        jump2id(oldI),
        showThumbnails(),
        showNowFrames(oldI, true),
    ]);
    // 加载期间可能有新的跳转，以最新播放头为准，避免覆盖跳转结果
    const i = Math.min(willPlayI, transformCs.length - 1) as TransId;
    playI = i;
    willPlayI = i;
    // 预热播放解码序列（暂停时 sink 屏蔽输出，仅让 k 帧序列就位，
    // 正式播放首轮即可接续排帧，不必现解整个 Gop）
    playFrameGet.playRequest(i);
    onPlay(transformCs.getTime(i));
}

/** afterTrans 会 flush 播放解码器，记录其任务，开始播放前需等待它完成，避免竞态 */
let afterTransTask: Promise<void> = Promise.resolve();
function runAfterTrans() {
    afterTransTask = afterTrans().catch((e) => console.error("afterTrans", e));
    return afterTransTask;
}

async function playId(i: TransId, force = false) {
    if (i === playI && !force) return;

    const c = transformCs.at(i);
    if (!c) {
        console.log("no chunk", i);
        return;
    }
    // 播放意图回退（循环到头、编辑后重开）时重置迟到帧过滤基线
    if (c.timestamp < playLastDrawTs) playLastDrawTs = c.timestamp;
    if (!playFrameGet.playRequest(i)) {
        // 供给不足或解码失败：跳过本轮（掉帧），
        // 时间继续推进维持播放，下轮队列消化后再排
        return;
    }
    playI = i;
    willPlayI = i;
}

let audioCtx: AudioContext | null = null;
let playNode: AudioBufferSourceNode | null = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") {
        audioCtx.resume().catch((e) => console.warn(e));
    }
    return audioCtx;
}

/** 从媒体时间 offsetMs 处开始播放预览音频 */
function audioStart(offsetMs: number) {
    audioStop();
    if (!transAudio) return;
    const ctx = getAudioCtx();
    const node = ctx.createBufferSource();
    node.buffer = transAudio;
    node.connect(ctx.destination);
    node.start(0, Math.max(0, offsetMs / 1000));
    playNode = node;
}

function audioStop() {
    if (!playNode) return;
    try {
        playNode.stop();
    } catch (e) {
        console.error(e);
    }
    playNode.disconnect();
    playNode = null;
}

async function play() {
    if (!isPlaying) return;

    const dTime = performance.now() - playTime;
    onPlay(dTime);

    const i = transformCs.time2Id(dTime);
    await playId(i);

    // 按时间判断结尾而非 playI：掉帧跳过排入时 playI 可能滞后，
    // 仍需按时收尾（音频独立播完，画面正常归零）
    if (i >= transformCs.length - 1) {
        playEnd();
    }

    requestAnimationFrame(() => {
        play();
    });
}

function onPlay(dTime: number) {
    playTimeEl.sv(dTime);
    timeLineControlPoint.sv(trans2src(transformCs.time2Id(dTime)));
}

function setPlaySize() {
    canvas.width = outputV.width;
    canvas.height = outputV.height;
}

function resetPlayTime() {
    const dTime = timestamp2ms(transformCs.at(playI)?.timestamp ?? 0);
    playTime = performance.now() - dTime;
}

/** 主画面画布的覆盖代数：同一画布只能由最新一轮绘制（旧轮内容是过期位置）。
 * 只作用于主画面，与底部预览序列无关；自动刷新（afterTrans）以 willPlayI
 * 为准，与用户跳转轮绘制同一位置，不存在语义上的丢弃 */
let jumpGen = 0;
/** 仅用户跳转的解码请求挂此信号：下次用户跳转才丢弃上一轮未完成请求 */
let seekAbort: AbortController | undefined;

async function jump2id(id: TransId, signal?: AbortSignal) {
    const gen = ++jumpGen;
    const fcanvas = await mainFrameGet.getFrame(id, signal);
    if (!fcanvas) {
        if (!signal?.aborted) console.log("no frame", id);
        return;
    }
    // 已有更新的跳转，抛弃过期画面
    if (gen !== jumpGen) return;
    canvas
        .getContext("2d")
        ?.drawImage(
            fcanvas,
            ...zeroPoint,
            fcanvas.width,
            fcanvas.height,
            ...zeroPoint,
            outputV.width,
            outputV.height,
        );
    willPlayI = id;
}

async function jump2idUi(id: SrcId) {
    const transId = src2trans(id);
    if (transId === undefined) return;
    // 同步更新状态（先于暂停，使随后的自动刷新也指向新位置），
    // 快速连点时下一步基于最新位置计算
    willPlayI = transId;
    playTimeEl.sv(transformCs.getTime(transId));
    timeLineControlPoint.sv(id);
    // 分层管理：播放中跳转先停止播放层（播放循环与音频），
    // 由预览层接管，避免播放画面与跳转静止帧互相覆盖
    if (isPlaying) {
        playEl.sv(false);
        pause();
    }
    // 播放序列与新位置无关：丢弃解码队列中旧序列残留，
    // 下次播放从新位置所在 k 帧完整顺序解码，避免旧状态混杂导致花屏
    playFrameGet.resetPlaySeq();
    // 用户触发的丢弃：只抛弃上一个用户跳转轮未完成的请求
    //（自动刷新的轮次不挂此 signal，不会被丢弃）
    seekAbort?.abort();
    seekAbort = new AbortController();
    const signal = seekAbort.signal;
    // 主画面与帧轴并行加载
    await Promise.all([
        jump2id(transId, signal),
        showNowFrames(transId, false, signal),
    ]);
}

function pause() {
    isPlaying = false;
    audioStop();
    // 关闭直通绘制：暂停后迟到的解码输出全部作废，
    // 不覆盖跳转/静止帧；下次播放时重新开启
    playFrameGet.setSink(null);

    onPause();
}

async function playEnd() {
    isPlaying = false;
    audioStop();
    // 屏蔽尾部迟到输出，随后 jump2idUi 归零画面不被覆盖
    playFrameGet.setSink(null);
    playEl.sv(false);

    await playId(0 as TransId, true);
    await jump2idUi(trans2src(0 as TransId) ?? defaultSrcId);
}

function onPause() {
    // 暂停时跟随最新意图位置（跳转会先于 pause 更新 willPlayI），
    // 与用户跳转轮的窗口一致，并发填充同一批格子、天然收敛
    showNowFrames(willPlayI);
}

/** 预览轴刷新：一轮 6 帧完整获取，不因代码自动刷新而丢弃；
 * 并发轮各自填充自己的格子，最新一轮的格子在 DOM 中，天然收敛 */
async function showThumbnails() {
    const transR = await transform();
    if (!transR) return;

    const tW = 300;
    const tH = Math.floor((tW * outputV.height) / outputV.width);
    const count = 6;

    // 一次性建好占位再并行解码，避免串行等待与布局跳动
    timeLineMain.clear();
    const fills: (() => Promise<void>)[] = [];
    for (let i = 0; i < count; i++) {
        const id = Math.floor((i / count) * transformCs.length) as TransId;
        const canvasEl = ele("canvas")
            .attr({
                width: tW,
                height: tH,
            })
            .style({
                maxWidth: "100%",
                maxHeight: "100%",
            });
        timeLineMain.add(
            view()
                .style({
                    width: `calc(100% / ${count})`,
                    height: "100%",
                    pointerEvents: "none",
                })
                .add(canvasEl),
        );
        const p = thumbFrameGet.getFrame(id);
        fills.push(async () => {
            const canvas = await p;
            if (!canvas) {
                console.log("no frame", id);
                return;
            }
            canvasEl.el
                .getContext("2d")!
                .drawImage(
                    canvas,
                    ...zeroPoint,
                    outputV.width,
                    outputV.height,
                    ...zeroPoint,
                    tW,
                    tH,
                );
        });
    }
    // 并行填充：单帧较慢或失败不影响其他缩略图
    await Promise.all(fills.map((fill) => fill()));
}

/** 帧轴刷新：显示窗口 7 帧完整获取，不因代码自动刷新而丢弃；
 * 只有用户跳转（jump2idUi 的 seekAbort）才会丢弃上一轮未完成的请求。
 * 多轮并发时内容按 data-i 幂等填充，落空的格子（已被移除）自然跳过 */
async function showNowFrames(
    centerId: TransId,
    force = false,
    signal?: AbortSignal,
) {
    const transR = await transform();
    if (!transR) return;

    const tW = 300;
    const tH = Math.floor((tW * outputV.height) / outputV.width);
    /** 显示窗口半径（页面固定 7 格，不随预取变化） */
    const showHalf = 3;
    /** 预取半径：窗口外前后再多解码几帧只入缓存、不建格子，
     * 跳转进入窗口时直接缓存命中 */
    const prefetchHalf = 6;

    for (const c of timeLineFrame.queryAll(":scope > *")) {
        const i = Number(c.el.getAttribute("data-i"));
        if (force || i < centerId - showHalf || centerId + showHalf + 1 <= i) {
            c.remove();
        }
    }

    /** 需要（重新）加载的格子，全部先发出请求再并行填充 */
    const pending: { i: number; p: Promise<OffscreenCanvas | null> }[] = [];
    for (let i = centerId - showHalf; i <= centerId + showHalf; i++) {
        const id = i as TransId;
        const inRange = 0 <= i && i < transformCs.length;
        let exist = timeLineFrame.query(`[data-i="${i}"]`);
        // 越界占位变为有效帧时结构不完整，需重建
        if (exist && inRange && !exist.query("canvas")) {
            exist.remove();
            exist = null;
        }
        if (!exist) {
            // 先同步建好格子（含标题与点击），帧解码完成后再填充画面
            const cellEl = view("y")
                .style({
                    width: `calc(100% / ${showHalf * 2 + 1})`,
                    order: i,
                    padding: "4px",
                    alignItems: "center",
                })
                .data({ i: String(i) });
            if (inRange) {
                const srcId = trans2src(id) ?? defaultSrcId;
                const canvasEl = ele("canvas")
                    .attr({
                        width: tW,
                        height: tH,
                    })
                    .style({ width: "fit-content", overflow: "hidden" });
                cellEl
                    .add([
                        canvasEl,
                        view("x")
                            .style({ gap: "1em", width: "100%" })
                            .add([
                                timeEl().sv(transformCs.getTime(id)),
                                spacer(),
                                // @ts-ignore
                                String(srcId) !== String(id)
                                    ? monoTxt(String(srcId))
                                    : null,
                                monoTxt(String(id)),
                            ]),
                    ])
                    .on("click", () => {
                        jump2idUi(srcId);
                    });
                pending.push({ i, p: previewFrameGet.getFrame(id, signal) });
            }
            timeLineFrame.add(cellEl);
        } else if (inRange && exist.el.getAttribute("data-loaded") !== "1") {
            // 上一次加载被抛弃，重新填充
            pending.push({ i, p: previewFrameGet.getFrame(id, signal) });
        }
    }

    // 高亮当前帧，不等解码立即反馈
    for (const c of timeLineFrame.queryAll(":scope > *")) {
        const i = Number(c.el.getAttribute("data-i"));
        if (i === centerId) {
            c.class(timeLineFrameHl);
        } else {
            c.el.classList.remove(timeLineFrameHl);
        }
    }

    // 提前量：窗口外、预取半径内的帧与窗口请求同批发出（共享一次 flush、
    // 一条序列顺序解码），只解码入缓存、不建格子不显示；跳转进窗口时命中
    const prefetch: Promise<OffscreenCanvas | null>[] = [];
    for (let i = centerId - prefetchHalf; i <= centerId + prefetchHalf; i++) {
        if (centerId - showHalf <= i && i <= centerId + showHalf) continue;
        if (i < 0 || i >= transformCs.length) continue;
        prefetch.push(previewFrameGet.getFrame(i as TransId, signal));
    }
    // 预取不阻塞显示，失败静默（下一轮刷新自然重试）
    Promise.all(prefetch).catch((e) => console.log(e));

    // 各格独立并行填充：单格失败或较慢不影响其他格显示
    await Promise.all(
        pending.map(async ({ i, p }) => {
            const canvas = await p;
            if (!canvas) {
                console.log("no frame", i);
                return;
            }
            const cell = timeLineFrame.query(`[data-i="${i}"]`);
            const canvasEl = cell?.query("canvas");
            if (!cell || !canvasEl) return;
            canvasEl.el
                .getContext("2d")!
                .drawImage(
                    canvas,
                    ...zeroPoint,
                    outputV.width,
                    outputV.height,
                    ...zeroPoint,
                    tW,
                    tH,
                );
            cell.data({ loaded: "1" });
        }),
    );
}

function editClip(i: number) {
    type center = { x: number; y: number; ratio: number };

    const data = history.getTmpData();

    const clip = data.clipList.at(i);
    if (!clip) return;

    const rect = clip.rect;

    function rect2center(rect: clip["rect"]) {
        return {
            x: rect.x + rect.w / 2,
            y: rect.y + rect.h / 2,
            ratio: rect.w / v.width,
        };
    }

    function center2rect(center: center) {
        const w = Math.min(v.width * center.ratio, v.width);
        const h = Math.min(v.height * center.ratio, v.height);
        let x = center.x - w / 2;
        let y = center.y - h / 2;
        x = MathClamp(0, x, v.width - w);
        y = MathClamp(0, y, v.height - h);
        return { x, y, w, h };
    }

    let clipJumpGen = 0;
    async function jump2id(id: SrcId) {
        const gen = ++clipJumpGen;
        const src = await clipFrameGet.getFrame(id);
        // 已有更新的跳转，抛弃过期画面
        if (!src || gen !== clipJumpGen) return;
        clipCanvas.width = v.width;
        clipCanvas.height = v.height;
        clipCanvas.getContext("2d")?.drawImage(src, 0, 0);
        clipControl.sv(rect);
    }

    async function save() {
        canvasView.sv("play");
        history.setData(data, t("更新镜头位置"));
        history.apply();
        uiDataSave();
    }

    function reRener() {
        renderUiData(data); // todo 部分更新
    }

    const centerPoint = rect2center(rect);

    const clipMoveLast = button(t("移到上一帧")).on("click", () => {
        // todo 跳过其他clip
        const i = Math.max(0, clip.i - 1) as SrcId;
        clip.i = i;
        jump2id(i);
        reRener();
    });
    const clipMoveNext = button(t("移到下一帧")).on("click", () => {
        // todo 跳过其他clip
        const i = Math.min(listLength() - 1, clip.i + 1) as SrcId;
        clip.i = i;
        jump2id(i);
        reRener();
    });
    const clipTransition = label(
        [
            input("number")
                .attr({ min: "0", step: "100" })
                .style({
                    // @ts-ignore
                    "field-sizing": "content",
                })
                .bindSet((v: number, el) => {
                    el.value = timestamp2ms(v).toFixed(0);
                })
                .bindGet((el) => {
                    return ms2timestamp(Number(el.value));
                })
                .sv(clip.transition)
                .on("input", (_, el) => {
                    clip.transition = el.gv;
                    reRener();
                }),
            t("过渡"),
        ],
        1,
    );
    const clipRemove = button(t("删除")).on("click", () => {
        data.clipList.splice(i, 1);
        reRener();
        save();
    });
    const clipSave = button(t("保存")).on("click", () => {
        save();
    });
    const clipGiveUp = button(t("放弃")).on("click", () => {
        canvasView.sv("play");
        history.giveup();
        const nowUi = history.getData();
        renderUiData(nowUi);
    });

    const clipCanvasEl = ele("canvas").style({
        maxWidth: "100%",
        maxHeight: "100%",
    });
    const clipCanvas = clipCanvasEl.el;
    const clipControl = view()
        .style({
            position: "absolute",
            boxShadow: "0px 0px 0 1px #fff, 0px 0px 0 2px #000",
        })
        .bindSet((rect: clip["rect"], el) => {
            const w = v.width;
            const h = v.height;
            pack(el).style({
                left: `${(rect.x / w) * 100}%`,
                top: `${(rect.y / h) * 100}%`,
                width: `${(rect.w / w) * 100}%`,
                height: `${(rect.h / h) * 100}%`,
            });
        })
        .on("wheel", (e) => {
            e.preventDefault();
            centerPoint.ratio *= Math.sqrt(1 - e.deltaY / 1000);
            const r = center2rect(centerPoint);
            clipControl.sv(r);
            rect.x = r.x;
            rect.y = r.y;
            rect.w = r.w;
            rect.h = r.h;
        });

    trackPoint(clipControl, {
        start: () => {
            return { x: 0, y: 0, data: { x: centerPoint.x, y: centerPoint.y } };
        },
        ing: (p, _, { startData: sd }) => {
            const r = clipCanvas.width / clipCanvas.offsetWidth;
            const x = p.x * r;
            const y = p.y * r;
            centerPoint.x = sd.x + x;
            centerPoint.y = sd.y + y;
            const rect = center2rect(centerPoint);
            clipControl.sv(rect);
            return rect;
        },
        end: (_, { ingData }) => {
            if (ingData) {
                rect.x = ingData.x;
                rect.y = ingData.y;
                rect.w = ingData.w;
                rect.h = ingData.h;
                const cp = rect2center(rect);
                centerPoint.x = cp.x;
                centerPoint.y = cp.y;
            }
        },
    });

    clipEditor.clear().add([
        view()
            .style({
                position: "relative",
                overflow: "hidden",
                maxWidth: "100%",
                maxHeight: "100%",
            })
            .add([clipCanvas, clipControl]),
        view("x").add([
            clipMoveLast,
            clipMoveNext,
            clipRemove,
            clipTransition,
            clipSave,
            clipGiveUp,
        ]),
    ]);

    canvasView.sv("clip");

    jump2id(clip.i);
}

async function uiDataSave() {
    const transR = await transform();
    if (!transR) return;
    runAfterTrans();
}

async function save() {
    if (exportEls.type.gv === "png") await saveImages();
    else if (exportEls.type.gv === "gif")
        await saveGif({
            dither: exportConfigEls.gif.gv.dither ? "floyd-steinberg" : "none",
        });
    else if (exportEls.type.gv === "apng") await saveApng();
    else if (exportEls.type.gv === "webm")
        await saveWebm({ codec: exportConfigEls.webm.gv.codec });
    else if (exportEls.type.gv === "mp4")
        await saveMp4({ codec: exportConfigEls.mp4.gv.codec });
    else
        await saveGif({
            dither: exportConfigEls.gif.gv.dither ? "floyd-steinberg" : "none",
        });
    if (store.get("录屏.超级录屏.导出后关闭")) {
        renderSend("windowClose", []);
    }
}

function getSavePath(type: baseType) {
    return renderSendSync("save_file_path", [
        type,
        type === "mp4" || type === "webm",
    ]);
}

const audioExportBitrate = 128000;

/** 按容器支持与浏览器可编码能力选择音轨编码，不能带音频时返回 null */
async function createAudioSource(format: OutputFormat) {
    if (!transAudio) return null;
    const supported = format.getSupportedCodecs();
    const candidates: AudioCodec[] =
        format instanceof Mp4OutputFormat
            ? ["aac", "opus", "mp3"]
            : ["opus", "vorbis"];
    const list = candidates.filter((c) => supported.includes(c));
    const codec = await getFirstEncodableAudioCodec(list, {
        sampleRate: transAudio.sampleRate,
        numberOfChannels: transAudio.numberOfChannels,
        bitrate: audioExportBitrate,
    });
    if (!codec) {
        console.warn("超级录屏：没有可编码的音频编码", list);
        return null;
    }
    return new AudioBufferSource({
        codec,
        bitrate: audioExportBitrate,
    });
}

/** 本次导出本应包含音频却没有时提示 */
function tipNoAudio() {
    console.warn("超级录屏：本次导出未包含音频");
    const el = txt(t("导出未包含音频")).style({
        color: cssColor.f,
        padding: "0 4px",
    });
    transformLogEl.add(el);
    setTimeout(() => el.remove(), 8000);
}

async function saveImages() {
    // todo 大小警告
    const exportPath = getSavePath("png");
    if (!exportPath) return;

    try {
        fs.mkdirSync(exportPath, { recursive: true });
    } catch (error) {}

    await transform(); // todo 不可取消

    let i = 0;
    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            const t = frameTrans2Canvas(frame);
            t.convertToBlob({ type: "image/png" }).then(async (blob) => {
                const buffer = Buffer.from(await blob.arrayBuffer());
                fs.writeFile(
                    `${exportPath}/${frame.timestamp}.png`,
                    buffer,
                    (_err) => {},
                );
            });
            i++;
            imgProgress.sv(i / transformCs.length);
        },
        error: (e) => console.error("Decode error:", e),
    });

    const imgProgress = progressEl().addInto(transformLogEl);

    decoder.configure(decoderVideoConfig);
    for (const [_, chunk] of transformCs.entries()) {
        if (chunk.type === "key") await decoder.flush();
        decoder.decode(chunk);
    }

    await decoder.flush();

    imgProgress.remove();

    renderSend("ok_save", [exportPath]);

    decoder.close();

    console.log("decoded");
}

async function saveGif(op?: {
    dither: "floyd-steinberg" | "none";
}) {
    const exportPath = getSavePath("gif");
    if (!exportPath) return;

    const gif = GIFEncoder();

    await transform();

    let i = 0;

    const delayMap = new Map<number, number>();
    const heightDt = ms2timestamp(1000 / srcRate);
    const lowDt = ms2timestamp(1000 / 15); // todo 设置
    let lastT = 0;
    const zeroByte = (transformCs.at(0 as TransId) as EncodedVideoChunk)
        .byteLength;
    for (const [i, chunk] of transformCs.entries()) {
        if (i === 0) {
            delayMap.set(chunk.timestamp, 0);
        } else {
            const delay = chunk.timestamp - lastT;
            if (chunk.byteLength < 0.3 * zeroByte) {
                if (delay < lowDt) continue;
                delayMap.set(chunk.timestamp, timestamp2ms(delay));
                lastT = chunk.timestamp;
            } else if (delay >= heightDt * 0.8) {
                // 容错，快0.8都是可接受的
                delayMap.set(chunk.timestamp, timestamp2ms(delay));
                lastT = chunk.timestamp;
            }
        }
    }

    console.log(delayMap);

    let palette: [number, number, number][];
    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            const delay = delayMap.get(frame.timestamp);
            if (delay === undefined) {
                frame.close();
                return;
            }
            const { data, width, height } = frameTrans2Canvas(frame)
                .getContext("2d")!
                .getImageData(0, 0, outputV.width, outputV.height); // todo 导出时缩放
            const _palette = palette || quantize(data, 256);
            const d =
                op?.dither === "floyd-steinberg"
                    ? floydSteinberg(data, width, height, _palette)
                    : data;
            const index = applyPalette(d, _palette);
            gif.writeFrame(index, width, height, {
                palette: frame.timestamp === 0 ? _palette : undefined,
                delay: delayMap.get(frame.timestamp),
            });
            i++;
            gifProgress.sv(i / transformCs.length);
        },
        error: (e) => console.error("Decode error:", e),
    });

    const gifProgress = progressEl().addInto(transformLogEl);

    // 取10帧生成调色板
    let paletteCanvas: OffscreenCanvas | undefined = undefined;
    let top = 0;
    const d = Math.floor(transformCs.length / 10);
    for (const [id] of transformCs.entries()) {
        if (id % d === 0) {
            const i = await exportFrameGet.getFrame(id);
            if (i) {
                const nC = new OffscreenCanvas(i.width, top + i.height);
                if (paletteCanvas)
                    nC.getContext("2d")?.drawImage(paletteCanvas, 0, 0);
                nC.getContext("2d")?.drawImage(i, 0, top);
                top += i.height;
                paletteCanvas = nC;
            }
        }
    }
    if (paletteCanvas) {
        const ctx = paletteCanvas.getContext("2d")!;
        palette = quantize(
            ctx.getImageData(0, 0, paletteCanvas.width, paletteCanvas.height)
                .data,
            256,
        );
    }

    decoder.configure(decoderVideoConfig);
    for (const [_, chunk] of transformCs.entries()) {
        if (chunk.type === "key") await decoder.flush();
        decoder.decode(chunk);
    }

    await decoder.flush();
    decoder.close();
    gif.finish();
    const bytes = gif.bytes();
    fs.writeFileSync(exportPath, Buffer.from(bytes));

    gifProgress.remove();

    renderSend("ok_save", [exportPath]);
}

async function saveApng() {
    const exportPath = getSavePath("apng");
    if (!exportPath) return;

    await transform();

    let i = 0;

    const delayMap = new Map<number, number>();
    const heightDt = ms2timestamp(1000 / srcRate);
    const lowDt = ms2timestamp(1000 / 15); // todo 设置
    let lastT = 0;
    const zeroByte = (transformCs.at(0 as TransId) as EncodedVideoChunk)
        .byteLength;
    for (const [i, chunk] of transformCs.entries()) {
        if (i === 0) {
            delayMap.set(chunk.timestamp, 0);
        } else {
            const delay = chunk.timestamp - lastT;
            if (chunk.byteLength < 0.3 * zeroByte) {
                if (delay < lowDt) continue;
                delayMap.set(chunk.timestamp, timestamp2ms(delay));
                lastT = chunk.timestamp;
            } else if (delay >= heightDt * 0.8) {
                // 容错，快0.8都是可接受的
                delayMap.set(chunk.timestamp, timestamp2ms(delay));
                lastT = chunk.timestamp;
            }
        }
    }

    console.log(delayMap);

    const images: ArrayBuffer[] = [];
    const dels: number[] = [];
    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            const delay = delayMap.get(frame.timestamp);
            if (delay === undefined) {
                frame.close();
                return;
            }
            const { data } = frameTrans2Canvas(frame)
                .getContext("2d")!
                .getImageData(0, 0, outputV.width, outputV.height); // todo 导出时缩放
            images.push(data.buffer as ArrayBuffer);
            dels.push(delay);
            i++;
            apngProgress.sv(i / transformCs.length);
        },
        error: (e) => console.error("Decode error:", e),
    });

    const apngProgress = progressEl().addInto(transformLogEl);

    decoder.configure(decoderVideoConfig);
    for (const [_, chunk] of transformCs.entries()) {
        if (chunk.type === "key") await decoder.flush();
        decoder.decode(chunk);
    }

    await decoder.flush();
    decoder.close();

    const bytes = UPNG.encode(images, outputV.width, outputV.height, 0, dels);

    fs.writeFileSync(exportPath, Buffer.from(bytes));

    apngProgress.remove();

    renderSend("ok_save", [exportPath]);
}

async function saveWebm(op: { codec: "vp8" | "vp9" | "av1" }) {
    const exportPath = getSavePath("webm");
    if (!exportPath) return;

    await transform({ codec: op.codec });

    const output = new Output({
        format: new WebMOutputFormat({
            appendOnly: false,
        }),
        target: new BufferTarget(),
    });

    const videoSource = new EncodedVideoPacketSource(op.codec);
    output.addVideoTrack(videoSource, {
        frameRate: srcRate,
    });

    const audioSource = await createAudioSource(output.format);
    if (audioSource) output.addAudioTrack(audioSource);

    await output.start();

    for (const [_, chunk] of transformCs.entries()) {
        await videoSource.add(EncodedPacket.fromEncodedChunk(chunk), {
            decoderConfig: {
                ...decoderVideoConfig,
                codedWidth: outputV.width,
                codedHeight: outputV.height,
            },
        });
    }
    if (audioSource && transAudio) {
        await audioSource.add(transAudio);
    } else if (srcAudio) {
        tipNoAudio();
    }
    await output.finalize();
    const { buffer } = output.target;
    if (buffer) {
        fs.writeFileSync(exportPath, Buffer.from(buffer)); // todo stream
        console.log("saved webm");
        renderSend("ok_save", [exportPath, true]);
    } else {
        // todo
    }
}

async function saveMp4(op: { codec: "avc" | "vp9" | "av1" }) {
    const exportPath = getSavePath("mp4");
    if (!exportPath) return;

    await transform({ codec: op.codec });

    const output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget(),
    });

    const videoSource = new EncodedVideoPacketSource(op.codec);
    output.addVideoTrack(videoSource, {
        frameRate: srcRate,
    });

    const audioSource = await createAudioSource(output.format);
    if (audioSource) output.addAudioTrack(audioSource);

    await output.start();

    for (const [_, chunk] of transformCs.entries()) {
        await videoSource.add(EncodedPacket.fromEncodedChunk(chunk), {
            decoderConfig: {
                ...decoderVideoConfig,
                codedWidth: outputV.width,
                codedHeight: outputV.height,
            },
        });
    }
    if (audioSource && transAudio) {
        await audioSource.add(transAudio);
    } else if (srcAudio) {
        tipNoAudio();
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

function iconEl(src: IconType) {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}

function iconBEl(src: IconType, title: string) {
    return button().add(iconEl(src)).attr({ title });
}

function monoTxt(text?: string) {
    return txt(text).class(Class.mono);
}

function timeEl() {
    return monoTxt().bindSet((t: number, el) => {
        el.innerText = formatTime(t);
    });
}

renderOn("superRecorderInit", ([sourceId]) =>
    sourceIdPromise.resolve(sourceId),
);

const history = new xhistory<uiData>([], {
    clipList: [],
    eventList: [],
    speed: [],
    remove: [],
});

const codecMap = new Map<
    string,
    { codec: string; isDeAcc: boolean; isEnAcc: boolean }
>();

await (async () => {
    const codecM = new Map([
        ["av1", "av01.1.04M.08"],
        ["vp9", "vp09.00.10.08"],
        ["avc", "avc1.42001F"],
        ["vp8", "vp8"],
    ]);
    // todo 找到能用的具体编码
    async function deSupported(mc: string): Promise<0 | 2 | 1> {
        const soft = (
            await VideoDecoder.isConfigSupported({
                codec: mc,
                hardwareAcceleration: "no-preference",
            })
        ).supported;
        if (!soft) return 0;
        const acc = (
            await VideoDecoder.isConfigSupported({
                codec: mc,
                hardwareAcceleration: "prefer-hardware",
            })
        ).supported;
        return acc ? 2 : 1;
    }
    async function enSupported(mc: string): Promise<0 | 2 | 1> {
        const soft = (
            await VideoEncoder.isConfigSupported({
                codec: mc,
                hardwareAcceleration: "no-preference",
                width: screen.width,
                height: screen.height,
            })
        ).supported;
        if (!soft) return 0;
        const acc = (
            await VideoEncoder.isConfigSupported({
                codec: mc,
                hardwareAcceleration: "prefer-hardware",
                width: screen.width,
                height: screen.height,
            })
        ).supported;
        return acc ? 2 : 1;
    }
    for (const [k, c] of codecM.entries()) {
        const de = await deSupported(c);
        const en = await enSupported(c);
        if (de >= 1 || en >= 1)
            codecMap.set(k, { codec: c, isDeAcc: de === 2, isEnAcc: en === 2 });
    }
})();

const [codec, isDeAcc, isEnAcc] = (() => {
    // todo use codecMap key instead
    const l = Array.from(codecMap.values());
    if (store.get("录屏.超级录屏.编码选择") === "性能优先") {
        l.toSorted(
            (a, b) =>
                Number(b.isDeAcc) +
                Number(b.isEnAcc) -
                Number(a.isDeAcc) -
                Number(a.isEnAcc),
        );
        return [l[0].codec, l[0].isDeAcc, l[0].isEnAcc];
    }
    for (const c of codecMap.values()) {
        if (c.isDeAcc || c.isEnAcc) return [c.codec, c.isDeAcc, c.isEnAcc];
    }
    return ["vp8", false, false];
})();
const decoderVideoConfig = {
    codec: codec,
    hardwareAcceleration: isDeAcc ? "prefer-hardware" : "no-preference",
} as const;
const encoderVideoConfig = {
    codec: codec,
    hardwareAcceleration: isEnAcc ? "prefer-hardware" : "no-preference",
} as const;
const baseCodec =
    Array.from(codecMap).find(([c, v]) => v.codec === codec)?.[0] || "vp8";
console.log("codec", codecMap, decoderVideoConfig, encoderVideoConfig);

const transformCs = new videoChunk<TransId>([]);
const srcCs = new videoChunk<SrcId>([]);

/** 各 UI 层独立的帧获取序列：暂停主画面 / 帧轴 / 预览轴 / 导出 / 镜头编辑 / 播放，互不干扰 */
const mainFrameGet = transformCs.getGetter();
const previewFrameGet = transformCs.getGetter();
const thumbFrameGet = transformCs.getGetter();
const exportFrameGet = transformCs.getGetter();
const clipFrameGet = srcCs.getGetter();
const playFrameGet = transformCs.getGetter();

const trans2srcM = new Map<number, number>();
const src2transM = new Map<number, number>();
const trans2src = (id: TransId) => {
    const nid = MathClamp(0, id, transformCs.length - 1);
    return trans2srcM.get(nid) as SrcId;
};
const src2trans = (id: SrcId) => {
    const nid = MathClamp(0, id, srcCs.length - 1);
    return src2transM.get(nid) as TransId;
};

const transformTask = new Set<(value: true | null) => void>();
let lastTransformAbort: AbortController | undefined;

/** 迟到帧过滤基线：暂停/结束时由 sink 关闭作废，
 * 播放意图回退时由 playId 重置，保证输出按时间单调绘制不回跳 */
let playLastDrawTs = 0;
/** 播放输出直通绘制：不拷贝入缓存（保持单次 drawImage 路径），
 * 丢弃迟到的旧帧——解码供给跟不上时掉帧，但时间与音频继续、维持播放 */
const drawPlayFrame = (frame: VideoFrame) => {
    if (frame.timestamp < playLastDrawTs) return;
    playLastDrawTs = frame.timestamp;
    canvas
        .getContext("2d")
        ?.drawImage(
            frame,
            ...zeroPoint,
            frame.codedWidth,
            frame.codedHeight,
            ...zeroPoint,
            outputV.width,
            outputV.height,
        );
};

const stopPEl = view("y")
    .style({
        width: "100vw",
        height: "100vh",
        backgroundColor: cssColor.bg,
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9,
        justifyContent: "center",
        alignItems: "center",
    })
    .class(Class.gap)
    .addInto();
view()
    .style({ width: "80px", height: "80px" })
    .add(iconEl("stop_record").style({ filter: "none" }))
    .addInto(stopPEl)
    .on("click", () => {
        stopPEl.remove();
        stopRecord();
    });

// 录制面板：音频输入控制与音量电平
const audioLevelInEl = view().style({
    width: "0%",
    height: "100%",
    backgroundColor: cssColor.main,
});
const audioLevelEl = view()
    .style({ width: "120px", height: "8px", overflow: "hidden" })
    .class(Class.deco)
    .add(audioLevelInEl);
let lastLevelT = 0;
audioCapture.onLevel((level) => {
    const now = performance.now();
    if (now - lastLevelT < 100) return;
    lastLevelT = now;
    audioLevelInEl.style({ width: `${Math.min(1, level * 4) * 100}%` });
});

function saveAudioNames() {
    store.set("录屏.音频.设备列表", audioCapture.activeIds());
}

const audioListEl = view("y")
    .style({
        display: "none",
        maxHeight: "30vh",
        overflowY: "auto",
        minWidth: "200px",
        maxWidth: "60vw",
        padding: cssVar("o-padding"),
    })
    .class(Class.deco);

async function renderAudioList() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((i) => i.kind === "audioinput");
    const canSys = store.get("录屏.音频.启用系统内录");
    const sysKey = audioCapture.sysKey;
    const sysEl = label([check(""), t("系统音频")])
        .attr({
            title: canSys ? "系统内录" : "开启才可以在界面进一步选择是否内录",
        })
        .sv(audioCapture.isActive(sysKey))
        .on("input", async (_, el) => {
            if (!canSys) {
                el.sv(false);
                return;
            }
            const ok = await audioCapture.setSystem(el.gv);
            el.sv(ok && audioCapture.isActive(sysKey));
            if (ok) saveAudioNames();
        });
    const micEls = mics.map((i) =>
        label([check(""), i.label || i.deviceId])
            .style({
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            })
            .sv(audioCapture.isActive(audioCapture.micKey(i.deviceId)))
            .on("input", async (_, el) => {
                const key = audioCapture.micKey(i.deviceId);
                const ok = await audioCapture.setMic(i.deviceId, el.gv);
                el.sv(ok && audioCapture.isActive(key));
                if (ok) saveAudioNames();
            }),
    );
    audioListEl
        .clear()
        .add([
            ...micEls,
            sysEl,
            mics.length === 0 && !canSys ? txt(t("无音频输入设备")) : null,
        ]);
}

let audioListShow = false;
const audioBtn = iconBEl("mic", "选择输入音频").on("click", () => {
    audioListShow = !audioListShow;
    audioListEl.style({ display: audioListShow ? "flex" : "none" });
    if (audioListShow) renderAudioList();
});

stopPEl.add(
    view("y")
        .class(Class.gap)
        .style({ alignItems: "center" })
        .add([
            view("x")
                .class(Class.gap)
                .style({ alignItems: "center" })
                .add([audioBtn, audioLevelEl]),
            audioListEl,
        ]),
);

const canvasEl = ele("canvas").style({
    overflow: "hidden",
    width: "fit-content",
});
const canvas = canvasEl.el;

const clipEditor = view("y").style({
    alignItems: "center",
    overflow: "hidden",
});

const canvasView = view("y")
    .style({ flexGrow: 1, overflow: "hidden", alignItems: "center" })
    .add([canvasEl, clipEditor])
    .addInto()
    .bindSet((type: "play" | "clip") => {
        if (type === "play") {
            canvasEl.style({ display: "block" });
            clipEditor.style({ display: "none" });
        } else {
            canvasEl.style({ display: "none" });
            clipEditor.style({ display: "flex" });
        }
    })
    .sv("play");

const actionsEl = view("x")
    .style({ justifyContent: "center", alignItems: "center" })
    .addInto();
const playEl = check("", [
    iconEl("pause").style({ display: "block" }),
    iconEl("recume").style({ display: "block" }),
]).on("input", async () => {
    if (playEl.gv) {
        const transR = await transform();
        if (!transR) {
            // 被新的转换取代，恢复未播放状态
            playEl.sv(false);
            return;
        }
        // afterTrans 可能正在重同步播放解码器，等它完成再播放
        await afterTransTask;
        isPlaying = true;
        // 开启输出直通绘制（pause/playEnd 会关闭，防止迟到输出覆盖静止帧）
        playFrameGet.setSink(drawPlayFrame);
        if (playI === transformCs.length - 1) {
            playI = 0 as TransId;
        }
        if (willPlayI !== playI) {
            await playId(willPlayI);
        }

        resetPlayTime();
        audioStart(timestamp2ms(transformCs.at(playI)?.timestamp ?? 0));
        play();
    } else {
        pause();
    }
});

const lastFrame = iconBEl("last", "上一帧").on("click", (e) => {
    const x = e.shiftKey ? 100 : e.ctrlKey ? 10 : 1;
    const id = Math.max(willPlayI - x, 0) as TransId;
    jump2idUi(trans2src(id));
});
const nextFrame = iconBEl("next", "下一帧").on("click", (e) => {
    const x = e.shiftKey ? 100 : e.ctrlKey ? 10 : 1;
    const id = Math.min(willPlayI + x, transformCs.length - 1) as TransId;
    jump2idUi(trans2src(id));
});
const lastKey = iconBEl("last_last", "上一秒").on("click", (e) => {
    const x = e.shiftKey ? 60 : e.ctrlKey ? 10 : 1;
    const id = Math.max(willPlayI - srcRate * x, 0) as TransId;
    jump2idUi(trans2src(id));
});
const nextKey = iconBEl("next_next", "下一秒").on("click", (e) => {
    const x = e.shiftKey ? 60 : e.ctrlKey ? 10 : 1;
    const id = Math.min(
        willPlayI + srcRate * x,
        transformCs.length - 1,
    ) as TransId;
    jump2idUi(trans2src(id));
});

const nowTimeEl = (total?: () => number) => {
    const el = view("x");
    const t = timeEl().sv(0);
    const all = timeEl().sv(0);
    let tt = 0;
    return el.add(total ? [t, "/", all] : t).bindSet((time: number | null) => {
        const nt = time ?? tt;
        tt = nt;
        t.sv(nt);
        if (total) all.sv(total());
    });
};

const playTimeEl = nowTimeEl(() => {
    return transformCs.getDuration() || srcCs.getDuration();
});

actionsEl.add([
    view()
        .class(Class.group)
        .add([lastKey, lastFrame, playEl, nextFrame, nextKey]),
    playTimeEl,
]);

const transformLogEl = view("x").addInto();

const progressEl = () => {
    const el = view("x");
    const p = view()
        .style({
            width: "200px",
            height: "20px",
            overflow: "hidden",
        })
        .class(Class.deco);
    const pi = view().addInto(p).style({
        width: "0%",
        height: "100%",
        backgroundColor: cssColor.main,
        borderRadius: "inherit",
    });
    const t = monoTxt();

    return el.add([p, t]).bindSet((progress: number) => {
        pi.style({ width: `${progress * 100}%` });
        t.sv(`${(progress * 100).toFixed(2)}%`);
    });
};

const transformProgressEl = progressEl();

const transformTimeEl = txt();

const transformCodec = monoTxt()
    .bindSet((x: [string, boolean, boolean], el) => {
        let c = t("未知编码");
        for (const [k, v] of codecMap.entries()) {
            if (v.codec === x[0]) {
                c = k;
                break;
            }
        }
        el.innerText = c;
        el.setAttribute(
            "data-title",
            `${x[0]} ${x[1] ? t("硬解") : t("软解")} ${x[2] ? t("硬编") : t("软编")}`,
        );
        el.onclick = () => {
            navigator.clipboard.writeText(x[0]);
        };
    })
    .sv([codec, isDeAcc, isEnAcc]);

const actionUndo = iconBEl("left", "撤回").on("click", async () => {
    history.undo();
    renderUiData(history.getData());
    await transform();
});
const actionList = dynamicSelect();
actionList.el.on("change", async () => {
    history.jump(Number(actionList.el.gv));
    renderUiData(history.getData());
    await transform();
});
const actionUnundo = iconBEl("right", "重做").on("click", async () => {
    history.unundo();
    renderUiData(history.getData());
    await transform();
});

history.on("change", () => {
    console.log("h", history.getData());
    actionList.setList(
        history.list.map((h, i) => ({ value: String(i), name: h })),
    );
    actionList.el.sv(String(history.index));
});

transformLogEl
    .style({ gap: "4px", alignItems: "center", padding: "var(--o-padding)" })
    .add([
        view("x")
            .add([actionUndo, actionList.el, actionUnundo])
            .class(Class.group),
        transformProgressEl,
        transformTimeEl,
        transformCodec,
    ]);

const timeLineMain = view("x")
    .style({ height: "80px" })
    .addInto()
    .on("click", (e) => {
        const p = e.offsetX / timeLineMain.el.offsetWidth;
        const id = transformCs.time2Id(
            p * transformCs.getDuration(),
        ) as TransId;
        jump2idUi(trans2src(id) ?? defaultSrcId);
    });

const timeLineControlP = view()
    .style({
        overflowX: "scroll",
        flexShrink: 0,
        paddingRight: "calc(100% - 300px)",
    })
    .addInto()
    .attr({ title: "[Shift+滚轮] 移动\n[滚轮] 缩放" })
    .on("wheel", (e) => {
        e.preventDefault();
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        timeLineControlP.el.scrollLeft += dx;
        const x = e.clientX - timeLineControl.el.getBoundingClientRect().left;
        const zoom = timeLineControl.gv;
        const dz = Math.sqrt(1 + dy / 1000);
        const nz = zoom * dz;
        const nx = x * dz;
        timeLineControlP.el.scrollLeft += nx - x;
        timeLineControl.sv(nz);
    });
const timeLineControl = view("y")
    .style({ position: "relative" })
    .class(
        addClass(
            {},
            {
                "& > *": {
                    position: "relative",
                    width: "100%",
                    height: "20px",
                },
                "& > * > *": {
                    position: "absolute",
                    minWidth: "4px",
                    height: "100%",
                    borderRadius: "4px",
                    color: "white",
                },
            },
        ),
    )
    .addInto(timeLineControlP)
    .bindSet((zoom: number) => {
        const nz = Math.max(300 / listLength(), zoom);
        timeLineControl
            .style({ width: `${nz * listLength()}px` })
            .data({ zoom: String(nz) });
    })
    .bindGet((el) => {
        return Number(el.getAttribute("data-zoom"));
    });
const timeLineControlPoint = view()
    .style({
        position: "absolute",
        top: 0,
        left: 0,
        width: "2px",
        height: "100%",
        backgroundColor: "red",
        pointerEvents: "none",
    })
    .addInto(timeLineControl)
    .bindSet((i: SrcId, el) => {
        el.style.left = `${(i / listLength()) * 100}%`;
    });

view()
    .addInto(timeLineControl)
    .on("click", (e) => {
        const p = e.offsetX / timeLineControl.el.offsetWidth;
        const id = Math.floor(p * listLength()) as SrcId;
        jump2idUi(id);
    });

const timeLineClip = () => {
    const el = view().addInto(timeLineControl);

    function ipx(n: number) {
        return `${(n / listLength()) * 100}%`;
    }

    function render(data: uiData["clipList"]) {
        el.clear();

        for (const [i, c] of data.entries()) {
            const isRemoved = history
                .getData()
                .remove.find((r) => r.start <= c.i && r.end >= c.i);
            const transId = src2trans(c.i);
            const beforeId = isRemoved
                ? c.i
                : trans2src(
                      transformCs.time2Id(
                          timestamp2ms(
                              (transformCs.at(transId)?.timestamp ?? 0) -
                                  c.transition,
                          ),
                      ) as TransId,
                  );
            view()
                .addInto(el)
                .attr({ title: "点击编辑" })
                .style({
                    left: ipx(beforeId),
                    width: ipx(c.i - beforeId + 1),
                    backgroundColor: "red",
                })
                .on("click", () => {
                    editClip(i);
                });
        }
    }

    function setData(data: uiData["clipList"]) {
        render(data);
    }

    el.el.ondblclick = (e) => {
        if (e.target === e.currentTarget) {
            const data = history.getData();
            const i = Math.floor(
                (e.offsetX / el.el.offsetWidth) * listLength(),
            );
            const newClip: clip = {
                i: i as SrcId,
                rect: { x: 0, y: 0, w: v.width, h: v.height },
                transition: ms2timestamp(400),
            };
            data.clipList.push(newClip);

            history.setData(data);
            renderUiData(data);
            editClip(data.clipList.length - 1);
        }
    };

    return { setData, el };
};

const timeLineTrack = <D>(op: {
    el: (
        el: ElType<HTMLElement>,
        data: { start: SrcId; end: SrcId; value: D },
    ) => void;
    newValue: () => D;
    setValue?: (el: ElType<HTMLElement>, data: D) => Promise<D>;
    on: (data: { start: SrcId; end: SrcId; value: D }[]) => void;
}) => {
    let data: { start: SrcId; end: SrcId; id: string; value: D }[] = [];
    const track = view().addInto(timeLineControl);

    function setData(d: { start: SrcId; end: SrcId; value: D }[]) {
        data = structuredClone(d).map((d) => ({ ...d, id: uuid() }));
        render();
    }
    function ipx(n: number) {
        return `${(n / listLength()) * 100}%`;
    }
    function i2px(i: number) {
        return (i / listLength()) * track.el.offsetWidth;
    }
    function px2i(px: number) {
        return Math.floor((px / track.el.offsetWidth) * listLength()) as SrcId;
    }
    function getX(e: PointerEvent) {
        const x = e.screenX - track.el.getBoundingClientRect().left;
        return x;
    }
    function itemEl(d: (typeof data)[0]) {
        const el = view()
            .data({ id: d.id })
            .attr({ title: op.setValue ? "点击编辑\n右键删除" : "右键删除" });
        setItemEl(d, el);
        op.el(el, d);
        track.add(el);
    }
    function setItemEl(d: (typeof data)[0], el: ElType<HTMLElement>) {
        el.style({
            left: ipx(d.start),
            width: ipx(d.end - d.start + 1),
        });
    }
    function render(changeElId?: string) {
        if (changeElId) {
            const da = data.find((d) => d.id === changeElId);
            if (!da) {
                console.warn("找不到对应元素", changeElId);
                return;
            }
            const el = track.query(
                `[data-id="${changeElId}"]`,
            ) as ElType<HTMLElement>;
            if (el) {
                setItemEl(da, el);
            } else {
                itemEl(da);
            }
            return;
        }
        track.clear();
        for (const d of data) {
            itemEl(d);
        }
    }
    function getMouseType(x: number) {
        let type: "start" | "center" | "end" | "none" = "none";
        let itemId = "";
        for (const d of data) {
            const s = i2px(d.start);
            const e = i2px(d.end);
            if (s - 2 <= x && x <= s + 2) {
                type = "start";
                itemId = d.id;
                break;
            }
            if (e - 2 <= x && x <= e + 2) {
                type = "end";
                itemId = d.id;
                break;
            }
            if (s <= x && x <= e) {
                type = "center";
                itemId = d.id;
                break;
            }
        }
        return {
            type: type,
            itemId: itemId,
        };
    }
    function on(_data: typeof data) {
        data = structuredClone(_data);
        op.on(
            _data.map((i) => {
                const { id, ...x } = i;
                return x;
            }),
        );
    }

    function limitLeft(d: (typeof data)[0], pi: SrcId) {
        const oldStart = d.start;
        const left = Math.max(
            ...data.map((d) => d.end).filter((s) => s < oldStart),
            -1,
        );
        return MathClamp(left + 1, oldStart + pi, d.end) as SrcId;
    }

    function limitRight(d: (typeof data)[0], pi: SrcId) {
        const oldEnd = d.end;
        const right = Math.min(
            ...data.map((d) => d.start).filter((e) => e > oldEnd),
            listLength(),
        );
        return MathClamp(d.start, oldEnd + pi, right - 1) as SrcId;
    }

    trackPoint(track, {
        all: (e) => {
            const x = getX(e);
            const { type } = getMouseType(x);
            if (type === "center") {
                track.style({ cursor: "grabbing" });
            } else if (type === "end") {
                track.style({ cursor: "w-resize" });
            } else if (type === "start") {
                track.style({ cursor: "e-resize" });
            } else {
                track.style({ cursor: "default" });
            }
        },
        start: (e) => {
            const x = getX(e);
            let { type, itemId } = getMouseType(x);
            if (type === "none") {
                const i = px2i(x);
                const d = {
                    start: i,
                    end: i,
                    id: uuid(),
                    value: op.newValue(),
                };
                data.push(d);
                render(d.id);
                itemId = d.id;
            }
            return {
                x: 0,
                y: 0,
                data: {
                    type: type,
                    d: data.find((d) => d.id === itemId)!,
                    el: track.query(`[data-id="${itemId}"]`)!,
                },
            };
        },
        ing: (p, _e, { startData: sd }) => {
            const pi = px2i(p.x);
            if (!sd.d || !sd.el) return null;
            const d = structuredClone(sd.d);
            const newD = structuredClone(d);
            if (sd.type === "none") {
                if (pi > 0) {
                    newD.end = limitRight(d, pi);
                }
                if (pi < 0) {
                    newD.start = limitLeft(d, pi);
                }
            }
            if (sd.type === "start") {
                newD.start = limitLeft(d, pi);
            }
            if (sd.type === "end") {
                newD.end = limitRight(d, pi);
            }
            if (sd.type === "center") {
                const width = d.end - d.start;
                const newS = d.start + pi;
                const newE = d.end + pi;

                const l = data
                    .filter((i) => i.id !== d.id)
                    .toSorted((a, b) => a.start - b.start);
                const canIn0: { start: number; end: number }[] = [];
                for (let i = 0; i < l.length; i++) {
                    const e = l[i].start - 1;
                    const s = (l[i - 1]?.end ?? -1) + 1;
                    canIn0.push({ start: s, end: e });
                }
                canIn0.push({
                    start: (l.at(-1)?.end ?? -1) + 1,
                    end: listLength() - 1,
                });
                const canIn = canIn0.filter(
                    (i) => i.start <= i.end && i.end - i.start >= width,
                );
                const canInSpread = canIn.map((x, i) => {
                    const last = canIn[i - 1];
                    const next = canIn[i + 1];
                    const s = last ? (last.end + x.start) / 2 : x.start;
                    const e = next ? (next.start + x.end) / 2 : x.end;
                    return { start: s, end: e };
                });

                const inI =
                    canIn[
                        canInSpread.findIndex(
                            (i) =>
                                i.start <= newS + width / 2 &&
                                newS + width / 2 <= i.end,
                        )
                    ];

                newD.start = MathClamp(
                    inI.start,
                    newS,
                    inI.end - width,
                ) as SrcId;
                newD.end = MathClamp(inI.start + width, newE, inI.end) as SrcId;
            }
            setItemEl(newD, sd.el);
            return newD;
        },
        end: (e, { ingData, startData }) => {
            if (!ingData) {
                if (startData.type === "center") {
                    if (op.setValue && e.button === 0) {
                        op.setValue(startData.el, startData.d.value).then(
                            (newValue) => {
                                const d = data.find(
                                    (d) => d.id === startData.d.id,
                                );
                                if (!d) return;
                                d.value = newValue;
                                op.el(startData.el, d);
                                on(data);
                            },
                        );
                    }
                    if (e.button !== 0) {
                        startData.el.remove();
                        const ndata = data.filter(
                            (i) => i.id !== startData.d.id,
                        );
                        on(ndata);
                    }
                }
                return;
            }
            const d = data.find((d) => d.id === ingData.id);
            if (!d) return;
            d.start = ingData.start;
            d.end = ingData.end;
            on(data);
        },
    });

    return { setData, el: track };
};

const timeLineClipEl = timeLineClip();
timeLineClipEl.el
    .style({
        backgroundColor: "#f001",
    })
    .attr({ title: "双击新建镜头" });
const timeLineSpeedEl = timeLineTrack({
    el: (el, data) => {
        el.style({
            backgroundColor: "#00f",
            fontSize: "min(100%, 16px)",
            lineHeight: "100%",
        })
            .clear()
            .class(
                addClass(
                    {},
                    {
                        "&>select": { background: "inherit" },
                        "&>select>option": { background: "inherit" },
                    },
                ),
            )
            .add(txt(`${data.value}x`));
    },
    newValue: () => 2,
    setValue: (el, data) => {
        const speedList = [1.25, 1.5, 2, 2.25, 2.5, 3, 6, 8, 10];
        const { promise, resolve } = Promise.withResolvers<number>();
        const s = select(
            speedList.map((i) => ({ value: String(i), name: `${i}x` })),
        )
            .style({ maxHeight: "100%" })
            .sv(String(data))
            .on("input", () => {
                resolve(Number(s.gv));
            })
            .on("pointerdown", (e) => e.stopPropagation());
        el.clear().add(s);
        s.el.showPicker();
        return promise;
    },
    on: (data) => {
        history.setDataF((uiData) => {
            uiData.speed = data;
            return uiData;
        }, t("更新速度"));
        history.apply();
        uiDataSave().then(() => {
            timeLineClipEl.setData(history.getData().clipList);
        });
    },
});
timeLineSpeedEl.el
    .style({
        backgroundColor: "#00f1",
    })
    .attr({ title: "拖动新建速度" });
const timeLineEventEl = timeLineTrack({
    el: (el) => {
        el.style({
            backgroundColor: "#0f0",
        });
    },
    newValue: () => null,
    on: (data) => {
        history.setDataF((uiData) => {
            uiData.eventList = data;
            return uiData;
        }, t("更新事件"));
        history.apply();
        uiDataSave();
    },
});
timeLineEventEl.el.style({
    backgroundColor: "#0f01",
});
const timeLineRemoveEl = timeLineTrack({
    el: (el) => {
        el.style({
            backgroundColor: "#000",
        });
    },
    newValue: () => null,
    on: (data) => {
        history.setDataF((uiData) => {
            uiData.remove = data.map((d) => ({ start: d.start, end: d.end }));
            return uiData;
        }, t("更新移除"));
        history.apply();
        uiDataSave().then(() => {
            timeLineClipEl.setData(history.getData().clipList);
        });
    },
});
timeLineRemoveEl.el
    .style({
        backgroundColor: "#0001",
    })
    .attr({ title: "拖动删除区间" });

const timeLineFrame = view("x")
    .style({ minHeight: "150px", gap: "8px" })
    .addInto();
const timeLineFrameHl = addClass(
    {
        border: `solid 1px ${cssColor.f}`,
        borderRadius: "var(--border-radius)",
    },
    {},
);

const exportConfigEls = {
    gif: (() => {
        const el = view("x").style({ paddingInline: "8px" });
        const dither = label([check("dither"), "平滑颜色"]).style({
            display: "flex",
            alignItems: "center",
        });
        el.add(dither);
        return el
            .bindGet(() => ({
                dither: dither.gv,
            }))
            .bindSet((v: { dither: boolean }) => {
                dither.sv(v.dither);
            });
    })(),
    apng: view(),
    mp4: (() => {
        const el = view("x").style({ paddingInline: "8px" });
        const codec = label(
            [
                select([
                    { value: "avc" },
                    { value: "vp9" },
                    { value: "av1" },
                ] as const).class(Class.noDeco),
                "编码",
            ],
            1,
        )
            .style({
                display: "flex",
                alignItems: "center",
            })
            // @ts-ignore
            .sv(baseCodec);
        el.add(codec);
        return el
            .bindGet(() => ({
                codec: codec.gv,
            }))
            .bindSet((v: { codec: "vp9" | "avc" | "av1" }) => {
                codec.sv(v.codec);
            });
    })(),
    webm: (() => {
        const el = view("x").style({ paddingInline: "8px" });
        const codec = label(
            [
                select([
                    { value: "vp8" },
                    { value: "vp9" },
                    { value: "av1" },
                ] as const).class(Class.noDeco),
                "编码",
            ],
            1,
        )
            .style({
                display: "flex",
                alignItems: "center",
            })
            // @ts-ignore
            .sv(baseCodec);
        el.add(codec);
        return el
            .bindGet(() => ({
                codec: codec.gv,
            }))
            .bindSet((v: { codec: "vp8" | "vp9" | "av1" }) => {
                codec.sv(v.codec);
            });
    })(),
    png: view("x"),
} satisfies Record<(typeof outputType)[number]["type"], ElType<HTMLElement>>;

const exportPx = dynamicSelect();

// 新建 Record 变量存储 UI 元素
const exportEls = {
    type: select(outputType.map((t) => ({ value: t.type, name: t.name }))).on(
        "change",
        (_, el) => {
            const type = el.gv;
            store.set("录屏.超级录屏.格式", type);
            const config = exportConfigEls[type];
            exportEls.exportConfig.clear().add(config);
        },
    ),
    exportConfig: view("x").class(Class.deco).style({ alignItems: "center" }),
};

const exportEl = frame("export", {
    _: view("x")
        .style({
            padding: cssVar("o-padding"),
        })
        .class(Class.gap),
    _x: {
        _: view("x").class(Class.group),
        export: iconBEl("save", "保存").on("click", save),
        type: exportEls.type,
    },
    exportConfig: exportEls.exportConfig,
    _s: spacer(),
    px: exportPx.el,
    editClip: iconBEl("draw", "编辑").on("click", async () => {
        const canvas = await mainFrameGet.getFrame(willPlayI);
        if (!canvas) return;
        canvas.convertToBlob({ type: "image/png" }).then(async (blob) => {
            const buffer = Buffer.from(await blob.arrayBuffer());
            renderSend("edit_pic", [buffer]);
        });
    }),
    editSrc: button(t("编辑原图")).on("click", async () => {
        const canvas = await clipFrameGet.getFrame(trans2src(willPlayI));
        if (!canvas) return;
        canvas.convertToBlob({ type: "image/png" }).then(async (blob) => {
            const buffer = Buffer.from(await blob.arrayBuffer());
            renderSend("edit_pic", [buffer]);
        });
    }),
});

// @ts-ignore
exportEls.type.sv(store.get("录屏.超级录屏.格式") ?? "gif");
const exconfig = exportConfigEls[exportEls.type.gv];
exportEls.exportConfig.clear().add(exconfig);

exportEl.el.addInto();

pack(document.body).style({
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
});

(async () => {
    if (testMode) return;
    const sourceId = await sourceIdPromise.promise;
    let stream: MediaStream | undefined;
    const audioDevices = store.get("录屏.音频.设备列表");
    const wantSysAudio =
        store.get("录屏.音频.启用系统内录") &&
        audioDevices.includes(sysAudioId);
    const videoConstraint = {
        mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: sourceId,
        },
    };
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: wantSysAudio
                ? {
                      // @ts-ignore
                      mandatory: {
                          chromeMediaSource: "desktop",
                      },
                  }
                : false,
            // @ts-ignore
            video: videoConstraint,
        });
    } catch (e) {
        console.error(e);
    }
    if (!stream && wantSysAudio) {
        // 系统内录获取失败时回退为纯视频，保证录制可用
        console.warn("超级录屏：获取系统音频失败，回退为无音频");
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                // @ts-ignore
                video: videoConstraint,
            });
        } catch (e) {
            console.error(e);
        }
    }
    if (!stream) return;

    audioCapture.setSourceId(sourceId);
    audioCapture.setSystemTrack(
        wantSysAudio ? (stream.getAudioTracks()[0] ?? null) : null,
        stream,
        wantSysAudio,
    );
    audioCapture.initFromSettings();

    const videoTrack = stream.getVideoTracks()[0];

    const encoder = new VideoEncoder({
        output: (c: EncodedVideoChunk) => {
            encodedChunks.push(c);
            encodeSize += c.byteLength;
            const freeMem = getFreeMemory();
            const willUseMem = encodeSize * 2; // 未来编辑时会复制一份，*2是考虑到稳帧
            if (freeMem - willUseMem < 20 * 1024 * 1024) {
                console.warn("内存不足，停止录制");
                stopRecord();
            } else if (freeMem - willUseMem < 50 * 1024 * 1024) {
                renderSend("recordMemWarning", []);
            }
        },
        error: (e) => console.error("Encode error:", e),
    });

    const videoWidth = videoTrack.getSettings().width ?? screen.width;
    const videoHeight = videoTrack.getSettings().height ?? screen.height;

    encoder.configure({
        ...encoderVideoConfig,
        width: videoWidth,
        height: videoHeight,
        framerate: srcRate,
        bitrate: bitrate,
    });
    v.width = videoWidth;
    v.height = videoHeight;

    exportPx.setList(
        [1, 2, 3, 4, 8].map((i) => ({
            value: String(i),
            name: `/${i} ${Math.round(v.width / i)} x ${Math.round(v.height / i)}`,
        })),
    );

    exportPx.el.on("change", async () => {
        const x = Number(exportPx.el.gv);
        store.set("录屏.超级录屏.缩放", x);
        outputV.width = Math.round(v.width / x);
        outputV.height = Math.round(v.height / x);
        setPlaySize();
        const transR = await transform({
            size: `${outputV.width}x${outputV.height}`,
        });
        if (!transR) return;
        runAfterTrans();
    });

    const lastR = store.get("录屏.超级录屏.缩放") ?? 1;

    exportPx.el.sv(String(lastR));

    outputV.width = Math.round(videoWidth / lastR);
    outputV.height = Math.round(videoHeight / lastR);

    const reader = new MediaStreamTrackProcessor({
        track: videoTrack,
    }).readable.getReader();

    // 读取视频帧并编码

    let encodedChunks: EncodedVideoChunk[] = [];
    let encodeSize = 0;

    const keys: superRecording = [];
    keys.push({ time: performance.now(), isStart: true, posi: { x: 0, y: 0 } });
    initKeys((x) => {
        keys.push({
            time: performance.now(),
            posi: mousePosi,
            ...x,
        });
    });
    const lisenerS = new AbortController();
    window.addEventListener(
        "focus",
        () => {
            keys.push({
                time: performance.now(),
                posi: mousePosi,
                wFoucus: true,
            });
        },
        { signal: lisenerS.signal },
    );
    window.addEventListener(
        "blur",
        () => {
            keys.push({
                time: performance.now(),
                posi: mousePosi,
                wBlur: true,
            });
        },
        { signal: lisenerS.signal },
    );

    stopRecord = async (cancel?: boolean) => {
        stopRecord = () => {}; // 只运行一次

        console.log("stop");

        uIOhook.stop();
        lisenerS.abort();

        reader.cancel();

        const audioStop = audioCapture
            .stop(encodedChunks.at(0)?.timestamp)
            .catch((e: unknown) => {
                console.error(e);
                return null;
            });

        if (cancel) {
            renderSend("windowClose", []);
            return;
        }

        renderSend("windowMax", []);

        await encoder.flush();
        encoder.close();

        srcAudio = await audioStop;

        history.apply();

        const afterCuncks = await afterRecord(encodedChunks);
        // @ts-ignore
        encodedChunks = null;

        console.log(afterCuncks);
        console.log(keys);

        srcCs.setList(afterCuncks);

        mapKeysOnFrames(afterCuncks, keys);

        onPlay(0);

        const transR = await transform();

        setPlaySize();

        if (transR) {
            runAfterTrans();
        }

        const nowUi = history.getData();
        renderUiData(nowUi);
        timeLineControl.sv(window.innerWidth / listLength());
    };

    const recordTime = nowTimeEl();
    stopPEl.add(
        view("x")
            .add([
                recordTime,
                iconBEl("close", "取消录制").on("click", () => {
                    stopRecord(true);
                }),
            ])
            .style({ alignItems: "center" }),
    );

    let lastTime = performance.now();

    let encodedI = 0;
    while (true) {
        const { done, value: videoFrame } = await reader.read();
        if (done) break;
        audioCapture.noteVideoTs(videoFrame.timestamp);
        if (encoder.encodeQueueSize > 2) {
            videoFrame.close();
        } else {
            encoder.encode(videoFrame, {
                keyFrame: encodedI % frameLength === 0,
            });
            encodedI++;
            videoFrame.close();
        }

        const nowTime = performance.now();
        if (nowTime - lastTime > 300) {
            lastTime = nowTime;
            recordTime.sv(nowTime - keys[0].time);
        }
    }
})();

// @ts-ignore
if (testMode !== false) {
    renderSend("windowMax", []);
    stopPEl.remove();
}

// @ts-ignore
if (testMode === "getFrame") {
    const s: EncodedVideoChunk[] = [];
    const encoder = new VideoEncoder({
        output: (c: EncodedVideoChunk) => {
            s.push(c);
        },
        error: (e) => console.error("Encode error:", e),
    });
    encoder.configure({
        ...encoderVideoConfig,
        width: 1920,
        height: 1080,
    });
    for (let i = 0; i < 600; i++) {
        const canvas = new OffscreenCanvas(1920, 1080);
        const ctx = canvas.getContext("2d")!;
        // 写数字
        ctx.font = "80px Arial";
        ctx.fillStyle = "red";
        ctx.fillText(String(i), 100, 100);
        const frame = new VideoFrame(canvas, {
            timestamp: i * (1000 / srcRate),
        });
        encoder.encode(frame, { keyFrame: i % frameLength === 0 });
        frame.close();
    }
    await encoder.flush();
    encoder.close();
    const x = new videoChunk([]);
    await x.setList(s);

    // 性能测试
    const t0 = performance.now();
    for (let i = 140; i < 160; i++) {
        console.log("test", String(i));
        await x.getFrame(i);
    }
    const t1 = performance.now();
    console.log("顺序解码", (t1 - t0) / 20);
    const t2 = performance.now();
    for (let i = 0; i < 20; i++) {
        console.log("test", String(i));
        const index = Math.floor(Math.random() * x.length);
        await x.getFrame(index);
    }
    const t3 = performance.now();
    console.log("随机解码", (t3 - t2) / 20);
    // 正确解码
    const show = view().addInto();
    for (let i = 0; i < 10; i++) {
        const index =
            i === 0 ? frameLength : Math.floor(Math.random() * x.length);
        const canvas = await x.getFrame(index);
        if (!canvas) continue;
        show.add(String(index));
        const c = ele("canvas")
            .attr({ width: canvas.width, height: canvas.height })
            .addInto(show);
        const ctx = c.el.getContext("2d")!;
        ctx.drawImage(canvas, 0, 0);
    }
}

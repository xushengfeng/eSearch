import type { superRecording } from "../../ShareTypes";
import {
    addClass,
    button,
    check,
    ele,
    type ElType,
    frame,
    input,
    label,
    pack,
    pureStyle,
    select,
    trackPoint,
    txt,
    view,
    image,
    dynamicSelect,
} from "dkh-ui";
import { getImgUrl, initStyle } from "../root/root";
import store from "../../../lib/store/renderStore";

const { ipcRenderer } = require("electron") as typeof import("electron");
const { uIOhook } = require("uiohook-napi") as typeof import("uiohook-napi");
const fs = require("node:fs") as typeof import("fs");

import { GIFEncoder, quantize, applyPalette } from "gifenc";

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

const zeroPoint = [0, 0] as const;

const keys: superRecording = [];

let lastUiData: uiData | null = null;
const lastTransOpt: { codec: string; size: string } = {
    codec: "",
    size: "0x0",
};

let lastEncodedChunks: (EncodedVideoChunk | null)[] = [];

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
    // { type: "apng", name: "apng" }, // todo
    // { type: "avif", name: "avif" }, // todo
    { type: "webm", codec: "vp8", name: "webm-vp8" },
    { type: "webm", codec: "vp9", name: "webm-vp9" },
    { type: "webm", codec: "av1", name: "webm-av1" },
    { type: "mp4", codec: "avc", name: "mp4-avc" },
    { type: "mp4", codec: "vp9", name: "mp4-vp9" },
    { type: "mp4", codec: "av1", name: "mp4-av1" },
    { type: "png", name: "png" },
] as const;

let isPlaying = false;
let playI: TransId = 0 as TransId;
let willPlayI: TransId = 0 as TransId;
let playTime = 0;

// let isEditClip = false;

let mousePosi: { x: number; y: number } = { x: 0, y: 0 };

class videoChunk<Id extends number> {
    private srcList: (EncodedVideoChunk | null)[] = [];
    list: EncodedVideoChunk[] = [];

    private _timestamp2Id = new Map<number, number>();
    private tasks = new Map<number, ((OffscreenCanvas) => void)[]>();
    private willDecodeIs = new Set<number>();
    private lastAddDecodeI = -1;
    private frameDecoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            const id = this._timestamp2Id.get(frame.timestamp) as number;
            const tasks = this.tasks.get(id) ?? [];
            for (const task of tasks) {
                task(frameTrans2Canvas(frame)); // 克隆 // todo 优化
            }
            if (tasks.length > 0) this.tasks.delete(id);
            this.willDecodeIs.delete(id);
            frame.close();
        },
        error: (e) => console.error("Decode error:", e),
    });

    constructor(_list: (EncodedVideoChunk | null)[]) {
        this.frameDecoder.configure(decoderVideoConfig);
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

        await this.frameDecoder.flush();
        this.lastAddDecodeI = -1;

        console.log(
            "size",
            `${this.#byte2mb(this.#sumChunckSize(this.list))}mb`,
        );
    }
    get length() {
        return this.list.length;
    }
    #on(i: number, cb: (OffscreenCanvas: OffscreenCanvas | null) => void) {
        if (i >= this.length) {
            cb(null);
        }
        const task = this.tasks.get(i) ?? [];
        task.push(cb);
        this.tasks.set(i, task);
        if (!this.willDecodeIs.has(i)) {
            // 要么在当前解码序列之后，要么在其他片段
            // 在当前解码序列之后，可以补充序列，在其他片段，则要重新添加序列（因为k帧已经不同了）
            // todo 延迟decode的调用，那就有可能补救
            // todo 缓存部分帧
            const thisKey = this.list
                .slice(0, i + 1)
                .findLastIndex((c) => c.type === "key");

            const nowDecodingKey = this.list
                .slice(0, this.lastAddDecodeI + 1)
                .findLastIndex((c) => c.type === "key");

            const startI =
                thisKey === nowDecodingKey ? this.lastAddDecodeI : thisKey;

            for (let j = startI; j <= i; j++) {
                const c = this.list[j];
                this.frameDecoder.decode(c);
                this.willDecodeIs.add(j);
            }

            this.lastAddDecodeI = i;
        }
    }
    async getFrame(index: Id) {
        const { promise, resolve } =
            Promise.withResolvers<OffscreenCanvas | null>();
        this.#on(index, (c) => resolve(c));
        await this.frameDecoder.flush(); // 不调用总有4个帧没解码完
        this.lastAddDecodeI = -1;
        return promise;
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

class xhistory<Data> {
    history: { data: Data; time: number; des: string }[];
    i = -1;
    private tmpData: Data | null = null;
    private des = "";
    private changeEvent = new Set<() => void>();
    constructor(datas: typeof this.history, _initData: Data) {
        this.history = datas;
        this.history.unshift({
            des: "初始化",
            data: _initData,
            time: new Date().getTime(),
        });
    }

    getTmpData() {
        return structuredClone(this.tmpData) ?? this.getData();
    }

    setDataF(fun: (data: Data) => Data, des?: string) {
        this.tmpData = fun(this.getTmpData());
        if (des) this.des += ` ${des}`;
    }
    setData(data: Data, des?: string) {
        this.tmpData = data;
        if (des) this.des += ` ${des}`;
    }

    apply(des = this.des) {
        const data = structuredClone(this.tmpData);
        if (data) {
            this.history.push({ data, time: new Date().getTime(), des });
        }
        this.i = this.history.length - 1;
        this.des = "";
        for (const f of this.changeEvent) {
            f();
        }
    }
    giveup() {
        this.tmpData = null;
        this.des = "";
    }

    getData() {
        return structuredClone(this.history.at(this.i)?.data as Data);
    }
    undo() {
        this.jump(this.i - 1);
    }
    unundo() {
        this.jump(this.i + 1);
    }
    jump(i: number) {
        this.i = MathClamp(0, i, this.history.length - 1);
    }

    on(name: "change", fun: () => void) {
        if (name === "change") this.changeEvent.add(fun);
    }
}

function uuid() {
    return crypto.randomUUID();
}

function MathClamp(min: number, value: number, max: number) {
    return Math.min(Math.max(min, value), max);
}

function frameTrans2Canvas(frame: VideoFrame) {
    const canvas = new OffscreenCanvas(frame.codedWidth, frame.codedHeight);
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(frame, 0, 0);
    frame.close();
    return canvas;
}

function listLength() {
    return srcCs.length;
}

function initKeys() {
    function push(x: Omit<superRecording[0], "time" | "posi">) {
        keys.push({
            time: performance.now(),
            posi: mousePosi,
            ...x,
        });
    }
    uIOhook.on("keydown", (e) => {
        push({
            keydown: e.keycode.toString(),
        });
    });

    uIOhook.on("keyup", (e) => {
        push({
            keyup: e.keycode.toString(),
        });
    });

    const map = { 1: 0, 2: 1, 3: 2 } as const;

    uIOhook.on("mousedown", (e) => {
        push({
            mousedown: map[e.button as number],
        });
    });
    uIOhook.on("mouseup", (e) => {
        push({
            mouseup: map[e.button as number],
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
    transformTimeEl.sv("补帧中...");
    // 补帧
    const m = new Map<number, number>();
    const d = Math.floor(ms2timestamp(1000 / srcRate));
    let index = 0;
    const frames = frameLength;
    const encodedChunks: EncodedVideoChunk[] = [];
    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            const t = frame.timestamp;
            encoder.encode(frame, { keyFrame: index % frames === 0 });
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
    let lastTime = 0;
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

function mapKeysOnFrames(chunks: EncodedVideoChunk[]) {
    const startTime = keys.find((k) => k.isStart)?.time;
    if (!startTime) {
        console.log(keys);
        throw new Error("no start key");
    }
    const newKeys = keys
        .map((i) => ({ ...i, time: i.time - startTime }))
        .filter((i) => i.time > 0);
    // 获取关键时间
    let lastK: (typeof newKeys)[0] | undefined = undefined;
    const nk = newKeys.filter(
        (k) =>
            "keydown" in k ||
            "keyup" in k ||
            "mousedown" in k ||
            "mouseup" in k,
    );
    const nk2: typeof newKeys = [];
    for (const k of nk) {
        if (k.time - (lastK?.time ?? 0) > 500) {
            nk2.push(k);
        }
        lastK = k;
    }

    const clipList: uiData["clipList"] = [];

    for (const k of nk2) {
        const t = ms2timestamp(k.time);
        const chunk = chunks.findIndex(
            (c, i) =>
                c.timestamp <= t &&
                t < (chunks[i + 1]?.timestamp ?? Number.POSITIVE_INFINITY),
        );
        if (chunk === -1) continue;
        const w = v.width / 3;
        const h = v.height / 3;
        const x = MathClamp(0, k.posi.x - w / 2, v.width - w);
        const y = MathClamp(0, k.posi.y - h / 2, v.height - h);
        clipList.push({
            i: chunk as SrcId,
            rect: { x, y, w: w, h: h },
            transition: ms2timestamp(400),
        });
    }

    history.setDataF((uidata) => {
        uidata.clipList = clipList;
        return uidata;
    }, "分析创建镜头位置");
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

async function transform(op?: Partial<typeof lastTransOpt>) {
    // todo cancel last transform
    lastTransformAbort?.abort();
    const { promise, resolve } = Promise.withResolvers<true | null>();
    for (const task of transformTask) {
        task(null);
    }
    transformTask.clear();
    transformTask.add(resolve);

    lastTransformAbort = new AbortController();
    runTransform(op, lastTransformAbort.signal)
        .then(() => {
            for (const task of transformTask) {
                task(true);
            }
        })
        .catch((e) => {
            console.log(e);
        });

    return promise;
}

async function runTransform(
    op?: Partial<typeof lastTransOpt>,
    signal = new AbortController().signal,
) {
    if (signal.aborted) return;

    const nowUi = history.getData();

    const forceRerendAll = (() => {
        for (const [i, v] of Object.entries(op ?? {})) {
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
        transformTimeEl.sv("开始处理");
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
        const c = codecMap.get(op?.codec ?? "");
        encoder.configure({
            ...(c
                ? {
                      codec: c.codec,
                      hardwareAcceleration: c.isEnAcc
                          ? "prefer-hardware"
                          : "no-preference",
                  }
                : encoderVideoConfig),
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

        function abort() {
            console.log("transform abort");
            decoder.close();
            encoder.close();
        }

        signal.addEventListener("abort", abort);

        if (!signal.aborted) {
            /**@see {@link ../../docs/develop/superRecorder.md#转换（编辑）} */
            await decoder.flush();
            await encoder.flush();
            signal.removeEventListener("abort", abort);
            decoder.close();
            encoder.close();

            const Tend = performance.now();

            transformTimeEl.sv(
                `处理帧数：${needDecode.size} 处理：${((Tend - Tdiff) / needDecode.size).toFixed(0)}ms/帧 总耗时：${(Tend - Tdiff).toFixed(0)}ms`,
            );
        }
    }

    if (signal.aborted) return;

    for (const i in op) lastTransOpt[i] = op[i];
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
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
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
    await showThumbnails();
    await showNowFrames(oldI);
    await playDecoder.flush();
    await playId(0 as TransId, true);
    await playId(oldI, true);
    onPlay(transformCs.getTime(oldI));
}

async function playId(i: TransId, force = false) {
    if (i === playI && !force) return;

    const c = transformCs.at(i);
    if (!c) {
        console.log("no chunk", i);
        return;
    }
    if (c.type === "key") {
        playDecoder.decode(c);
        playI = i;
        willPlayI = i;
        return;
    }
    const beforeId = transformCs.list
        .slice(0, i)
        .findLastIndex((c) => c.type === "key");

    const fillI = i < playI || playI < beforeId ? beforeId : playI + 1;

    for (let n = fillI; n < i; n++) {
        playDecoder.decode(transformCs.at(n as TransId) as EncodedVideoChunk);
    }
    playDecoder.decode(c);
    playI = i;
    willPlayI = i;
    console.log("play", playI);
}

async function play() {
    if (!isPlaying) return;

    const dTime = performance.now() - playTime;
    onPlay(dTime);

    const i = transformCs.time2Id(dTime);
    await playId(i);

    if (playI === transformCs.length - 1) {
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

async function jump2id(id: TransId) {
    const fcanvas = await transformCs.getFrame(id);
    if (!fcanvas) {
        console.log("no frame", id);
        return;
    }
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
    playTimeEl.sv(transformCs.getTime(transId));
    timeLineControlPoint.sv(id);
    await jump2id(transId);
    await showNowFrames(transId);
}

function pause() {
    isPlaying = false;

    onPause();
}

async function playEnd() {
    isPlaying = false;
    playEl.sv(false);

    await playId(0 as TransId, true);
    await jump2idUi(trans2src(0 as TransId) ?? 0);
}

function onPause() {
    showNowFrames(playI);
}

async function showThumbnails() {
    const transR = await transform();
    if (!transR) return;
    timeLineMain.clear();
    for (let i = 0; i < 6; i++) {
        const id = Math.floor((i / 6) * transformCs.length) as TransId;
        const canvas = await transformCs.getFrame(id);
        if (!canvas) {
            console.log("no frame", id);
            continue;
        }
        const tW = 300;
        const tH = Math.floor((tW * outputV.height) / outputV.width);

        const canvasEl = ele("canvas")
            .attr({
                width: tW,
                height: tH,
            })
            .style({
                maxWidth: "100%",
                maxHeight: "100%",
            });
        (canvasEl.el.getContext("2d") as CanvasRenderingContext2D).drawImage(
            canvas,
            ...zeroPoint,
            outputV.width,
            outputV.height,
            ...zeroPoint,
            tW,
            tH,
        );
        timeLineMain.add(
            view()
                .style({
                    width: "calc(100% / 6)",
                    height: "100%",
                    pointerEvents: "none",
                })
                .add(canvasEl),
        );
    }
}

async function showNowFrames(centerId: TransId, force = false) {
    const transR = await transform();
    if (!transR) return;
    const hasI: number[] = [];
    for (const c of timeLineFrame.queryAll(":scope > *")) {
        const i = Number(c.el.getAttribute("data-i"));
        if (force || i < centerId - 3 || centerId + 4 <= i) {
            c.remove();
        } else {
            hasI.push(i);
        }
    }
    for (let i = centerId - 3; i < centerId + 4; i++) {
        if (hasI.includes(i)) continue;
        const id = i as TransId;
        const c = view("y")
            .style({ width: "calc(100% / 7)", order: i })
            .data({ i: String(i) });

        const tW = 300;
        const tH = Math.floor((tW * outputV.height) / outputV.width);

        if (0 <= i && i < transformCs.length) {
            const canvas = await transformCs.getFrame(id);
            if (!canvas) {
                console.log("no frame", id);
                continue;
            }
            const canvasEl = ele("canvas")
                .attr({
                    width: tW,
                    height: tH,
                })
                .style({ width: "fit-content", overflow: "hidden" })
                .on("click", () => {
                    jump2idUi(trans2src(id) ?? 0);
                });
            (
                canvasEl.el.getContext("2d") as CanvasRenderingContext2D
            ).drawImage(
                canvas,
                ...zeroPoint,
                outputV.width,
                outputV.height,
                ...zeroPoint,
                tW,
                tH,
            );
            c.add(canvasEl);
            c.add(timeEl().sv(transformCs.getTime(id)));
        }
        timeLineFrame.add(c);
    }

    for (const c of timeLineFrame.queryAll(":scope > *")) {
        const i = Number(c.el.getAttribute("data-i"));
        if (i === centerId) {
            c.class(timeLineFrameHl);
        } else {
            c.el.classList.remove(timeLineFrameHl);
        }
    }
}

function editClip(i: number) {
    type center = { x: number; y: number; ratio: number };

    const data = history.getData();

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

    async function jump2id(id: SrcId) {
        const src = await srcCs.getFrame(id);
        if (!src) return;
        clipCanvas.width = v.width;
        clipCanvas.height = v.height;
        clipCanvas.getContext("2d")?.drawImage(src, 0, 0);
        clipControl.sv(rect);
    }

    async function save() {
        canvasView.sv("play");
        history.setData(data, "更新镜头位置");
        history.apply();
        uiDataSave();
    }

    function reRener() {
        renderUiData(data); // todo 部分更新
    }

    const centerPoint = rect2center(rect);

    const clipMoveLast = button("移到上一帧").on("click", () => {
        // todo 跳过其他clip
        const i = Math.max(0, clip.i - 1) as SrcId;
        clip.i = i;
        jump2id(i);
        reRener();
    });
    const clipMoveNext = button("移到下一帧").on("click", () => {
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
            "过渡",
        ],
        1,
    );
    const clipRemove = button("删除").on("click", () => {
        data.clipList.splice(i, 1);
        reRener();
        save();
    });
    const clipSave = button("保存").on("click", () => {
        save();
    });
    const clipGiveUp = button("放弃").on("click", () => {
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
    afterTrans();
}

async function save() {
    if (exportEl.els.type.gv === "png") saveImages();
    else if (exportEl.els.type.gv === "gif") saveGif();
    else if (exportEl.els.type.gv === "webm-av1") saveWebm("av1");
    else if (exportEl.els.type.gv === "webm-vp9") saveWebm("vp9");
    else if (exportEl.els.type.gv === "webm-vp8") saveWebm("vp8");
    else if (exportEl.els.type.gv === "mp4-av1") saveMp4("av1");
    else if (exportEl.els.type.gv === "mp4-vp9") saveMp4("vp9");
    else if (exportEl.els.type.gv === "mp4-avc") saveMp4("avc");
}

function getSavePath(type: baseType) {
    return ipcRenderer.sendSync(
        "get_save_file_path",
        type,
        type === "mp4" || type === "webm",
    );
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

    ipcRenderer.send("ok_save", exportPath);

    decoder.close();

    console.log("decoded");
}

async function saveGif() {
    const exportPath = getSavePath("gif");
    if (!exportPath) return;

    const gif = GIFEncoder();

    await transform();

    let i = 0;

    const delayMap = new Map<number, number>();
    for (const [i, chunk] of transformCs.entries()) {
        if (i === 0) delayMap.set(chunk.timestamp, 0);
        else {
            const delay =
                chunk.timestamp -
                (transformCs.at((i - 1) as TransId) as EncodedVideoChunk)
                    .timestamp;
            delayMap.set(chunk.timestamp, timestamp2ms(delay));
        }
    }

    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            const { data, width, height } = (
                frameTrans2Canvas(frame).getContext(
                    "2d",
                ) as OffscreenCanvasRenderingContext2D
            ).getImageData(0, 0, outputV.width, outputV.height);
            const palette = quantize(data, 256);
            const index = applyPalette(data, palette);
            gif.writeFrame(index, width, height, {
                palette,
                delay: delayMap.get(frame.timestamp) ?? 1000 / srcRate,
            });
            i++;
            gifProgress.sv(i / transformCs.length);
        },
        error: (e) => console.error("Decode error:", e),
    });

    const gifProgress = progressEl().addInto(transformLogEl);

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

    ipcRenderer.send("ok_save", exportPath);
}

async function saveWebm(_codec: "vp8" | "vp9" | "av1") {
    const exportPath = getSavePath("webm");
    if (!exportPath) return;

    const { Muxer, ArrayBufferTarget } = require("webm-muxer") as typeof import(
        "webm-muxer"
    );
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: `V_${_codec.toUpperCase()}`,
            width: outputV.width,
            height: outputV.height,
            frameRate: srcRate,
        },
    });

    await transform({ codec: _codec });

    for (const [_, chunk] of transformCs.entries()) {
        muxer.addVideoChunk(chunk);
    }
    muxer.finalize();
    const { buffer } = muxer.target;
    fs.writeFileSync(exportPath, Buffer.from(buffer));
    console.log("saved webm");
    ipcRenderer.send("ok_save", exportPath, true);
}

async function saveMp4(_codec: "avc" | "vp9" | "av1") {
    const exportPath = getSavePath("mp4");
    if (!exportPath) return;

    const { Muxer, ArrayBufferTarget } = require("mp4-muxer") as typeof import(
        "mp4-muxer"
    );
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: _codec,
            width: outputV.width,
            height: outputV.height,
            frameRate: srcRate,
        },
        fastStart: false,
    });

    await transform({ codec: _codec });

    for (const [_, chunk] of transformCs.entries()) {
        muxer.addVideoChunk(chunk);
    }
    muxer.finalize();
    const { buffer } = muxer.target;
    fs.writeFileSync(exportPath, Buffer.from(buffer));
    console.log("saved mp4");
    ipcRenderer.send("ok_save", exportPath, true);
}

// @auto-path:../assets/icons/$.svg
function iconBEl(src: string) {
    return button().add(image(getImgUrl(`${src}.svg`), "icon").class("icon"));
}

function timeEl() {
    return txt()
        .style({ fontFamily: "var(--monospace)" })
        .bindSet((t: number, el) => {
            el.innerText = formatTime(t);
        });
}

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
console.log("codec", codecMap, decoderVideoConfig, encoderVideoConfig);

const transformCs = new videoChunk<TransId>([]);
const srcCs = new videoChunk<SrcId>([]);

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

const playDecoder = new VideoDecoder({
    output: (frame: VideoFrame) => {
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
        ctx.drawImage(
            frame,
            ...zeroPoint,
            frame.codedWidth,
            frame.codedHeight,
            ...zeroPoint,
            outputV.width,
            outputV.height,
        );
        frame.close();
    },
    error: (e) => console.error("Decode error:", e),
});
playDecoder.configure(decoderVideoConfig);

initStyle(store);

const stopPEl = view("y")
    .style({
        width: "100vw",
        height: "100vh",
        backgroundColor: "white",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9,
        justifyContent: "center",
        alignItems: "center",
    })
    .addInto();
view()
    .style({
        width: "64px",
        height: "64px",
        borderRadius: "16px",
        backgroundColor: "red",
    })
    .addInto(stopPEl)
    .on("click", () => {
        stopPEl.remove();
        stopRecord();
    });

const recordTime = timeEl().sv(0);

stopPEl.add(
    view("x")
        .add([
            recordTime,
            iconBEl("close").on("click", () => {
                stopRecord(true);
            }),
        ])
        .style({ alignItems: "center" }),
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
    iconBEl("pause").style({ display: "block" }),
    iconBEl("recume").style({ display: "block" }),
]).on("input", async () => {
    if (playEl.gv) {
        const transR = await transform();
        if (!transR) return;
        isPlaying = true;
        if (playI === transformCs.length - 1) {
            playI = 0 as TransId;
        }
        if (willPlayI !== playI) {
            await playId(willPlayI);
        }

        resetPlayTime();
        play();
    } else {
        pause();
    }
});

const lastFrame = iconBEl("last").on("click", () => {
    const id = Math.max(willPlayI - 1, 0) as TransId;
    jump2idUi(trans2src(id) ?? willPlayI);
});
const nextFrame = iconBEl("next").on("click", () => {
    const id = Math.min(willPlayI + 1, transformCs.length - 1) as TransId;
    jump2idUi(trans2src(id) ?? willPlayI);
});
// const lastKey = button("<<");
// const nextKey = button(">>");

const playTimeEl = (() => {
    const el = view("x");
    const t = timeEl().sv(0);
    const all = timeEl().sv(0);
    let tt = 0;
    return el.add([t, "/", all]).bindSet((time: number | null) => {
        const nt = time ?? tt;
        tt = nt;
        t.sv(nt);
        all.sv(transformCs.getDuration() || srcCs.getDuration());
    });
})();

actionsEl.add([lastFrame, playEl, nextFrame, playTimeEl]);

const transformLogEl = view("x").addInto();

const progressEl = () => {
    const el = view("x");
    const p = view().style({
        width: "200px",
        height: "20px",
        borderRadius: "4px",
        backgroundColor: "#eee",
        overflow: "hidden",
    });
    const pi = view()
        .addInto(p)
        .style({ width: "0%", height: "100%", backgroundColor: "#000" });
    const t = txt().style({ fontFamily: "var(--monospace)" });

    return el.add([p, t]).bindSet((progress: number) => {
        pi.style({ width: `${progress * 100}%` });
        t.sv(`${(progress * 100).toFixed(2)}%`);
    });
};

const transformProgressEl = progressEl();

const transformTimeEl = txt();

const actionUndo = iconBEl("left")
    .style({ width: "24px", height: "24px" })
    .on("click", async () => {
        history.undo();
        renderUiData(history.getData());
        await transform();
    });
const actionList = dynamicSelect();
actionList.el
    .on("change", async () => {
        history.jump(Number(actionList.el.gv));
        renderUiData(history.getData());
        await transform();
    })
    .style({
        height: "24px",
        // @ts-ignore
        fieldSizing: "content",
    });
const actionUnundo = iconBEl("right")
    .style({ width: "24px", height: "24xp" })
    .on("click", async () => {
        history.unundo();
        renderUiData(history.getData());
        await transform();
    });

history.on("change", () => {
    console.log("h", history.getData());
    actionList.setList(
        history.history.map((h, i) => ({ value: String(i), name: h.des })),
    );
    actionList.el.sv(String(history.i));
});

transformLogEl.add([
    view("x").add([actionUndo, actionList.el, actionUnundo]),
    transformProgressEl,
    transformTimeEl,
]);

const timeLineMain = view("x")
    .style({ height: "80px" })
    .addInto()
    .on("click", (e) => {
        const p = e.offsetX / timeLineMain.el.offsetWidth;
        const id = transformCs.time2Id(
            p * transformCs.getDuration(),
        ) as TransId;
        jump2idUi(trans2src(id) ?? 0);
    });

const timeLineControl = view("y")
    .style({ position: "relative", flexShrink: 0 })
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
    .addInto();
const timeLineControlPoint = view()
    .style({
        position: "absolute",
        top: 0,
        left: 0,
        width: "2px",
        height: "100%",
        backgroundColor: "red",
    })
    .addInto(timeLineControl)
    .bindSet((i: SrcId, el) => {
        el.style.left = `${(i / listLength()) * 100}%`;
    });

view()
    .addInto(timeLineControl)
    .on("click", (e) => {
        const p = e.offsetX / timeLineMain.el.offsetWidth;
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
        data = d.map((d) => ({ ...d, id: uuid() }));
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
        const el = view().data({ id: d.id });
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
    function render() {
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
                itemEl(d);
                type = "end";
                itemId = d.id;
            }
            return {
                x: 0,
                y: 0,
                data: {
                    type: type,
                    d: data.find((d) => d.id === itemId) as (typeof data)[0],
                    el: track.query(
                        `[data-id="${itemId}"]`,
                    ) as ElType<HTMLElement>,
                },
            };
        },
        ing: (p, _e, { startData: sd }) => {
            const pi = px2i(p.x);
            if (!sd.d || !sd.el) return;
            const d = structuredClone(sd.d);
            const newD = structuredClone(d);
            if (sd.type === "start") {
                const oldStart = sd.d.start;
                const left = Math.max(
                    ...data.map((d) => d.end).filter((s) => s < oldStart),
                    -1,
                );
                newD.start = MathClamp(left + 1, oldStart + pi, d.end) as SrcId;
            }
            if (sd.type === "end") {
                const oldEnd = d.end;
                const right = Math.min(
                    ...data.map((d) => d.start).filter((e) => e > oldEnd),
                    listLength(),
                );
                newD.end = MathClamp(d.start, oldEnd + pi, right - 1) as SrcId;
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
timeLineClipEl.el.style({
    backgroundColor: "#f001",
});
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
        }, "更新速度");
        history.apply();
        uiDataSave().then(() => {
            timeLineClipEl.setData(history.getData().clipList);
        });
    },
});
timeLineSpeedEl.el.style({
    backgroundColor: "#00f1",
});
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
        }, "更新事件");
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
        }, "更新移除");
        history.apply();
        uiDataSave().then(() => {
            timeLineClipEl.setData(history.getData().clipList);
        });
    },
});
timeLineRemoveEl.el.style({
    backgroundColor: "#0001",
});

const timeLineFrame = view("x").style({ height: "150px" }).addInto();
const timeLineFrameHl = addClass({ border: "solid 1px #000" }, {});

const exportPx = select([]);

const exportEl = frame("export", {
    _: view("x"),
    export: iconBEl("save").on("click", save),
    type: select(
        outputType
            .filter(
                (i) =>
                    !("codec" in i) || ("codec" in i && codecMap.has(i.codec)),
            )
            .map((t) => ({ value: t.name })),
    ),
    px: exportPx,
    editClip: iconBEl("draw").on("click", async () => {
        const canvas = await transformCs.getFrame(willPlayI);
        if (!canvas) return;
        canvas.convertToBlob({ type: "image/png" }).then(async (blob) => {
            const buffer = Buffer.from(await blob.arrayBuffer());
            ipcRenderer.send("ding_edit", buffer);
        });
    }),
    editSrc: button("编辑原图").on("click", async () => {
        const canvas = await srcCs.getFrame(trans2src(willPlayI));
        if (!canvas) return;
        canvas.convertToBlob({ type: "image/png" }).then(async (blob) => {
            const buffer = Buffer.from(await blob.arrayBuffer());
            ipcRenderer.send("ding_edit", buffer);
        });
    }),
});

exportEl.el.addInto();

pureStyle();

pack(document.body).style({
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
});

ipcRenderer.on("record", async (_e, _t, sourceId) => {
    if (testMode) return;
    let stream: MediaStream | undefined;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: "desktop",
                    chromeMediaSourceId: sourceId,
                },
            },
        });
    } catch (e) {
        console.error(e);
    }
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];

    const encoder = new VideoEncoder({
        output: (c: EncodedVideoChunk) => {
            encodedChunks.push(c);
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

    for (const x of [1, 2, 4, 8]) {
        exportPx.add(
            ele("option").attr({
                value: String(x),
                text: `/${x} ${Math.round(v.width / x)} x ${Math.round(v.height / x)}`,
            }),
        );
    }
    exportPx
        .on("change", async () => {
            const x = Number(exportPx.gv);
            outputV.width = Math.round(v.width / x);
            outputV.height = Math.round(v.height / x);
            setPlaySize();
            const transR = await transform({
                size: `${outputV.width}x${outputV.height}`,
            });
            if (!transR) return;
            afterTrans();
        })
        .sv("2");

    outputV.width = Math.round(videoWidth / 2);
    outputV.height = Math.round(videoHeight / 2);

    // @ts-ignore
    const reader = new MediaStreamTrackProcessor({
        track: videoTrack,
    }).readable.getReader();

    // 读取视频帧并编码

    let encodedChunks: EncodedVideoChunk[] = [];

    initKeys();
    keys.push({ time: performance.now(), isStart: true, posi: { x: 0, y: 0 } });

    stopRecord = async (cancel?: boolean) => {
        stopRecord = () => {}; // 只运行一次

        console.log("stop");

        uIOhook.stop();

        reader.cancel();

        if (cancel) {
            ipcRenderer.send("window", "close");
            return;
        }

        ipcRenderer.send("window", "max");

        await encoder.flush();
        encoder.close();

        history.apply();

        const afterCuncks = await afterRecord(encodedChunks);
        // @ts-ignore
        encodedChunks = null;

        console.log(afterCuncks);
        console.log(keys);

        srcCs.setList(afterCuncks);

        mapKeysOnFrames(afterCuncks);

        onPlay(0);

        const transR = await transform();

        setPlaySize();

        if (transR) {
            afterTrans();
        }

        const nowUi = history.getData();
        renderUiData(nowUi);
    };

    setTimeout(() => stopRecord(), 5 * 60 * 1000); // 5分钟后自动停止录制

    let lastTime = performance.now();

    while (true) {
        const { done, value: videoFrame } = await reader.read();
        if (done) break;
        if (encoder.encodeQueueSize > 2) {
            videoFrame.close();
        } else {
            encoder.encode(videoFrame);
            videoFrame.close();
        }

        const nowTime = performance.now();
        if (nowTime - lastTime > 300) {
            lastTime = nowTime;
            recordTime.sv(nowTime - keys[0].time);
        }
    }
});

// @ts-ignore
if (testMode !== false) {
    ipcRenderer.send("window", "max");
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
        const ctx = canvas.getContext(
            "2d",
        ) as OffscreenCanvasRenderingContext2D;
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
        const ctx = c.el.getContext("2d") as CanvasRenderingContext2D;
        ctx.drawImage(canvas, 0, 0);
    }
}

// @ts-ignore
if (testMode === "history") {
    const history = new xhistory<string>([], "");

    function logList() {
        const l = structuredClone(history.history);
        console.log(l);
        return l;
    }

    console.assert(history.getData() === "");
    logList();

    history.setData("hi");
    console.assert(history.getData() === "");
    logList();

    history.apply();
    console.assert(history.getData() === "hi");
    logList();

    history.setData("hello");
    history.apply();

    history.setData("world");
    history.apply();

    history.undo();
    console.assert(history.getData() === "hello");

    history.undo();
    console.assert(history.getData() === "hi");

    history.unundo();
    console.assert(history.getData() === "hello");
    logList();

    history.setData("end");
    history.apply();
    const l = logList();
    console.assert(
        JSON.stringify(["", "hi", "hello", "world"]),
        JSON.stringify(l.map((i) => i.data)),
    );
}

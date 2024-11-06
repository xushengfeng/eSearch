import type { superRecording } from "../../ShareTypes";
import { button, check, ele, frame, select, view } from "dkh-ui";

const { ipcRenderer } = require("electron") as typeof import("electron");
const { uIOhook } = require("uiohook-napi") as typeof import("uiohook-napi");
const fs = require("node:fs") as typeof import("fs");
const path = require("node:path") as typeof import("path");

import { GIFEncoder, quantize, applyPalette } from "gifenc";

const keys: superRecording = [];

let src: EncodedVideoChunk[] = [];
let transformed: EncodedVideoChunk[] = [];

type clip = {
    i: number;
    rect: { x: number; y: number; w: number; h: number };
    transition: number; // 往前数
};

type uiData = {
    clipList: clip[];
    speed: { start: number; end: number; value: number }[];
    eventList: { start: number; end: number; value: unknown }[]; // todo
    remove: { start: number; end: number }[];
};

type FrameX = {
    rect: { x: number; y: number; w: number; h: number };
    timestamp: number;
    event: unknown[];
    isRemoved: boolean;
};

// let lastUiData: uiData | null = null;

const history: uiData[] = [];

// todo 自适应分辨率/用户设定分辨率
const outputV = {
    width: 1920 / 2,
    height: 1080 / 2,
};

// 原始分辨率
// todo 节省内存，可以降低原始分辨率，像鼠标坐标也要缩小
const v = {
    width: 100,
    height: 100,
};

const codec = "vp8";
const srcRate = 30;
const bitrate = 16 * 1024 * 1024;

const outputType = [
    { type: "png", name: "png" },
    { type: "gif", name: "gif" },
    { type: "webp", name: "webp" },
    { type: "apng", name: "apng" },
    { type: "avif", name: "avif" },
    { type: "webm", codec: "vp8", name: "webm-vp8" },
    { type: "webm", codec: "vp9", name: "webm-vp9" },
    { type: "webm", codec: "av1", name: "webm-av1" },
    { type: "mp4", codec: "avc", name: "mp4-avc" },
    { type: "mp4", codec: "vp9", name: "mp4-vp9" },
    { type: "mp4", codec: "av1", name: "mp4-av1" },
] as const;
type baseType = (typeof outputType)[number]["type"];

let isPlaying = false;
let playI = 0;
let playTime = 0;

const playDecoder = new VideoDecoder({
    output: (frame: VideoFrame) => {
        const ctx = canvas.getContext("2d");
        ctx.drawImage(
            frame,
            0,
            0,
            frame.codedWidth,
            frame.codedHeight,
            0,
            0,
            outputV.width,
            outputV.height,
        );
        frame.close();
    },
    error: (e) => console.error("Decode error:", e),
});
playDecoder.configure({
    codec: codec,
});

let lastDecodeFrame: OffscreenCanvas | null = null;
const frameDecoder = new VideoDecoder({
    output: (frame: VideoFrame) => {
        const canvas = new OffscreenCanvas(frame.codedWidth, frame.codedHeight);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(frame, 0, 0);
        lastDecodeFrame = canvas;
        frame.close();
    },
    error: (e) => console.error("Decode error:", e),
});
frameDecoder.configure({
    codec: codec,
});

const canvas = ele("canvas").addInto().el;

const actionsEl = view("x").addInto();
const playEl = check("", ["||", "|>"]).on("input", async () => {
    if (playEl.gv) {
        await transform();
        isPlaying = true;
        if (playI === transformed.length - 1) {
            playI = 0;
        }
        resetPlayTime();
        canvas.width = outputV.width;
        canvas.height = outputV.height;
        play();
    } else {
        pause();
    }
});

const lastFrame = button("<").on("click", () => {
    const id = Math.max(playI - 1, 0);
    jump2id(id);
    getNowFrames();
});
const nextFrame = button(">").on("click", () => {
    const id = Math.min(playI + 1, transformed.length - 1);
    jump2id(id);
    getNowFrames();
});
const lastKey = button("<<");
const nextKey = button(">>");

actionsEl.add([lastKey, lastFrame, playEl, nextFrame, nextKey]);

const timeLineMain = view("x").addInto();
const timeLineFrame = view("x").addInto();

const exportEl = frame("export", {
    _: view("x"),
    export: button("导出").on("click", save),
    type: select(outputType.map((t) => ({ value: t.name }))),
});

exportEl.el.addInto();

let mousePosi: { x: number; y: number } = { x: 0, y: 0 };

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

let stopRecord = () => {};

function ms2timestamp(t: number) {
    return t * 1000;
}

function mapKeysOnFrames(chunks: EncodedVideoChunk[]) {
    const startTime = keys.find((k) => k.isStart).time;
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
        const x = Math.max(0, Math.min(v.width - w, k.posi.x - w / 2));
        const y = Math.max(0, Math.min(v.height - h, k.posi.y - h / 2));
        getNowUiData().clipList.push({
            i: chunk,
            rect: { x, y, w: w, h: h },
            transition: ms2timestamp(400),
        });
    }
}

function getNowUiData() {
    return history.at(-1) as uiData;
}

function frame2Id(frame: VideoFrame) {
    return src.findIndex((c) => c.timestamp === frame.timestamp);
}

function getFrameX(data: uiData) {
    const frameList: FrameX[] = [];
    // todo speed map
    for (const [i, c] of src.entries()) {
        const f: FrameX = {
            rect: { x: 0, y: 0, w: v.width, h: v.height },
            timestamp: c.timestamp,
            event: [],
            isRemoved: false,
        };

        f.isRemoved = data.remove.some((r) => r.start <= i && i <= r.end);
        if (f.isRemoved) {
            frameList.push(f);
            continue;
        }

        // clip
        if (data.clipList.length > 0) {
            const bmClip = data.clipList.find((c) => c.i === i);
            if (bmClip) {
                f.rect = bmClip.rect;
                continue;
            }
            const firstClip = structuredClone(
                data.clipList.at(0) as uiData["clipList"][0],
            );
            firstClip.i = 0;
            const lastClip = structuredClone(
                data.clipList.at(-1) as uiData["clipList"][0],
            );
            lastClip.i = Number.POSITIVE_INFINITY;
            const l = structuredClone(data.clipList);
            l.unshift(firstClip);
            l.push(lastClip);

            const clipI = l.findIndex((c) => c.i < i);
            const clip = l[clipI];
            const nextClip = l[clipI + 1];
            const clipTime = src[clip.i].timestamp; // todo map
            const nextClipTime = src[nextClip.i].timestamp;
            const t = c.timestamp;
            f.rect = getClip(clip, clipTime, t, nextClip, nextClipTime);
        }
    }
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

async function transform(_codec: string = codec) {
    // todo 无操作时直接返回
    // todo diff chunks，更改部分帧
    // todo diff 时注意codec
    // todo diff 有的不变，有的变frame，有的变时间戳
    // todo keyframe diff
    // todo keyframe webm 32s mp4 5-10s
    transformed = [];
    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            // 解码 处理 编码
            const nFrame = transformX(frame);
            encoder.encode(nFrame);
            nFrame.close();
        },
        error: (e) => console.error("Decode error:", e),
    });
    const encoder = new VideoEncoder({
        output: (c: EncodedVideoChunk) => {
            // todo 这里有点难获取id，时间戳也是不保证的
            transformed.push(c);
        },
        error: (e) => console.error("Encode error:", e),
    });
    const codecMap = {
        vp8: "vp8",
        vp9: "vp09.00.10.08",
        av1: "av01.0.04M.08",
        avc: "avc1.42001F",
    };
    // todo 回退
    encoder.configure({
        codec: codecMap[_codec],
        width: outputV.width,
        height: outputV.height,
        framerate: srcRate,
        bitrate: bitrate,
    });
    decoder.configure({
        codec: codec,
    });
    for (const chunk of src) {
        decoder.decode(chunk);
    }
    /**@see {@link ../../docs/develop/superRecorder.md#转换（编辑）} */
    await decoder.flush();
    await encoder.flush();
    decoder.close();
    encoder.close();
}

function transformX(frame: VideoFrame) {
    const t = renderFrameX(frame);
    const canvas = t.canvas;
    const nFrame = new VideoFrame(canvas, {
        timestamp: t.time,
    });
    return nFrame;
}

function renderFrameX(frame: VideoFrame) {
    const nowUi = getNowUiData();
    const frameX = getFrameX(nowUi).at(frame2Id(frame));
    const clip = frameX.rect;
    const canvas = new OffscreenCanvas(outputV.width, outputV.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
        frame,
        clip.x,
        clip.y,
        clip.w,
        clip.h,
        0,
        0,
        outputV.width,
        outputV.height,
    );
    const time = frameX.timestamp;
    frame.close();
    return { canvas, time };
}

async function playId(i: number) {
    if (i === playI) return;
    if (transformed[i].type === "key") {
        playDecoder.decode(transformed[i]);
        playI = i;
        return;
    }
    const beforeId = transformed
        .slice(0, i)
        .findLastIndex((c) => c.type === "key");

    const fillI = playI <= beforeId ? beforeId : playI + 1;

    for (let n = fillI; n < i; n++) {
        playDecoder.decode(transformed[n]);
    }
    playDecoder.decode(transformed[i]);
    playI = i;
    console.log("play", playI);

    if (playI === transformed.length - 1) {
        playEnd();
    }
}

/**
 * **注意先调用transform**
 */
async function getFrame(i: number) {
    await frameDecoder.flush();
    const beforeId = transformed
        .slice(0, i + 1)
        .findLastIndex((c) => c.type === "key");

    console.log(i);

    for (let n = beforeId; n < i; n++) {
        frameDecoder.decode(transformed[n]);
    }
    frameDecoder.decode(transformed[i]);
    await frameDecoder.flush();
    return lastDecodeFrame;
}

function play() {
    requestAnimationFrame(() => {
        const dTime = ms2timestamp(performance.now() - playTime);

        if (isPlaying) {
            for (let i = playI; i < transformed.length; i++) {
                if (transformed[i].timestamp > dTime) {
                    playId(i);
                    break;
                }
            }
            play();
        }
    });
}

function resetPlayTime() {
    const dTime = transformed[playI].timestamp / 1000;
    playTime = performance.now() - dTime;
}

async function jump2id(id: number) {
    await transform();
    playI = id;
    const xcanvas = await getFrame(id);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
        xcanvas,
        0,
        0,
        xcanvas.width,
        xcanvas.height,
        0,
        0,
        outputV.width,
        outputV.height,
    );
    resetPlayTime(); // todo 修复中间播放
}

function pause() {
    isPlaying = false;

    onPause();
}

function playEnd() {
    isPlaying = false;
    playI = 0;
    playEl.sv(false);

    onPause();
}

function onPause() {
    getNowFrames();
}

async function showThumbnails() {
    await transform();
    for (let i = 0; i < 6; i++) {
        const id = Math.floor((i / 6) * transformed.length);
        const canvas = await getFrame(id);
        const tW = 300;
        const tH = Math.floor((tW * outputV.height) / outputV.width);

        const canvasEl = ele("canvas")
            .attr({
                width: tW,
                height: tH,
            })
            .style({ width: "calc(100% / 6)" });
        canvasEl.el
            .getContext("2d")
            .drawImage(
                canvas,
                0,
                0,
                outputV.width,
                outputV.height,
                0,
                0,
                tW,
                tH,
            );
        timeLineMain.add(canvasEl);
    }
}

async function getNowFrames() {
    await transform();
    // todo cache
    timeLineFrame.clear();
    for (
        let i = Math.max(playI - 3, 0);
        i < Math.min(playI + 3, transformed.length);
        i++
    ) {
        const id = i;
        const canvas = await getFrame(id); // todo get slice
        const tW = 300;
        const tH = Math.floor((tW * outputV.height) / outputV.width);

        const canvasEl = ele("canvas")
            .attr({
                width: tW,
                height: tH,
            })
            .style({ width: "calc(100% / 6)" });
        canvasEl.el
            .getContext("2d")
            .drawImage(
                canvas,
                0,
                0,
                outputV.width,
                outputV.height,
                0,
                0,
                tW,
                tH,
            );
        timeLineFrame.add(canvasEl);
    }
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
    const dir = "./output";
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (error) {}
    return path.join(dir, `${new Date().getTime()}.${type}`);
}

async function saveImages() {
    const exportPath = getSavePath("png");

    try {
        fs.mkdirSync(exportPath, { recursive: true });
    } catch (error) {}

    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            const t = renderFrameX(frame);
            t.canvas.convertToBlob({ type: "image/png" }).then(async (blob) => {
                const buffer = Buffer.from(await blob.arrayBuffer());
                fs.writeFile(
                    `${exportPath}/${t.time}.png`,
                    // @ts-ignore
                    buffer,
                    (_err) => {},
                );
            });
        },
        error: (e) => console.error("Decode error:", e),
    });
    decoder.configure({
        codec: codec,
    });
    for (const chunk of src) {
        decoder.decode(chunk);
    }

    await decoder.flush();

    decoder.close();

    console.log("decoded");
}

async function saveGif() {
    const exportPath = getSavePath("gif");

    const gif = GIFEncoder();

    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            const { data, width, height } = renderFrameX(frame)
                .canvas.getContext("2d")
                .getImageData(0, 0, outputV.width, outputV.height);
            const palette = quantize(data, 256);
            const index = applyPalette(data, palette);
            gif.writeFrame(index, width, height, {
                palette,
            });
        },
        error: (e) => console.error("Decode error:", e),
    });
    decoder.configure({
        codec: codec,
    });
    for (const chunk of src) {
        decoder.decode(chunk);
    }

    await decoder.flush();
    decoder.close();
    gif.finish();
    const bytes = gif.bytes();
    // @ts-ignore
    fs.writeFileSync(exportPath, Buffer.from(bytes));
}

async function saveWebm(_codec: "vp8" | "vp9" | "av1") {
    const { Muxer, ArrayBufferTarget } =
        require("webm-muxer") as typeof import("webm-muxer");
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: `V_${_codec.toUpperCase()}`,
            width: outputV.width,
            height: outputV.height,
        },
    });

    await transform(_codec);

    for (const chunk of transformed) {
        muxer.addVideoChunk(chunk);
    }
    muxer.finalize();
    const { buffer } = muxer.target;
    const exportPath = getSavePath("webm");
    // @ts-ignore
    fs.writeFileSync(exportPath, Buffer.from(buffer));
    console.log("saved webm");
}

async function saveMp4(_codec: "avc" | "vp9" | "av1") {
    const { Muxer, ArrayBufferTarget } =
        require("mp4-muxer") as typeof import("mp4-muxer");
    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
            codec: _codec,
            width: outputV.width,
            height: outputV.height,
        },
        fastStart: false,
    });

    await transform(_codec);

    for (const chunk of transformed) {
        muxer.addVideoChunk(chunk);
    }
    muxer.finalize();
    const { buffer } = muxer.target;
    const exportPath = getSavePath("mp4");
    // @ts-ignore
    fs.writeFileSync(exportPath, Buffer.from(buffer));
    console.log("saved mp4");
}

ipcRenderer.on("record", async (_e, _t, sourceId) => {
    // return
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

    encoder.configure({
        codec: codec,
        width: videoTrack.getSettings().width,
        height: videoTrack.getSettings().height,
        framerate: srcRate,
        bitrate: bitrate,
    });
    v.width = videoTrack.getSettings().width;
    v.height = videoTrack.getSettings().height;

    // @ts-ignore
    const reader = new MediaStreamTrackProcessor({
        track: videoTrack,
    }).readable.getReader();

    // 读取视频帧并编码

    const encodedChunks = [];

    initKeys();
    keys.push({ time: performance.now(), isStart: true, posi: { x: 0, y: 0 } });

    stopRecord = async () => {
        console.log("stop");

        uIOhook.stop();

        reader.cancel();

        await encoder.flush();
        encoder.close();
        console.log(encodedChunks);
        console.log(keys);

        history.push({ clipList: [], eventList: [], remove: [], speed: [] });

        src = encodedChunks;
        mapKeysOnFrames(encodedChunks);
        ipcRenderer.send("window", "show");

        showThumbnails();
    };

    setTimeout(() => stopRecord(), 5 * 1000);

    while (true) {
        const { done, value: videoFrame } = await reader.read();
        if (done) break;
        if (encoder.encodeQueueSize > 2) {
            videoFrame.close();
        } else {
            encoder.encode(videoFrame);
            videoFrame.close();
        }
    }
});

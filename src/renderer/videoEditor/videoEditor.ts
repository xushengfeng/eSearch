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

const clipList: Map<
    number, // src id
    clip
> = new Map();

let transformedClip: Map<number, clip> = new Map();

const removedFrames: Map<number, boolean> = new Map();

const eventList: Map<number, eventX> = new Map();

// 关键帧
type clip = {
    time: number;
    rect: { x: number; y: number; w: number; h: number };
};

type eventX = {
    time: number;
    point: { x: number; y: number };
    // todo key events
};

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
let playTotalTime = 0;

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
const playEl = check("", ["||", "|>"])
    .addInto(actionsEl)
    .on("input", async () => {
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

function mapKeysOnFrames(chunks: EncodedVideoChunk[]) {
    const startTime = keys.find((k) => k.isStart).time;
    const newKeys = keys
        .map((i) => ({ ...i, time: i.time - startTime }))
        .filter((i) => i.time > 0);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const key = newKeys.filter(
            (k) =>
                k.time * 1000 >= chunk.timestamp &&
                k.time * 1000 <
                    (chunk[i + 1]?.timestamp || Number.POSITIVE_INFINITY),
        );
        if (key.length === 0) continue;
        const w = v.width / 3;
        const h = v.height / 3;
        const x = Math.max(0, Math.min(v.width - w, key[0].posi.x - w / 2));
        const y = Math.max(0, Math.min(v.height - h, key[0].posi.y - h / 2));
        const clip: clip = {
            rect: { x, y, w: w, h: h },
            time: chunk.timestamp,
        };
        clipList.set(chunk.timestamp, clip);
        eventList.set(chunk.timestamp, {
            time: chunk.timestamp,
            point: key[0].posi,
        });
    }
    transformedClip = structuredClone(clipList);
    console.log(clipList);
}

async function transform(_codec: string = codec) {
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

function getClip(n: number) {
    if (transformedClip.has(n) && !removedFrames.has(n))
        return transformedClip.get(n).rect;
    const keys = Array.from(transformedClip.keys()).filter(
        (k) => !removedFrames.has(k),
    );
    const i = keys.findIndex((k) => transformedClip.get(k).time > n);

    function get(min: clip, t: number, max: clip) {
        const v = (t - min.time) / (max.time - min.time); // todo 非线性插值
        return {
            x: v * min.rect.x + (1 - v) * max.rect.x,
            y: v * min.rect.y + (1 - v) * max.rect.y,
            w: v * min.rect.w + (1 - v) * max.rect.w,
            h: v * min.rect.h + (1 - v) * max.rect.h,
        };
    }

    if (i === -1)
        return get(
            transformedClip.get(keys[0]),
            n,
            transformedClip.get(keys[0]),
        );
    return get(
        transformedClip.get(keys[i]),
        n,
        transformedClip.get(keys[i + 1] || keys[i]),
    );
}

function transformX(frame: VideoFrame) {
    const t = transformXRaw(frame);
    const canvas = t.canvas;
    const nFrame = new VideoFrame(canvas, {
        timestamp: t.time,
    });
    return nFrame;
}

function transformXRaw(frame: VideoFrame) {
    const clip = getClip(frame.timestamp);
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
    const time = frame.timestamp;
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
        const dTime = (performance.now() - playTime) * 1000;

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

function pause() {
    isPlaying = false;
}

function playEnd() {
    isPlaying = false;
    playI = 0;
    playEl.sv(false);
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
            const t = transformXRaw(frame);
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
            const { data, width, height } = transformXRaw(frame)
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

ipcRenderer.on("record", async (e, t, sourceId) => {
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

    setTimeout(async () => {
        console.log("stop");

        uIOhook.stop();

        reader.cancel();

        playTotalTime = performance.now() - keys.find((k) => k.isStart).time;

        await encoder.flush();
        encoder.close();
        console.log(encodedChunks);
        console.log(keys);
        src = encodedChunks;
        mapKeysOnFrames(encodedChunks);
        ipcRenderer.send("window", "show");

        showThumbnails();
    }, 3 * 1000);

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

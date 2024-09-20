import type { superRecording } from "../../ShareTypes";
import { ele, view } from "dkh-ui";

const { ipcRenderer } = require("electron") as typeof import("electron");
const { uIOhook } = require("uiohook-napi") as typeof import("uiohook-napi");
const fs = require("node:fs") as typeof import("fs");

const keys: superRecording = [];

let src: EncodedVideoChunk[] = [];
let transformed: EncodedVideoChunk[] = [];

const clipList: Map<
    number, // src id
    clip
> = new Map();

let transformedClip: Map<number, clip> = new Map();

type clip = {
    time: number;
    rect: { x: number; y: number; w: number; h: number };
    point: { x: number; y: number };
    // todo key events
    isRemoved?: boolean;
};

// todo 自适应分辨率/用户设定分辨率
const outputV = {
    width: 100,
    height: 100,
};

// 原始分辨率
// todo 节省内存，可以降低原始分辨率，像鼠标坐标也要缩小
const v = {
    width: 100,
    height: 100,
};

const canvas = ele("canvas").el;

const timeLineMain = view("x");
const timeLineFrame = view("x");

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
            point: key[0].posi,
            rect: { x, y, w: x + w, h: y + h },
            time: chunk.timestamp,
            isRemoved: false,
        };
        clipList.set(chunk.timestamp, clip);
    }
    transformedClip = structuredClone(clipList);
    console.log(clipList);
}

async function transform() {
    // todo diff chunks，更改部分帧
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
    encoder.configure({
        codec: "vp8",
        width: outputV.width,
        height: outputV.height,
        framerate: 30,
    });
    decoder.configure({
        codec: "vp8",
    });
    for (const chunk of src) {
        decoder.decode(chunk);
    }
    await encoder.flush();
    await decoder.flush();
}

function transformX(frame: VideoFrame) {
    const clip = clipList.get(frame.timestamp);
    const canvas = new OffscreenCanvas(v.width, v.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
        frame,
        clip.rect.x,
        clip.rect.y,
        clip.rect.w,
        clip.rect.h,
        0,
        0,
        v.width,
        v.height,
    );
    const nFrame = new VideoFrame(canvas, {
        timestamp: clip.time,
    });
    frame.close();
    return nFrame;
}

async function save() {
    await transform();

    saveImages();
}

async function saveImages() {
    const datas = [];
    console.log(transformed);

    const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
            console.log(frame.codedHeight);

            const canvas = ele("canvas").attr({ width: 100, height: 100 }).el;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(frame, 0, 0);
            datas.push(canvas.toDataURL());
            frame.close();
        },
        error: (e) => console.error("Decode error:", e),
    });
    decoder.configure({
        codec: "vp8",
    });
    for (const chunk of transformed) {
        decoder.decode(chunk);
    }

    await decoder.flush();

    console.log("decoded");

    fs.mkdirSync("./images");
    console.log(datas);

    for (const data of datas.slice(0, 10)) {
        fs.writeFile(
            `./images/${new Date().getTime()}.png`,
            data.replace(/^data:image\/\w+;base64,/, ""),
            "base64",
            (_err) => {},
        );
    }
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
        codec: "vp8",
        width: videoTrack.getSettings().width,
        height: videoTrack.getSettings().height,
        framerate: 30,
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

        reader.cancel();

        await encoder.flush();
        encoder.close();
        console.log(encodedChunks);
        console.log(keys);
        src = encodedChunks;
        mapKeysOnFrames(encodedChunks);
        save();
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

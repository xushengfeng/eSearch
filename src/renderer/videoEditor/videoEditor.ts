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

let isPlaying = false;
let playI = 0;
let playTime = 0;

const canvas = ele("canvas").el;

const playDecoder = new VideoDecoder({
    output: (frame: VideoFrame) => {
        // todo 正常速度播放
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
    codec: "vp8",
});

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
            rect: { x, y, w: x + w, h: y + h },
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
    const clip = getClip(frame.timestamp);
    const canvas = new OffscreenCanvas(v.width, v.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
        frame,
        clip.x,
        clip.y,
        clip.w,
        clip.h,
        0,
        0,
        v.width,
        v.height,
    );
    const nFrame = new VideoFrame(canvas, {
        timestamp: frame.timestamp,
    });
    frame.close();
    return nFrame;
}

async function playId(i: number) {
    // todo 修复乱码
    for (let n = playI + 1; n < i; n++) {
        playDecoder.decode(transformed[n]);
    }
    playDecoder.decode(transformed[i]);
    playI = i;
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

        uIOhook.stop();

        reader.cancel();

        await encoder.flush();
        encoder.close();
        console.log(encodedChunks);
        console.log(keys);
        src = encodedChunks;
        mapKeysOnFrames(encodedChunks);
        ipcRenderer.send("window", "show");
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

canvas.onclick = async () => {
    await transform();
    isPlaying = true;
    playTime = performance.now();
    canvas.width = outputV.width;
    canvas.height = outputV.height;
    playI = 0;
    await playDecoder.flush();
    playId(0);
    play();
};

document.body.appendChild(canvas);

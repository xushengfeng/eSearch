import type { superRecording } from "../../ShareTypes";
import { ele, view } from "dkh-ui";

const { ipcRenderer } = require("electron") as typeof import("electron");
const { uIOhook } = require("uiohook-napi") as typeof import("uiohook-napi");
const fs = require("node:fs") as typeof import("fs");

const keys: superRecording = [];

let src: EncodedVideoChunk[] = [];
let transformed: EncodedVideoChunk[] = [];

const canvas = ele("canvas").el;

const timeLineMain = view("x");
const timeLineFrame = view("x");

function initKeys() {
    uIOhook.on("keydown", (e) => {
        keys.push({
            time: performance.now(),
            keydown: e.keycode.toString(),
        });
    });

    uIOhook.on("keyup", (e) => {
        keys.push({
            time: performance.now(),
            keyup: e.keycode.toString(),
        });
    });

    const map = { 1: 0, 2: 1, 3: 2 } as const;

    uIOhook.on("mousedown", (e) => {
        keys.push({
            time: performance.now(),
            mousedown: map[e.button as number],
        });
    });
    uIOhook.on("mouseup", (e) => {
        keys.push({
            time: performance.now(),
            mouseup: map[e.button as number],
        });
    });

    uIOhook.on("wheel", (e) => {
        console.log(e.direction, e.rotation);
        keys.push({ time: performance.now(), wheel: true });
    });

    uIOhook.on("mousemove", (e) => {
        keys.push({ time: performance.now(), posi: { x: e.x, y: e.y } });
    });

    uIOhook.start();
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
            transformed.push(c);
        },
        error: (e) => console.error("Encode error:", e),
    });
    encoder.configure({
        codec: "vp8",
        width: 100, // todo 自适应分辨率/用户设定分辨率
        height: 100,
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
    const canvas = new OffscreenCanvas(
        frame.displayWidth / 2,
        frame.displayHeight / 2,
    );
    const ctx = canvas.getContext("2d");
    ctx.drawImage(frame, 0, 0);
    const nFrame = new VideoFrame(canvas, {
        timestamp: frame.timestamp,
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

    // @ts-ignore
    const reader = new MediaStreamTrackProcessor({
        track: videoTrack,
    }).readable.getReader();

    // 读取视频帧并编码

    const encodedChunks = [];

    initKeys();
    keys.push({ time: performance.now(), isStart: true });

    setTimeout(async () => {
        console.log("stop");

        reader.cancel();

        await encoder.flush();
        encoder.close();
        console.log(encodedChunks);
        console.log(keys);
        src = encodedChunks;
        transformed = encodedChunks;
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

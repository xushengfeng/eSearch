const { ipcRenderer } = require("electron") as typeof import("electron");
import {
    addClass,
    button,
    dynamicSelect,
    ele,
    image,
    trackPoint,
    txt,
    view,
} from "dkh-ui";
import { jsKeyCodeDisplay } from "../../../lib/key";

import { getImgUrl, initStyle } from "../root/root";

import store from "../../../lib/store/renderStore";
import { renderSend } from "../../../lib/ipc";

function initRecord() {
    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
        // biome-ignore format:
        // biome-ignore lint: 部分引入
        var { uIOhook, UiohookKey } = require("uiohook-napi") as typeof import("uiohook-napi");

    function rKey() {
        const posi = store.get("录屏.提示.键盘.位置");
        const px = posi.x === "+" ? "right" : "left";
        const py = posi.y === "+" ? "bottom" : "top";
        const pel = keysEl.parentElement as HTMLElement;
        pel.style[px] = `${posi.offsetX}px`;
        pel.style[py] = `${posi.offsetY}px`;

        keysEl.style.fontSize = `${store.get("录屏.提示.键盘.大小") * 16}px`;

        const keycode2key = {};

        for (const i in UiohookKey) {
            keycode2key[UiohookKey[i]] = i;
        }
        console.log(keycode2key);

        const map: { [k: string]: string } = {
            Ctrl: "Control",
            CtrlRight: "ControlRight",
        };

        for (let i = 0; i < 25; i++) {
            const k = String.fromCharCode(65 + i);
            map[k] = `Key${k}`;
        }

        function getKey(keycode: number) {
            const key = keycode2key[keycode] as string;

            const keyDisplay = jsKeyCodeDisplay(map[key] || key);

            const mainKey = keyDisplay.primary ?? key;
            let topKey = keyDisplay?.secondary ?? keyDisplay?.symble ?? "";
            if (keyDisplay.isNumpad) topKey = "";
            return {
                main: mainKey,
                top: topKey,
                numpad: keyDisplay.isNumpad,
                right: keyDisplay.isRight,
            };
        }

        let keyO: number[] = [];

        let lastKey = null as ReturnType<typeof view> | null;

        uIOhook.on("keydown", (e) => {
            if (!keyO.includes(e.keycode)) keyO.push(e.keycode);
            if (!lastKey) {
                lastKey = view();
                if (posi.x === "+") keysEl.append(lastKey.el);
                else keysEl.insertAdjacentElement("afterbegin", lastKey.el);
            }
            const key = getKey(e.keycode);
            if (["Ctrl", "Alt", "Shift", "Meta"].includes(key.main))
                lastKey.data({ modi: "true" });
            const kbdEl = ele("kbd").add(
                txt(key.main)
                    .class("main_key")
                    .data({ k: e.keycode.toString() }),
            );
            console.log(key);

            if (key.top) kbdEl.add(txt(key.top).class("top_key"));
            else {
                kbdEl.el.querySelector("span")?.classList.remove("main_key");
                kbdEl.el.classList.add("only_key");
            }
            lastKey.add(kbdEl);
            if (key.numpad) kbdEl.el.classList.add("numpad_key");
            if (key.right) kbdEl.el.classList.add("right_key");
            const l = Array.from(keysEl.children);
            if (posi.x === "+") {
                for (const v of l.slice(0, -10)) v.remove();
            } else {
                for (const v of l.slice(10)) v.remove();
            }
        });
        uIOhook.on("keyup", (e) => {
            keyO = keyO.filter((i) => i !== e.keycode);
            for (const el of (lastKey?.el
                .querySelectorAll(`[data-k="${e.keycode}"]`)
                ?.values() as Iterable<HTMLElement>) || []) {
                el.classList.add("key_hidden");
            }
            if (keyO.length === 0) {
                const e = lastKey;
                setTimeout(() => {
                    e?.style({ opacity: "0" });
                }, 4000);
                lastKey = null;
            }
        });
    }

    function rMouse() {
        const m2m = { 1: 0, 3: 1, 2: 2 };
        const mouseEl = recorderMouseEl.querySelectorAll("div");

        uIOhook.on("mousedown", (e) => {
            mouseEl[m2m[e.button as number]].style.backgroundColor = "#00f";
        });
        uIOhook.on("mouseup", (e) => {
            mouseEl[m2m[e.button as number]].style.backgroundColor = "";
        });

        let time_out: NodeJS.Timeout;
        uIOhook.on("wheel", (e) => {
            console.log(e.direction, e.rotation);
            const x = {
                3: { 1: "wheel_u", "-1": "wheel_d" },
                4: { 1: "wheel_l", "-1": "wheel_r" },
            };
            recorderMouseEl.className = x[e.direction][e.rotation];
            clearTimeout(time_out);
            time_out = setTimeout(() => {
                recorderMouseEl.className = "";
            }, 200);
        });
    }

    if (store.get("录屏.提示.键盘.开启")) rKey();
    if (store.get("录屏.提示.鼠标.开启")) rMouse();

    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
        // @ts-ignore
        uIOhook.start();

    if (store.get("录屏.提示.光标.开启"))
        recorderMouseEl.style.display = "flex";

    const mouseStyle = document.createElement("style");
    mouseStyle.innerHTML = `.mouse{${store.get("录屏.提示.光标.样式").replaceAll(";", " !important;")}}`;
    document.body.appendChild(mouseStyle);
}

async function cameraStreamF(id: string | null) {
    if (id) {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { deviceId: id },
        });
        videoEl.srcObject = stream;
        videoEl.play();
        if (store.get("录屏.摄像头.镜像"))
            videoEl.style.transform = "rotateY(180deg)";

        videoEl.oncanplay = () => {
            cEl.style({ display: "" });
            initSeg();
        };
    } else {
        const src = videoEl.srcObject;
        if (src instanceof MediaStream) {
            try {
                src.getVideoTracks()[0].stop();
            } catch (e) {}
        }
        videoEl.srcObject = null;
        cEl.style({ display: "none" });
    }
}

async function getAndSetStream() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoL = devices.filter((i) => i.kind === "videoinput");
    cameraSelect.setList(
        videoL.map((i) => ({
            name: i.label,
            value: i.deviceId,
        })),
    );
    if (videoL.length > 1) {
        cameraSelect.el.style({ display: "" });
    } else cameraSelect.el.style({ display: "none" });
    if (videoL.length > 0) {
        const id =
            videoL.find((i) => i.deviceId === store.get("录屏.摄像头.设备"))
                ?.deviceId ?? videoL[0].deviceId;
        cameraSelect.el.sv(id);
        return id;
    }
    return null;
}

let seg: typeof import("esearch-seg");

async function initSeg() {
    const bgSetting = store.get("录屏.摄像头.背景");
    if (bgSetting.模式 === "none") {
        return;
    }
    const path = require("node:path") as typeof import("path");
    videoEl.style.display = "";
    segEl.clear();
    videoEl.style.display = "none";
    cameraCanvas = document.createElement("canvas");
    segCanvas = document.createElement("canvas");
    const bgEl = document.createElement("div");
    if (bgSetting.模式 === "img" || bgSetting.模式 === "video") {
        const bg =
            bgSetting.模式 === "img"
                ? document.createElement("img")
                : document.createElement("video");
        const url =
            bgSetting.模式 === "img" ? bgSetting.imgUrl : bgSetting.videoUrl;
        bg.src = url;
        bgEl.append(bg);
        bgEl.style.objectFit = bgSetting.fit;
        cameraCanvas.style.display = "none";
    }
    if (bgSetting.模式 === "blur") {
        cameraCanvas.style.filter = `blur(${bgSetting.模糊}px)`;
        cameraCanvas.style.display = "";
    }
    if (bgSetting.模式 === "hide") {
        cameraCanvas.style.display = "none";
    }
    segEl.add([cameraCanvas, bgEl, segCanvas]);
    seg = require("esearch-seg") as typeof import("esearch-seg");
    await seg.init({
        segPath: path.join(__dirname, "../../assets/onnx/seg", "seg.onnx"),
        ort: require("onnxruntime-node"),
        ortOption: {
            executionProviders: [{ name: store.get("AI.运行后端") || "cpu" }],
        },
        shape: [256, 144],
        invertOpacity: true,
        threshold: 0.7,
    });
    drawCamera();
    segEl.style({
        aspectRatio: `auto ${videoEl.videoWidth} / ${videoEl.videoHeight}`,
    });
}

function drawCamera() {
    const canvasCtx = cameraCanvas.getContext("2d") as CanvasRenderingContext2D;
    const segCtx = segCanvas.getContext("2d") as CanvasRenderingContext2D;
    cameraCanvas.width = videoEl.videoWidth;
    cameraCanvas.height = videoEl.videoHeight;
    console.log(videoEl.videoHeight);
    canvasCtx.drawImage(videoEl, 0, 0, cameraCanvas.width, cameraCanvas.height);
    seg.seg(
        canvasCtx.getImageData(0, 0, cameraCanvas.width, cameraCanvas.height),
    ).then((data) => {
        segCanvas.width = data.width;
        segCanvas.height = data.height;
        segCtx.putImageData(data, 0, 0);
    });
    setTimeout(() => {
        if (videoEl.srcObject) drawCamera();
    }, 10);
}

// @auto-path:../assets/icons/$.svg
function iconEl(src: string) {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}

initStyle(store);

const rectEl = view().addInto().attr({ id: "recorder_rect" });
const rb = view().addInto(rectEl).attr({ id: "recorder_bar" });
const keysEl = view().addInto(rb).attr({ id: "recorder_key" }).el;
const recorderMouseEl = view()
    .addInto()
    .attr({ id: "mouse_c" })
    .class("mouse")
    .add([view(), view(), view()]).el;

const cEl = view()
    .addInto()
    .style({ position: "fixed", left: 0, top: 0, width: "100px" });

// todo 摄像头比例
// todo 记忆

const videoEl = ele("video").addInto(cEl).el;
const segEl = view()
    .attr({ id: "seg" })
    .addInto(cEl)
    .class(
        addClass(
            { position: "relative", overflow: "hidden" },
            { "&>*": { position: "absolute", top: 0, width: "100%" } },
        ),
    );
const cameraSelect = dynamicSelect();
cEl.class("small-size").add(cameraSelect.el.style({ display: "none" }));
cameraSelect.el.on("change", async () => {
    const id = cameraSelect.el.gv;
    cameraStreamF(id);
    store.set("录屏.摄像头.设备", id);
});

let cameraCanvas: HTMLCanvasElement = document.createElement("canvas");
let segCanvas: HTMLCanvasElement = document.createElement("canvas");

const stop = button(iconEl("stop_record").style({ filter: "none" })).on(
    "click",
    () => {
        renderSend("recordState", ["stop"]);
    },
);
const pause = button(iconEl("play_pause")).on("click", () => {
    renderSend("recordState", ["pause"]);
});
const timeEl = txt();
const controlBar = view("x")
    .class("small-size")
    .class("bar")
    .add([stop, pause, timeEl])
    .addInto()
    .style({
        position: "fixed",
        bottom: 0,
        right: 0,
        borderRadius: "var(--o-padding)",
    });

initRecord();

navigator.mediaDevices.ondevicechange = async () => {
    const id = await getAndSetStream();
    cameraStreamF(id);
};

trackPoint(cEl, {
    start: () => {
        const r = cEl.el.getBoundingClientRect();
        return { x: r.left, y: r.top };
    },
    ing: (p) => {
        cEl.style({ left: `${p.x}px`, top: `${p.y}px` });
    },
});

ipcRenderer.on("record", async (_event, t, arg) => {
    switch (t) {
        case "mouse":
            {
                recorderMouseEl.style.left = `${arg.x}px`;
                recorderMouseEl.style.top = `${arg.y}px`;
                const l = document.elementsFromPoint(arg.x, arg.y);
                renderSend("windowIgnoreMouse", [
                    !(l.includes(cEl.el) || l.includes(controlBar.el)),
                ]);
            }
            break;
        case "camera":
            console.log(arg);
            if (arg) {
                const id = await getAndSetStream();
                cameraStreamF(id);
            } else {
                cameraStreamF(null);
            }
            break;
        case "time":
            timeEl.sv(arg);
            break;
    }
});

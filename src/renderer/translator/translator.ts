import { setting } from "../../ShareTypes";

let Screenshots: typeof import("node-screenshots").Screenshots;

Screenshots = require("node-screenshots").Screenshots;

const { ipcRenderer, nativeImage } = require("electron") as typeof import("electron");

import xtranslator from "xtranslator";

const path = require("path") as typeof import("path");
const fs = require("fs") as typeof import("fs");

var Store = require("electron-store");
var configPath = new URLSearchParams(location.search).get("config_path");
var store = new Store({
    cwd: configPath || "",
});

const transE = store.get("屏幕翻译.默认翻译");

let translateE = async (input: string) => input;

if (transE) {
    let x = (store.get("屏幕翻译.翻译") as setting["屏幕翻译"]["翻译"]).find((i) => i.id === transE);
    xtranslator.e[x.type].setKeys(x.keys);
    translateE = (input: string) => xtranslator.e[x.type].run(input, x.from, x.to);
}

import { el, setStyle } from "redom";

type Rect = { x: number; y: number; w: number; h: number };
let rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

var allScreens: (Electron.Display & { captureSync: () => Buffer })[];

var screenId = NaN;

var mode: "auto" | "manual" = "manual";

var frequencyTime: number = store.get("屏幕翻译.dTime") || 3000;

var pause = false;

const lo = require("esearch-ocr") as typeof import("esearch-ocr");
const ort = require("onnxruntime-node");
let l: [string, string, string, string, any];
for (let i of store.get("离线OCR")) if (i[0] == "默认") l = i;
function ocrPath(p: string) {
    return path.join(path.isAbsolute(p) ? "" : path.join(__dirname, "../../ocr/ppocr"), p);
}
let detp = ocrPath(l[1]),
    recp = ocrPath(l[2]),
    字典 = ocrPath(l[3]);
await lo.init({
    detPath: detp,
    recPath: recp,
    dic: fs.readFileSync(字典).toString(),
    ...l[4],
    ort: ort,
    detShape: [640, 640],
});

const mainEl = el("div", { class: "main" });
const textEl = el("div", { class: "text" });
const rectEl = el("div", { class: "rect" });
mainEl.append(textEl, rectEl);

/**
 * 修复屏幕信息
 * @see https://github.com/nashaofu/node-screenshots/issues/18
 */
function dispaly2screen(displays: Electron.Display[], screens: import("node-screenshots").Screenshots[]) {
    allScreens = [];
    if (!screens) return;
    for (const i in displays) {
        const d = displays[i];
        const s = screens[i];
        allScreens.push({ ...d, captureSync: () => s.captureSync(true) });
    }
}

function screenshot(id: number, rect: Rect) {
    const screen = allScreens.find((i) => i.id === id);
    const img = screen.captureSync();
    const canvas = el("canvas");
    const image = nativeImage.createFromBuffer(img);
    const { width: w, height: h } = image.getSize();

    canvas.width = w;
    canvas.height = h;

    let bitmap = image.toBitmap();
    let x = new Uint8ClampedArray(bitmap.length);
    for (let i = 0; i < bitmap.length; i += 4) {
        // 交换R和B通道的值，同时复制G和Alpha通道的值
        x[i] = bitmap[i + 2]; // B
        x[i + 1] = bitmap[i + 1]; // G
        x[i + 2] = bitmap[i]; // R
        x[i + 3] = bitmap[i + 3]; // Alpha
    }
    let d = new ImageData(x, w, h);
    canvas.getContext("2d").putImageData(d, 0, 0);
    return canvas.getContext("2d").getImageData(rect.x, rect.y, rect.w, rect.h);
}

async function ocr(imgData: ImageData) {
    const l = await lo.ocr(imgData);
    return l;
}

var tCache: Map<string, string> = new Map();

async function translate(text: string) {
    const t = tCache.get(text);
    if (t)
        return new Promise((resolve: (t: string) => void) => {
            resolve(t);
        });
    else {
        const t = await translateE(text);
        tCache.set(text, t);
        return t;
    }
}

const sl = () =>
    new Promise((resolve) => {
        setTimeout(() => {
            resolve("");
        }, 100);
    });

async function run() {
    const data = screenshot(screenId, rect);
    document.body.style.opacity = "1";

    const ocrData = await ocr(data);

    textEl.innerHTML = "";
    for (let i of ocrData) {
        const text = i.text;
        const item = el("div");
        let x0 = i.box[0][0];
        let y0 = i.box[0][1];
        let x1 = i.box[2][0];
        let y1 = i.box[2][1];
        setStyle(item, {
            left: x0 + "px",
            top: y0 + "px",
            width: x1 - x0 + "px",
            height: y1 - y0 + "px",
            "line-height": y1 - y0 + "px",
            "font-size": y1 - y0 + "px",
        });
        textEl.append(item);
        // item.innerText = text;
        translate(text).then((res) => {
            item.innerText = res;
        });
    }
}

document.body.append(mainEl);

const runRun = () =>
    setTimeout(() => {
        if (mode === "auto" && !pause) {
            run();
            runRun();
        }
    }, frequencyTime);
// todo 立刻运行

ipcRenderer.on("init", (_e, id: number, display: Electron.Display[], _rect: Rect, dy: number) => {
    dispaly2screen(display, Screenshots.all());
    screenId = id;
    rect = _rect;
    run();
    mainEl.style.top = dy + "px";
    textEl.style.width = _rect.w + "px";
    textEl.style.height = _rect.h + "px";
    rectEl.style.width = _rect.w + "px";
    rectEl.style.height = _rect.h + "px";
    switchMode();
});

const switchEl = el("input", {
    type: "checkbox",
    onclick: () => {
        if (switchEl.checked) mode = "manual";
        else mode = "auto";
        switchMode();
    },
});

function switchMode() {
    if (mode === "manual") {
        playEl.style.display = "none";
        runEl.style.display = "";
        setOffset(0);
    } else {
        playEl.style.display = "";
        runEl.style.display = "none";
        setOffset(store.get("屏幕翻译.offsetY") || -1);
    }
}

function setOffset(offset: number) {
    textEl.style.top = offset - -1 * textEl.offsetHeight + "px";
}

switchEl.checked = mode === "manual";

const playEl = el("button", {
    onclick: async () => {
        if (mode === "auto") {
            pause = !pause;
            runRun();
            // todo icon show
        }
    },
});

const runEl = el("button", {
    onclick: async () => {
        if (mode != "auto") {
            mainEl.style.opacity = "0";
            await sl();
            await sl();
            await run();
            mainEl.style.opacity = "1";
        }
    },
});

const toolsEl = el(
    "div",
    { class: "tools" },
    switchEl,
    playEl,
    runEl,
    el("button", {
        onclick: () => {
            ipcRenderer.send("translator", "close");
        },
    })
);

rectEl.append(toolsEl);

ipcRenderer.on("mouse", (_e, x: number, y: number) => {
    const El = document.elementFromPoint(x, y);
    ipcRenderer.send("ignore", !toolsEl.contains(El));
});

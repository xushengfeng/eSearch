let Screenshots: typeof import("node-screenshots").Screenshots;

Screenshots = require("node-screenshots").Screenshots;

const { ipcRenderer, nativeImage } = require("electron") as typeof import("electron");

import xtranslator from "xtranslator";
xtranslator.e.caiyun.setKeys(["3975l6lr5pcbvidl6jl2"]);

const path = require("path") as typeof import("path");
const fs = require("fs") as typeof import("fs");

var Store = require("electron-store");
var configPath = new URLSearchParams(location.search).get("config_path");
var store = new Store({
    cwd: configPath || "",
});

import { el, setStyle } from "redom";

type Rect = { x: number; y: number; w: number; h: number };
let rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

var allScreens: (Electron.Display & { captureSync: () => Buffer })[];

var screenId = NaN;

/** auto为按时检测，scroll为滚动时才检测 */
var mode: "auto" | "scroll" = "auto";

var frequencyTime: number = 3000;

var pause = false;

const lo = require("esearch-ocr") as typeof import("esearch-ocr");
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
    node: true,
    detShape: [640, 640],
});

const mainEl = el("div", { class: "main" });

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
        const t = await xtranslator.e.caiyun.run(text, "auto", "zh");
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
    document.body.style.opacity = "0";
    await sl();
    await sl();
    const data = screenshot(screenId, rect);
    document.body.style.opacity = "1";

    const ocrData = await ocr(data);

    mainEl.innerHTML = "";
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
        mainEl.append(item);
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
            // runRun();
        }
    }, frequencyTime);

ipcRenderer.on("init", (_e, id: number, display: Electron.Display[], _rect: Rect) => {
    dispaly2screen(display, Screenshots.all());
    screenId = id;
    rect = _rect;
    runRun();
});

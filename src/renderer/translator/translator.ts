const { ipcRenderer } = require("electron") as typeof import("electron");

import screenShots from "../screenShot/screenShot";

import xtranslator from "xtranslator";

import { button, check, type ElType, image, view } from "dkh-ui";

const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");

import close_svg from "../assets/icons/close.svg";
import pause_svg from "../assets/icons/pause.svg";
import recume_svg from "../assets/icons/recume.svg";
import ocr_svg from "../assets/icons/ocr.svg";
import updown_svg from "../assets/icons/updown.svg";

function iconEl(img: string) {
    return image(img, "icon").class("icon");
}

import store from "../../../lib/store/renderStore";

const transE = store.get("翻译.翻译器");

let translateE = async (input: string[]) => input;

if (transE.length > 0) {
    const x = transE[0];
    // @ts-ignore
    xtranslator.e[x.type].setKeys(x.keys);
    const lan = store.get("屏幕翻译.语言");
    translateE = (input: string[]) =>
        xtranslator.e[x.type].run(input, lan.from, lan.to);
}

type Rect = { x: number; y: number; w: number; h: number };
let rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

let screenId = Number.NaN;

let display: Electron.Display[];

let mode: "auto" | "manual" = "manual";

const frequencyTime: number = store.get("屏幕翻译.dTime") || 3000;

let pause = false;

const lo = require("esearch-ocr") as typeof import("esearch-ocr");
const ort = require("onnxruntime-node");
let l: [string, string, string, string];
for (const i of store.get("离线OCR")) if (i[0] === "默认") l = i;
function ocrPath(p: string) {
    return path.join(
        path.isAbsolute(p) ? "" : path.join(__dirname, "../../ocr/ppocr"),
        p,
    );
}
const detp = ocrPath(l[1]);
const recp = ocrPath(l[2]);
const 字典 = ocrPath(l[3]);

function screenshot(id: number, rect: Rect) {
    const screen = screenShots(display).find((i) => i.id === id);
    const img = screen.captureSync().data;
    const canvas = document.createElement("canvas");

    canvas.width = img.width;
    canvas.height = img.height;

    canvas.getContext("2d").putImageData(img, 0, 0);
    return canvas.getContext("2d").getImageData(rect.x, rect.y, rect.w, rect.h);
}

async function ocr(imgData: ImageData) {
    const l = await OCR.ocr(imgData);
    return l;
}

const tCache: Map<string, string> = new Map();

async function translate(text: { text: string; el: ElType<HTMLDivElement> }[]) {
    const toTran: typeof text = [];
    for (const i of text) {
        const t = tCache.get(i.text);
        if (t) {
            i.el.el.innerText = t;
        } else {
            toTran.push(i);
        }
    }

    const tt = await translateE(toTran.map((i) => i.text));
    for (let i = 0; i < tt.length; i++) {
        const tran = tt[i];
        const text = toTran[i].text;
        tCache.set(text, tran);
        toTran[i].el.el.innerText = tran;
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

    textEl.clear();
    const textL: { text: string; el: ElType<HTMLDivElement> }[] = [];
    for (const i of ocrData) {
        const text = i.text;
        const x0 = i.box[0][0];
        const y0 = i.box[0][1];
        const x1 = i.box[2][0];
        const y1 = i.box[2][1];
        const item = view().style({
            left: `${x0}px`,
            top: `${y0}px`,
            width: `${x1 - x0}px`,
            height: `${y1 - y0}px`,
            "line-height": `${y1 - y0}px`,
            "font-size": `${y1 - y0}px`,
        });
        textEl.add(item);
        // item.innerText = text;
        textL.push({ el: item, text });
    }
    translate(textL);
}

const runRun = () => {
    if (mode === "auto" && !pause) {
        run();
        setTimeout(runRun, frequencyTime);
    }
};

const switchEl = check("manual").on("click", () => {
    if (switchEl.gv) mode = "manual";
    else mode = "auto";
    switchMode();
});

const setPosi = button(iconEl(updown_svg)).on("click", () => {
    const y = -1 * store.get("屏幕翻译.offsetY");
    setOffset(y);
    store.set("屏幕翻译.offsetY", y);
});

function switchMode() {
    if (mode === "manual") {
        playEl.el.style.display = "none";
        setPosi.el.style.display = "none";
        runEl.el.style.display = "";
        setOffset(0);
    } else {
        playEl.el.style.display = "";
        setPosi.el.style.display = "";
        runEl.el.style.display = "none";
        setOffset(store.get("屏幕翻译.offsetY") || -1);
        runRun();
    }
}

function setOffset(offset: number) {
    textEl.el.style.top = `${(offset - -1) * textEl.el.offsetHeight}px`;
}

const playIcon = iconEl(pause_svg);
const playEl = button(playIcon).on("click", () => {
    if (mode === "auto") {
        pause = !pause;
        playIcon.el.src = pause ? recume_svg : pause_svg;
        runRun();
    }
});

const runEl = button(iconEl(ocr_svg)).on("click", async () => {
    if (mode !== "auto") {
        mainEl.el.style.opacity = "0";
        await sl();
        await sl();
        await run();
        mainEl.el.style.opacity = "1";
    }
});

const toolsEl = view()
    .class("tools")
    .add([
        switchEl,
        setPosi,
        playEl,
        runEl,
        button(iconEl(close_svg)).on("click", () =>
            ipcRenderer.send("translator", "close"),
        ),
    ]);

ipcRenderer.on("mouse", (_e, x: number, y: number) => {
    const El = document.elementFromPoint(x, y);
    ipcRenderer.send("ignore", !toolsEl.el.contains(El));
});

const OCR = await lo.init({
    detPath: detp,
    recPath: recp,
    dic: fs.readFileSync(字典).toString(),
    ortOption: {
        executionProviders: [{ name: store.get("AI.运行后端") || "cpu" }],
    },
    ort: ort,
    detShape: [640, 640],
});

const mainEl = view().class("main");
const textEl = view().class("text");
const rectEl = view().class("rect");
mainEl.add([textEl, rectEl]);

document.body.append(mainEl.el);

switchEl.sv(mode === "manual");

rectEl.add(toolsEl);

ipcRenderer.on(
    "init",
    (_e, id: number, _display: Electron.Display[], _rect: Rect, dy: number) => {
        display = _display;
        screenId = id;
        rect = _rect;
        run();
        mainEl.style({ top: `${dy}px`, height: `${_rect.h * 3}px` });
        textEl.style({ width: `${_rect.w}px`, height: `${_rect.h}px` });
        rectEl.style({ width: `${_rect.w}px`, height: `${_rect.h}px` });
        switchMode();
    },
);

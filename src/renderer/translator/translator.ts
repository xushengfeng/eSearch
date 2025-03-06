const { ipcRenderer } = require("electron") as typeof import("electron");

import initScreenShots from "../screenShot/screenShot";

import xtranslator from "xtranslator";

import { addClass, button, type ElType, image, pack, view } from "dkh-ui";

const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");

// @auto-path:../assets/icons/$.svg
function iconEl(src: string) {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}

import store from "../../../lib/store/renderStore";
import { getImgUrl, initStyle, setTitle } from "../root/root";
import { t } from "../../../lib/translate/translate";
import { renderSend } from "../../../lib/ipc";

initStyle(store);

setTitle(t("屏幕翻译"));

const screenShots = initScreenShots({
    c: store.get("额外截屏器.命令"),
    path: store.get("额外截屏器.位置"),
});

const transE = store.get("翻译.翻译器");

let translateE = async (input: string[]) => input;

if (transE.length > 0) {
    const x = transE[0];
    // @ts-ignore
    xtranslator.e[x.type].setKeys(x.keys);
    const lan = store.get("屏幕翻译.语言");
    translateE = (input: string[]) =>
        // @ts-ignore
        xtranslator.e[x.type].run(input, lan.from, lan.to);
}

type Rect = { x: number; y: number; w: number; h: number };
let rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

let screenId = Number.NaN;

let display: Electron.Display[];

const frequencyTime: number = store.get("屏幕翻译.dTime") || 3000;

let pause = false;

const lo = require("esearch-ocr") as typeof import("esearch-ocr");
const ort = require("onnxruntime-node");
const l: [string, string, string, string] = [
    "默认",
    "默认/ppocr_det.onnx",
    "默认/ppocr_rec.onnx",
    "默认/ppocr_keys_v1.txt",
];
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
    const l = screenShots(display).screen;
    const screen = l.find((i) => i.id === id) || l[0];
    if (!screen) return null;
    const img = screen.captureSync().data;
    if (!img) return null;
    const canvas = document.createElement("canvas");

    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("can get canvas context");
    ctx.putImageData(img, 0, 0);
    return ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
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
    if (!data) return;
    document.body.style.opacity = "1";

    const ocrData = await ocr(data);

    textEl.clear();
    const textL: { text: string; el: ElType<HTMLDivElement> }[] = [];
    for (const _i of ocrData.columns.flatMap((c) => c.parragraphs)) {
        const lineHeight = _i.src
            .map((i) => i.box[3][1] - i.box[0][1])
            .reduce((a, b) => (a + b) / 2);
        const i = _i.parse;
        const text = i.text;
        const x0 = i.box[0][0];
        const y0 = i.box[0][1];
        const x1 = i.box[2][0];
        const y1 = i.box[2][1];
        const item = view().style({
            position: "absolute",
            left: `${x0}px`,
            top: `${y0}px`,
            width: `${x1 - x0}px`,
            height: `${y1 - y0}px`,
            lineHeight: `${lineHeight}px`,
            fontSize: `${lineHeight}px`,
        });
        textEl.add(item);
        textL.push({ el: item, text });
    }
    translate(textL);
}

const runRun = () => {
    if (!pause) {
        run();
        setTimeout(runRun, frequencyTime);
    }
};

pack(document.body).style({
    overflow: "hidden",
});

const playIcon = iconEl("recume");
const playEl = button(playIcon).on("click", () => {
    pause = !pause;
    playIcon.el.src = pause ? getImgUrl("recume.svg") : getImgUrl("pause.svg");
    runRun();
});

const runEl = button(iconEl("ocr")).on("click", async () => {
    mainEl.el.style.opacity = "0";
    await sl();
    await sl();
    await run();
    mainEl.el.style.opacity = "1";
});

const toolsEl = view("x")
    .style({ position: "absolute", right: 0, top: 0 })
    .class(
        addClass(
            {},
            {
                "&>*": {
                    backgroundColor: "var(--bg)",
                    // @ts-ignore
                    "-webkit-app-region": "no-drag",
                },
            },
        ),
    )
    .class("small-size")
    .add([
        playEl,
        runEl,
        button(iconEl("close")).on("click", () =>
            renderSend("windowClose", []),
        ),
    ]);

const OCR = await lo.init({
    detPath: detp,
    recPath: recp,
    dic: fs.readFileSync(字典).toString(),
    ortOption: {
        executionProviders: [{ name: store.get("AI.运行后端") || "cpu" }],
    },
    ort: ort,
    detRatio: 0.75,
});

const mainEl = view().style({
    position: "absolute",
    overflow: "hidden",
    width: "100vw",
    height: "100vh",
});
const textEl = view().style({
    position: "relative",
    // @ts-ignore
    "-webkit-app-region": "drag",
    width: "100vw",
    height: "100vh",
});
mainEl.add([textEl]);

mainEl.addInto();

mainEl.add(toolsEl);

ipcRenderer.on(
    "init",
    (_e, id: number, _display: Electron.Display[], _rect: Rect) => {
        display = _display;
        screenId = id;
        rect = _rect;
    },
);

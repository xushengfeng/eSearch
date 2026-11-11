/// <reference types="vite/client" />

import { EraserBrush } from "@erase2d/fabric";
import chroma from "chroma-js";
import type { Border } from "edge_det";
import {
    ActiveSelection,
    Canvas,
    Circle,
    type CircleProps,
    classRegistry,
    controlsUtils,
    FabricImage,
    type FabricObject,
    filters,
    IText,
    PencilBrush,
    Point,
    Polygon,
    Polyline,
    Rect,
    Shadow,
    SprayBrush,
    util,
} from "fabric";
import hotkeys from "hotkeys-js";
import { findOffset } from "picture_match";
import { ele2jsKeyCode, jsKeyCodeDisplay } from "../../../lib/key";
import {
    type LongFrame,
    type LongStep,
    LongStitcher,
    longOverlapLevel,
} from "../../../lib/longStitch";
import open_with from "../../../lib/open_with";
import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import { isWaylandSession } from "../../../lib/wayland";
import { writeImage, writeText } from "../lib/clipboard";
import { clipDrawTools } from "../lib/clipDrawTools";
import { colorPicker } from "../lib/colorPicker";
import {
    clipboardImageFormat,
    encodeCanvasImage,
    imageFormatMime,
    isImageFormatSupported,
} from "../lib/imageExport";
import { Class, cssColor, getImgUrl, initStyle, setTitle } from "../root/root";

import initScreenShots, { getWindowInfos } from "../screenShot/screenShot";
import EdgeWorker from "./edgeWorker?worker";

const screenShots = initScreenShots(
    { c: store.get("额外截屏器.命令"), path: store.get("额外截屏器.位置") },
    undefined,
    t,
    store.get("使用XDGDesktopPortal"),
);

import {
    button,
    type ElType,
    ele,
    frame,
    image,
    input,
    p,
    pack,
    setProperties,
    textarea,
    trackPoint,
    txt,
    view,
} from "dkh-ui";
import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import { typedEntries, typedKeys } from "../../../lib/utils";
import type { IconType } from "../../iconTypes";
import type {
    CaptureSourceInfo,
    EditType,
    LiveDingTarget,
    LongWarnLevel,
    setting,
    translateWinType,
    功能,
    功能列表,
} from "../../ShareTypes.js";
import xhistory from "../lib/history";
import { ocrList } from "../ocr/ocr_omni";

type SrcPoint = { x: number; y: number } & { readonly _: unique symbol };

initStyle(store);

function iconEl(src: IconType) {
    return view().add(
        image(getImgUrl(`${src}.svg`), "icon")
            .class("icon")
            .attr({ width: bSize }),
    );
}

function selectEl<i extends string>(
    el: ElType<HTMLElement>,
    title: string,
    data: { name: string; value: i }[],
) {
    let value = data[0].value;
    const valueMap = new Map(
        data.map((i) => [
            i.value,
            view()
                .add(i.name)
                .on("click", () => {
                    setV(i.value);
                    change();
                }),
        ]),
    );

    function change() {
        el.el.dispatchEvent(new CustomEvent("change"));
        selectEl.remove();
        selectEl.el.hidePopover();
    }

    function setV(v: i) {
        value = data.find((i) => i.value === v)?.value ?? data[0].value;
        el.data({
            title: `${title} - ${data.find((i) => i.value === value)?.name ?? ""}`,
        });
    }

    function showList() {
        for (const [v, el] of valueMap) {
            el.el.classList.remove("selected");
            if (v === value) el.el.classList.add("selected");
        }
        const rect = handleEl.el.getBoundingClientRect();
        selectEl
            .clear()
            .addInto()
            .add(Array.from(valueMap.values()))
            .style({
                position: "fixed",
                zIndex: 9999,
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                margin: 0,
            });
        selectEl.el.showPopover();
    }

    const selectEl = view().attr({ popover: "auto" }).class("side_select_menu");
    const handleEl = view()
        .addInto(el)
        .on("click", showList)
        .class("side_select");

    el.on("pointerup", (e) => {
        if (e.button === 2) showList();
    });

    return el
        .bindGet(() => value)
        .bindSet((v: i) => {
            setV(v);
        });
}

function rangeBar(
    _min: number | undefined,
    _max: number | undefined,
    _step: number | undefined,
    text = "",
) {
    const min = _min ?? 0;
    const max = _max ?? 100;
    const step = _step ?? 1;

    let type: "edit" | "move" = "move";

    const p = view().style({
        "align-content": "center",
        position: "relative",
        cursor: "ew-resize",
    });
    const bar = view().style({
        position: "absolute",
        top: "0",
        height: "100%",
        background: "var(--bar-focus-color)",
        borderRadius: "inherit",
        zIndex: "-1",
    });
    const i = input()
        .style({
            // @ts-ignore
            "field-sizing": "content",
            "line-height": "1",
            height: "auto",
        })
        .on("input", () => {
            setV(Number.parseFloat(i.gv), true);
        })
        .on("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                setV(Number.parseFloat(i.gv));
                useI(false);
                valueHistory.push(value);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setV(value + step);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setV(value - step);
            }
        })
        .on("blur", () => {
            setV(Number.parseFloat(i.gv));
            useI(false);
            valueHistory.push(value);
        })
        .on("mousedown", (e) => {
            if (e.button === 2 && valueHistory.length) {
                e.preventDefault();
                setV(valueHistory.pop() as number);
            }
        });

    useI(false);
    p.add(
        view("x").add([i, text]).style({
            "justify-content": "center",
        }),
    )
        .add(bar)
        .class("range-b")
        .class(Class.mono);

    function useI(b: boolean) {
        i.attr({ disabled: !b }).style({
            "pointer-events": b ? "all" : "none",
        });
        type = b ? "edit" : "move";
        if (b) i.el.focus();
    }

    let value = min;

    const valueHistory: number[] = [value];

    const range = max - min;

    function setV(v: number, noInput = false, event = true) {
        value = vFix(v);
        setBar(value);
        if (!noInput) i.sv(String(value));
        if (event) inputEvent();
    }

    trackPoint(p, {
        start: () => {
            if (type === "edit") return null;
            return { x: 0, y: 0, data: value };
        },
        ing: (p, _e, { startData: oldV }) => {
            setV(oldV + (p.x / 200) * range);
        },
        end(e, { moved }) {
            if (!moved) {
                if (e.button === 2 && valueHistory.length) {
                    setV(valueHistory.pop() as number);
                } else useI(true);
            } else {
                valueHistory.push(value);
            }
        },
    });

    function vFix(v: number) {
        const vv = Math.max(min, Math.min(max, v));
        if (step < 1) {
            const r = 1 / step;
            return (Math.round(vv * r - min * r) + min * r) / r;
        }
        return Math.round((vv - min) / step) * step + min;
    }

    function setBar(v: number) {
        const p = (v - min) / range;
        bar.style({ width: `${p * 100}%` });
    }

    function inputEvent() {
        p.el.dispatchEvent(new Event("input"));
    }

    return p
        .bindGet(() => {
            return vFix(value);
        })
        .bindSet((v: number) => {
            setV(v, false, false);
        })
        .sv(value);
}

function setSetting() {
    const 工具栏 = store.get("工具栏");
    setProperties({
        "--color-size": `${colorSize * colorISize}px`,
        "--color-i-size": `${colorISize}px`,
        "--color-i-i": `${colorSize}`,
        "--bar-size": `${工具栏.按钮大小}px`,
        "--bar-icon": `${工具栏.按钮图标比例}`,
    });
}

function toCanvas(canvas: HTMLCanvasElement, img: ImageData) {
    canvas.getContext("2d")!.putImageData(img, 0, 0);
}

async function setScreen(i: (typeof allScreens)[0]) {
    let _img = screenShotCache.get(i.id);
    if (!_img) {
        try {
            const __img = (await i.capture()).toImageData();
            if (__img) {
                screenShotCache.set(i.id, __img);
                _img = __img;
            }
        } catch (error) {
            console.error("Error capturing screen:", error);
            // todo tip
        }
    }
    const img = _img;
    if (!img) return;
    const w = img.width;
    const h = img.height;
    mainCanvas.width = w;
    mainCanvas.height = h;
    // 由 Fabric 同步上下层画布，避免尺寸不一致导致点击位置偏移
    fabricCanvas.setDimensions({ width: w, height: h });
    setClipSize(w, h);
    toCanvas(mainCanvas, img);
    resetImageEdge();
    finalRect = [0, 0, mainCanvas.width, mainCanvas.height];
    if (记忆框选)
        if (记忆框选值?.[i.id]?.[2]) {
            finalRect = 记忆框选值[i.id];
            rectSelect = true;
            finalRectFix();
        } // 记忆框选边不为0时
    drawClipRect();
    nowScreenId = i.id;
    if (store.get("框选.自动框选.图像识别")) setTimeout(ensureImageEdge, 0);

    if (w < window.innerWidth || h < window.innerHeight)
        document.body.classList.add("editor_bg");
}

function setEditorP(zoom: number, x: number, y: number) {
    const t: string[] = [];
    if (zoom != null) {
        t.push(`scale(${zoom})`);
        editorP.zoom = zoom;
    }
    if (x != null) {
        let limitX = x;
        const min = -mainCanvas.width;
        const max =
            (window.innerWidth * window.devicePixelRatio) / editorP.zoom;
        if (x < min) limitX = min;
        if (x > max) limitX = max;
        t.push(`translateX(${limitX}px)`);
        editorP.x = limitX;
    }
    if (y != null) {
        let limitY = y;
        const min = -mainCanvas.height;
        const max =
            (window.innerHeight * window.devicePixelRatio) / editorP.zoom;
        if (y < min) limitY = min;
        if (y > max) limitY = max;
        t.push(`translateY(${limitY}px)`);
        editorP.y = limitY;
    }
    editor.el.style.transform = t.join(" ");

    refreshClipUi();
    whBar(finalRect);
    scheduleElementBarPosition();
}

/** 截图坐标 → 屏幕逻辑像素 */
function src2screenX(x: number) {
    return (x + editorP.x) * editorP.zoom;
}
function src2screenY(y: number) {
    return (y + editorP.y) * editorP.zoom;
}

/** 画布在屏幕上的可见范围 */
function visibleCanvasRect() {
    const x0 = Math.max(0, src2screenX(0));
    const y0 = Math.max(0, src2screenY(0));
    return {
        x0,
        y0,
        x1: Math.max(
            x0,
            Math.min(window.innerWidth, src2screenX(mainCanvas.width)),
        ),
        y1: Math.max(
            y0,
            Math.min(window.innerHeight, src2screenY(mainCanvas.height)),
        ),
    };
}

/** 对齐设备像素，避免线落在半个像素上发虚 */
function snapPx(v: number) {
    return Math.round(v * window.devicePixelRatio) / window.devicePixelRatio;
}

/**
 * 线宽（屏幕逻辑像素）：不小于 1 逻辑像素；
 * 放大后为 1 个截图像素，并随 editor 缩放变粗
 */
function lineW() {
    const dpr = window.devicePixelRatio;
    const w = Math.max(1, editorP.zoom) * dpr;
    return Math.max(Math.ceil(dpr), Math.round(w)) / dpr;
}

function setElBox(el: HTMLElement, x: number, y: number, w: number, h: number) {
    const s = el.style;
    const l = `${x}px`;
    const t = `${y}px`;
    const width = `${Math.max(0, w)}px`;
    const height = `${Math.max(0, h)}px`;
    // 值没变就不写，避免无谓的样式重算和重绘
    if (s.left !== l) s.left = l;
    if (s.top !== t) s.top = t;
    if (s.width !== width) s.width = width;
    if (s.height !== height) s.height = height;
}

/** 用屏幕坐标设置盒子，四条边都对齐设备像素 */
function setScreenRect(
    el: HTMLElement,
    left: number,
    top: number,
    right: number,
    bottom: number,
) {
    const l = snapPx(left);
    const t = snapPx(top);
    const r = snapPx(right);
    const b = snapPx(bottom);
    setElBox(el, l, t, Math.max(0, r - l), Math.max(0, b - t));
}

/** 把多边形裁到矩形内，避免生成超大的 clip-path 坐标 */
function clipPolygonToRect(
    points: { x: number; y: number }[],
    x0: number,
    y0: number,
    x1: number,
    y1: number,
) {
    const clip = (
        poly: { x: number; y: number }[],
        inside: (p: { x: number; y: number }) => boolean,
        cross: (
            a: { x: number; y: number },
            b: { x: number; y: number },
        ) => { x: number; y: number },
    ) => {
        const out: { x: number; y: number }[] = [];
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            const aIn = inside(a);
            const bIn = inside(b);
            if (aIn) out.push(a);
            if (aIn !== bIn) out.push(cross(a, b));
        }
        return out;
    };
    let out = clip(
        points,
        (p) => p.x >= x0,
        (a, b) => ({
            x: x0,
            y: a.y + ((x0 - a.x) * (b.y - a.y)) / (b.x - a.x),
        }),
    );
    out = clip(
        out,
        (p) => p.x <= x1,
        (a, b) => ({
            x: x1,
            y: a.y + ((x1 - a.x) * (b.y - a.y)) / (b.x - a.x),
        }),
    );
    out = clip(
        out,
        (p) => p.y >= y0,
        (a, b) => ({
            x: a.x + ((y0 - a.y) * (b.x - a.x)) / (b.y - a.y),
            y: y0,
        }),
    );
    out = clip(
        out,
        (p) => p.y <= y1,
        (a, b) => ({
            x: a.x + ((y1 - a.y) * (b.x - a.x)) / (b.y - a.y),
            y: y1,
        }),
    );
    return out;
}

function setClipSize(w: number, h: number) {
    clipEl.style.width = `${w}px`;
    clipEl.style.height = `${h}px`;
}

let clipCursor = "";
/** cursor 是继承属性，值没变不写，避免整层样式重算 */
function setClipCursor(c: string) {
    if (clipCursor === c) return;
    clipCursor = c;
    clipEl.style.cursor = c;
}

let edgeWorker: Worker | null = null;
let edgeRequestId = 0;
let edgeState: "idle" | "running" | "done" = "idle";

/** 清掉视觉识别结果，窗口结果保留 */
function clearImageEdge() {
    for (let i = edgeRect.length - 1; i >= 0; i--) {
        if (edgeRect[i].type === "image") edgeRect.splice(i, 1);
    }
}

/** 切换屏幕时作废进行中的识别 */
function resetImageEdge() {
    edgeRequestId++;
    edgeState = "idle";
    clearImageEdge();
    setEdge([]);
}

function getEdgeWorker() {
    if (edgeWorker) return edgeWorker;
    const worker = new EdgeWorker();
    worker.onmessage = (e: MessageEvent<{ id: number; borders: Border[] }>) => {
        const { id, borders } = e.data;
        if (id !== edgeRequestId) return;
        edgeState = "done";
        for (const r of borders) {
            edgeRect.push({
                x: r.x,
                y: r.y,
                width: r.w,
                height: r.h,
                type: "image",
            });
        }
        refreshEdgeHint();
    };
    worker.onerror = (e) => {
        console.error("图像识别失败", e.message);
        worker.terminate();
        if (edgeWorker === worker) {
            edgeWorker = null;
            edgeState = "idle";
        }
    };
    edgeWorker = worker;
    return worker;
}

/** 每个屏幕只识别一次，按 S 时若未识别过则补上 */
function ensureImageEdge() {
    if (edgeState !== "idle") return;
    const canvas = mainCanvas;
    const width = canvas.width;
    const height = canvas.height;
    const data = canvas.getContext("2d")?.getImageData(0, 0, width, height);
    if (!data) return;
    edgeState = "running";
    const id = ++edgeRequestId;
    getEdgeWorker().postMessage(
        {
            id,
            buffer: data.data.buffer,
            width,
            height,
            lowThreshold: store.get("框选.自动框选.最小阈值"),
            highThreshold: store.get("框选.自动框选.最大阈值"),
        },
        [data.data.buffer],
    );
}

function getWin() {
    for (const win of windows) {
        const x = Math.max(win.rect.x, 0);
        const y = Math.max(win.rect.y, 0);
        const w = Math.min(win.rect.w, mainCanvas.width - x);
        const h = Math.min(win.rect.h, mainCanvas.height - y);
        edgeRect.push({
            x: x,
            y: y,
            width: w,
            height: h,
            type: "system",
        });
    }
}

function getNowScreen(id = nowScreenId) {
    const s = allScreens.find((i) => i.id === id) ?? allScreens[0];
    return s;
}

function showSaveBar(m: boolean) {
    hotkeys.deleteScope("c_bar");
    if (m) {
        centerBarEl.style({
            opacity: 1,
            pointerEvents: "auto",
        });
        toHotkeyScope("c_bar");
    } else {
        centerBarEl.style({
            opacity: 0,
            pointerEvents: "none",
        });
        backHotkeyScope();
    }
}

function toHotkeyScope(scope: hotkeyScope) {
    if (hotkeyScopes.at(-1) !== scope) hotkeyScopes.push(scope);
    hotkeys.setScope(scope);
}
function backHotkeyScope() {
    if (hotkeyScopes.length > 1) hotkeyScopes.pop();
    hotkeys.setScope(hotkeyScopes.at(-1) ?? "normal");
}

function setDefaultAction(act: setting["框选后默认操作"] | undefined) {
    if (!act) return;
    autoDo = act;
    if (autoDo !== "no") {
        toolsX[autoDo].el.el.style.backgroundColor = "var(--bar-focus-color)";
    }
}

function 记忆框选f() {
    if (记忆框选 && !longInited) {
        记忆框选值[nowScreenId] = [
            finalRect[0],
            finalRect[1],
            finalRect[2],
            finalRect[3],
        ];
        store.set("框选.记忆.rects", 记忆框选值);
    }
}

// 关闭
async function closeWin() {
    mainCanvas.width = drawCanvas.width = mainCanvas.width; // 确保清空画布
    cleanClip();
    document.documentElement.style.display = "none";
    记忆框选f();
    stopLongInput();
    // @ts-expect-error
    await scheduler.yield();
    renderSend("clip_close", []);
}

function runOcr() {
    const type = ocr引擎.gv;
    const c = getClipPhoto();
    renderSend("clip_ocr", [c.toDataURL(), type]);
    toolsX.close.f();
}

function runSearch() {
    const type = 识图引擎.gv;
    if (
        type === "ai" &&
        !store.get("AI.在线模型").find((i) => i.supportVision)
    ) {
        alert("无视觉模型，请在设置中添加模型");
        return;
    }
    const c = getClipPhoto();
    renderSend("clip_search", [c.toDataURL(), type]);
    toolsX.close.f();
}
// 二维码
function runQr() {
    const c = getClipPhoto();
    renderSend("clip_qr", [c.toDataURL()]);
    toolsX.close.f();
}

/** 是否处于绘画模式，绘画时不触发自动框选 */
let drawingMode = false;

function drawM(v: boolean) {
    drawingMode = v;
    if (v) {
        // 绘画模式
        clipEl.style.pointerEvents = "none";
        whEl.style({ pointerEvents: "none" });
        setEdge([]);
        refreshPropertyPanel();
    } else {
        // 裁切模式
        clipEl.style.pointerEvents = "auto";
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
        whEl.style({ pointerEvents: "auto" });
        hideElementBar();
    }
}

/**
 * 编辑栏跟踪工具栏
 */
function trackLocation() {
    const h = toolBar.offsetTop;
    let l = toolBar.offsetLeft + toolBar.offsetWidth + 8;
    if (drawBarPosi === "left") {
        l = toolBar.offsetLeft - drawBar.offsetWidth - 8;
    }
    drawBar.style.top = `${h}px`;
    drawBar.style.left = `${l}px`;
}

// 在其他应用打开

function openApp() {
    const path = require("node:path");
    const os = require("node:os");
    const tmpPhoto = path.join(os.tmpdir(), "/eSearch/tmp.png");
    const fs = require("node:fs");
    const c = getClipPhoto();
    const f = c.toDataURL().replace(/^data:image\/\w+;base64,/, "");
    const dataBuffer = Buffer.from(f, "base64");
    fs.writeFile(tmpPhoto, dataBuffer, () => {
        open_with(tmpPhoto);
    });
}

function initRecord() {
    const mode = toolsX.record.el.gv;
    if (mode === "normal") {
        renderSend("clip_recordx", [
            {
                rect: finalRect,
                id: String(nowScreenId),
                w: mainCanvas.width,
                h: mainCanvas.height,
                r: ratio,
            },
        ]);
    } else {
        renderSend("clip_recordx", []);
    }
    toolsX.close.f();
}

let longBusy = false;
let longCapped = false;
let longCompact = false;
let longCompactPreview = false;
let longCompactStarted = false;
let longPreviewLastTime = 0;
let longWarnLevel: LongWarnLevel = 0;
let longWarnTimer: NodeJS.Timeout | undefined;

let longStitcher: LongStitcher | null = null;
type LongDebugRecord = {
    file: string;
    width: number;
    height: number;
    data: Buffer;
    meta: Record<string, unknown>;
};

let longDebugRecords: LongDebugRecord[] = [];
let longDebugManifest: Record<string, unknown> | null = null;
let longDebugBytes = 0;
let longDebugTruncated = false;
const MAX_LONG_DEBUG_BYTES = 100 * 1024 * 1024;

declare global {
    interface Window {
        exportLongDebug: () => string | undefined;
    }
}

function resetLongDebug() {
    longDebugRecords = [];
    longDebugManifest = {
        version: 1,
        createdAt: new Date().toISOString(),
        mode: longDisplayMode(),
        direction: longFX,
        displayId: nowScreenId,
        rect: finalRect,
        ratio,
        screen: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
        settings: {
            模式: store.get("广截屏.模式"),
            t: store.get("广截屏.t"),
        },
    };
    longDebugBytes = 0;
    longDebugTruncated = false;
}

function recordLongDebug(frame: LongFrame, step: LongStep, forceLast: boolean) {
    try {
        const zlib = require("node:zlib") as typeof import("node:zlib");
        const data = zlib.deflateRawSync(
            Buffer.from(
                frame.data.buffer,
                frame.data.byteOffset,
                frame.data.byteLength,
            ),
        );
        if (longDebugBytes + data.byteLength > MAX_LONG_DEBUG_BYTES) {
            if (!longDebugTruncated) {
                longDebugTruncated = true;
                console.warn("长截屏调试数据超过内存上限，停止记录后续帧");
            }
            return;
        }
        longDebugBytes += data.byteLength;
        const index = longDebugRecords.length;
        const file = `${String(index).padStart(4, "0")}.rgba.z`;
        longDebugRecords.push({
            file,
            width: frame.width,
            height: frame.height,
            data,
            meta: {
                index,
                file,
                width: frame.width,
                height: frame.height,
                time: Date.now(),
                offset: step.offset,
                appliedOffset: step.applied,
                margins: step.margins,
                patch: step.patch,
                bounds: step.bounds,
                final: step.final,
                forceLast,
            },
        });
    } catch (error) {
        console.error("记录长截屏调试帧失败", error);
    }
}

function exportLongDebug() {
    if (!longDebugManifest || longDebugRecords.length === 0) {
        console.warn("没有可导出的长截屏调试数据");
        return;
    }
    try {
        const fs = require("node:fs") as typeof import("node:fs");
        const path = require("node:path") as typeof import("node:path");
        const zlib = require("node:zlib") as typeof import("node:zlib");
        const base = renderSendSync("userDataPath", []);
        if (!base) return;
        const dir = path.join(base, "long-debug", String(Date.now()));
        fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
        for (const record of longDebugRecords) {
            fs.writeFileSync(
                path.join(dir, "frames", record.file),
                record.data,
            );
        }
        fs.writeFileSync(
            path.join(dir, "frames.jsonl"),
            `${longDebugRecords.map((r) => JSON.stringify(r.meta)).join("\n")}\n`,
        );
        let resultMeta: { width: number; height: number } | undefined;
        if (longX.img) {
            const ctx = longX.img.getContext("2d");
            if (ctx) {
                const image = ctx.getImageData(
                    0,
                    0,
                    longX.img.width,
                    longX.img.height,
                );
                fs.writeFileSync(
                    path.join(dir, "result.rgba.z"),
                    zlib.deflateRawSync(
                        Buffer.from(
                            image.data.buffer,
                            image.data.byteOffset,
                            image.data.byteLength,
                        ),
                    ),
                );
                resultMeta = {
                    width: longX.img.width,
                    height: longX.img.height,
                };
                fs.writeFileSync(
                    path.join(dir, "result.json"),
                    JSON.stringify({
                        ...resultMeta,
                        frameCount: longDebugRecords.length,
                    }),
                );
            }
        }
        const manifest = {
            ...longDebugManifest,
            frameCount: longDebugRecords.length,
            truncated: longDebugTruncated,
            exportedAt: new Date().toISOString(),
            result: resultMeta,
        };
        fs.writeFileSync(
            path.join(dir, "manifest.json"),
            JSON.stringify(manifest, null, 2),
        );
        fs.writeFileSync(
            path.join(dir, "README.txt"),
            `长截屏调试数据\n\n帧文件为 raw RGBA + zlib deflateRaw，元数据见 frames.jsonl。\n复现：pnpm long-stitch "${dir}" [--from N] [--to N] [--step N]\n`,
        );
        console.log("长截屏调试数据已导出", dir);
        longDebugRecords = [];
        longDebugBytes = 0;
        return dir;
    } catch (error) {
        console.error("导出长截屏调试数据失败", error);
        return;
    }
}

window.exportLongDebug = exportLongDebug;

function resetLongRunState() {
    longCapped = false;
    longRunning = true;
    longInited = true;
    longCompact = false;
    clearLongWarn();
    longCompactPreview = false;
    longCompactStarted = false;
    longPreviewLastTime = 0;
    finishLongInside = false;
    longStitcher = new LongStitcher({ findOffset, direction: longFX });
    longX.img = null;
    longX.imgXY = { x: 0, y: 0 };
}

function makeLongPreview(): [string, number, number] | undefined {
    const img = longX.img;
    if (!img?.width || !img?.height) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(360 / img.width, 1000 / img.height);
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return [canvas.toDataURL("image/webp", 0.82), canvas.width, canvas.height];
}

function queueLongPreview() {
    if (!longCompact || !longCompactPreview) return;
    const now = performance.now();
    if (now - longPreviewLastTime < 250) return;
    const preview = makeLongPreview();
    if (!preview) return;
    longPreviewLastTime = now;
    renderSend("long_compact_preview", [
        { data: preview[0], w: preview[1], h: preview[2] },
    ]);
}

function setLongWarn(level: LongWarnLevel) {
    if (level === longWarnLevel) return;
    longWarnLevel = level;
    if (longCompact) {
        renderSend("long_compact_warn", [level]);
    } else {
        renderLongWarn();
    }
}

function updateLongWarn(step: LongStep, forceLast: boolean) {
    if (forceLast) return;
    const level = longOverlapLevel(
        step.offset?.overlap,
        step.offset?.confidence,
    );
    if (level > 0) {
        setLongWarn(level);
        if (longWarnTimer) clearTimeout(longWarnTimer);
        // 自动模式下停手后不会再有新帧，靠超时收掉提示
        longWarnTimer = setTimeout(() => {
            longWarnTimer = undefined;
            setLongWarn(0);
        }, 1600);
        return;
    }
    if (longWarnTimer) {
        clearTimeout(longWarnTimer);
        longWarnTimer = undefined;
    }
    setLongWarn(0);
}

function clearLongWarn() {
    if (longWarnTimer) {
        clearTimeout(longWarnTimer);
        longWarnTimer = undefined;
    }
    setLongWarn(0);
}

async function long_s(forceLast = false) {
    // 上一帧还没拼完就跳过这一帧：并发进 addLong 会抢拼接状态，
    // 拼出来的偏移互相错位
    if (longBusy || longCapped) return;
    longBusy = true;
    try {
        const data = (await getNowScreen().capture()).toImageData();
        // 截屏失败时拿到的是 0x0 的空图，不能当成一帧
        if (!data?.width || !data?.height) return;
        await addLong(data, forceLast);
    } catch (error) {
        console.error(`长截图单帧失败: ${error}`);
        // 中途抛异常时不能把鼠标穿透留着，否则整个桌面看起来都点不动
        if (!longCompact) renderSend("windowIgnoreMouse", [false]);
    } finally {
        longBusy = false;
    }
}

function startLongInterval() {
    if (longClipTime) clearInterval(longClipTime);
    longClipTime = setInterval(() => {
        long_s();
    }, store.get("广截屏.t"));
}

function stopLongInput() {
    uIOhook?.removeAllListeners();
    uIOhook?.stop();
    uIOhook = null;
    clearInterval(longClipTime);
    longClipTime = undefined;
    if (longMouse !== null) {
        clearInterval(longMouse);
        longMouse = null;
    }
}

function startLongInput() {
    if (store.get("广截屏.模式") !== "自动" || isWaylandSession()) {
        startLongInterval();
        return;
    }
    try {
        uIOhook = require("uiohook-napi").uIOhook;
        if (!uIOhook) throw new Error("uiohook 不可用");
        uIOhook.start();
        uIOhook.on("keyup", () => {
            // 原来每次全局抬键都抓一整屏，完全不限流
            const n = Date.now();
            if (n - lastLong > 300) {
                lastLong = n;
                long_s();
            }
        });
        uIOhook.on("wheel", () => {
            const n = Date.now();
            if (n - lastLong > 500) {
                lastLong = n;
                long_s();
            }
        });
    } catch (error) {
        console.error(`长截图无法监听按键和滚轮，改用定时截取: ${error}`);
        uIOhook = null;
        startLongInterval();
    }
}

function longDisplayMode() {
    const mode = store.get("广截屏.显示模式");
    if (mode === "自动") return isWaylandSession() ? "紧凑" : "覆盖";
    return mode;
}

async function startLongCompact() {
    longCompact = true;
    longCompactPreview = false;
    longCompactStarted = false;
    longPreviewLastTime = 0;

    记忆框选值[nowScreenId] = [
        finalRect[0],
        finalRect[1],
        finalRect[2],
        finalRect[3],
    ];
    store.set("框选.记忆.rects", 记忆框选值);

    // 先隐藏全屏截屏层再抓首帧：Wayland 下 portal 提示框不会再被遮罩挡住
    renderSendSync("clip_hide", []);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await long_s();

    const preview = makeLongPreview();
    renderSend("long_compact_start", [
        {
            displayId: nowScreenId,
            rect: finalRect,
            ratio,
            preview: preview
                ? { data: preview[0], w: preview[1], h: preview[2] }
                : undefined,
        },
    ]);
}

async function startLong() {
    resetLongRunState();
    resetLongDebug();
    if (longDisplayMode() === "紧凑") {
        await startLongCompact();
        return;
    }
    initLong(finalRect);
    // 先装好触发方式再截第一帧：Wayland 下第一帧可能等 portal 很久甚至失败，
    // 放在后面会让定时截取一直没开始
    startLongInput();
    renderSend("windowIgnoreMouse", [true]);
    await long_s();
}

function initLong(rect: number[]) {
    longRunning = true;
    longInited = true;
    longCapped = false;

    longMouse = setInterval(() => {
        const { x, y } = renderSendSync("getMousePos", []).po;
        const el = document.elementsFromPoint(x, y);
        if (longRunning)
            renderSend("windowIgnoreMouse", [!el.includes(finishLongB)]);
        else renderSend("windowIgnoreMouse", [false]);
    }, 1000);

    for (const i of longHide) {
        i.style.display = "none";
    }

    document.body.classList.remove("editor_bg");

    记忆框选值[nowScreenId] = [rect[0], rect[1], rect[2], rect[3]];
    store.set("框选.记忆.rects", 记忆框选值);

    lr.style({
        left: `${rect[0] / ratio}px`,
        top: `${rect[1] / ratio}px`,
        width: `${rect[2] / ratio}px`,
        height: `${rect[3] / ratio}px`,
        opacity: "",
    });
    const w = 16;
    let right = 0;
    let botton = 0;
    // 优先放在选区下方，放不下再放右侧，都放不下才盖在选区里
    if ((rect[1] + rect[3]) / ratio + w <= window.innerHeight) {
        botton = -w;
    } else if ((rect[0] + rect[2]) / ratio + w <= window.innerWidth) {
        right = -w;
    }
    finishLongB.style.right = `${right}px`;
    finishLongB.style.bottom = `${botton}px`;
    finishLongInside = right === 0 && botton === 0;
    finishLongB.onclick = stopLong;

    let longWidth = 0;
    if (window.innerWidth / 2 > (rect[0] + rect[2] / 2) / ratio) {
        // 右边
        longPreview.style({ right: "0", left: "auto" });
        longWidth = window.innerWidth - (rect[0] + rect[2]) / ratio - w;
    } else {
        longPreview.style({ left: "0" });
        longWidth = rect[0] / ratio - w;
    }
    longPreview.style({
        display: longWidth < 100 ? "none" : "",
        width: `${longWidth}px`,
        height: "100vh",
    });
}

async function stopLong() {
    // 先停掉按键/滚轮/定时触发，避免最后一帧还没截又来了新帧
    stopLongInput();
    // 等已经在抓的那一帧拼完，否则下面的最后一帧会直接被跳过
    for (let i = 0; longBusy && i < 40; i++) {
        await new Promise((r) => setTimeout(r, 50));
    }
    // 在抓最后一帧前收掉提示，避免它进入拼接画面
    clearLongWarn();

    if (longCompact) {
        // 控制窗可能贴在选区底部，和覆盖模式的结束按钮一样，
        // 用隐藏控制窗后的最后一帧覆盖掉它
        longCompactPreview = false;
        try {
            await long_s(true);
        } finally {
            longCompact = false;
            longCompactStarted = false;
            try {
                await addLong(undefined);
            } finally {
                renderSend("long_compact_end", []);
            }
        }
        return;
    }

    // 结束按钮压在选区里时，先藏起来并等界面刷新，再截最后一帧覆盖它
    if (finishLongInside) {
        lr.style({ opacity: "0" });
        // 等一帧让结束按钮真的从画面上消失；窗口不在前台时 rAF 可能被节流，用定时器更稳
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await long_s(finishLongInside);

    lr.style({ opacity: "0" });
    renderSend("windowIgnoreMouse", [false]);
    addLong(undefined);
    for (const i of longHide) {
        i.style.display = "";
    }
}

async function addLong(x: ImageData | undefined, forceLast = false) {
    if (!x) {
        stopLongInput();
        pjLong();
        return;
    }
    const canvas = ele("canvas").el;
    canvas.width = finalRect[2];
    canvas.height = finalRect[3];
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        longCapped = true;
        console.error("长截图：拿不到 2d 上下文，停止拼接");
        return;
    }
    ctx.putImageData(x, -finalRect[0], -finalRect[1]);

    if (!longStitcher) {
        longStitcher = new LongStitcher({
            findOffset,
            direction: longFX,
        });
    }
    const frame: LongFrame = {
        width: canvas.width,
        height: canvas.height,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    };
    const step = await longStitcher.addFrame(frame, forceLast);
    updateLongWarn(step, forceLast);
    recordLongDebug(frame, step, forceLast);
    applyLongStep(canvas, step);
}

function applyLongStep(frameCanvas: HTMLCanvasElement, step: LongStep) {
    const patch = step.patch;
    if (!patch) return;

    const newCanvas = ele("canvas").el;
    newCanvas.width = step.bounds.width;
    newCanvas.height = step.bounds.height;
    const newCtx = newCanvas.getContext("2d");
    if (!newCtx) {
        longCapped = true;
        console.error("长截图：拿不到 2d 上下文，停止拼接");
        return;
    }

    const old = longX.img;
    const oldXY = longX.imgXY;
    if (old) {
        newCtx.drawImage(old, oldXY.x - step.bounds.x, oldXY.y - step.bounds.y);
    }
    newCtx.drawImage(
        frameCanvas,
        patch.sx,
        patch.sy,
        patch.sw,
        patch.sh,
        patch.dx - step.bounds.x,
        patch.dy - step.bounds.y,
        patch.sw,
        patch.sh,
    );

    longX.img = newCanvas;
    longX.imgXY = { x: step.bounds.x, y: step.bounds.y };

    if (longCompact) {
        queueLongPreview();
        return;
    }

    longPreview.clear();
    newCanvas.style.maxWidth = "100%";
    newCanvas.style.maxHeight = "100%";
    longPreview.add(newCanvas);
}

function pjLong() {
    const oCanvas = longX.img;
    if (!oCanvas) return;
    mainCanvas.width = oCanvas.width;
    mainCanvas.height = oCanvas.height;
    setClipSize(oCanvas.width, oCanvas.height);

    const ggid = oCanvas
        .getContext("2d")!
        .getImageData(0, 0, oCanvas.width, oCanvas.height);
    mainCanvas.getContext("2d")!.putImageData(ggid, 0, 0);

    finalRect = [0, 0, oCanvas.width, oCanvas.height];
    // 尺寸变了，立即按当前形态重绘
    drawClip();

    fabricCanvas.setDimensions({
        width: oCanvas.width,
        height: oCanvas.height,
    });

    longPreview.style({ display: "none" });
    longPreview.clear();
    clearLongWarn();

    document.body.classList.add("editor_bg");

    lr.style({ width: "0", height: "0" });

    longRunning = false;
}

type DipRect = { x: number; y: number; w: number; h: number };
type WindowInfo = ReturnType<typeof getWindowInfos>[number];

function intersectRect(a: DipRect, b: DipRect): DipRect | null {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w);
    const y2 = Math.min(a.y + a.h, b.y + b.h);
    if (x2 <= x || y2 <= y) return null;
    return { x, y, w: x2 - x, h: y2 - y };
}

function rectArea(r: DipRect | null) {
    return r ? r.w * r.h : 0;
}

function requestCaptureSources(): Promise<CaptureSourceInfo[]> {
    return new Promise((resolve) => {
        const id = ++captureSourceRequestId;
        const timer = setTimeout(() => {
            captureSourceRequests.delete(id);
            resolve([]);
        }, 120_000);
        captureSourceRequests.set(id, (sources) => {
            clearTimeout(timer);
            resolve(sources);
        });
        renderSend("getCaptureSources", [id]);
    });
}

function normalizeWindowName(name: string) {
    return name
        .replace(/^[●•*]\s*/, "")
        .replace(/\[\*\]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function stripAppSuffix(name: string) {
    return name.replace(/\s+[-–—]\s+[^-–—]+$/, "");
}

/** 先用窗口 id，再用唯一标题匹配 */
function matchWindowSource(win: WindowInfo, sources: CaptureSourceInfo[]) {
    const id = Number(win.id);
    for (const source of sources) {
        const p = source.id.split(":");
        if (p[0] === "window" && Number(p[1]) === id) return source;
    }
    const title = normalizeWindowName(win.title);
    if (!title) return null;
    const exact = sources.filter((source) => {
        const name = normalizeWindowName(source.name);
        return (
            name === title ||
            (stripAppSuffix(name) !== "" &&
                stripAppSuffix(name) === stripAppSuffix(title))
        );
    });
    return exact.length === 1 ? exact[0] : null;
}

function chooseLiveWindow(
    sel: DipRect,
    list: WindowInfo[],
): { win: WindowInfo; rect: DipRect } | null {
    const usable = list.filter((win) => {
        if (win.pid === mainPid) return false;
        if (win.minimized) return false;
        if (currentDisplays.length > 0 && win.displayId === null) return false;
        if (!(win.dipRect.w > 1) || !(win.dipRect.h > 1)) return false;
        return allScreens.some(
            (screen) =>
                rectArea(
                    intersectRect(win.dipRect, {
                        x: screen.bounds.x,
                        y: screen.bounds.y,
                        w: screen.bounds.width,
                        h: screen.bounds.height,
                    }),
                ) > 0,
        );
    });
    const autoLocate =
        usable.length >= 2 ||
        (usable.length === 1 &&
            rectArea(intersectRect(sel, usable[0].dipRect)) > 0);
    if (!autoLocate) return null;

    const overlaps = usable
        .map((win) => ({ win, rect: intersectRect(sel, win.dipRect) }))
        .filter((i): i is { win: WindowInfo; rect: DipRect } => !!i.rect);
    if (!overlaps.length) return null;

    const maxArea = Math.max(...overlaps.map((i) => rectArea(i.rect)));
    const center = { x: sel.x + sel.w / 2, y: sel.y + sel.h / 2 };
    const atCenter = overlaps
        .filter(
            ({ win }) =>
                win.dipRect.x <= center.x &&
                center.x <= win.dipRect.x + win.dipRect.w &&
                win.dipRect.y <= center.y &&
                center.y <= win.dipRect.y + win.dipRect.h,
        )
        .sort((a, b) => b.win.z - a.win.z)[0];
    const chosen =
        atCenter && rectArea(atCenter.rect) >= maxArea * 0.6
            ? atCenter
            : overlaps.sort((a, b) => rectArea(b.rect) - rectArea(a.rect))[0];

    if (rectArea(chosen.rect) < rectArea(sel) * 0.2) return null;
    return chosen;
}

function cropPoster(
    photo: HTMLCanvasElement,
    sel: DipRect,
    sticker: DipRect,
    scale: number,
) {
    const x = Math.max(
        0,
        Math.min(photo.width - 1, Math.round((sticker.x - sel.x) * scale)),
    );
    const y = Math.max(
        0,
        Math.min(photo.height - 1, Math.round((sticker.y - sel.y) * scale)),
    );
    const w = Math.max(
        1,
        Math.min(photo.width - x, Math.round(sticker.w * scale)),
    );
    const h = Math.max(
        1,
        Math.min(photo.height - y, Math.round(sticker.h * scale)),
    );
    if (x === 0 && y === 0 && w >= photo.width - 1 && h >= photo.height - 1)
        return photo.toDataURL();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas
        .getContext("2d")!
        .drawImage(photo, x, y, w, h, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL();
}

async function runLiveDing() {
    if (liveDingRunning) return;
    liveDingRunning = true;
    try {
        const display = getNowScreen();
        const sel: DipRect = {
            x: finalRect[0] / ratio + display.bounds.x,
            y: finalRect[1] / ratio + display.bounds.y,
            w: finalRect[2] / ratio,
            h: finalRect[3] / ratio,
        };
        const photo = getClipPhoto();
        const list = getWindowInfos(currentDisplays);
        const chosen = chooseLiveWindow(sel, list);
        let sticker = sel;
        let target: LiveDingTarget | null = null;
        let sources: CaptureSourceInfo[] | undefined;
        if (chosen) {
            // PipeWire 会弹系统选择框，先隐藏全屏截屏层，避免挡住它
            renderSend("clip_hide", []);
            sources = await requestCaptureSources();
            const source = matchWindowSource(chosen.win, sources);
            if (source) {
                sticker = chosen.rect;
                const win = chosen.win.dipRect;
                const clamp = (v: number) => Math.max(0, Math.min(1, v));
                target = {
                    sourceId: source.id,
                    windowId: chosen.win.id,
                    appName: chosen.win.appName,
                    title: chosen.win.title,
                    crop: {
                        x: clamp((sticker.x - win.x) / win.w),
                        y: clamp((sticker.y - win.y) / win.h),
                        w: clamp(sticker.w / win.w),
                        h: clamp(sticker.h / win.h),
                    },
                };
            }
        }
        renderSend("clip_ding_live", [
            {
                poster: cropPoster(photo, sel, sticker, ratio),
                rect: sticker,
                displayId: nowScreenId,
                target,
                sources,
            },
        ]);
        toolsX.close.f();
    } finally {
        liveDingRunning = false;
    }
}

// 钉在屏幕上
function runDing() {
    const c = getClipPhoto();
    const display = getNowScreen();
    renderSend("clip_ding", [
        c.toDataURL(),
        "ding",
        {
            x: finalRect[0] / ratio + display.bounds.x,
            y: finalRect[1] / ratio + display.bounds.y,
            w: finalRect[2] / ratio,
            h: finalRect[3] / ratio,
        },
    ]);
    toolsX.close.f();
}

function alert(m: string) {
    const d = ele("dialog")
        .add(
            view("y")
                .add([
                    t(m),
                    button(t("确定"))
                        .on("click", () => {
                            d.remove();
                        })
                        .style({ width: "auto" }),
                ])
                .class(Class.gap),
        )
        .class(Class.glassBar)
        .addInto();
    d.el.showModal();
}

function checkTranslator() {
    const fyq = store.get("翻译.翻译器");
    if (fyq.length === 0) {
        alert("无翻译器，请先设置翻译器");
        return false;
    }
    return true;
}

async function translate() {
    const t = checkTranslator();
    if (!t) return;
    const display = getNowScreen();
    const c = getClipPhoto();
    if (toolsX.translate.el.gv === "ding") {
        renderSend("clip_ding", [
            c.toDataURL(),
            "translate",
            {
                x: finalRect[0] / ratio + display.bounds.x,
                y: finalRect[1] / ratio + display.bounds.y,
                w: finalRect[2] / ratio,
                h: finalRect[3] / ratio,
            },
        ]);
    } else
        renderSend("clip_translate", [
            {
                rect: {
                    x: finalRect[0],
                    y: finalRect[1],
                    w: finalRect[2],
                    h: finalRect[3],
                },
                dipRect: {
                    x: finalRect[0] / ratio + display.bounds.x,
                    y: finalRect[1] / ratio + display.bounds.y,
                    w: finalRect[2] / ratio,
                    h: finalRect[3] / ratio,
                },
                displayId: nowScreenId,
                img: getClipPhoto().toDataURL(),
            },
        ]);
    toolsX.close.f();
}

// 复制
async function runCopy() {
    const c = getClipPhoto();
    const blob = await getBlob(c, "image/png");
    if (blob) await writeImage(blob);
    toolsX.close.f();
}
// 保存
function runSave() {
    if (store.get("保存.快速保存")) {
        type = store.get("保存.默认格式");
        renderSend("clip_hide", []);
        const p = renderSendSync("save_file_path", [type]);
        save(p);
        return;
    }
    showSaveBar(true);
    const els = suffixList;
    const type2N = saveTypeList;
    for (const i of els) {
        i.el.className = "";
    }
    let i = type2N.indexOf(store.get("保存.默认格式"));
    if (i < 0) i = 0;
    els[i].el.className = "suffix_h";
    toHotkeyScope("c_bar");
    hotkeys("enter", "c_bar", () => {
        els[i].el.click();
        showSaveBar(false);
    });
    const l = type2N.length;
    hotkeys("up", "c_bar", () => {
        els[i % l].el.className = "";
        i = i === 0 ? l - 1 : i - 1;
        els[i % l].el.className = "suffix_h";
    });
    hotkeys("down", "c_bar", () => {
        els[i % l].el.className = "";
        i++;
        els[i % l].el.className = "suffix_h";
    });
    hotkeys("esc", "c_bar", () => {
        showSaveBar(false);
    });
}
async function save(message: string) {
    if (!message) return;
    const iType = message.split(".")?.pop()?.toLowerCase() as
        | setting["保存"]["默认格式"]
        | undefined;
    const _type = iType && saveTypeList.includes(iType) ? iType : type;

    if (_type !== "svg") store.set("保存.默认格式", _type);

    const fs = require("node:fs");
    let dataBuffer: Uint8Array;
    try {
        if (_type === "svg") dataBuffer = Buffer.from(getClipPhotoSVG());
        else {
            const nc = getClipPhoto();
            dataBuffer = await encodeCanvasImage(nc, _type);
            if (store.get("保存.保存并复制")) {
                // 剪贴板只稳定支持常见类型，其他格式另编码一份 png
                const copyType = clipboardImageFormat(_type);
                const copyBuffer =
                    copyType === _type
                        ? dataBuffer
                        : await encodeCanvasImage(nc, "png");
                await writeImage(
                    new Blob([copyBuffer], {
                        type: imageFormatMime[copyType],
                    }),
                ); // todo tip
            }
        }
    } catch (e) {
        console.error("保存失败", e);
        return;
    }

    fs.writeFile(message, dataBuffer, (err: Error | null) => {
        if (!err) {
            renderSend("ok_save", [message]);
            toolsX.close.f();
        } else {
            // todo error
        }
    });
}

function getClipPhotoSVG() {
    const svg = document.createElement("div");
    if (typeof fabricCanvas === "undefined") {
        svg.innerHTML = `<!--?xml version="1.0" encoding="UTF-8" standalone="no" ?-->
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${mainCanvas.width}" height="${mainCanvas.height}" viewBox="0 0 1920 1080" xml:space="preserve">
            <desc>Created with eSearch</desc>
            </svg>`;
    } else {
        svg.innerHTML = fabricCanvas.toSVG();
        // @ts-ignore
        svg.querySelector("desc").innerHTML =
            "Created with eSearch & Fabric.js";
    }
    const svgEl = svg.querySelector("svg") as SVGElement;
    svgEl.setAttribute("viewBox", finalRect.join(" "));
    const image = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "image",
    );
    image.setAttribute("xlink:href", mainCanvas.toDataURL());
    svgEl.insertBefore(image, svgEl.firstChild);
    const svgT = new XMLSerializer().serializeToString(svgEl);
    return svgT;
}

function getClipPhoto() {
    const mainCtx = mainCanvas.getContext("2d")!;
    if (!finalRect) finalRect = [0, 0, mainCanvas.width, mainCanvas.height];

    if (typeof fabricCanvas !== "undefined") {
        fabricCanvas.discardActiveObject();
        fabricCanvas.renderAll();
    }

    const tmpCanvas = document.createElement("canvas");
    const tmpctx = tmpCanvas.getContext("2d")!;
    tmpCanvas.width = finalRect[2];
    tmpCanvas.height = finalRect[3];
    const gid = mainCtx.getImageData(
        finalRect[0],
        finalRect[1],
        finalRect[2],
        finalRect[3],
    ); // 裁剪
    tmpctx.putImageData(gid, 0, 0);
    tmpctx.drawImage(
        fabricCanvas.toCanvasElement(1, {
            left: finalRect[0],
            top: finalRect[1],
            width: finalRect[2],
            height: finalRect[3],
        }),
        0,
        0,
    );
    if (!isRect) {
        const ctx = tmpctx;

        // 创建临时Canvas并保存原始内容
        const tempCanvas = createTemporaryCanvas(tmpCanvas);

        // 清除主Canvas
        ctx.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);

        // 定义裁剪区域
        ctx.beginPath();
        freeSelect.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x - finalRect[0], point.y - finalRect[1]);
            } else {
                ctx.lineTo(point.x - finalRect[0], point.y - finalRect[1]);
            }
        });
        ctx.closePath();
        ctx.clip();

        // 将原始内容重新绘制到主Canvas上
        ctx.drawImage(tempCanvas, 0, 0);
    }
    return tmpCanvas;
}

function createTemporaryCanvas(originalCanvas: HTMLCanvasElement) {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = originalCanvas.width;
    tempCanvas.height = originalCanvas.height;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.drawImage(originalCanvas, 0, 0);
    return tempCanvas;
}

async function getBlob(c: HTMLCanvasElement, type: string, q = 1) {
    const { promise, resolve } = Promise.withResolvers<Blob | null>();
    c.toBlob(
        (blob) => {
            resolve(blob);
        },
        type,
        q,
    );
    return promise;
}

function e2srcPoint(e: MouseEvent | PointerEvent) {
    return { x: e.clientX, y: e.clientY } as SrcPoint;
}

function src2pXYdb(e: SrcPoint) {
    const cX = (e.x - editorP.x * editorP.zoom) / editorP.zoom;
    const cY = (e.y - editorP.y * editorP.zoom) / editorP.zoom;
    return { x: cX, y: cY };
}

function src2pXY(e: SrcPoint) {
    const { x, y } = src2pXYdb(e);
    return { x: Math.round(x), y: Math.round(y) } as editor_position;
}

// 鼠标框选坐标转画布坐标,鼠标坐标转画布坐标
function p2Rect(p1: px_position | null, p2: px_position | null): rect {
    if (!p1 || !p2) return [0, 0, 0, 0];
    const { x: oX1, y: oY1 } = p1;
    const { x: oX2, y: oY2 } = p2;
    const x1 = Math.min(oX1, oX2);
    const y1 = Math.min(oY1, oY2);
    const x2 = Math.max(oX1, oX2) + 1;
    const y2 = Math.max(oY1, oY2) + 1;
    return [x1, y1, x2 - x1, y2 - y1];
}

function src2cXY(e: SrcPoint) {
    const { x, y } = src2pXYdb(e);
    if (editorP.zoom === 1 / window.devicePixelRatio) {
        return { x: Math.ceil(x), y: Math.ceil(y) } as px_position; // 确保获取到最后的像素
    }
    return { x: Math.floor(x), y: Math.floor(y) } as px_position; // 放大后，可以进行高精度计算来获取所有像素，缩写后，看的是放大镜，这就无关紧要了
}

function pointsOutRect(points: point[]) {
    if (points.length === 0) {
        return [0, 0, 0, 0] as rect;
    }

    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    // 遍历所有点，找到最小和最大的x,y坐标
    for (const point of points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }

    // 返回边框的左下角和右上角坐标
    return [minX, minY, maxX - minX, maxY - minY] as rect;
}

// 开始操纵框选
function clipStart(e: MouseEvent, inRect: boolean) {
    const p = src2pXY(e2srcPoint(e));
    if (isRect) {
        // 在选区内，则调整，否则新建
        if (inRect) {
            isInClipRect(p);
            oldP = { x: p.x, y: p.y };
            oFinalRect = finalRect;
            moving = true;
            moveRect(oFinalRect, p, p);
        } else {
            selecting = true;
            rectStartE = src2cXY(e2srcPoint(e));
            finalRect = p2Rect(rectStartE, rectStartE);
            rightKey = false;
            changeRightBar(false);
        }
    } else {
        if (inRect) {
            oldP = { x: p.x, y: p.y };
            oPoly = structuredClone(freeSelect);
            moving = true;
            movePoly(oPoly, p, p);
        } else {
            selecting = true;
            freeSelect = [p];
            finalRect = pointsOutRect(freeSelect);
            rightKey = false;
            changeRightBar(false);
        }
    }
    renderClip(e);

    // 隐藏
    drawBar.style.opacity = toolBar.style.opacity = "0";
}

function pickColor(e: MouseEvent | PointerEvent) {
    rightKey = !rightKey;
    // 自由右键取色
    mouseBar(finalRect, e2srcPoint(e));
    // 改成多格式样式
    if (rightKey) {
        changeRightBar(true);
    } else {
        changeRightBar(false);
    }
}

function clipEnd(e: MouseEvent) {
    const p = src2pXY(e2srcPoint(e));
    selecting = false;
    if (isRect) {
        const r = p2Rect(rectStartE, src2cXY(e2srcPoint(e)));
        if (rectInRect.length) {
            let nearestL = Number.POSITIVE_INFINITY;
            let nr: rect | null = null;
            for (const rect of rectInRect) {
                const center1 = {
                    x: rect[0] + rect[2] / 2,
                    y: rect[1] + rect[3] / 2,
                };
                const center2 = { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 };
                const l =
                    Math.sqrt(
                        (center1.x - center2.x) ** 2 +
                            (center1.y - center2.y) ** 2,
                    ) +
                    Math.abs(rect[0] - r[0]) +
                    Math.abs(rect[1] - r[1]) +
                    Math.abs(rect[0] + rect[2] - (r[0] + r[2])) +
                    Math.abs(rect[1] + rect[3] - (r[1] + r[3]));
                if (l < nearestL) {
                    nearestL = l;
                    nr = rect;
                }
            }
            if (nr && (e.shiftKey || (!moved && down))) {
                rectSelect = true;
                finalRect = nr;
            } else {
                finalRect = r;
            }
        } else {
            finalRect = r;
        }
    } else {
        freeSelect.push(p);
        finalRect = pointsOutRect(freeSelect);
    }
    // 此时 selecting 已为 false，选区已定，直接重绘
    drawClip();
    renderClip(e);
    hisPush();
}

/** 遮罩当前的显示形态，未绘制过为 undefined */
let maskType: "rect" | "poly" | null | undefined;
/** 自动框选提示的上一次内容 */
let edgeKey = "";

/** 切换遮罩形态，null 为不显示 */
function showMask(type: "rect" | "poly" | null) {
    if (type === maskType) return;
    maskType = type;
    const rectV = type === "rect";
    for (const el of clipMaskRect) el.el.style.display = rectV ? "" : "none";
    for (const el of clipSelectLines) el.el.style.display = rectV ? "" : "none";
    clipMaskPoly.el.style.display = type === "poly" ? "" : "none";
}

function drawSelectLines() {
    const [x, y, width, height] = finalRect;
    const w = lineW();
    const vc = visibleCanvasRect();
    const top = Math.max(vc.y0, src2screenY(y));
    const bottom = Math.min(vc.y1, src2screenY(y + height));
    const left = Math.max(vc.x0, src2screenX(x));
    const right = Math.min(vc.x1, src2screenX(x + width));
    const spanH = Math.max(0, bottom - top);
    const spanW = Math.max(0, right - left);
    clipSelectLineX.forEach((el, i) => {
        const px = src2screenX(x + x选区参考线.x[i] * width);
        if (spanH <= 0 || px < vc.x0 || px > vc.x1) {
            setElBox(el.el, 0, 0, 0, 0);
            return;
        }
        setScreenRect(el.el, px - w / 2, top, px + w / 2, top + spanH);
    });
    clipSelectLineY.forEach((el, i) => {
        const py = src2screenY(y + x选区参考线.y[i] * height);
        if (spanW <= 0 || py < vc.y0 || py > vc.y1) {
            setElBox(el.el, 0, 0, 0, 0);
            return;
        }
        setScreenRect(el.el, left, py - w / 2, left + spanW, py + w / 2);
    });
}

/** 画框(遮罩) */
function drawClipRect() {
    const x = finalRect[0];
    const y = finalRect[1];
    const width = finalRect[2];
    const height = finalRect[3];

    showMask("rect");

    // 画布在屏幕上的可见范围
    const { x0: vx0, y0: vy0, x1: vx1, y1: vy1 } = visibleCanvasRect();
    // 选区在画布可见范围内的屏幕坐标
    const hx0 = Math.min(vx1, Math.max(vx0, src2screenX(x)));
    const hy0 = Math.min(vy1, Math.max(vy0, src2screenY(y)));
    const hx1 = Math.min(vx1, Math.max(hx0, src2screenX(x + width)));
    const hy1 = Math.min(vy1, Math.max(hy0, src2screenY(y + height)));
    // 洞的边缘对齐设备像素；贴着画布边缘时直接使用画布边缘，避免出现暗边
    const hxl = Math.min(vx1, Math.max(vx0, hx0 === vx0 ? vx0 : snapPx(hx0)));
    const hyt = Math.min(vy1, Math.max(vy0, hy0 === vy0 ? vy0 : snapPx(hy0)));
    const hxr = Math.min(vx1, Math.max(hxl, hx1 === vx1 ? vx1 : snapPx(hx1)));
    const hyb = Math.min(vy1, Math.max(hyt, hy1 === vy1 ? vy1 : snapPx(hy1)));

    setElBox(clipMaskRect[0].el, vx0, vy0, vx1 - vx0, Math.max(0, hyt - vy0));
    setElBox(clipMaskRect[1].el, vx0, hyb, vx1 - vx0, Math.max(0, vy1 - hyb));
    setElBox(
        clipMaskRect[2].el,
        vx0,
        hyt,
        Math.max(0, hxl - vx0),
        Math.max(0, hyb - hyt),
    );
    setElBox(
        clipMaskRect[3].el,
        hxr,
        hyt,
        Math.max(0, vx1 - hxr),
        Math.max(0, hyb - hyt),
    );

    drawSelectLines();

    // 大小栏
    whBar(finalRect);
}

/** 画多边形(遮罩) */
function drawClipPoly(points: point[]) {
    if (points.length < 2) {
        showMask(null);
        return;
    }

    showMask("poly");

    // 只覆盖画布的可见范围，避免多边形超出画布时在背景上出现遮罩
    const { x0: vx0, y0: vy0, x1: vx1, y1: vy1 } = visibleCanvasRect();
    const w = Math.max(0, vx1 - vx0);
    const h = Math.max(0, vy1 - vy0);
    setElBox(clipMaskPoly.el, vx0, vy0, w, h);

    const clipped = clipPolygonToRect(
        points.map((p) => ({
            x: src2screenX(p.x),
            y: src2screenY(p.y),
        })),
        vx0,
        vy0,
        vx1,
        vy1,
    );
    if (clipped.length < 3) {
        clipMaskPoly.el.style.clipPath = "none";
    } else {
        const path = clipped
            .map((p, i) => {
                const px = snapPx(p.x) - vx0;
                const py = snapPx(p.y) - vy0;
                return `${i === 0 ? "M" : "L"}${px} ${py}`;
            })
            .join("");
        // evenodd 让选区多边形成为遮罩的洞
        clipMaskPoly.el.style.clipPath = `path(evenodd, "M0 0H${w}V${h}H0Z${path}Z")`;
    }

    // 大小栏
    whBar(pointsOutRect(points));
}

function drawClip() {
    if (isRect) drawClipRect();
    else drawClipPoly(freeSelect);
}

function cleanClip() {
    showMask(null);
    edgeKey = "";
    for (const el of clipCkx) setElBox(el.el, 0, 0, 0, 0);
    clipEdge.el.replaceChildren();
}

/** 缩放、平移后刷新遮罩和参考线 */
function refreshClipUi() {
    drawClip();
    if (nowMouseE) {
        const e = e2srcPoint(nowMouseE);
        ckx(e);
        inEdge(src2pXYdb(e));
    }
}

/** 只刷新自动框选提示，不动当前选区 */
function refreshEdgeHint() {
    if (!nowMouseE) return;
    inEdge(src2pXYdb(e2srcPoint(nowMouseE)));
}

/**
 * 自动框选提示
 */
function inEdge(p: editor_position) {
    if (rectSelect || drawingMode) {
        setEdge([]);
        return;
    }

    rectInRect = [];
    for (const i of edgeRect) {
        if (!识别窗口 && i.type === "system") continue;
        const x0 = i.x;
        const y0 = i.y;
        const x1 = i.x + i.width;
        const y1 = i.y + i.height;
        if (x0 < p.x && p.x < x1 && y0 < p.y && p.y < y1) {
            rectInRect.push([i.x, i.y, i.width, i.height]);
        }
    }
    setEdge(rectInRect);
}

/** 提示框没变化就不动 DOM */
function setEdge(rects: rect[]) {
    const w = lineW();
    const key = `${w}|${editorP.zoom}|${editorP.x}|${editorP.y}|${rects.map((i) => i.join(",")).join(";")}`;
    if (key === edgeKey) return;
    edgeKey = key;
    clipEdge.el.replaceChildren(
        ...rects.map((i) => {
            const el = document.createElement("div");
            setScreenRect(
                el,
                src2screenX(i[0]),
                src2screenY(i[1]),
                src2screenX(i[0] + i[2]),
                src2screenY(i[1] + i[3]),
            );
            el.style.boxSizing = "border-box";
            el.style.border = `${w}px solid #000`;
            el.style.outline = `${w}px solid #fff`;
            return el;
        }),
    );
}

function renderClip(e: MouseEvent) {
    if (down) {
        moved = true;
        rectSelect = true; // 按下并移动，肯定手动选好选区了
    }

    if (selecting) {
        if (isRect) {
            // 画框
            finalRect = p2Rect(rectStartE, src2cXY(e2srcPoint(e)));
        } else {
            freeSelect.push(src2pXY(e2srcPoint(e)));
            finalRect = pointsOutRect(freeSelect);
        }
    }
    if (moving) {
        if (isRect) {
            moveRect(oFinalRect, oldP, { x: e.offsetX, y: e.offsetY });
        } else {
            movePoly(oPoly, oldP, { x: e.offsetX, y: e.offsetY });
        }
    }

    // 仅选区变化或遮罩形态变化时重绘遮罩
    const mask = isRect ? "rect" : freeSelect.length >= 2 ? "poly" : null;
    if (selecting || moving || maskType !== mask) drawClip();
    inEdge({ x: e.offsetX, y: e.offsetY });
    ckx(e2srcPoint(e));

    if (!selecting && !moving) {
        // 只是悬浮光标时生效，防止在新建或调整选区时光标发生突变
        if (isRect) {
            isInClipRect({ x: e.offsetX, y: e.offsetY });
        } else {
            isPointInPolygon({ x: e.offsetX, y: e.offsetY });
        }
    }
}

// 大小栏
function whBar(finalRect: rect) {
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // 大小文字
    const d = 0;
    const x0 = String(finalRect[0] + d);
    const y0 = String(finalRect[1] + d);
    const x1 = String(finalRect[0] + d + finalRect[2]);
    const y1 = String(finalRect[1] + d + finalRect[3]);
    const w = String(finalRect[2]);
    const h = String(finalRect[3]);
    const ch =
        (四角坐标
            ? x0.length +
              1 + // ","
              y0.length +
              x1.length +
              1 + // ","
              y1.length
            : 0) +
        w.length +
        1 + // "×"
        h.length;
    const width = ch * chPX + (四角坐标 ? 8 * 4 : 8 * 2);
    whX0.el.value = x0;
    whY0.el.value = y0;
    whX1.el.value = x1;
    whY1.el.value = y1;
    whW.el.value = w;
    whH.el.value = h;
    checkWhBarWidth();
    // 位置
    const zx = (finalRect[0] + editorP.x) * editorP.zoom;
    const zy = (finalRect[1] + editorP.y) * editorP.zoom;
    const zw = finalRect[2] * editorP.zoom;
    const dw = width;
    const dh = 40;
    const gap = 8;

    let x: number;
    x = zx + zw / 2 - dw / 2;
    x = Math.max(gap, Math.min(winWidth - dw - gap, Math.round(x)));

    let y = zy - dh - gap;
    y = Math.max(gap, Math.min(winHeight - dh - gap, Math.round(y)));

    whEl.style({
        transform: `translate(${x}px, ${y}px)`,
    });
}

function checkWhBarWidth() {
    for (const el of whL) {
        el.style({ width: `${el.el.value.length}ch` });
    }
}

function changeWH(el: ElType<HTMLInputElement>) {
    const l0 = whL.map((i) => i.el.value);
    const l = l0.map((string) => {
        // 排除（数字运算符空格）之外的非法输入
        if (string.match(/[\d+\-*/.\s()]/g)?.length !== string.length)
            return null;
        // todo sandbox math
        // biome-ignore lint: 已经过滤（？） 计算math
        return eval(string);
    });

    if (l.includes(null)) {
        whBar(finalRect);
        return;
    }

    const d = 0;
    if (el === whX0 || el === whY0) {
        finalRect[0] = Number(l[0]) - d;
        finalRect[1] = Number(l[1]) - d;
    } else if (el === whX1 || el === whY1) {
        finalRect[2] = Number(l[2]) - finalRect[0] - d;
        finalRect[3] = Number(l[3]) - finalRect[1] - d;
    } else {
        finalRect[2] = Number(l[4]);
        finalRect[3] = Number(l[5]);
    }
    finalRectFix();
    hisPush();
    drawClipRect();
    followBar();
}

function mouseBar(finalRect: rect, e: SrcPoint) {
    const { x, y } = src2cXY(e);
    const [x0, y0, width, height] = finalRect;

    const delta = (colorSize - 1) / 2;
    const xOffset = x - delta;
    const yOffset = y - delta;

    const imageData = mainCanvasContext.getImageData(
        xOffset,
        yOffset,
        colorSize,
        colorSize,
    );

    pointColorCanvasCtx.clearRect(0, 0, colorSize, colorSize);
    pointColorCanvasBgCtx.clearRect(0, 0, colorSize, colorSize);

    pointColorCanvasBgCtx.putImageData(imageData, 0, 0);

    let points: point[] = [];

    if (isRect || freeSelect.length < 3) {
        points.push({ x: x0, y: y0 });
        points.push({ x: x0, y: y0 + height });
        points.push({ x: x0 + width, y: y0 + height });
        points.push({ x: x0 + width, y: y0 });
    } else {
        points = freeSelect;
    }

    pointColorCanvasCtx.save();

    pointColorCanvasCtx.beginPath();
    pointColorCanvasCtx.moveTo(points[0].x - xOffset, points[0].y - yOffset);
    for (let i = 1; i < points.length; i++) {
        pointColorCanvasCtx.lineTo(
            points[i].x - xOffset,
            points[i].y - yOffset,
        );
    }
    pointColorCanvasCtx.closePath();
    pointColorCanvasCtx.clip();
    pointColorCanvasCtx.drawImage(pointColorCanvasBg, 0, 0);

    pointColorCanvasCtx.restore();

    const centerIndex = (colorSize * delta + delta) * 4;
    let [r, g, b, a] = imageData.data.slice(centerIndex, centerIndex + 4);

    a /= 255;
    const cssColor = `rgb(${r} ${g} ${b} / ${a})`;
    pointCenter.style.background = cssColor;
    theColor = [r, g, b, a];
    clipColorText([r, g, b, a], 取色器默认格式);

    mouseBarXy.sv([x, y]);
}

function ckx(e: SrcPoint) {
    if (!g光标参考线) return;
    const { x, y } = src2cXY(e);
    const w = lineW();
    const vc = visibleCanvasRect();
    const centerX = src2screenX(x + 0.5);
    const centerY = src2screenY(y + 0.5);
    if (
        vc.x1 <= vc.x0 ||
        vc.y1 <= vc.y0 ||
        centerX < vc.x0 ||
        centerX > vc.x1 ||
        centerY < vc.y0 ||
        centerY > vc.y1
    ) {
        for (const el of clipCkx) setElBox(el.el, 0, 0, 0, 0);
        return;
    }
    setScreenRect(
        clipCkx[0].el,
        vc.x0,
        centerY - w / 2,
        centerX - w / 2,
        centerY + w / 2,
    );
    setScreenRect(
        clipCkx[1].el,
        centerX + w / 2,
        centerY - w / 2,
        vc.x1,
        centerY + w / 2,
    );
    setScreenRect(
        clipCkx[2].el,
        centerX - w / 2,
        vc.y0,
        centerX + w / 2,
        centerY - w / 2,
    );
    setScreenRect(
        clipCkx[3].el,
        centerX - w / 2,
        centerY + w / 2,
        centerX + w / 2,
        vc.y1,
    );
}

function numberFormat(num: number) {
    return (num || 0).toFixed(1).replace(/\.?0+$/, "");
}

function rgba2str(rgba: colorRGBA) {
    return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
}

// 色彩空间转换
function colorConversion(rgba: colorRGBA | null, type: colorFormat): string {
    const color = chroma(rgba2str(rgba || [0, 0, 0, 0]));
    if (color.alpha() !== 1) return "/";
    switch (type) {
        case "HEX":
            return color.hex();
        case "RGB":
            return color.css();
        case "HSL": {
            return color.css("hsl");
        }
        case "HSV": {
            const hsv = color.hsv();
            return `hsv(${numberFormat(hsv[0])} ${numberFormat(hsv[1] * 100)}% ${numberFormat(hsv[2] * 100)}%)`;
        }
        case "CMYK": {
            const cmyk = color.cmyk();
            return `cmyk(${numberFormat(cmyk[0] * 100)}% ${numberFormat(cmyk[1] * 100)}% ${numberFormat(cmyk[2] * 100)}% ${numberFormat(cmyk[3] * 100)}%)`;
        }
        case "HWB": {
            const [h, s, v] = color.hsv();
            return `hwb(${numberFormat(h)} ${numberFormat((1 - s) * v * 100)}% ${numberFormat((1 - v) * 100)}%)`;
        }
        case "LAB":
            return color.css("lab");
        case "LCH":
            return color.css("lch");
        case "OKLAB":
            return color.css("oklab");
        case "OKLCH":
            return color.css("oklch");
        default:
            return "";
    }
}

function getColorFormatEl() {
    return mouseBarCopyColorList[取色器格式位置];
}

// 改变颜色文字和样式
function clipColorText(l: colorRGBA, type: colorFormat) {
    const color = chroma(rgba2str(l));
    const clipColorTextColor = color.alpha() === 1 ? pickTextColor(color) : "";
    theTextColor = [color.hex(), clipColorTextColor];

    mouseBarCopyColor.el.style.backgroundColor = color.hex();
    const mainEl = getColorFormatEl();
    // 只改变默认格式的字体颜色和内容，并定位展示
    mainEl.el.style.color = theTextColor[1];
    const c = colorConversion(l, type);
    const s = c.indexOf("(");
    const main =
        s === -1
            ? c
            : c
                  .slice(s + 1, -1)
                  .replace("deg", "°")
                  .replace("none", "-");
    const minR = 0.6;
    mainEl.style({
        fontSize: `${Math.max(minR, Math.min((colorSize * colorISize) / (main.length * chPX), 1))}rem`,
    });
    mainEl.el.textContent = main;
    const minW = main.length * chPX * minR;
    mouseBarColorMinSize = minW;

    if (color.alpha() !== 1) {
        mainEl.el.style.color = "";
    }
}

// 改变鼠标跟随栏形态，展示所有颜色格式
function changeRightBar(v: boolean) {
    mouseBarCopySize
        .clear()
        .add(`${finalRect[2]} × ${finalRect[3]}`)
        .on("click", (_, el) => {
            copy(el);
        });
    mouseBarCopyColorList = allColorFormat.map((i) =>
        view()
            .add(colorConversion(theColor, i))
            .on("click", (_, el) => {
                copy(el);
            }),
    );
    mouseBarCopyColor
        .clear()
        .style({
            backgroundColor: theTextColor[0],
            color: theTextColor[1],
        })
        .add(mouseBarCopyColorList);
    const maxW = Math.max(
        ...mouseBarCopyColorList.map((i) => i.el.innerText.length * chPX),
    );
    if (v) {
        const width = maxW;
        const height = 32 * (allColorFormat.length + 2);
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        const newX = Math.min(mouseBarX, winWidth - width - 16);
        const newY = Math.min(mouseBarY, winHeight - height - 16);

        mouseBarEl.class(Class.transition).style({
            transform: `translate(${newX}px, ${newY}px)`,
        });

        mouseBarColor.el.style.height = "0";
        mouseBarCopy.style({
            width: `${maxW}px`,
            height: `${32 * (allColorFormat.length + 1)}px`,
        });
        mouseBarCopyI.el.style.top = "0";
        mouseBarEl.el.style.pointerEvents = "auto";
    } else {
        mouseBarEl.style({
            transform: `translate(${mouseBarX}px, ${mouseBarY}px)`,
        });
        setTimeout(() => {
            mouseBarEl.el.classList.remove(Class.transition);
        }, 400);
        mouseBarColor.el.style.height = "";
        mouseBarCopy.style({
            width: `${Math.max(colorSize * colorISize, mouseBarColorMinSize)}px`,
            height: "32px",
        });
        mouseBarCopyI.el.style.top = `${-32 * (取色器格式位置 + 1)}px`;
        mouseBarEl.el.style.pointerEvents = "none";
        if (theColor) clipColorText(theColor, 取色器默认格式);
    }
}

/**
 * 复制内容
 */
function copy(e: ElType<HTMLElement>) {
    writeText(e.el.innerText);
    rightKey = false;
    changeRightBar(false);
}

/**
 * 工具栏自动跟随
 */
function followBar(op?: { x: number; y: number }) {
    const zx = (finalRect[0] + editorP.x) * editorP.zoom;
    const zy = (finalRect[1] + editorP.y) * editorP.zoom;
    const zw = finalRect[2] * editorP.zoom;
    const zh = finalRect[3] * editorP.zoom;
    let x = 0;
    let y = 0;
    if (!op) {
        x = followBarList.at(-1)?.[0] ?? 0;
        y = followBarList.at(-1)?.[1] ?? 0;
    } else {
        x = op.x;
        y = op.y;
    }
    followBarList.push([x, y]);
    const [x1, y1] = [zx, zy];
    const x2 = x1 + zw;
    const y2 = y1 + zh;
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;
    const toolW = toolBar.offsetWidth;
    const drawW = drawBar.offsetWidth;
    const gap = barGap;
    const groupW = toolW + gap + drawW;

    if ((x1 + x2) / 2 <= x) {
        // 向右
        if (x2 + groupW + gap <= maxWidth) {
            toolBar.style.left = `${x2 + gap}px`; // 贴右边
            drawBarPosi = "right";
        } else {
            if (工具栏跟随 === "展示内容优先") {
                // 超出屏幕贴左边
                if (x1 - groupW - gap >= 0) {
                    toolBar.style.left = `${x1 - toolW - gap}px`;
                    drawBarPosi = "left";
                } else {
                    // 还超贴右内
                    toolBar.style.left = `${maxWidth - groupW}px`;
                    drawBarPosi = "right";
                }
            } else {
                // 直接贴右边,即使遮挡
                toolBar.style.left = `${x2 - groupW - gap}px`;
                drawBarPosi = "right";
            }
        }
    } else {
        // 向左
        if (x1 - groupW - gap >= 0) {
            toolBar.style.left = `${x1 - toolW - gap}px`; // 贴左边
            drawBarPosi = "left";
        } else {
            if (工具栏跟随 === "展示内容优先") {
                // 超出屏幕贴右边
                if (x2 + groupW <= maxWidth) {
                    toolBar.style.left = `${x2 + gap}px`;
                    drawBarPosi = "right";
                } else {
                    // 还超贴左内
                    toolBar.style.left = `${0 + drawW + gap}px`;
                    drawBarPosi = "left";
                }
            } else {
                toolBar.style.left = `${x1 + gap}px`;
                drawBarPosi = "left";
            }
        }
    }

    if (y >= (y1 + y2) / 2) {
        if (y2 - toolBar.offsetHeight >= 0) {
            toolBar.style.top = `${y2 - toolBar.offsetHeight}px`;
        } else {
            if (y1 + toolBar.offsetHeight > maxHeight) {
                toolBar.style.top = `${maxHeight - toolBar.offsetHeight}px`;
            } else {
                toolBar.style.top = `${y1}px`;
            }
        }
    } else {
        if (y1 + toolBar.offsetHeight <= maxHeight) {
            toolBar.style.top = `${y1}px`;
        } else {
            toolBar.style.top = `${maxHeight - toolBar.offsetHeight}px`;
        }
    }
    drawBar.style.opacity = toolBar.style.opacity = "1";
    trackLocation();
}

// 修复final_rect负数
// 超出屏幕处理
function finalRectFix() {
    finalRect = finalRect.map((i) => Math.round(i)) as rect;
    const x0 = finalRect[0];
    const y0 = finalRect[1];
    const x1 = finalRect[0] + finalRect[2];
    const y1 = finalRect[1] + finalRect[3];
    let x = Math.min(x0, x1);
    let y = Math.min(y0, y1);
    let w = Math.max(x0, x1) - x;
    let h = Math.max(y0, y1) - y;
    // 移出去移回来保持原来大小
    if (x < 0) w = x = 0;
    if (y < 0) h = y = 0;
    if (x > mainCanvas.width) x = x % mainCanvas.width;
    if (y > mainCanvas.height) y = y % mainCanvas.height;
    if (x + w > mainCanvas.width) w = mainCanvas.width - x;
    if (y + h > mainCanvas.height) h = mainCanvas.height - y;
    finalRect = [x, y, w, h];
}

function inRange(
    min: number,
    value: number,
    max: number,
    type: `${"[" | "("}${")" | "]"}` = "[]",
) {
    if (type === "[]") return min <= value && value <= max;
    if (type === "(]") return min < value && value <= max;
    if (type === "[)") return min <= value && value < max;
    return min < value && value < max;
}

/**
 * 判断光标位置并更改样式,定义光标位置的移动方向
 */
function isInClipRect(p: editor_position) {
    let inRect = false;

    const [x0, y0, width, height] = finalRect;
    const x1 = x0 + width;
    const y1 = y0 + height;
    // 如果全屏,那允许框选
    if (
        !(
            finalRect[2] === mainCanvas.width &&
            finalRect[3] === mainCanvas.height
        )
    ) {
        if (x0 <= p.x && p.x <= x1 && y0 <= p.y && p.y <= y1) {
            // 在框选区域内,不可框选,只可调整
            inRect = true;
        } else {
            inRect = false;
        }

        direction = "";

        const num = (8 / editorP.zoom) * window.devicePixelRatio;

        // 光标样式
        if (inRange(x0, p.x, x0 + num) && inRange(y0, p.y, y0 + num)) {
            setClipCursor("nwse-resize");
            direction = "西北";
        } else if (inRange(x1 - num, p.x, x1) && inRange(y1 - num, p.y, y1)) {
            setClipCursor("nwse-resize");
            direction = "东南";
        } else if (inRange(y0, p.y, y0 + num) && inRange(x1 - num, p.x, x1)) {
            setClipCursor("nesw-resize");
            direction = "东北";
        } else if (inRange(y1 - num, p.y, y1) && inRange(x0, p.x, x0 + num)) {
            setClipCursor("nesw-resize");
            direction = "西南";
        } else if (inRange(x0, p.x, x0 + num) && inRange(y0, p.y, y1)) {
            setClipCursor("ew-resize");
            direction = "西";
        } else if (inRange(x1 - num, p.x, x1) && inRange(y0, p.y, y1)) {
            setClipCursor("ew-resize");
            direction = "东";
        } else if (inRange(y0, p.y, y0 + num) && inRange(x0, p.x, x1)) {
            setClipCursor("ns-resize");
            direction = "北";
        } else if (inRange(y1 - num, p.y, y1) && inRange(x0, p.x, x1)) {
            setClipCursor("ns-resize");
            direction = "南";
        } else if (
            inRange(x0 + num, p.x, x1 - num, "()") &&
            inRange(y0 + num, p.y, y1 - num, "()")
        ) {
            setClipCursor("move");
            direction = "move";
        } else {
            setClipCursor("crosshair");
            direction = "";
        }
    } else {
        // 全屏可框选
        setClipCursor("crosshair");
        direction = "";
        inRect = false;
    }
    return inRect;
}

/** 调整框选 */
function moveRect(
    oldFinalRect: rect | null,
    oldPosition: editor_position,
    position: editor_position,
) {
    if (!oldFinalRect) return;
    const op = oldPosition;
    const p = position;
    const dx = p.x - op.x;
    const dy = p.y - op.y;
    switch (direction) {
        case "西北":
            finalRect = [
                oldFinalRect[0] + dx,
                oldFinalRect[1] + dy,
                oldFinalRect[2] - dx,
                oldFinalRect[3] - dy,
            ];
            break;
        case "东南":
            finalRect = [
                oldFinalRect[0],
                oldFinalRect[1],
                oldFinalRect[2] + dx,
                oldFinalRect[3] + dy,
            ];
            break;
        case "东北":
            finalRect = [
                oldFinalRect[0],
                oldFinalRect[1] + dy,
                oldFinalRect[2] + dx,
                oldFinalRect[3] - dy,
            ];
            break;
        case "西南":
            finalRect = [
                oldFinalRect[0] + dx,
                oldFinalRect[1],
                oldFinalRect[2] - dx,
                oldFinalRect[3] + dy,
            ];
            break;
        case "西":
            finalRect = [
                oldFinalRect[0] + dx,
                oldFinalRect[1],
                oldFinalRect[2] - dx,
                oldFinalRect[3],
            ];
            break;
        case "东":
            finalRect = [
                oldFinalRect[0],
                oldFinalRect[1],
                oldFinalRect[2] + dx,
                oldFinalRect[3],
            ];
            break;
        case "北":
            finalRect = [
                oldFinalRect[0],
                oldFinalRect[1] + dy,
                oldFinalRect[2],
                oldFinalRect[3] - dy,
            ];
            break;
        case "南":
            finalRect = [
                oldFinalRect[0],
                oldFinalRect[1],
                oldFinalRect[2],
                oldFinalRect[3] + dy,
            ];
            break;
        case "move":
            finalRect = [
                oldFinalRect[0] + dx,
                oldFinalRect[1] + dy,
                oldFinalRect[2],
                oldFinalRect[3],
            ];
            break;
    }
    if (finalRect[0] < 0) {
        finalRect[2] = finalRect[2] + finalRect[0];
        finalRect[0] = 0;
    }
    if (finalRect[1] < 0) {
        finalRect[3] = finalRect[3] + finalRect[1];
        finalRect[1] = 0;
    }
    if (finalRect[0] + finalRect[2] > mainCanvas.width)
        finalRect[2] = mainCanvas.width - finalRect[0];
    if (finalRect[1] + finalRect[3] > mainCanvas.height)
        finalRect[3] = mainCanvas.height - finalRect[1];

    finalRectFix();
}
function isPointInPolygon(p: point): boolean {
    // 射线法判断点是否在选区多边形内
    let inside = false;
    for (let i = 0, j = freeSelect.length - 1; i < freeSelect.length; j = i++) {
        const { x: xi, y: yi } = freeSelect[i];
        const { x: xj, y: yj } = freeSelect[j];
        if (
            yi > p.y !== yj > p.y &&
            p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
        )
            inside = !inside;
    }

    if (inside) {
        setClipCursor("move");
        direction = "move";
    } else {
        setClipCursor("crosshair");
        direction = "";
    }
    return inside;
}

/** 调整框选 */
function movePoly(
    oldPoly: point[] | null,
    oldPosition: editor_position,
    position: editor_position,
) {
    if (!oldPoly) return;
    const op = oldPosition;
    const p = position;
    const dx = p.x - op.x;
    const dy = p.y - op.y;
    if (direction === "move") {
        freeSelect = oldPoly.map((i) => {
            const x = Math.round(i.x + dx);
            const y = Math.round(i.y + dy);
            return { x, y };
        });
    }
}

/**
 * 保存历史
 */
function hisPush() {
    const canvas = fabricCanvas?.toJSON() || {};
    undoStack.setData({ rect: finalRect, canvas: canvas });
    undoStack.apply();
}
/**
 * 更改历史指针
 * @param {boolean} v true向前 false向后
 */
function undo(v: boolean) {
    if (propertyHistoryTimer) {
        clearTimeout(propertyHistoryTimer);
        propertyHistoryTimer = undefined;
    }
    if (v) {
        undoStack.undo();
    } else {
        undoStack.unundo();
    }
    const c = undoStack.getData();
    finalRect = c.rect;
    drawClipRect();
    followBar();
    if (fabricCanvas)
        fabricCanvas.loadFromJSON(c.canvas).then(() => {
            fabricCanvas.renderAll();
        });
}

type ShapeDash = "solid" | "dash" | "dot";

const dashOptions = [
    { name: "实线", value: "solid" },
    { name: "虚线", value: "dash" },
    { name: "点线", value: "dot" },
];

const shapeStyleDefaults = {
    dash: "solid" as ShapeDash,
    rx: 0,
    feather: 0,
    fontSize: 40,
    fontFamily: "",
    fontWeight: "normal" as "normal" | "bold",
    fontStyle: "normal" as "normal" | "italic",
    underline: false,
    textAlign: "left" as "left" | "center" | "right",
    lineHeight: 1.16,
    charSpacing: 0,
    radius: 12,
};
type ShapeStyleKey = keyof typeof shapeStyleDefaults;
let shapeMainFont: string | undefined;

const arrowStyleDefaults = {
    arrowW: 10,
    arrowH: 16,
    arrowType: "stroke" as "fill" | "stroke",
};
type ArrowStyleKey = keyof typeof arrowStyleDefaults;

function getArrowPro() {
    if (!shapePro.arrow) shapePro.arrow = {};
    const pro = shapePro.arrow;
    const out = { ...arrowStyleDefaults };
    for (const k of Object.keys(arrowStyleDefaults) as ArrowStyleKey[]) {
        const value =
            pro[k] ?? store.get(`图像编辑.形状属性.arrow.${k}`) ?? out[k];
        (pro as Record<string, unknown>)[k] = value;
        out[k] = value as never;
    }
    return out;
}

function shapeStyleKeys(name: keyof typeof shapePro): ShapeStyleKey[] {
    if (name === "mask") return ["rx", "feather"];
    if (name === "rect") return ["dash", "rx"];
    if (name === "text")
        return [
            "fontFamily",
            "fontSize",
            "fontWeight",
            "fontStyle",
            "underline",
            "textAlign",
            "lineHeight",
            "charSpacing",
        ];
    if (name === "number") return ["dash", "fontSize", "radius"];
    if (name === "free" || name === "eraser" || name === "spray") return [];
    return ["dash"];
}

function getShapeStyle(name: keyof typeof shapePro) {
    const out = { ...shapeStyleDefaults };
    if (shapeMainFont === undefined) shapeMainFont = store.get("字体").主要字体;
    out.fontFamily = shapeMainFont;
    if (name === "number") out.fontSize = 16;
    const pro = shapePro[name] ?? {};
    for (const k of shapeStyleKeys(name)) {
        if (pro[k] !== undefined) {
            (out as Record<string, unknown>)[k] = pro[k];
            continue;
        }
        const stored = store.get(`图像编辑.形状属性.${name}.${k}` as never);
        const value = stored ?? out[k];
        (pro as Record<string, unknown>)[k] = value;
        (out as Record<string, unknown>)[k] = value;
    }
    return out;
}

function dashArray(dash: string | undefined) {
    return dash === "dot" ? [2, 4] : dash === "dash" ? [8, 6] : null;
}

function getShapePro(name: keyof typeof shapePro) {
    if (!shapePro[name]) shapePro[name] = {};
    const v = {
        fc: name === "text" ? strokeColor : fillColor,
        sc: strokeColor,
        sw: strokeWidth,
        shadow: 0,
        ...getShapeStyle(name),
    };
    if (name === "free" || name === "eraser" || name === "spray") {
        v.sc = freeColor;
        v.sw = freeWidth;
    }

    for (const x of ["fc", "sc", "sw", "shadow"] as const) {
        if (shapePro[name][x]) {
            v[x] = shapePro[name][x] as never;
        } else {
            shapePro[name][x] = v[x] =
                store.get(`图像编辑.形状属性.${name}.${x}`) ?? v[x];
        }
    }
    return v;
}

function setEditType<T extends keyof EditType>(
    mainType: T,
    type: EditType[T],
): void {
    if (mainType !== "select") {
        fabricCanvas.discardActiveObject();
    }
    if (!(mainType === "select" && type === "draw")) {
        nowType = mainType;
        if (mainType === "select") {
            selectEditType = type as EditType["select"];
            store.set("图像编辑.记忆.select", selectEditType);
        }
    }

    const SELECT = "select";
    const activeSide = drawSideEls[mainType][type];
    let hiddenActive = true;
    for (const tool of drawMainTools) {
        if (tool.category === "more") continue;
        const active =
            tool.category === mainType &&
            (tool.type === undefined || tool.type === type);
        if (active) hiddenActive = false;
        tool.el.el.classList.toggle(SELECT, active);
        tool.el.el.innerHTML = active ? activeSide.el.innerHTML : tool.html;
    }
    const moreTool = drawMainTools.find((tool) => tool.category === "more");
    if (moreTool) {
        moreTool.el.el.classList.toggle(SELECT, hiddenActive);
        const hiddenHTML = activeSide.el.querySelector("img")
            ? activeSide.el.innerHTML
            : moreTool.html;
        moreTool.el.el.innerHTML = hiddenActive ? hiddenHTML : moreTool.html;
    }

    for (const [i, items] of Object.entries(drawSideEls)) {
        for (const [j, sel] of Object.entries(
            items as Record<string, ElType<HTMLElement>>,
        )) {
            sel.el.classList.toggle(SELECT, i === mainType && j === type);
        }
    }

    if (mainType === "select") {
        if (type !== "draw") {
            exitFree();
            exitShape();
            exitFilter();
            drawM(false);
            if (type === "free") {
                isRect = false;
            } else {
                isRect = true;
            }
        } else {
            drawM(true);
            exitFree();
            exitShape();
            exitFilter();
        }
        backHotkeyScope();
    } else {
        drawM(true);
        toHotkeyScope("drawing");
    }
    if (mainType === "draw") {
        fabricCanvas.isDrawingMode = true;
        mode = type as EditType["draw"];
        if (type === "free") {
            pencilElClick();
        }
        if (type === "eraser") {
            eraserElClick();
        }
        if (type === "spray") {
            freeSprayElClick();
        }
        exitShape();
        exitFilter();
        freeDrawCursor();
    }
    if (mainType === "filter") {
        willFilter = type as EditType["filter"];
        exitFree();
        exitShape();
        newFilterSelecting = true;
        fabricCanvas.defaultCursor = "crosshair";
    }
    if (mainType === "shape") {
        if (shape !== type) {
            polyOP = [];
            drawingShape = false;
            drawNumberN = 1;
            removePreviewShape();
        }
        shape = type as Shape;

        exitFree();
        exitFilter();
        fabricCanvas.defaultCursor = "crosshair";
    }

    refreshPropertyPanel();
}

let currentSideIndex: number | null = null;

function showSideBarIndex(index: number) {
    showSideBar(true);
    currentSideIndex = index;
    for (const [
        i,
        { w, el, anchorCategory },
    ] of drawBarSideElChildren.entries()) {
        if (index === i) {
            const height = Math.ceil(el.el.children.length / w);
            const x = w;
            const y = height;
            const anchor = drawMainTools.findIndex(
                (tool) => tool.category === anchorCategory,
            );
            const barTop = drawBar.getBoundingClientRect().top;
            const top = Math.max(
                -barTop + 4,
                Math.min(
                    bSize * Math.min(anchor, drawMainBar.children.length - y),
                    window.innerHeight - barTop - bSize * y - 4,
                ),
            );
            el.style({ display: "", width: `${x * bSize}px` });
            let left = bSize * 1;
            if (drawBar.offsetLeft + bSize + bSize * x > window.innerWidth)
                left = -bSize * x;
            drawSideBar.style.left = `${left}px`;
            drawSideBar.style.top = `${top}px`;
            drawSideBar.style.width = `${bSize * x}px`;
            drawSideBar.style.height = `${bSize * y}px`;
        } else {
            el.style({ display: "none" });
        }
    }
    scheduleElementBarPosition();
}

function showSideBarByCategory(category: "select" | "more") {
    const index = drawBarSideElChildren.findIndex(
        (item) => item.anchorCategory === category,
    );
    if (index === -1) return;
    showSideBarIndex(index);
}

function toggleMoreSideBar() {
    const index = drawBarSideElChildren.findIndex(
        (item) => item.anchorCategory === "more",
    );
    if (index === -1) return;
    if (
        currentSideIndex === index &&
        !drawBarSideEl.el.classList.contains("draw_side_hide")
    ) {
        showSideBar(false);
    } else {
        showSideBarIndex(index);
    }
}

function isInDrawBar() {
    return drawBar.contains(
        document.elementFromPoint(nowMouseE.clientX, nowMouseE.clientY),
    );
}

function showSideBar(show: boolean) {
    if (show) {
        drawSideBar.classList.remove("draw_side_hide");
    } else {
        drawSideBar.classList.add("draw_side_hide");
        currentSideIndex = null;
    }
    scheduleElementBarPosition();
}

function showBars(b: boolean) {
    const l = [toolBar, drawBar];
    for (const i of l) {
        if (b) {
            i.style.pointerEvents = "";
            i.style.opacity = "";
        } else {
            i.style.pointerEvents = "none";
            i.style.opacity = "0";
        }
    }
    if (b) refreshPropertyPanel();
    else hideElementBar();
}
function pencilElClick() {
    fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.color = getShapePro("free").sc;
    fabricCanvas.freeDrawingBrush.width = getShapePro("free").sw;

    freeShadow();
}
function eraserElClick() {
    // todo
    const eraser = new EraserBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush = eraser;
    fabricCanvas.freeDrawingBrush.width = getShapePro("eraser").sw;
}
function freeSprayElClick() {
    fabricCanvas.freeDrawingBrush = new SprayBrush(fabricCanvas);
    fabricCanvas.freeDrawingBrush.color = getShapePro("spray").sc;
    fabricCanvas.freeDrawingBrush.width = getShapePro("spray").sw;
}
function freeShadow() {
    if (fabricCanvas.freeDrawingBrush)
        fabricCanvas.freeDrawingBrush.shadow = new Shadow({
            blur: getShapePro("free").shadow,
            color: getShapePro("free").sc,
        });
}

function freeDrawCursor() {
    if (mode === "free" || mode === "eraser") {
        let svgW = freeWidth;
        let hW = svgW / 2;
        const r = freeWidth / 2;
        if (svgW < 10) {
            svgW = 10;
            hW = 5;
        }
        let svg = "";
        if (mode === "free") {
            svg = `<svg width="${svgW}" height="${svgW}" xmlns="http://www.w3.org/2000/svg"><line x1="0" x2="${svgW}" y1="${hW}" y2="${hW}" stroke="#000"/><line y1="0" y2="${svgW}" x1="${hW}" x2="${hW}" stroke="#000"/><circle style="fill:${freeColor};" cx="${hW}" cy="${hW}" r="${r}"/></svg>`;
        } else {
            svg = `<svg width="${svgW}" height="${svgW}" xmlns="http://www.w3.org/2000/svg"><line x1="0" x2="${svgW}" y1="${hW}" y2="${hW}" stroke="#000"/><line y1="0" y2="${svgW}" x1="${hW}" x2="${hW}" stroke="#000"/><circle style="stroke-width:1;stroke:#000;fill:none" cx="${hW}" cy="${hW}" r="${r}"/></svg>`;
        }
        const d = document.createElement("div");
        d.innerHTML = svg;
        const s = new XMLSerializer().serializeToString(
            d.querySelector("svg") as SVGElement,
        );
        const cursorUrl = `data:image/svg+xml;base64,${window.btoa(s)}`;
        fabricCanvas.freeDrawingCursor = `url(" ${cursorUrl} ") ${hW} ${hW}, auto`;
    } else {
        fabricCanvas.freeDrawingCursor = "auto";
    }
}

function fabricDelete() {
    for (const o of fabricCanvas.getActiveObjects()) {
        fabricCanvas.remove(o);
    }
    getFilters();
    hisPush();
}

function rotate(x: number, y: number, r: number) {
    const s = Math.sin(r);
    const c = Math.cos(r);
    return [x * c - y * s, x * s + y * c];
}

// 画一般图形
function draw(
    shape: EditType["shape"],
    v: "start" | "move",
    x1: number,
    y1: number,
    x2: number,
    y2: number,
) {
    const pro = getShapePro(shape);
    const [fillColor, strokeColor, strokeWidth] = [pro.fc, pro.sc, pro.sw];
    const dash = dashArray(pro.dash);
    if (v === "move") {
        removePreviewShape();
    }
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x1 - x2);
    const h = Math.abs(y1 - y2);
    let shapeX: FabricObject | null = null;
    if (shape === "line") {
        shapeX = new line(
            [
                { x: x1, y: y1 },
                { x: x2, y: y2 },
            ],
            {
                fill: null,
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                strokeDashArray: dash,
                originX: "left",
                originY: "top",
                形状: "line",
            },
        );
    } else if (shape === "circle") {
        shapeX = new Circle({
            radius: Math.max(w, h) / 2,
            left: x,
            top: y,
            originX: "left",
            originY: "top",
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: dash,
            canChangeFill: true,
            形状: "circle",
        });
    } else if (shape === "rect") {
        shapeX = new Rect({
            left: x,
            top: y,
            width: w,
            height: h,
            rx: pro.rx,
            ry: pro.rx,
            originX: "left",
            originY: "top",
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: dash,
            canChangeFill: true,
            形状: "rect",
        });
    } else if (shape === "text") {
        shapeX = new IText(t("点击输入文字"), {
            left: x,
            top: y,
            originX: "left",
            originY: "top",
            fill: fillColor,
            canChangeFill: true,
            形状: "text",
            fontFamily: pro.fontFamily,
            fontSize: pro.fontSize,
            fontWeight: pro.fontWeight,
            fontStyle: pro.fontStyle,
            underline: pro.underline,
            textAlign: pro.textAlign,
            lineHeight: pro.lineHeight,
            charSpacing: pro.charSpacing,
        });
    } else if (shape === "arrow") {
        const arrowPro = getArrowPro();
        shapeX = new arrow(
            [
                { x: x1, y: y1 },
                { x: x2, y: y2 },
            ],
            {
                fill: null,
                stroke: strokeColor,
                strokeWidth: strokeWidth,
                strokeDashArray: dash,
                arrowW: arrowPro.arrowW,
                arrowH: arrowPro.arrowH,
                arrowType: arrowPro.arrowType,
                objectCaching: false,
                形状: "arrow",
            },
        );
    } else if (shape === "mask") {
        const m = new mask({
            left: x,
            top: y,
            originX: "left",
            originY: "top",
            width: w,
            height: h,
            rx: pro.rx,
            ry: pro.rx,
            fill: fillColor,
            canChangeFill: true,
            形状: "mask",
        });
        m.feather = pro.feather;
        shapeX = m;
    }
    if (shapeX) {
        previewShape = shapeX;
        fabricCanvas.add(shapeX);
    }
}
// 多边形
function drawPoly(shape: EditType["shape"]) {
    const pro = getShapePro(shape);
    const [fillColor, strokeColor, strokeWidth] = [pro.fc, pro.sc, pro.sw];
    const dash = dashArray(pro.dash);
    if (polyOP.length !== 1) {
        removePreviewShape();
    }
    let shapeX: FabricObject | null = null;
    if (shape === "polyline") {
        shapeX = new polyline(polyOP, {
            fill: "#0000",
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: dash,
            originX: "left",
            originY: "top",
            形状: "polyline",
        });
    }
    if (shape === "polygon") {
        shapeX = new polygon(polyOP, {
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            strokeDashArray: dash,
            originX: "left",
            originY: "top",
            canChangeFill: true,
            形状: "polygon",
        });
    }
    if (shapeX) {
        previewShape = shapeX;
        fabricCanvas.add(shapeX);
    }
}

function drawNumber(p: point) {
    const pro = getShapePro("number");
    const txt = new xnumber({
        left: p.x,
        top: p.y,
        fontSize: pro.fontSize,
        radius: pro.radius,
        originX: "center",
        originY: "center",
        fill: pro.fc,
        stroke: pro.sc,
        strokeWidth: pro.sw,
        strokeDashArray: dashArray(pro.dash),
        canChangeFill: true,
        text: String(drawNumberN),
        objectCaching: false,
        形状: "number",
    });
    fabricCanvas.add(txt);
    fabricCanvas.setActiveObject(txt);

    drawNumberN++;
    hisPush();
}

function pickTextColor(bg: chroma.Color, c1 = "#fff", c2 = "#000") {
    // todo 主题色
    if (chroma.contrast(bg, c1) > chroma.contrast(bg, c2)) {
        return c1;
    }
    return c2;
}

/** 画笔类工具的颜色和粗细 */
function setFreePro(key: "sc" | "sw", value: string | number) {
    const brush = fabricCanvas.freeDrawingBrush;
    if (key === "sc" && brush && typeof value === "string") {
        brush.color = value;
        freeDrawCursor();
    }
    if (key === "sw" && brush && typeof value === "number") {
        brush.width = value;
        freeDrawCursor();
    }
    freeShadow();
    setShapeDefault(mode ?? "free", key, value);
}

/** 用滚轮或方向键调整当前工具的线宽 */
function adjustStrokeWidth(delta: number) {
    const kind = nowType === "draw" ? mode : nowType === "shape" ? shape : "";
    if (!kind) return;
    const sw = Math.max(
        1,
        Math.floor((getShapePro(kind).sw ?? strokeWidth) + delta),
    );
    if (fabricCanvas.isDrawingMode && fabricCanvas.freeDrawingBrush) {
        fabricCanvas.freeDrawingBrush.width = sw;
        freeDrawCursor();
    }
    setShapeDefault(kind, "sw", sw);
    refreshPropertyPanel();
}

function newFilterSelect(o: point, no: point) {
    const x1 = Math.round(o.x);
    const y1 = Math.round(o.y);
    const x2 = Math.round(no.x);
    const y2 = Math.round(no.y);
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x1 - x2);
    const h = Math.abs(y1 - y2);

    const mainCtx = mainCanvas.getContext("2d")!;
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = w;
    tmpCanvas.height = h;
    const gid = mainCtx.getImageData(x, y, w, h); // 裁剪
    tmpCanvas.getContext("2d")!.putImageData(gid, 0, 0);
    const img = new FabricImage(tmpCanvas, {
        left: x,
        top: y,
        originX: "left",
        originY: "top",
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hasControls: false,
        hoverCursor: "auto",
    });
    fabricCanvas.add(img);
    fabricCanvas.setActiveObject(img);
}

// biome-ignore lint/suspicious/noExplicitAny: 适配库
function applyFilter(i: number, filter: filters.BaseFilter<string, any>) {
    const obj = fabricCanvas.getActiveObject() as FabricImage;
    obj.filters[i] = filter;
    obj.applyFilters();
    fabricCanvas.renderAll();
}
function getFilters() {
    const obj = fabricCanvas.getActiveObject() as FabricImage;
    if (!obj?.filters) return;
    const f = obj.filters;

    const values = Object.values(filtetMap);
    for (const fl of values) {
        const i = values.indexOf(fl);
        if (fl.value) {
            if (f[i]) {
                const name = typedKeys(filtetMap)[i];
                const range = (
                    fl.el?.() ??
                    rangeBar(
                        fl.value.min,
                        fl.value.max,
                        fl.value.step,
                        fl.value.text,
                    )
                )
                    .on("input", () => {
                        // @ts-ignore
                        const filter = fl.fun(range.gv);
                        applyFilter(i, filter);
                    })
                    .sv(Object.values(f[i])[0]);
                filterRangeEl.clear().add(range);
                for (const i of Object.values(drawSideEls.filter)) {
                    i.el.classList.remove("filter_select");
                }
                drawSideEls.filter[name].el.classList.add("filter_select");
            }
        }
    }
}

// 确保退出其他需要鼠标事件的东西，以免多个东西一起出现
function exitFree() {
    fabricCanvas.isDrawingMode = false;
    fabricCanvas.defaultCursor = "auto";
}
function exitShape() {
    shape = "";
    drawingShape = false;
    fabricCanvas.selection = true;
    fabricCanvas.defaultCursor = "auto";
    polyOP = [];
    drawNumberN = 1;
    removePreviewShape();
}
function exitFilter() {
    newFilterSelecting = false;
    fabricCanvas.defaultCursor = "auto";
    willFilter = "";
}

async function fabricCopy() {
    const dx = store.get("图像编辑.复制偏移.x");
    const dy = store.get("图像编辑.复制偏移.y");
    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) return;
    const fabricClipboard = await activeObject.clone();
    const clonedObj = await fabricClipboard.clone();
    fabricCanvas.discardActiveObject();
    clonedObj.set({
        left: clonedObj.left + dx,
        top: clonedObj.top + dy,
        evented: true,
    });
    if (clonedObj instanceof ActiveSelection) {
        clonedObj.canvas = fabricCanvas;
        clonedObj.forEachObject((obj) => {
            fabricCanvas.add(obj);
        });
        clonedObj.setCoords();
    } else {
        fabricCanvas.add(clonedObj);
    }
    fabricCanvas.setActiveObject(clonedObj);
    fabricCanvas.requestRenderAll();
    hisPush();
}

// 获取设置

const screenShotCache = new Map<number, ImageData>();

const 字体 = store.get("字体");

const allColorFormat: colorFormat[] = [
    "HEX",
    "RGB",
    "HSL",
    "HSV",
    "HWB",
    "LAB",
    "LCH",
    "OKLAB",
    "OKLCH",
    "CMYK",
];

const 工具栏跟随 = store.get("工具栏跟随");
const 四角坐标 = store.get("显示四角坐标");
const 遮罩颜色 = store.get("框选.颜色.遮罩") || "#0008";
const 取色器默认格式 = store.get("取色器.默认格式");
const 取色器格式位置 = allColorFormat.indexOf(取色器默认格式);
const 取色器显示 = store.get("取色器.显示");
const colorSize = store.get("取色器.大小");
const colorISize = store.get("取色器.像素大小");
const 记忆框选 = store.get("框选.记忆.开启");
const 记忆框选值 = store.get("框选.记忆.rects") as {
    [id: string]: rect;
};
const 识别窗口 = store.get("框选.识别窗口");
const bSize = store.get("工具栏.按钮大小");

const g光标参考线 = store.get("框选.参考线.光标");
const x选区参考线 = store.get("框选.参考线.选区");
const c参考线颜色 = store.get("框选.颜色");

const 全局缩放 = store.get("全局.缩放") || 1.0;
let ratio = 1;

setSetting();

const tools: 功能列表 = [
    "close",
    "screens",
    "ocr",
    "search",
    "QR",
    "open",
    "ding",
    "dingLive",
    "record",
    "long",
    "translate",
    "editor",
    "copy",
    "save",
];

const hotkeyTipEl = view().attr({ id: "hotkeys_tip" }).class(Class.glassBar);

const toolsX: Record<功能, { el: ElType<HTMLElement>; f: () => void }> = {
    close: {
        el: iconEl("close").attr({ title: "关闭" }),
        f: () => closeWin(),
    },
    screens: { el: view().attr({ title: "屏幕管理" }), f: () => {} },
    ocr: {
        el: selectEl(
            iconEl("ocr"),
            t("文字识别"),
            ocrList(store).map((v) => ({
                name: typeof v.name === "string" ? t(v.name) : v.name.text,
                value: v.value,
            })),
        ),
        f: () => runOcr(),
    },
    search: {
        el: selectEl(iconEl("search"), t("以图搜图"), [
            { value: "baidu", name: t("百度") },
            { value: "yandex", name: "Yandex" },
            { value: "google", name: "Google" },
            { value: "ai", name: "AI" },
        ]),
        f: () => runSearch(),
    },
    QR: { el: iconEl("scan").attr({ title: "二维码" }), f: () => runQr() },
    open: {
        el: iconEl("open").attr({ title: "其他应用打开" }),
        f: () => openApp(),
    },
    ding: {
        el: iconEl("ding").attr({ title: "屏幕贴图" }),
        f: () => runDing(),
    },
    dingLive: {
        el: iconEl("live_ding").attr({ title: "动态贴图" }),
        f: () => runLiveDing(),
    },
    record: {
        el: selectEl<"normal" | "super">(iconEl("record"), t("录屏"), [
            { name: t("普通录屏"), value: "normal" },
            { name: t("超级录屏"), value: "super" },
        ]),
        f: () => initRecord(),
    },
    long: {
        el: selectEl<"y" | "xy">(iconEl("long_clip"), t("广截屏"), [
            { name: t("长截屏 y"), value: "y" },
            { name: t("广截屏 xy"), value: "xy" },
        ]),
        f: () => startLong(),
    },
    translate: {
        el: selectEl<translateWinType["type"]>(
            iconEl("translate"),
            t("屏幕翻译"),
            [
                { name: t("贴图"), value: "ding" },
                { name: t("自动翻译"), value: "live" },
            ],
        ),
        f: () => translate(),
    },
    editor: {
        el: iconEl("super_edit").attr({ title: "高级图片编辑" }),
        f: () => {
            const c = getClipPhoto();
            renderSend("clip_editor", [c.toDataURL()]);
            toolsX.close.f();
        },
    },
    copy: { el: iconEl("copy").attr({ title: "复制" }), f: () => runCopy() },
    save: { el: iconEl("save").attr({ title: "保存" }), f: () => runSave() },
};

for (const [_, { el, f }] of Object.entries(toolsX)) {
    el.on("pointerup", (e) => {
        if (e.target === el.el)
            if (e.button === 0) {
                f();
            } else if (e.button === 1) {
                el.el.style.backgroundColor = ""; // todo class
                autoDo = "no";
            }
    });
}

const toolBarEl = view().attr({ id: "tool_bar" }).class(Class.glassBar);
for (const [id, { el }] of Object.entries(toolsX)) {
    toolBarEl.add(el.attr({ id: `tool_${id}` }));
}

toolsX.long.el.sv(store.get("广截屏.方向"));
toolsX.long.el.on("change", () => {
    store.set("广截屏.方向", toolsX.long.el.gv);
    longFX = toolsX.long.el.gv;
    toolsX.long.f();
});

toolsX.record.el.sv(store.get("录屏.模式"));
toolsX.record.el.on("change", () => {
    store.set("录屏.模式", toolsX.record.el.gv);
    toolsX.record.f();
});

toolsX.translate.el.sv(store.get("屏幕翻译.type"));
toolsX.translate.el.on("change", () => {
    store.set("屏幕翻译.type", toolsX.translate.el.gv);
    toolsX.translate.f();
});

toolBarEl.style({
    left: store.get("工具栏.初始位置.left"),
    top: store.get("工具栏.初始位置.top"),
});

const toolsOrder = store.get("工具栏.功能");
for (const g of tools) {
    const id = g;
    const i = toolsOrder.indexOf(id);
    const el = toolsX[id].el;
    if (i !== -1) el.style({ order: String(i) });
    else el.style({ display: "none" });
}

const drawBarEl = view().attr({ id: "draw_bar" }).addInto();
const drawBarMainEl = view()
    .attr({ id: "draw_main" })
    .class(Class.glassBar)
    .addInto(drawBarEl);
const drawBarSideEl = view()
    .attr({ id: "draw_side" })
    .class(Class.glassBar)
    .addInto(drawBarEl);

const drawSideSelect = {
    rect: iconEl("rect_select").attr({ title: "矩形选择" }),
    free: iconEl("free_select").attr({ title: "自由选择" }),
    draw: iconEl("draw_select").attr({ title: "移动" }),
} as const;

const drawSideFree = {
    pencil: iconEl("draw").attr({ title: "画笔" }),
    eraser: iconEl("eraser").attr({ title: "橡皮" }),
    spray: iconEl("spray").attr({ title: "喷刷" }),
} as const;

const drawSideShapes = {
    line: iconEl("line").attr({ title: "线条" }),
    circle: iconEl("circle").attr({ title: "圆" }),
    rect: iconEl("rect").attr({ title: "矩形" }),
    polyline: iconEl("polyline").attr({ title: "折线" }),
    polygon: iconEl("polygon").attr({ title: "多边形" }),
    text: iconEl("text").attr({ title: "文字" }),
    number: iconEl("number").attr({ title: "序号" }),
    arrow: iconEl("arrow").attr({ title: "箭头" }),
    mask: iconEl("mask").attr({ title: "遮罩" }),
} as const;

const filterRangeEl = view().class("draw_filters_range");

const drawSideFilters = {
    pixelate: iconEl("pixelate").attr({ title: "马赛克" }),
    blur: iconEl("blur").attr({ title: "模糊" }),
    brightness: iconEl("brightness").attr({ title: "亮度" }),
    contrast: iconEl("contrast").attr({ title: "对比度" }),
    saturation: iconEl("saturation").attr({ title: "饱和度" }),
    hue: iconEl("hue").attr({ title: "色调" }),
    gamma: filterTextEl("伽马"),
    noise: filterTextEl("噪点"),
} as const;

const drawSideFiltersMoreGray = {
    gray_average: filterTextEl("平均灰度"),
    gray_lightness: filterTextEl("亮度"),
    gray_luminosity: filterTextEl("亮度"),
};

const drawSideFiltersMore = {
    invert: filterEl("invert", "负片"),
    sepia: filterEl("sepia", "棕褐色"),
    bw: filterEl("bw", "黑白"),
    brownie: filterEl("brownie", "布朗尼"),
    vintage: filterEl("vintage", "老式"),
    koda: filterEl("koda", "柯达彩色胶片"),
    techni: filterEl("techni", "特艺色彩"),
    polaroid: filterEl("polaroid", "宝丽来"),
} as const;

const drawSideFiltersAll = {
    ...drawSideFilters,
    ...drawSideFiltersMoreGray,
    ...drawSideFiltersMore,
} as const;

const drawSidePosition = {
    front: iconEl("position_front").attr({ title: "移动到最顶端" }),
    forwards: iconEl("position_forwards").attr({ title: "向上移动一层" }),
    backwards: iconEl("position_backwards").attr({ title: "向下移动一层" }),
    back: iconEl("position_back").attr({ title: "移动到最底端" }),
} as const;

const drawSide操作 = {
    撤回: iconEl("left")
        .attr({ title: "撤回" })
        .data({ key: showShortKey("Control+Z") }),
    重做: iconEl("right")
        .attr({ title: "重做" })
        .data({ key: showShortKey("Control+Y") }),
    复制: iconEl("copy")
        .attr({ title: "复制" })
        .data({ key: showShortKey("Control+C") }),
    删除: iconEl("clear")
        .attr({ title: "删除" })
        .data({ key: showShortKey("Delete") }),
} as const;

function filterTextEl(title: string) {
    return view().attr({ title }).add(t(title));
}

function filterEl(name: string, title: string) {
    return filterTextEl(title).attr({ id: `draw_filters_${name}` });
}

function drawSideGen(els: Record<string, ElType<HTMLElement>>, pid: string) {
    return Object.entries(els).map(([k, v]) => {
        v.attr({ id: `draw_${pid}_${k}` });
        return v;
    });
}
function drawSideGen2(pid: string) {
    return view()
        .class("draw_items")
        .attr({ id: `draw_${pid}_i` });
}

drawSideGen(drawSideSelect, "select");
drawSideGen(drawSideFree, "free");
drawSideGen(drawSideShapes, "shapes");
drawSideGen(drawSideFilters, "filters");
drawSideGen(drawSidePosition, "position");
drawSideGen(drawSide操作, "操作");

function getDrawToolEl(key: string) {
    const [category, type] = key.split(".");
    if (category === "draw") {
        if (type === "free") return drawSideFree.pencil;
        const map = {
            eraser: drawSideFree.eraser,
            spray: drawSideFree.spray,
        } as const;
        return map[type as keyof typeof map];
    }
    if (category === "shape")
        return drawSideShapes[type as keyof typeof drawSideShapes];
    if (category === "filter")
        return drawSideFiltersAll[type as keyof typeof drawSideFiltersAll];
    if (category === "position")
        return drawSidePosition[type as keyof typeof drawSidePosition];
    if (category === "action") {
        const map = {
            undo: drawSide操作.撤回,
            redo: drawSide操作.重做,
            copy: drawSide操作.复制,
            delete: drawSide操作.删除,
        } as const;
        return map[type as keyof typeof map];
    }
    throw new Error(`未知编辑栏工具: ${key}`);
}

const drawToolEntries = clipDrawTools.map((meta) => ({
    ...meta,
    el: getDrawToolEl(meta.key),
}));
const drawToolEntryMap = new Map(
    drawToolEntries.map((entry) => [entry.key, entry]),
);
const configuredDrawToolKeys = store.get("图像编辑.编辑栏.功能");
const visibleDrawTools = configuredDrawToolKeys.flatMap((key) => {
    const entry = drawToolEntryMap.get(key);
    return entry ? [entry] : [];
});
const visibleDrawToolKeys = new Set(visibleDrawTools.map((entry) => entry.key));
const hiddenDrawTools = drawToolEntries.filter(
    (entry) => !visibleDrawToolKeys.has(entry.key),
);

type DrawMainTool = {
    key: string;
    category: keyof EditType | "more" | "action";
    type?: string;
    el: ElType<HTMLElement>;
    html: string;
    run?: () => void;
};

function createMainTool(
    key: string,
    category: DrawMainTool["category"],
    type: string | undefined,
    icon: IconType | undefined,
    title: string,
    id: string,
    run?: () => void,
): DrawMainTool {
    const el = (
        icon
            ? iconEl(icon)
            : view()
                  .style({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      padding: "4px",
                      boxSizing: "border-box",
                      fontSize: "calc(var(--bar-size) / 5)",
                      lineHeight: "1.1",
                      textAlign: "center",
                      cursor: "pointer",
                  })
                  .add(t(title))
    ).attr({ id, title });
    return { key, category, type, el, html: el.el.innerHTML, run };
}

const selectMainTool = createMainTool(
    "select",
    "select",
    undefined,
    "rect_select",
    "选择",
    "draw_select",
    () => setEditType("select", selectEditType),
);
const moreMainTool = createMainTool(
    "more",
    "more",
    undefined,
    "more",
    "更多",
    "draw_more",
);
const visibleMainTools = visibleDrawTools.map((entry) => {
    const [category, type] = entry.key.split(".");
    const isAction = category === "position" || category === "action";
    const tool = createMainTool(
        entry.key,
        isAction ? "action" : (category as keyof EditType),
        isAction ? undefined : type,
        entry.icon,
        entry.title,
        `draw_main_${entry.key.replace(/\./g, "_")}`,
        isAction
            ? () => entry.el.el.click()
            : () => setEditType(category as keyof EditType, type as never),
    );
    const key = entry.el.el.dataset.key;
    if (key) tool.el.data({ key });
    return tool;
});
const drawMainTools: DrawMainTool[] = [
    selectMainTool,
    ...visibleMainTools,
    ...(hiddenDrawTools.length > 0 ? [moreMainTool] : []),
];
for (const { el } of drawMainTools) {
    drawBarMainEl.add(el);
}

const drawMoreItems = hiddenDrawTools.map((entry) => entry.el);

const drawBarSideElChildren: {
    w: number;
    el: ElType<HTMLElement>;
    anchorCategory: keyof EditType | "more";
}[] = [
    {
        w: 1,
        el: drawSideGen2("select").add(Object.values(drawSideSelect)),
        anchorCategory: "select",
    },
    {
        w: 6,
        el: drawSideGen2("more").add(drawMoreItems),
        anchorCategory: "more",
    },
];

drawBarSideEl.add(drawBarSideElChildren.map((i) => i.el));

const elementBar = view()
    .attr({ id: "element_bar" })
    .class(Class.glassBar)
    .addInto();
const elementBarHeader = view()
    .attr({ id: "element_bar_header" })
    .addInto(elementBar);
const elementBarBody = view()
    .attr({ id: "element_bar_body" })
    .addInto(elementBar);

// 颜色弹层：旧色盘 + 项目取色器
let colorPopoverTarget: ((v: string) => void) | null = null;
let colorPopoverAnchor: HTMLElement | null = null;
let colorPopoverOpen = false;
let colorPopoverTab: "grid" | "picker" = "grid";
const colorPopover = view("y").class(Class.gap, Class.glassBar).style({
    position: "fixed",
    inset: "auto",
    display: "none",
    margin: 0,
    padding: "0px",
    width: "224px",
    maxHeight: "calc(100vh - 8px)",
    overflowX: "hidden",
    overflowY: "auto",
    color: "var(--font-color)",
    borderRadius: "var(--border-radius)",
    boxShadow: "var(--shadow)",
    visibility: "hidden",
    zIndex: "120",
});
const colorTabs = view("x");
const colorGrid = view().style({
    display: "grid",
    width: "100%",
    gridTemplateColumns: "repeat(5, 1fr)",
});
const inlinePicker = colorPicker({
    inline: true,
    live: true,
    alpha: true,
    width: "100%",
});
const colorTabGrid = button(t("色盘"))
    .class("color_tab")
    .style({ padding: "1px 6px", fontSize: "11px" })
    .on("click", () => setColorTab("grid"));
const colorTabPicker = button(t("取色器"))
    .class("color_tab")
    .style({ padding: "1px 6px", fontSize: "11px" })
    .on("click", () => setColorTab("picker"));
colorTabs.add([colorTabGrid, colorTabPicker]);
colorPopover.add([colorTabs, colorGrid, inlinePicker]).addInto();
inlinePicker.el.style.display = "none";

function setColorTab(tab: "grid" | "picker") {
    colorPopoverTab = tab;
    colorGrid.style({ display: tab === "grid" ? "grid" : "none" });
    inlinePicker.style({ display: tab === "picker" ? "flex" : "none" });
    colorTabGrid.style({
        background: tab === "grid" ? "var(--bar-focus-color)" : "transparent",
    });
    colorTabPicker.style({
        background: tab === "picker" ? "var(--bar-focus-color)" : "transparent",
    });
    if (colorPopoverOpen) positionColorPopover();
}

function renderColorGrid(hue?: number, gray = false) {
    colorGrid.clear();
    const colors: { color: string; hue: number; gray?: boolean }[] = [];
    if (hue === undefined) {
        colors.push({ color: "#fff", hue: 0, gray: true });
        for (let i = 0; i < 360; i += 15) {
            colors.push({ color: chroma.hsl(i, 1, 0.5).css(), hue: i });
        }
    } else if (gray) {
        for (let i = 0; i < 25; i++) {
            colors.push({
                color: chroma.hsl(0, 0, (24 - i) / 24).css(),
                hue: 0,
                gray: true,
            });
        }
    } else {
        for (let l = 90; l > 0; l -= 20) {
            for (let s = 100; s > 0; s -= 20) {
                colors.push({
                    color: chroma.hsl(hue, s / 100, l / 100).css(),
                    hue,
                });
            }
        }
    }
    for (const item of colors) {
        const swatch = view()
            .class("color_swatch")
            .style({ "background-color": item.color })
            .data({
                title: `${colorConversion(
                    chroma(item.color).rgba(),
                    取色器默认格式,
                )}\n${hue === undefined ? t("右键查看更多") : t("右键返回")}`,
            })
            .on("pointerdown", (e) => {
                if (e.button === 0) {
                    applyPopoverColor(chroma(item.color).alpha(1).css(), false);
                } else {
                    renderColorGrid(
                        hue === undefined ? item.hue : undefined,
                        item.gray,
                    );
                }
            });
        colorGrid.add(swatch);
    }
    if (colorPopoverOpen) positionColorPopover();
}

function applyPopoverColor(v: string, fromPicker: boolean) {
    try {
        const c = chroma(v);
        if (!fromPicker) inlinePicker.sv(c.css());
        colorPopoverTarget?.(c.css());
    } catch {}
}

inlinePicker.on("input", () => {
    applyPopoverColor(inlinePicker.gv, true);
});

function positionColorPopover() {
    if (!colorPopoverOpen || !colorPopoverAnchor) return;
    const rect = colorPopoverAnchor.getBoundingClientRect();
    const width = colorPopover.el.offsetWidth;
    const height = colorPopover.el.offsetHeight;
    const gap = 6;
    const margin = 4;
    const below = rect.bottom + gap;
    const top =
        below + height <= window.innerHeight - margin ||
        rect.top - height - gap < margin
            ? below
            : rect.top - height - gap;
    colorPopover.style({
        left: `${Math.max(
            margin,
            Math.min(window.innerWidth - width - margin, rect.left),
        )}px`,
        top: `${Math.max(
            margin,
            Math.min(window.innerHeight - height - margin, top),
        )}px`,
        visibility: "visible",
    });
}

function onColorOutside(e: PointerEvent) {
    const target = e.target as Node | null;
    if (!target) return;
    if (
        colorPopover.el.contains(target) ||
        colorPopoverAnchor?.contains(target)
    )
        return;
    closeColorPopover();
}

function onColorKey(e: KeyboardEvent) {
    if (e.key === "Escape") closeColorPopover();
}

function closeColorPopover() {
    if (colorPopoverOpen) {
        colorPopoverOpen = false;
        colorPopover.style({ display: "none", visibility: "hidden" });
    }
    colorPopoverTarget = null;
    colorPopoverAnchor = null;
    document.removeEventListener("pointerdown", onColorOutside, true);
    document.removeEventListener("keydown", onColorKey, true);
    window.removeEventListener("resize", positionColorPopover);
    document.removeEventListener("scroll", positionColorPopover, true);
}

function openColorPopover(
    anchor: HTMLElement,
    get: () => string,
    apply: (v: string) => void,
) {
    colorPopoverTarget = apply;
    colorPopoverAnchor = anchor;
    if (!colorPopoverOpen) {
        colorPopoverOpen = true;
        colorPopover.style({ display: "flex" });
        document.addEventListener("pointerdown", onColorOutside, true);
        document.addEventListener("keydown", onColorKey, true);
        window.addEventListener("resize", positionColorPopover);
        document.addEventListener("scroll", positionColorPopover, true);
    }
    const color = get();
    inlinePicker.sv(color);
    renderColorGrid();
    setColorTab(colorPopoverTab);
    positionColorPopover();
}

colorPopover.on("contextmenu", (e) => e.preventDefault());

const whEl = view("x").attr({ id: "clip_wh" }).class(Class.glassBar, Class.gap);
const whX0 = input();
const whY0 = input();
const whX1 = input();
const whY1 = input();
const whW = input();
const whH = input();
const whXYStyle = { display: 四角坐标 ? "block" : "none" };
whEl.add([
    view()
        .style(whXYStyle)
        .add([whX0, txt(",").style({ color: cssColor.ff }), whY0]),
    view()
        .style(whXYStyle)
        .add([whX1, txt(",").style({ color: cssColor.ff }), whY1]),
    view().add([whW, txt("×").style({ color: cssColor.ff }), whH]),
]);

let chPX = 0;
const chCal = txt("0").style({ width: "1ch" });
chCal.addInto();
chPX = chCal.el.offsetWidth;
chCal.remove();

const longTip = frame("long_tip", {
    _: view().attr({ id: "long_tip" }),
    rect: {
        _: view().attr({ id: "long_rect" }),
        finish: view().attr({ id: "long_finish" }),
    },
});

const longPreview = view().style({ position: "fixed" });

hotkeyTipEl.addInto();
toolBarEl.addInto();
whEl.addInto();
longTip.el.addInto();
longPreview.addInto();

const centerBarEl = view()
    .attr({ id: "center_bar" })
    .class(Class.glassBar)
    .addInto();
const saveType = view()
    .attr({ id: "save_type" })
    .addInto(centerBarEl)
    .add(view().add(t("保存文件格式为")));
const saveTypeList: (typeof type)[] = ["png", "jpg", "webp", "bmp"];
if (await isImageFormatSupported("avif")) saveTypeList.push("avif");
saveTypeList.push("svg");
const suffixList = saveTypeList.map((i) =>
    view()
        .data({ value: i })
        .add(i)
        .on("click", () => {
            type = i;
            showSaveBar(false);
            renderSend("clip_hide", []);
            save(renderSendSync("clip_save", [i]));
        }),
);
view().attr({ id: "suffix" }).add(suffixList).addInto(saveType);

const editor = view().attr({ id: "editor" }).addInto();
const mainCanvas = ele("canvas").attr({ id: "main_photo" }).el;
const clipEl = ele("div").attr({ id: "clip_photo" }).el;
const drawCanvas = ele("canvas").attr({ id: "draw_photo" }).el;
const drawP = view().attr({ id: "draw_photo_top" }).add(drawCanvas);
editor.add([mainCanvas, clipEl, drawP]);

/** 遮罩和参考线用屏幕坐标绘制，不参与 editor 缩放 */
const clipMaskLayer = view().attr({ id: "clip_mask" }).addInto();
const clipLineLayer = view().attr({ id: "clip_line" }).addInto();

/** 遮罩：矩形用四块围合，自由多边形用 clip-path 挖洞 */
const clipMaskRect = Array.from({ length: 4 }, () =>
    view().style({ background: 遮罩颜色 }),
);
const clipMaskPoly = view().style({
    background: 遮罩颜色,
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    display: "none",
});
/** 选区参考线 */
const clipSelectLineX = x选区参考线.x.map(() =>
    view().style({ background: c参考线颜色.选区参考线 }),
);
const clipSelectLineY = x选区参考线.y.map(() =>
    view().style({ background: c参考线颜色.选区参考线 }),
);
const clipSelectLines = [...clipSelectLineX, ...clipSelectLineY];
/** 光标参考线：左右横线、上下竖线 */
const clipCkx = Array.from({ length: 4 }, () =>
    view().style({ background: c参考线颜色.光标参考线 }),
);
/** 自动框选提示 */
const clipEdge = view().style({
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
});
clipMaskLayer.add([...clipMaskRect.map((i) => i.el), clipMaskPoly.el]);
clipLineLayer.add([
    ...clipSelectLines.map((i) => i.el),
    clipEdge.el,
    ...clipCkx.map((i) => i.el),
]);

editor.style({ width: `${window.screen.width / 全局缩放}px` });
// 第一次截的一定是桌面,所以可提前定义
mainCanvas.width = drawCanvas.width =
    window.screen.width * window.devicePixelRatio;
mainCanvas.height = drawCanvas.height =
    window.screen.height * window.devicePixelRatio;
setClipSize(mainCanvas.width, mainCanvas.height);
let zoomW = 0;
type rect = [number, number, number, number];
type point = { x: number; y: number };
let finalRect = [0, 0, mainCanvas.width, mainCanvas.height] as rect;
let freeSelect: point[] = [];

const toolBar = toolBarEl.el;
const drawBar = drawBarEl.el;

let nowScreenId = 0;

let allScreens: Awaited<ReturnType<typeof screenShots>>["screen"];
let windows: Awaited<ReturnType<typeof screenShots>>["window"];
/** 当前截屏会话的显示器信息 */
let currentDisplays: Electron.Display[] = [];
/** 主进程 pid，用于排除应用自身窗口 */
let mainPid = 0;
/** 窗口视频源的请求回调 */
const captureSourceRequests = new Map<
    number,
    (sources: CaptureSourceInfo[]) => void
>();
let captureSourceRequestId = 0;
let liveDingRunning = false;

let nowMouseE: MouseEvent;

const editorP = { zoom: 1, x: 0, y: 0 };

let middleB: PointerEvent | null = null;
const middleP = { x: 0, y: 0 };

const edgeRect: {
    x: number;
    y: number;
    width: number;
    height: number;
    type: "system" | "image";
}[] = [];

const drawSideEls: {
    [key in keyof EditType]: { [key1 in EditType[key]]: ElType<HTMLElement> };
} = {
    select: drawSideSelect,
    draw: {
        free: drawSideFree.pencil,
        eraser: drawSideFree.eraser,
        spray: drawSideFree.spray,
    },
    filter: drawSideFiltersAll,
    shape: drawSideShapes,
};

const mouseBarEl = view()
    .attr({ id: "mouse_bar" })
    .class(Class.glassBar)
    .addInto();
const mouseBarColor = view().attr({ id: "point_color" }).addInto(mouseBarEl);
const mouseBarXy = view()
    .attr({ id: "clip_xy" })
    .addInto(mouseBarEl)
    .bindSet((v: [number, number], el) => {
        el.textContent = `(${v[0]}, ${v[1]})`;
    });
const mouseBarCopy = view().attr({ id: "clip_copy" }).addInto(mouseBarEl);
const mouseBarCopyI = view().addInto(mouseBarCopy);
const mouseBarCopySize = view().addInto(mouseBarCopyI);
const mouseBarCopyColor = view().addInto(mouseBarCopyI);
let mouseBarCopyColorList: ElType<HTMLElement>[] = [];
let mouseBarColorMinSize = 10;

type hotkeyScope = "normal" | "c_bar" | "drawing";
const hotkeyScopes: hotkeyScope[] = [];

const drawHotKey = store.get("截屏编辑快捷键");

type hotkeyTip = { name: string; keys: string[] }[];
const hotkeyTipX: { name: string; hotkey: hotkeyTip }[] = [
    {
        name: "画布",
        hotkey: [
            { name: "移动", keys: [t("方向键"), "wheel"] },
            { name: "缩放", keys: ["Control+wheel"] },
        ],
    },
    {
        name: "框选",
        hotkey: [
            { name: "全选", keys: ["Control+A"] },
            { name: "移动和调节", keys: [t("按住+方向键")] },
            { name: "×5", keys: ["+Control+"] },
            { name: "×10", keys: ["+Shift+"] },
            { name: "左上x", keys: [store.get("大小栏快捷键.左上x")] },
            { name: "左上y", keys: [store.get("大小栏快捷键.左上y")] },
            { name: "右下x", keys: [store.get("大小栏快捷键.右下x")] },
            { name: "右下y", keys: [store.get("大小栏快捷键.右下y")] },
            { name: "宽", keys: [store.get("大小栏快捷键.宽")] },
            { name: "高", keys: [store.get("大小栏快捷键.高")] },
            { name: "自动框选", keys: ["S"] },
            { name: "匹配自动框选", keys: [`Shift ${t("框选")}`] },
        ],
    },
    {
        name: "数值",
        hotkey: [
            { name: "大", keys: ["Up"] },
            { name: "小", keys: ["Down"] },
            { name: "取消更改", keys: ["RightKey"] },
        ],
    },
    {
        name: "取色器",
        hotkey: [
            { name: "展示所有颜色格式", keys: ["RightKey"] },
            { name: "复制颜色", keys: [store.get("其他快捷键.复制颜色")] },
        ],
    },
    { name: "快捷键", hotkey: [{ name: "展示", keys: ["Alt"] }] },
];

let autoDo = store.get("框选后默认操作");

let lastLong = 0;

let uIOhook: typeof import("uiohook-napi")["uIOhook"] | null;
let longClipTime: NodeJS.Timeout | undefined;

const longHide = Array.from(document.body.children).filter(
    (i) => i !== longTip.el.el && i !== longPreview.el,
) as HTMLElement[];

const longX = {
    img: null as HTMLCanvasElement | null,
    imgXY: { x: 0, y: 0 },
};

let longRunning = false;
let longInited = false;
let longMouse: NodeJS.Timeout | null = null;
/** 结束按钮无法避开选区时会盖住画面，结束时需要先藏起来再截最后一帧 */
let finishLongInside = false;

let longFX: typeof toolsX.long.el.gv = "y";

let type: setting["保存"]["默认格式"];

/** 矩形还是自由 */
let isRect = true;
let /**是否在绘制新选区*/ selecting = false;
let rightKey = false;
let rectStartE: px_position | null = null;
let /**是否在更改选区*/ moving = false;

type editor_position = { x: number; y: number };
type px_position = { x: number; y: number } & symbol;

let /** 先前坐标，用于框选的生成和调整 */ oldP = {
        x: Number.NaN,
        y: Number.NaN,
    } as editor_position;
let oFinalRect: rect | null = null;
let oPoly: point[] | null = null;
let theColor: [number, number, number, number] | null = null;
let theTextColor: [string, string] = ["", ""];
type colorFormat = setting["取色器"]["默认格式"];
type colorRGBA = [number, number, number, number];
const undoStack = new xhistory<{ rect: rect; canvas: object }>([], {
    rect: [0, 0, mainCanvas.width, mainCanvas.height] as rect,
    canvas: {},
});
let direction:
    | ""
    | "move"
    | "东"
    | "西"
    | "南"
    | "北"
    | "东南"
    | "西南"
    | "东北"
    | "西北";
let /**鼠标是否移动过，用于自动框选点击判断 */ moved = false;
let /**鼠标是否按住 */ down = false;
let /**是否选好了选区，若手动选好，自动框选提示关闭 */ rectSelect = false;

let rectInRect: rect[] = [];

const mouseBarW =
    Math.max(
        colorSize * colorISize,
        (String(window.innerWidth).length +
            String(window.innerHeight).length +
            2 +
            1) *
            8,
    ) + 4;
const mouseBarH = 4 + colorSize * colorISize + 32 * 2;

let mouseBarX = 0;
let mouseBarY = 0;

// 工具栏跟随
const followBarList = [[0, 0]];
let drawBarPosi: "right" | "left" = "right";
const barGap = 8;

// 移动画画栏
let drawBarMovingXY: [number, number] | null = null;

let nowType: keyof EditType;
let selectEditType: EditType["select"] =
    store.get("图像编辑.记忆.select") || "rect";

let willShowITime: NodeJS.Timeout;

let isShowBars = !store.get("工具栏.稍后出现") as boolean;

let mode: EditType["draw"];

type Shape = EditType["shape"] | "";
let shape: Shape = "";

let drawingShape = false;
let previewShape: FabricObject | null = null;

function removePreviewShape() {
    if (previewShape) {
        fabricCanvas.remove(previewShape);
        previewShape = null;
    }
}
const unnormalShapes = ["polyline", "polygon", "number"];
let drawOP: [number, number] = [0, 0]; // 首次按下的点
let polyOP: point[] = []; // 多边形点
let newFilterO: Point | null = null;
let drawNumberN = 1;
declare module "fabric" {
    // to have the properties recognized on the instance and in the constructor
    interface FabricObject {
        canChangeFill?: boolean;
        形状?: Shape;
    }
    // to have the properties typed in the exported object
    interface SerializedObjectProps {
        canChangeFill?: boolean;
        形状?: Shape;
    }
}

let newFilterSelecting = false;

const filtetMap: {
    [key in EditType["filter"]]: {
        value?: {
            value: number;
            max: number;
            min?: number;
            step?: number;
            text?: string;
        };
        // biome-ignore lint/suspicious/noExplicitAny: 适配库
        fun: (v?: number) => filters.BaseFilter<string, any>;
        el?: () => ElType<HTMLElement>;
    };
} = {
    pixelate: {
        value: { min: 1, value: 16, max: 200, text: "px" },
        fun: (v) => new Filters.Pixelate({ blocksize: v }),
    },
    blur: {
        value: { value: 1, max: 5, text: "%", step: 0.01 },
        fun: (v) => new Filters.Blur({ blur: v }),
    },
    brightness: {
        value: { min: -1, value: 0, max: 1, step: 0.01 },
        fun: (v) => new Filters.Brightness({ brightness: v }),
    },
    contrast: {
        value: { min: -1, value: 0, max: 1, step: 0.01 },
        fun: (v) => new Filters.Contrast({ contrast: v }),
    },
    saturation: {
        value: { min: -1, value: 0, max: 1, step: 0.01 },
        fun: (v) => new Filters.Saturation({ saturation: v }),
    },
    hue: {
        value: { min: -1, value: 0, max: 1, step: 0.01 },
        fun: (v) => new Filters.HueRotation({ rotation: v }),
    },
    noise: {
        value: { value: 0, max: 1000 },
        fun: (v) => new Filters.Noise({ value: v }),
    },
    invert: { fun: () => new Filters.Invert() },
    sepia: { fun: () => new Filters.Sepia() },
    bw: { fun: () => new Filters.BlackWhite() },
    brownie: { fun: () => new Filters.Brownie() },
    vintage: { fun: () => new Filters.Vintage() },
    koda: { fun: () => new Filters.Kodachrome() },
    techni: { fun: () => new Filters.Technicolor() },
    polaroid: { fun: () => new Filters.Polaroid() },
    gray_average: {
        fun: () =>
            new Filters.Grayscale({
                mode: "average",
            }),
    },
    gray_lightness: {
        fun: () =>
            new Filters.Grayscale({
                mode: "lightness",
            }),
    },
    gray_luminosity: {
        fun: () =>
            new Filters.Grayscale({
                mode: "luminosity",
            }),
    },
    gamma: {
        fun: (v) =>
            new Filters.Gamma({
                gamma: v as unknown as [number, number, number],
            }),
        // @ts-ignore
        value: { value: [1, 1, 1] },
        el: gammaEl,
    },
};

let willFilter: EditType["filter"] | "" = "";

// ------

document.body.style.opacity = "0";

renderOn("clip_init", async ([_displays, imgBuffer, mainid, act, pid]) => {
    currentDisplays = _displays;
    mainPid = pid ?? 0;
    const wx = await screenShots(_displays, imgBuffer); // 只是截屏 也可能是小图片
    allScreens = wx.screen;
    const mainId = mainid;
    const i = getNowScreen(mainId);
    windows = wx.window.map((w) => {
        w.rect.x -= i.bounds?.x ?? 0;
        w.rect.y -= i.bounds?.y ?? 0;
        return w;
    });
    await setScreen(i);
    const nowScreen = _displays.find((i) => i.id === mainId) || _displays[0]; // 非截屏，是屏幕
    const xy = { x: 0, y: 0 };
    if (wx.type === "normal") {
        zoomW = i.size.width;
        ratio = i.scaleFactor;
    } else if (wx.type === "command") {
        const x = store.get("自定义屏幕属性");
        const s = x.find((i) => i.id === mainId);
        zoomW = i.size.width;
        if (s) ratio = s.scaleFactor;
        else ratio = nowScreen.scaleFactor;
    } else if (wx.type === "img")
        if (
            i.size.width < nowScreen.size.width ||
            i.size.height < nowScreen.size.height
        ) {
            const x =
                (nowScreen.size.width * window.devicePixelRatio) / 2 -
                i.size.width / 2;
            const y =
                (nowScreen.size.height * window.devicePixelRatio) / 2 -
                i.size.height / 2;
            xy.x = x;
            xy.y = y;
            zoomW = i.size.width;
            ratio = devicePixelRatio;
        }
    setEditorP(1 / ratio, 0, 0);
    undoStack.reset({
        rect: finalRect,
        canvas: fabricCanvas.toJSON(),
    });

    document.body.style.opacity = "";

    renderSend("clip_show", []);
    const screensEl = toolsX.screens.el;
    if (allScreens.length > 1) {
        let minX = 0;
        let maxX = 0;
        let minY = 0;
        let maxY = 0;
        for (const i of allScreens) {
            const right = i.bounds.x + i.bounds.width;
            const bottom = i.bounds.y + i.bounds.height;
            maxX = Math.max(maxX, right);
            maxY = Math.max(maxY, bottom);
            minX = Math.min(minX, i.bounds.x);
            minY = Math.min(minY, i.bounds.y);
        }
        const tWidth = maxX - minX;
        const tHeight = maxY - minY;
        const el = view();
        for (const i of allScreens) {
            const x = (i.bounds.x - minX) / tWidth;
            const y = (i.bounds.y - minY) / tHeight;
            const width = i.bounds.width / tWidth;
            const height = i.bounds.height / tHeight;
            const div = view().style({
                width: `${width * 100}%`,
                height: `${height * 100}%`,
                left: `${x * 100}%`,
                top: `${y * 100}%`,
            });
            if (i.id === nowScreenId) {
                div.el.classList.add("now_screen");
            }
            el.add(div);
            div.on("click", () => {
                el.query(".now_screen")?.el.classList.remove("now_screen");
                div.class("now_screen");
                setScreen(i);
            });
        }
        screensEl.clear().add(el);
    } else {
        screensEl.el.style.display = "none";
    }

    setDefaultAction(act);

    getWin();

    drawClipRect();
    setTimeout(() => {
        whBar(finalRect);
    }, 0);
    rightKey = false;
    changeRightBar(false);
});

renderOn("clip_stop_long", () => stopLong());

renderOn("long_compact_run", ([preview]) => {
    if (!longCompact || longCompactStarted) return;
    longCompactStarted = true;
    longCompactPreview = preview;
    startLongInput();
});

renderOn("captureSources", ([requestId, sources]) => {
    const cb = captureSourceRequests.get(requestId);
    captureSourceRequests.delete(requestId);
    cb?.(sources);
});
document.onwheel = (e) => {
    if (
        !editor.el.contains(e.target as HTMLElement) &&
        e.target !== document.body
    )
        return;
    if (longRunning) return;

    document.body.classList.add("editor_bg");

    if ((nowType === "draw" || nowType === "shape") && !e.ctrlKey) {
        adjustStrokeWidth(e.deltaY / 50);
        return;
    }

    if (e.ctrlKey) {
        const zz = 1 + Math.abs(e.deltaY) / 300;
        const z = e.deltaY > 0 ? zoomW / zz : zoomW * zz;
        zoomW = z;
        const ozoom = editorP.zoom;
        const nzoom = z / mainCanvas.width;
        const dx = nowMouseE.clientX - editorP.x * ozoom;
        const dy = nowMouseE.clientY - editorP.y * ozoom;
        const x = nowMouseE.clientX - dx * (nzoom / ozoom);
        const y = nowMouseE.clientY - dy * (nzoom / ozoom);
        setEditorP(nzoom, x / nzoom, y / nzoom);
    } else {
        let dx = 0;
        let dy = 0;
        if (e.shiftKey && !e.deltaX) {
            dx = -e.deltaY;
        } else {
            dx = -e.deltaX;
            dy = -e.deltaY;
        }
        setEditorP(
            editorP.zoom,
            editorP.x + dx / editorP.zoom,
            editorP.y + dy / editorP.zoom,
        );
    }
};

document.onkeyup = (e) => {
    if (e.key === "0") {
        if (e.ctrlKey) {
            setEditorP(1 / window.devicePixelRatio, 0, 0); // todo 统一缩放标准
            zoomW = mainCanvas.width;
        }
    }
};

document.addEventListener("pointerdown", (e) => {
    if (e.button === 1) {
        middleB = e;
        middleP.x = editorP.x;
        middleP.y = editorP.y;
        document.body.classList.add("editor_bg");
    }
});
document.addEventListener("pointermove", (e) => {
    if (middleB) {
        const dx = e.clientX - middleB.clientX;
        const dy = e.clientY - middleB.clientY;
        setEditorP(
            editorP.zoom,
            middleP.x + dx / editorP.zoom,
            middleP.y + dy / editorP.zoom,
        );
    }
});
document.addEventListener("pointerup", (_e) => {
    middleB = null;
});

hotkeys.filter = (event) => {
    const tagName = (<HTMLElement>event.target).tagName;
    const v = !(
        (<HTMLElement>event.target).isContentEditable ||
        tagName === "INPUT" ||
        tagName === "SELECT" ||
        tagName === "TEXTAREA"
    );
    return v;
};

toHotkeyScope("normal");
for (const k of tools) {
    let key = store.get(`工具快捷键.${k}`) as string;
    if (["esc", "escape"].includes(key.toLowerCase()))
        hotkeys(key, "normal", toolsX[k].f);
    else if (key.toLowerCase() === "enter") hotkeys(key, "normal", toolsX[k].f);
    else hotkeys(key, "all", toolsX[k].f);
    key = key
        .split("+")
        .map((k) => jsKeyCodeDisplay(ele2jsKeyCode(k)).primary)
        .join("");
    if (k === "copy") {
        key += ` ${t("双击")}`;
    }
    toolsX[k].el.data({ key: key.trim() });
}
const { more: moreHotKey, ...drawToolHotKey } = drawHotKey;
const moreKey = moreHotKey.键;
const toolShortcutKeys = new Map<string, string>();
const digitTargets = new Map<string, string>();
const digitActions = new Map<string, () => void>();
const positionalTools = drawMainTools.filter(
    (tool) => tool.category !== "more",
);
for (const [i, tool] of positionalTools.slice(0, 9).entries()) {
    const digit = String(i + 1);
    digitTargets.set(digit, tool.key);
    digitActions.set(digit, () => tool.run?.());
}
const moreTool = drawMainTools.find((tool) => tool.category === "more");
if (moreTool && moreKey) {
    if (/^[0-9]$/.test(moreKey)) {
        digitTargets.set(moreKey, moreTool.key);
        digitActions.set(moreKey, toggleMoreSideBar);
    } else {
        hotkeys(moreKey, toggleMoreSideBar);
    }
}

for (const [mainKey, k] of typedEntries(drawToolHotKey)) {
    for (const [j, v] of typedEntries(k.副)) {
        const toolKey = `${mainKey}.${j}`;
        if (v) toolShortcutKeys.set(toolKey, v);
        try {
            // @ts-expect-error
            drawSideEls[mainKey][j].data({
                key: showShortKey(v),
            });
        } catch (error) {}
        if (!v) continue;
        if (/^[0-9]$/.test(v)) {
            digitTargets.set(v, toolKey);
            digitActions.set(v, () => setEditType(mainKey, j));
            continue;
        }
        hotkeys(v, () => {
            setEditType(mainKey, j);
        });
    }
}

for (const [digit, action] of digitActions) {
    hotkeys(digit, action);
}

for (const tool of drawMainTools) {
    if (tool.category === "more") {
        const key =
            !moreKey ||
            (/^[0-9]$/.test(moreKey) && digitTargets.get(moreKey) !== "more")
                ? ""
                : moreKey;
        tool.el.data({ key: showShortKey(key) });
        continue;
    }
    let digit: string | undefined;
    for (const [d, target] of digitTargets) {
        if (target === tool.key) {
            digit = d;
            break;
        }
    }
    tool.el.data({
        key: showShortKey(
            digit ??
                toolShortcutKeys.get(tool.key) ??
                tool.el.el.dataset.key ??
                "",
        ),
    });
}

function showShortKey(k: string) {
    return k
        .split("+")
        .map((k) => jsKeyCodeDisplay(ele2jsKeyCode(k)).primary)
        .join("");
}

// alt显示快捷键
let altT: number;
document.addEventListener("keydown", (e) => {
    if (e.key === "Alt" && !longRunning) {
        altT = window.setTimeout(() => {
            document.documentElement.style.setProperty(
                "--hotkey-show",
                "block",
            );
        }, 400);
    }
});
document.addEventListener("keyup", (e) => {
    if (e.key === "Alt") {
        clearTimeout(altT);
        document.documentElement.style.setProperty("--hotkey-show", "none");
    }
});

for (const m of hotkeyTipX) {
    hotkeyTipEl.add(p(t(m.name)));
    for (const k of m.hotkey) {
        const x = view().add(txt(t(k.name)));
        for (let s of k.keys) {
            s = s
                .split("+")
                .map((k) => jsKeyCodeDisplay(ele2jsKeyCode(k)).primary)
                .join("+");
            x.add(txt(s));
        }
        hotkeyTipEl.add(x);
    }
}

setDefaultAction(autoDo);

// OCR
const ocr引擎 = toolsX.ocr.el;
ocr引擎.sv(store.get("OCR.类型"));
ocr引擎.on("change", () => {
    store.set("OCR.类型", ocr引擎.gv);
    toolsX.ocr.f();
});

// 以图搜图
const 识图引擎 = toolsX.search.el;
// @ts-ignore
识图引擎.sv(store.get("以图搜图.引擎"));
识图引擎.on("change", () => {
    store.set("以图搜图.引擎", 识图引擎.gv);
    toolsX.search.f();
});

trackLocation();

const finishLongB = longTip.els.finish.el;

const lr = longTip.els.rect;
const longWarnEl = view().attr({ id: "long_warn" }).addInto(lr);

function longWarnText(level: LongWarnLevel) {
    return level === 2 ? t("滚动过快，可能漏内容") : t("滚动偏快，请放慢");
}

function renderLongWarn() {
    const el = longWarnEl.el;
    if (!longWarnLevel) {
        el.style.display = "none";
        return;
    }
    el.classList.toggle("long_warn_danger", longWarnLevel === 2);
    el.textContent = longWarnText(longWarnLevel);
    el.style.display = "block";
    positionLongWarn();
}

function positionLongWarn() {
    const el = longWarnEl.el;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const gap = 8;
    const x = finalRect[0] / ratio;
    const y = finalRect[1] / ratio;
    const rw = finalRect[2] / ratio;
    const rh = finalRect[3] / ratio;
    let left = rw / 2 - w / 2;
    let top = rh + gap;
    if (y + rh + gap + h <= window.innerHeight) {
        // 优先放在选区下方，其次上方、右侧、左侧
    } else if (y - gap - h >= 0) {
        top = -gap - h;
    } else if (x + rw + gap + w <= window.innerWidth) {
        left = rw + gap;
        top = rh / 2 - h / 2;
    } else if (x - gap - w >= 0) {
        left = -gap - w;
        top = rh / 2 - h / 2;
    } else {
        // 四周都没有空间时贴在结束按钮旁，跟随最后一帧一起隐藏
        left = Math.max(0, rw - w);
        top = Math.max(0, rh - h - 24);
    }
    longWarnEl.style({ left: `${left}px`, top: `${top}px` });
}

trackPoint(pack(toolBar), {
    start: (e) => {
        if (e.ctrlKey) {
            toolBar.style.transition = "none";
            return {
                x: toolBar.offsetLeft,
                y: toolBar.offsetTop,
            };
        }
        return null;
    },
    ing: (p) => {
        toolBar.style.left = `${p.x}px`;
        toolBar.style.top = `${p.y}px`;
        trackLocation();
    },
    end: () => {
        toolBar.style.transition = "";
    },
});

setTitle(t("截屏"));

// 键盘控制光标
document.body.onkeydown = (e) => {
    const tagName = (<HTMLElement>e.target).tagName;
    if (
        (<HTMLElement>e.target).isContentEditable ||
        tagName === "INPUT" ||
        tagName === "SELECT" ||
        tagName === "TEXTAREA"
    )
        return;
    if (longRunning) return;
    if (hotkeys.getScope() === "c_bar") return;
    const o: Record<string, "up" | "right" | "down" | "left"> = {
        ArrowUp: "up",
        ArrowRight: "right",
        ArrowDown: "down",
        ArrowLeft: "left",
    };
    if (nowType === "draw" || nowType === "shape") {
        if (!(e.key in o)) return;
        adjustStrokeWidth(
            e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : -1,
        );
        return;
    }
    let v = 1;
    if (e.ctrlKey) v = v * 5;
    if (e.shiftKey) v = v * 10;
    if (e.key in o) {
        if (direction) {
            const op = nowMouseE;
            let x = op.offsetX;
            let y = op.offsetY;
            const d = v;
            switch (o[e.key]) {
                case "up":
                    y = op.offsetY - d;
                    break;
                case "down":
                    y = op.offsetY + d;
                    break;
                case "right":
                    x = op.offsetX + d;
                    break;
                case "left":
                    x = op.offsetX - d;
                    break;
            }
            if (isRect) {
                moveRect(finalRect, { x: op.offsetX, y: op.offsetY }, { x, y });
            } else {
                movePoly(
                    freeSelect,
                    { x: op.offsetX, y: op.offsetY },
                    { x, y },
                );
            }
            drawClip();
            ckx(e2srcPoint(nowMouseE));
        } else {
            let x = editorP.x;
            let y = editorP.y;
            const d = v / editorP.zoom;
            switch (o[e.key]) {
                case "up":
                    y = editorP.y + d;
                    break;
                case "down":
                    y = editorP.y - d;
                    break;
                case "right":
                    x = editorP.x - d;
                    break;
                case "left":
                    x = editorP.x + d;
                    break;
            }
            setEditorP(editorP.zoom, x, y);
            document.body.classList.add("editor_bg");
            mouseBar(finalRect, e2srcPoint(nowMouseE));
        }
    }
};

clipEl.onmousedown = (e) => {
    let inRect = false;
    if (isRect) {
        inRect = isInClipRect({ x: e.offsetX, y: e.offsetY });
    } else {
        inRect = isPointInPolygon({ x: e.offsetX, y: e.offsetY });
    }
    if (e.button === 0) {
        clipStart(e, inRect);
    }
    if (e.button === 2) {
        if (store.get("鼠标快捷键.右键") === "取色器") pickColor(e);
        else toolsX.close.f();
    }
    toolBar.style.pointerEvents =
        drawBar.style.pointerEvents =
        whEl.el.style.pointerEvents =
            "none";

    down = true;
};

document.onmouseup = (e) => {
    if (e.button === 0) {
        if (selecting) {
            clipEnd(e);
            // 抬起鼠标后工具栏跟随
            followBar({ x: e.clientX, y: e.clientY });
            // 框选后默认操作
            if (autoDo !== "no" && e.button === 0) {
                toolsX[autoDo].f();
            }
            isShowBars = true;
            showBars(isShowBars);
        }
        if (moving) {
            moving = false;
            oFinalRect = null;
            if (e.button === 0) followBar({ x: e.clientX, y: e.clientY });
            hisPush();
        }
    }
    toolBar.style.pointerEvents =
        drawBar.style.pointerEvents =
        whEl.el.style.pointerEvents =
            "auto";

    down = false;
    moved = false;
};

hotkeys("s", () => {
    if (drawingMode) return;
    rectSelect = false;
    finalRect = [0, 0, mainCanvas.width, mainCanvas.height];
    drawClipRect();
    ensureImageEdge();
    refreshEdgeHint();
});

const whHotKeyMap = {
    左上x: whX0,
    左上y: whY0,
    右下x: whX1,
    右下y: whY1,
    宽: whW,
    高: whH,
};

const whHotkey = store.get("大小栏快捷键");
for (const [i] of typedEntries(whHotkey)) {
    if (whHotkey[i])
        hotkeys(whHotkey[i], { keyup: true, keydown: false }, () => {
            whHotKeyMap[i].el.focus();
        });
}

const whL = [whX0, whY0, whX1, whY1, whW, whH];

for (const xel of whL) {
    const el = xel.el;
    const kd = (e: KeyboardEvent) => {
        if (e.key === "ArrowRight" && el.value.length === el.selectionEnd) {
            e.preventDefault();
            const next = whL[whL.indexOf(xel) + 1]?.el;
            if (next) {
                next.selectionStart = next.selectionEnd = 0;
                next.focus();
            }
        }
        if (e.key === "ArrowLeft" && 0 === el.selectionStart) {
            e.preventDefault();
            const last = whL[whL.indexOf(xel) - 1]?.el;
            if (last) {
                last.selectionStart = last.selectionEnd = last.value.length;
                last.focus();
            }
        }
        let v = 1;
        if (e.ctrlKey) v = v * 5;
        if (e.shiftKey) v = v * 10;
        if (e.key === "ArrowUp" && !Number.isNaN(Number(el.value))) {
            e.preventDefault();
            el.value = String(Number(el.value) + 1 * v);
            changeWH(xel);
        }
        if (e.key === "ArrowDown" && !Number.isNaN(Number(el.value))) {
            e.preventDefault();
            el.value = String(Number(el.value) - 1 * v);
            changeWH(xel);
        }
        if (e.key === "Escape") {
            el.blur();
        }
    };

    xel.on("input", checkWhBarWidth)
        .on("change", () => changeWH(xel))
        .on("keydown", kd);
}

// 快捷键全屏选择
hotkeys("ctrl+a, command+a", () => {
    finalRect = [0, 0, mainCanvas.width, mainCanvas.height];
    hisPush();
    setClipCursor("crosshair");
    direction = "";
    drawClipRect();
});

// 生成取色器
if (!取色器显示) mouseBarColor.style({ display: "none" });

const pointColorCanvasBg = document.createElement("canvas");
pointColorCanvasBg.style.opacity = "0.5";
pointColorCanvasBg.width = pointColorCanvasBg.height = colorSize;
mouseBarColor.add(pointColorCanvasBg);
const pointColorCanvasBgCtx = pointColorCanvasBg.getContext("2d")!;
const pointColorCanvas = document.createElement("canvas");
pointColorCanvas.width = pointColorCanvas.height = colorSize;
mouseBarColor.add(pointColorCanvas);
const pointColorCanvasCtx = pointColorCanvas.getContext("2d", {
    willReadFrequently: true,
})!;
const pointCenter = document.createElement("div");
mouseBarColor.add(pointCenter);
pointCenter.style.left = `${((colorSize - 1) / 2) * colorISize}px`;
pointCenter.style.top = `${((colorSize - 1) / 2) * colorISize}px`;

if (!store.get("鼠标跟随栏.显示")) mouseBarEl.style({ display: "none" });
// 鼠标跟随栏
const mainCanvasContext = mainCanvas.getContext("2d")!;

// 复制坐标
mouseBarXy.on("click", () => {
    copy(mouseBarXy);
});

changeRightBar(false);

hotkeys(store.get("其他快捷键.复制颜色"), () => {
    copy(getColorFormatEl());
});

clipEl.ondblclick = () => {
    if (store.get("鼠标快捷键.双击") === "复制") toolsX.copy.f();
    else toolsX.save.f();
};

document.onmousemove = (e) => {
    nowMouseE = e;
    // 一帧内的多次移动只渲染最后一次
    requestAnimationFrame(() => {
        const ev = nowMouseE;
        renderClip(ev);
        if (!rightKey) {
            // 鼠标跟随栏
            mouseBar(finalRect, e2srcPoint(ev));

            const d = 16;
            const x = Math.round(ev.clientX + d);
            const y = Math.round(ev.clientY + d);
            const w = mouseBarW;
            const h = mouseBarH;
            const sw = window.innerWidth;
            const sh = window.innerHeight;

            let _x = x;
            let _y = y;
            if (x > sw - w - d && y > sh - h - d) {
                _x = x - w - d - d;
                _y = y - h - d - d;
            } else if (x > sw - w - d) {
                _x = sw - w - d;
            } else if (y > sh - h - d) {
                _y = sh - h - d;
            }

            mouseBarX = _x;
            mouseBarY = _y;

            mouseBarEl.style({
                transform: `translate(${_x}px, ${_y}px)`,
            });

            const isDrawBar = drawBar.contains(ev.target as HTMLElement);
            const isToolBar = toolBar.contains(ev.target as HTMLElement);
            const isElementBar = elementBar.el.contains(
                ev.target as HTMLElement,
            );
            const isColorPopover =
                colorPopoverOpen &&
                colorPopover.el.contains(ev.target as HTMLElement);
            const isFontPanel =
                fontPanelOpen &&
                fontPanel.el.contains(ev.target as HTMLElement);
            mouseBarEl.el.classList.toggle(
                "mouse_bar_hide",
                isDrawBar ||
                    isToolBar ||
                    isElementBar ||
                    isColorPopover ||
                    isFontPanel,
            );

            // 画板栏移动
            if (drawBarMovingXY) {
                drawBar.style.left = `${ev.clientX - drawBarMovingXY[0]}px`;
                drawBar.style.top = `${ev.clientY - drawBarMovingXY[1]}px`;
            }
        }
    });
};

drawBar.addEventListener("mousedown", (e) => {
    if (e.button !== 0) {
        drawBarMovingXY = [
            e.clientX - drawBar.offsetLeft,
            e.clientY - drawBar.offsetTop,
        ];
        drawBar.style.transition = "0s";
    }
});
drawBar.addEventListener("mouseup", (e) => {
    if (e.button !== 0) {
        drawBarMovingXY = null;
        drawBar.style.transition = "";
    }
});

drawSideSelect.rect.on("click", () => {
    setEditType("select", "rect");
});
drawSideSelect.free.on("click", () => {
    setEditType("select", "free");
});
drawSideSelect.draw.on("click", () => {
    setEditType("select", "draw");
});

hotkeys("ctrl+z", () => {
    undo(true);
});
hotkeys("ctrl+y", () => {
    undo(false);
});

drawSide操作.撤回.on("click", () => {
    undo(true);
});
drawSide操作.重做.on("click", () => {
    undo(false);
});
drawSide操作.复制.on("click", () => {
    fabricCopy();
});
drawSide操作.删除.on("click", () => {
    fabricDelete();
});

const Filters = filters;

const fabricCanvas = new Canvas("draw_photo", {
    enableRetinaScaling: false,
});
fabricCanvas.setTargetFindTolerance(5);

hisPush();

const fillColor = "#fff";
const strokeColor = "#333";
const strokeWidth = 1;
const freeColor = "#333";
const freeWidth = 2;

const shapePro: setting["图像编辑"]["形状属性"] = {};

for (const [key, filter] of typedEntries(filtetMap)) {
    if (!filter.value) continue;
    const stored = store.get(`图像编辑.形状属性.${key}.value` as never) as
        | number
        | number[]
        | undefined;
    if (stored !== undefined) {
        (filter.value as unknown as { value: number | number[] }).value =
            stored;
    }
}

// 属性栏
let elementBarVisible = false;
let elementBarSide: "right" | "left" | "bottom" | "top" = "right";
let elementBarRaf = 0;
let propertyHistoryTimer: NodeJS.Timeout | undefined;

function schedulePropertyHistory() {
    if (propertyHistoryTimer) clearTimeout(propertyHistoryTimer);
    propertyHistoryTimer = setTimeout(() => {
        propertyHistoryTimer = undefined;
        hisPush();
    }, 250);
}

function setElementBarVisible(v: boolean) {
    elementBarVisible = v;
    elementBar.el.style.display = v ? "block" : "none";
    if (v) scheduleElementBarPosition();
}

function hideElementBar() {
    closeColorPopover();
    closeFontPanel();
    setElementBarVisible(false);
}

let propertyAdvanced = false;

function smallIcon(src: IconType, title: string, f: () => void) {
    return view()
        .class(Class.click)
        .attr({ title: t(title) })
        .add(
            image(getImgUrl(`${src}.svg`), "icon")
                .class("icon")
                .style({ width: "16px", height: "16px" }),
        )
        .on("click", f);
}

function propIcon(kind: "fill" | "stroke" | "corner" | "width", title: string) {
    const el = view()
        .class("prop_icon")
        .class(kind)
        .attr({ title: t(title) });
    if (kind === "fill" || kind === "stroke") {
        const iconSrc = kind === "fill" ? "fill.svg" : "storke.svg";
        el.add(
            image(getImgUrl(iconSrc), "icon")
                .class("icon")
                .style({ width: "16px", height: "16px" }),
        );
    } else if (kind === "width") {
        el.add(txt("线").style({ fontSize: "9px" }));
    }
    return el;
}

function propertyRow(
    label: string | ElType<HTMLElement>,
    control: ElType<HTMLElement>,
) {
    const lead =
        typeof label === "string" ? txt(t(label)).class("prop_label") : label;
    return view("x").class("prop_row").add([lead, control]);
}

function propertyPair(
    labelA: string,
    controlA: ElType<HTMLElement>,
    labelB: string,
    controlB: ElType<HTMLElement>,
) {
    return view("x")
        .class("prop_row")
        .class("prop_pair")
        .add([
            txt(t(labelA)).class("prop_label"),
            controlA,
            txt(t(labelB)).class("prop_label"),
            controlB,
        ]);
}

function commonValue<T>(
    objects: FabricObject[],
    get: (o: FabricObject) => T | undefined,
): T | undefined {
    const values = objects.map(get);
    return values.every((v) => v === values[0]) ? values[0] : undefined;
}

function applyActive(f: (o: FabricObject) => void) {
    const objects = fabricCanvas.getActiveObjects();
    if (!objects.length) return;
    for (const o of objects) {
        f(o);
        o.setCoords();
    }
    fabricCanvas.requestRenderAll();
    schedulePropertyHistory();
    scheduleElementBarPosition();
}

/** 元素属性对应的形状记忆，滤镜图片没有 */
function objectShapeKind(kind: string | null) {
    if (!kind || kind === "filter") return null;
    return (kind === "path" ? "free" : kind) as keyof typeof shapePro;
}

/** 修改选中元素的属性时，同样记为同形状下次的默认属性 */
function applyActiveRemember(
    kind: string | null,
    key: "fc" | "sc" | "sw" | ShapeStyleKey | ArrowStyleKey,
    value: string | number | boolean,
    f: (o: FabricObject) => void,
) {
    applyActive(f);
    const memoryKind = objectShapeKind(kind);
    if (memoryKind) setShapeDefault(memoryKind, key, value);
}

function numberControl(
    get: () => number | undefined,
    set: (v: number) => void,
    step = 1,
    digits = 2,
    min?: number,
    max?: number,
) {
    const precision = 10 ** digits;
    const round = (v: number) => Math.round(v * precision) / precision;
    const fix = (v: number) => {
        const lo = min ?? Number.NEGATIVE_INFINITY;
        const hi = max ?? Number.POSITIVE_INFINITY;
        return round(Math.min(hi, Math.max(lo, v)));
    };
    let value = get();
    const valueEl = txt("", true).class("prop_num_value");
    const show = () => {
        if (value === undefined) {
            valueEl.el.textContent = "—";
            valueEl.el.classList.add("prop_mixed");
        } else {
            valueEl.el.textContent = String(round(value));
            valueEl.el.classList.remove("prop_mixed");
        }
    };
    const setValue = (v: number) => {
        value = fix(v);
        show();
        set(value);
    };
    show();
    const minus = view()
        .class("prop_num_btn")
        .attr({ title: t("减少") })
        .on("pointerdown", (e) => e.stopPropagation())
        .on("click", () => setValue((value ?? 0) - step))
        .add(
            image(getImgUrl("minus.svg"), "icon")
                .class("icon")
                .style({ width: "12px", height: "12px" }),
        );
    const plus = view()
        .class("prop_num_btn")
        .attr({ title: t("增加") })
        .on("pointerdown", (e) => e.stopPropagation())
        .on("click", () => setValue((value ?? 0) + step))
        .add(
            image(getImgUrl("add.svg"), "icon")
                .class("icon")
                .style({ width: "12px", height: "12px" }),
        );
    const el = view("x").class("prop_num").add([minus, valueEl, plus]);
    trackPoint(el, {
        start: () => ({ x: 0, y: 0, data: fix(value ?? 0) }),
        ing: (p, _e, { startData }) => {
            setValue(startData + p.x * step);
        },
    });
    return el;
}

function propertyNumber(
    label: string | ElType<HTMLElement>,
    get: () => number | undefined,
    set: (v: number) => void,
    step = 1,
    digits = 2,
    min?: number,
    max?: number,
) {
    return propertyRow(label, numberControl(get, set, step, digits, min, max));
}

function stepDigits(step: number) {
    const text = String(step);
    const dot = text.indexOf(".");
    return dot === -1 ? 0 : text.length - dot - 1;
}

function propertyRange(
    label: string | ElType<HTMLElement>,
    min: number,
    max: number | undefined,
    step: number,
    get: () => number | undefined,
    set: (v: number) => void,
) {
    return propertyRow(
        label,
        numberControl(get, set, step, stepDigits(step), min, max),
    );
}

function colorControl(get: () => string | undefined, set: (v: string) => void) {
    const swatch = view()
        .style({
            width: "20px",
            height: "20px",
            outline: "1px solid var(--border-color)",
            outlineOffset: "-1px",
            borderRadius: "3px",
        })
        .attr({ title: t("颜色") });
    const color = input().class("prop_color_input");
    const bgGroup = view("x").add(swatch).add(color);
    const alpha = rangeBar(0, 1, 0.01).class("prop_alpha");
    const value = get();
    let c = value ? chroma(value) : chroma("#fff");
    const showColor = (inputColor: chroma.Color) => {
        color.sv(inputColor.hex());
        color.style({ color: pickTextColor(inputColor) });
        bgGroup.style({ "background-color": inputColor.hex() });
    };
    const applyValue = (v: string) => {
        try {
            c = chroma(v);
        } catch {
            return;
        }
        color.el.classList.remove("prop_mixed");
        showColor(c);
        alpha.sv(c.alpha());
        set(c.css());
        schedulePropertyHistory();
    };
    showColor(c);
    alpha.sv(c.alpha());
    if (value === undefined) color.el.classList.add("prop_mixed");
    const apply = () => {
        try {
            applyValue(chroma(color.gv).alpha(alpha.gv).css());
        } catch {}
    };
    color.on("input", apply);
    alpha.on("input", apply);
    swatch.on("click", () =>
        openColorPopover(swatch.el, () => c.css(), applyValue),
    );
    return view("x")
        .style({
            alignItems: "center",
            minWidth: 0,
            borderRadius: "3px",
            overflow: "hidden",
        })
        .add([bgGroup, alpha]);
}

function propertyColor(
    label: string | ElType<HTMLElement>,
    get: () => string | undefined,
    set: (v: string) => void,
) {
    return propertyRow(label, colorControl(get, set));
}

function propertySelect(
    label: string,
    options: { name: string; value: string }[],
    get: () => string | undefined,
    set: (v: string) => void,
) {
    const buttons = options.map((item) => ({
        value: item.value,
        el: view()
            .class("prop_option")
            .attr({ title: t(item.name) })
            .add(txt(item.name))
            .on("click", () => {
                if (get() === item.value) return;
                set(item.value);
                sync(item.value);
                schedulePropertyHistory();
            }),
    }));
    const sync = (v: string | undefined) => {
        for (const b of buttons)
            b.el.el.classList.toggle("selected", b.value === v);
    };
    sync(get());
    return propertyRow(
        label,
        view("x")
            .class("prop_options")
            .add(buttons.map((b) => b.el)),
    );
}

function propertyInput(
    label: string | ElType<HTMLElement>,
    get: () => string | undefined,
    set: (v: string) => void,
) {
    const i = input();
    const v = get();
    if (v !== undefined) i.sv(v);
    i.on("input", () => {
        set(i.gv);
        schedulePropertyHistory();
    });
    return propertyRow(label, i);
}

/** 本地字体列表，首次打开时加载 */
let localFonts: string[] | null = null;
async function getLocalFonts() {
    if (localFonts) return localFonts;
    try {
        const fonts = await (
            window as unknown as {
                queryLocalFonts?: () => Promise<
                    { fullName: string; family: string }[]
                >;
            }
        ).queryLocalFonts?.();
        localFonts = Array.from(
            new Set((fonts ?? []).flatMap((f) => [f.fullName, f.family])),
        )
            .filter(Boolean)
            .sort();
    } catch {
        localFonts = [];
    }
    return localFonts;
}

const fontItemHeight = 24;
let fontPanelOpen = false;
let fontPanelOwner: HTMLElement | null = null;
let fontPanelButton: HTMLElement | null = null;
let fontPanelTarget: ((v: string) => void) | null = null;
let fontPanelValue = "";
let fontList: string[] = [];
let fontRenderFrame = 0;

const fontPanel = view("y")
    .attr({ id: "font_panel" })
    .class(Class.gap, Class.glassBar)
    .style({
        position: "fixed",
        inset: "auto",
        display: "none",
        margin: 0,
        padding: "4px",
        width: "240px",
        maxHeight: "calc(100vh - 8px)",
        overflow: "hidden",
        color: "var(--font-color)",
        borderRadius: "var(--border-radius)",
        boxShadow: "var(--shadow)",
        visibility: "hidden",
        zIndex: "120",
    })
    .addInto();
const fontSearch = input()
    .attr({ placeholder: t("搜索字体") })
    .style({ width: "100%", height: "24px", fontSize: "12px" })
    .on("input", () => renderFonts(true));
const fontScroll = view().style({
    position: "relative",
    height: "260px",
    maxHeight: "calc(100vh - 60px)",
    overflowY: "auto",
});
const fontSpacer = view().style({ position: "relative" });
fontScroll.add(fontSpacer);
fontPanel.add([fontSearch, fontScroll]);
fontScroll.on("scroll", () => {
    if (fontRenderFrame) return;
    fontRenderFrame = requestAnimationFrame(() => {
        fontRenderFrame = 0;
        renderFonts();
    });
});

function renderFonts(reset = false) {
    if (reset) {
        const query = fontSearch.gv.trim().toLowerCase();
        const all = localFonts ?? [];
        fontList = query
            ? all.filter((f) => f.toLowerCase().includes(query))
            : all;
        fontScroll.el.scrollTop = 0;
    }
    const height = fontScroll.el.clientHeight || 260;
    const start = Math.max(
        0,
        Math.floor(fontScroll.el.scrollTop / fontItemHeight) - 4,
    );
    const end = Math.min(
        fontList.length,
        start + Math.ceil(height / fontItemHeight) + 8,
    );
    fontSpacer.style({ height: `${fontList.length * fontItemHeight}px` });
    fontSpacer.clear();
    for (let n = start; n < end; n++) {
        const name = fontList[n];
        fontSpacer.add(
            view("x")
                .class("font_item")
                .style({
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${n * fontItemHeight}px`,
                    height: `${fontItemHeight}px`,
                    alignItems: "center",
                    background:
                        name === fontPanelValue ? "var(--bar-focus-color)" : "",
                })
                .add(txt(name, true))
                .on("click", () => {
                    fontPanelTarget?.(name);
                    closeFontPanel();
                }),
        );
    }
}

function positionFontPanel() {
    if (!fontPanelOpen || !fontPanelOwner) return;
    const rect = fontPanelOwner.getBoundingClientRect();
    const width = fontPanel.el.offsetWidth;
    const height = fontPanel.el.offsetHeight;
    const gap = 4;
    const margin = 4;
    let left = rect.right + gap;
    let top = rect.top;
    if (left + width > window.innerWidth - margin) {
        left = rect.left;
        top = rect.bottom + gap;
        if (top + height > window.innerHeight - margin) {
            top = rect.top - height - gap;
        }
    }
    fontPanel.style({
        left: `${Math.max(
            margin,
            Math.min(window.innerWidth - width - margin, left),
        )}px`,
        top: `${Math.max(
            margin,
            Math.min(window.innerHeight - height - margin, top),
        )}px`,
        visibility: "visible",
    });
}

function onFontOutside(e: PointerEvent) {
    const target = e.target as Node | null;
    if (!target) return;
    if (fontPanel.el.contains(target) || fontPanelButton?.contains(target))
        return;
    closeFontPanel();
}

function onFontKey(e: KeyboardEvent) {
    if (e.key === "Escape") closeFontPanel();
}

function closeFontPanel() {
    if (!fontPanelOpen) return;
    fontPanelOpen = false;
    fontPanel.style({ display: "none", visibility: "hidden" });
    fontPanelOwner = null;
    fontPanelButton = null;
    fontPanelTarget = null;
    document.removeEventListener("pointerdown", onFontOutside, true);
    document.removeEventListener("keydown", onFontKey, true);
    window.removeEventListener("resize", positionFontPanel);
    document.removeEventListener("scroll", positionFontPanel, true);
}

async function openFontPanel(
    owner: HTMLElement,
    buttonEl: HTMLElement,
    value: string,
    apply: (v: string) => void,
) {
    if (fontPanelOpen) closeFontPanel();
    fontPanelOpen = true;
    fontPanelOwner = owner;
    fontPanelButton = buttonEl;
    fontPanelTarget = apply;
    fontPanelValue = value;
    fontSearch.sv("");
    fontPanel.style({ display: "flex" });
    renderFonts(true);
    positionFontPanel();
    document.addEventListener("pointerdown", onFontOutside, true);
    document.addEventListener("keydown", onFontKey, true);
    window.addEventListener("resize", positionFontPanel);
    document.addEventListener("scroll", positionFontPanel, true);
    await getLocalFonts();
    if (!fontPanelOpen) return;
    renderFonts(true);
    const index = fontList.indexOf(fontPanelValue);
    if (index >= 0) {
        fontScroll.el.scrollTop = Math.max(
            0,
            index * fontItemHeight -
                fontScroll.el.clientHeight / 2 +
                fontItemHeight / 2,
        );
        renderFonts();
        positionFontPanel();
    }
    fontSearch.el.focus();
}

function propertyFont(
    label: string,
    get: () => string | undefined,
    set: (v: string) => void,
) {
    const valueEl = input().class("prop_font_value");
    const current = get();
    valueEl.sv(current ?? "");
    const update = (v: string, syncInput: boolean) => {
        if (syncInput) valueEl.sv(v);
        set(v);
        schedulePropertyHistory();
    };
    valueEl.on("input", () => update(valueEl.gv, false));
    const pick = button()
        .class("prop_font_btn")
        .attr({ title: t("选择字体") })
        .add(
            image(getImgUrl("search.svg"), "icon")
                .class("icon")
                .style({ width: "14px", height: "14px" }),
        );
    const control = view("x").class("prop_font").add([valueEl, pick]);
    pick.on("click", () => {
        if (fontPanelOpen && fontPanelOwner === control.el) {
            closeFontPanel();
            return;
        }
        openFontPanel(control.el, pick.el, valueEl.gv, (v) => update(v, true));
    });
    return propertyRow(label, control);
}

function propertyText(
    label: string,
    get: () => string | undefined,
    set: (v: string) => void,
) {
    const ta = textarea();
    const v = get();
    if (v !== undefined) ta.el.value = v;
    ta.on("input", () => {
        set(ta.gv);
        schedulePropertyHistory();
    });
    return propertyRow(label, ta).style({ alignItems: "flex-start" });
}

function toggleButton(
    icon: IconType,
    title: string,
    get: () => boolean,
    set: (v: boolean) => void,
) {
    const b = button()
        .class("prop_toggle")
        .attr({ title: t(title) })
        .add(
            image(getImgUrl(`${icon}.svg`), "icon")
                .class("icon")
                .style({ width: "16px", height: "16px" }),
        );
    const sync = () => {
        b.el.classList.toggle("selected", get());
    };
    b.on("click", () => {
        set(!get());
        sync();
        schedulePropertyHistory();
    });
    sync();
    return b;
}

function lineEndpoint(o: Polyline, index: "start" | "end") {
    const point =
        index === "start" ? o.points[0] : o.points[o.points.length - 1];
    return new Point(point).subtract(o.pathOffset).transform(o.calcOwnMatrix());
}

function setLineEndpoint(
    o: Polyline,
    index: "start" | "end",
    axis: "x" | "y",
    value: number,
) {
    const pointIndex = index === "start" ? 0 : o.points.length - 1;
    const anchorIndex = pointIndex === 0 ? o.points.length - 1 : 0;
    const matrix = o.calcOwnMatrix();
    const anchorBefore = new Point(o.points[anchorIndex])
        .subtract(o.pathOffset)
        .transform(matrix);
    const point = lineEndpoint(o, index);
    point[axis] = value;
    o.points[pointIndex] = util
        .sendPointToPlane(point, undefined, matrix)
        .add(o.pathOffset);
    o.setDimensions();
    const anchorAfter = new Point(o.points[anchorIndex])
        .subtract(o.pathOffset)
        .transform(o.calcOwnMatrix());
    const diff = anchorAfter.subtract(anchorBefore);
    o.set({ left: o.left - diff.x, top: o.top - diff.y });
    o.setCoords();
    o.set("dirty", true);
}

function addLineEndpoints(o: Polyline) {
    elementBarBody.add([
        propertyPair(
            "起点X",
            numberControl(
                () => lineEndpoint(o, "start").x,
                (v) =>
                    applyActive((x) =>
                        setLineEndpoint(x as Polyline, "start", "x", v),
                    ),
                1,
                0,
            ),
            "起点Y",
            numberControl(
                () => lineEndpoint(o, "start").y,
                (v) =>
                    applyActive((x) =>
                        setLineEndpoint(x as Polyline, "start", "y", v),
                    ),
                1,
                0,
            ),
        ),
        propertyPair(
            "终点X",
            numberControl(
                () => lineEndpoint(o, "end").x,
                (v) =>
                    applyActive((x) =>
                        setLineEndpoint(x as Polyline, "end", "x", v),
                    ),
                1,
                0,
            ),
            "终点Y",
            numberControl(
                () => lineEndpoint(o, "end").y,
                (v) =>
                    applyActive((x) =>
                        setLineEndpoint(x as Polyline, "end", "y", v),
                    ),
                1,
                0,
            ),
        ),
    ]);
}

function getObjectKind(o: FabricObject): string {
    if (o.形状) return o.形状;
    if (o.type === "i-text" || o.type === "textbox") return "text";
    if (o.type === "path") return "path";
    if (o.type === "image") return "filter";
    return o.type;
}

function kindTitle(kind: string | null) {
    const names: Record<string, string> = {
        rect: "矩形",
        circle: "圆",
        line: "线条",
        polyline: "折线",
        polygon: "多边形",
        text: "文字",
        number: "序号",
        arrow: "箭头",
        mask: "遮罩",
        path: "画笔",
        filter: "滤镜",
    };
    return kind ? t(names[kind] ?? kind) : "";
}

function setShapeDefault(
    kind: keyof typeof shapePro,
    key:
        | "fc"
        | "sc"
        | "sw"
        | "shadow"
        | "value"
        | ShapeStyleKey
        | ArrowStyleKey,
    value: string | number | boolean | number[],
) {
    const pro = shapePro[kind] ?? {};
    (pro as Record<string, unknown>)[key] = value;
    shapePro[kind] = pro;
    store.set(`图像编辑.形状属性.${kind}.${key}` as never, value as never);
}

function addHeader(
    title: string,
    options: {
        close?: boolean;
        copy?: boolean;
        remove?: boolean;
        advanced?: boolean;
    } = {},
) {
    const list: ElType<HTMLElement>[] = [txt(title)];
    if (options.advanced) {
        const advanced = smallIcon("setting", "高级", () => {
            propertyAdvanced = !propertyAdvanced;
            refreshPropertyPanel();
        });
        if (propertyAdvanced)
            advanced.style({ background: "var(--bar-focus-color)" });
        list.push(advanced);
    }
    if (options.copy) {
        list.push(smallIcon("copy", "复制", () => fabricCopy()));
    }
    if (options.remove) {
        list.push(smallIcon("delete", "删除", () => fabricDelete()));
    }
    if (options.close) {
        list.push(
            smallIcon("close", "关闭", () => {
                fabricCanvas.discardActiveObject();
                hideElementBar();
            }),
        );
    }
    elementBarHeader.clear().add(list);
}

function renderShapeToolPanel(kind: EditType["shape"]) {
    addHeader(`${kindTitle(kind)} · 默认`);
    const fill = (v: string) => {
        setShapeDefault(kind, "fc", v);
    };
    const stroke = (v: string) => {
        setShapeDefault(kind, "sc", v);
    };
    const width = (v: number) => {
        setShapeDefault(kind, "sw", v);
    };

    if (!["line", "arrow", "polyline"].includes(kind))
        elementBarBody.add(
            propertyColor(
                propIcon("fill", kind === "text" ? "文字颜色" : "填充"),
                () => getShapePro(kind).fc,
                fill,
            ),
        );
    if (kind !== "mask" && kind !== "text") {
        elementBarBody.add(
            propertyColor(
                propIcon("stroke", "描边"),
                () => getShapePro(kind).sc,
                stroke,
            ),
        );
        elementBarBody.add(
            propertyRange(
                propIcon("width", "线宽"),
                0,
                undefined,
                1,
                () => getShapePro(kind).sw,
                width,
            ),
        );
        elementBarBody.add(
            propertySelect(
                "虚线",
                dashOptions,
                () => getShapePro(kind).dash,
                (v) => setShapeDefault(kind, "dash", v),
            ),
        );
    }

    if (kind === "rect" || kind === "mask") {
        elementBarBody.add(
            propertyNumber(
                propIcon("corner", kind === "mask" ? "洞口圆角" : "圆角"),
                () => getShapePro(kind).rx,
                (v) => setShapeDefault(kind, "rx", v),
                1,
                0,
                0,
            ),
        );
        if (kind === "mask")
            elementBarBody.add(
                propertyNumber(
                    "羽化",
                    () => getShapePro(kind).feather,
                    (v) => setShapeDefault(kind, "feather", v),
                    1,
                    0,
                    0,
                ),
            );
    }

    if (kind === "text") {
        elementBarBody.add([
            propertyFont(
                "字体",
                () => getShapePro("text").fontFamily,
                (v) => setShapeDefault("text", "fontFamily", v),
            ),
            propertyNumber(
                "字号",
                () => getShapePro("text").fontSize,
                (v) => setShapeDefault("text", "fontSize", v),
                1,
                0,
                0,
            ),
            propertyRow(
                "样式",
                view("x")
                    .style({ gap: "2px", alignItems: "center" })
                    .add([
                        toggleButton(
                            "bold",
                            "加粗",
                            () => getShapePro("text").fontWeight === "bold",
                            (v) =>
                                setShapeDefault(
                                    "text",
                                    "fontWeight",
                                    v ? "bold" : "normal",
                                ),
                        ),
                        toggleButton(
                            "italic",
                            "斜体",
                            () => getShapePro("text").fontStyle === "italic",
                            (v) =>
                                setShapeDefault(
                                    "text",
                                    "fontStyle",
                                    v ? "italic" : "normal",
                                ),
                        ),
                        toggleButton(
                            "underline",
                            "下划线",
                            () => getShapePro("text").underline === true,
                            (v) => setShapeDefault("text", "underline", v),
                        ),
                    ]),
            ),
            propertySelect(
                "对齐",
                [
                    { name: "左", value: "left" },
                    { name: "中", value: "center" },
                    { name: "右", value: "right" },
                ],
                () => getShapePro("text").textAlign,
                (v) => setShapeDefault("text", "textAlign", v),
            ),
            propertyNumber(
                "行高",
                () => getShapePro("text").lineHeight,
                (v) => setShapeDefault("text", "lineHeight", v),
                0.01,
                2,
                0,
            ),
            propertyNumber(
                "字距",
                () => getShapePro("text").charSpacing,
                (v) => setShapeDefault("text", "charSpacing", v),
                1,
                0,
            ),
        ]);
    }

    if (kind === "number") {
        elementBarBody.add([
            propertyNumber(
                "字号",
                () => getShapePro("number").fontSize,
                (v) => setShapeDefault("number", "fontSize", v),
                1,
                0,
                0,
            ),
            propertyNumber(
                "半径",
                () => getShapePro("number").radius,
                (v) => setShapeDefault("number", "radius", v),
                1,
                0,
                0,
            ),
        ]);
    }

    if (kind === "arrow") {
        elementBarBody.add([
            propertyNumber(
                "头宽",
                () => getArrowPro().arrowW,
                (v) => setShapeDefault("arrow", "arrowW", v),
                1,
                0,
                0,
            ),
            propertyNumber(
                "头高",
                () => getArrowPro().arrowH,
                (v) => setShapeDefault("arrow", "arrowH", v),
                1,
                0,
                0,
            ),
            propertySelect(
                "样式",
                [
                    { name: "实心", value: "fill" },
                    { name: "空心", value: "stroke" },
                ],
                () => getArrowPro().arrowType,
                (v) =>
                    setShapeDefault(
                        "arrow",
                        "arrowType",
                        v as "fill" | "stroke",
                    ),
            ),
        ]);
    }
    setElementBarVisible(true);
}

function renderDrawToolPanel(modeType: EditType["draw"]) {
    addHeader(
        `${modeType === "eraser" ? "橡皮" : modeType === "spray" ? "喷刷" : "画笔"} · 默认`,
    );
    if (modeType !== "eraser")
        elementBarBody.add(
            propertyColor(
                propIcon("stroke", "颜色"),
                () => getShapePro(modeType).sc,
                (v) => setFreePro("sc", v),
            ),
        );
    elementBarBody.add([
        propertyRange(
            propIcon("width", "粗细"),
            0,
            undefined,
            1,
            () => getShapePro(modeType).sw,
            (v) => setFreePro("sw", v),
        ),
        propertyRange(
            "阴影",
            0,
            undefined,
            1,
            () => getShapePro(modeType).shadow ?? 0,
            (v) => {
                setShapeDefault(modeType, "shadow", v);
                freeShadow();
            },
        ),
    ]);
    setElementBarVisible(true);
}

function renderFilterToolPanel() {
    if (!willFilter) {
        hideElementBar();
        return;
    }
    addHeader("滤镜 · 默认");
    const filterKey = willFilter;
    const f = filtetMap[filterKey];
    if (f.value) {
        elementBarBody.add(
            propertyRange(
                "强度",
                f.value.min ?? 0,
                f.value.max,
                f.value.step ?? 1,
                () => f.value?.value,
                (v) => {
                    f.value!.value = v;
                    setShapeDefault(filterKey, "value", v);
                },
            ),
        );
    }
    setElementBarVisible(true);
}

function renderToolPropertyPanel() {
    closeFontPanel();
    elementBarHeader.clear();
    elementBarBody.clear();
    if (nowType === "shape" && shape) {
        renderShapeToolPanel(shape);
    } else if (nowType === "draw" && mode) {
        renderDrawToolPanel(mode);
    } else if (nowType === "filter") {
        renderFilterToolPanel();
    } else {
        hideElementBar();
        return;
    }
}

function renderElementPropertyPanel(objects: FabricObject[]) {
    closeFontPanel();
    const kinds = new Set(objects.map(getObjectKind));
    const kind = kinds.size === 1 ? [...kinds][0] : null;
    const single = objects.length === 1;
    addHeader(single ? kindTitle(kind) : `${objects.length} 个元素`, {
        close: true,
        copy: true,
        remove: true,
        advanced: single,
    });
    elementBarBody.clear();

    if (single && propertyAdvanced) {
        const o = objects[0];
        const geometry: ElType<HTMLElement>[] = [
            propertyPair(
                "X",
                numberControl(
                    () => o.left,
                    (v) => applyActive((x) => x.set({ left: v })),
                    1,
                    0,
                ),
                "Y",
                numberControl(
                    () => o.top,
                    (v) => applyActive((x) => x.set({ top: v })),
                    1,
                    0,
                ),
            ),
        ];
        if (
            ["rect", "circle", "ellipse", "filter", "mask"].includes(kind ?? "")
        ) {
            geometry.push(
                propertyPair(
                    "宽",
                    numberControl(
                        () => o.getScaledWidth(),
                        (v) =>
                            applyActive((x) => {
                                if (x.width) x.set({ scaleX: v / x.width });
                            }),
                        1,
                        0,
                        0,
                    ),
                    "高",
                    numberControl(
                        () => o.getScaledHeight(),
                        (v) =>
                            applyActive((x) => {
                                if (x.height) x.set({ scaleY: v / x.height });
                            }),
                        1,
                        0,
                        0,
                    ),
                ),
            );
        }
        geometry.push(
            propertyNumber(
                "角度",
                () => o.angle,
                (v) => applyActive((x) => x.set({ angle: v })),
                1,
                1,
            ),
        );
        elementBarBody.add(geometry);
        if (kind === "line" || kind === "arrow")
            addLineEndpoints(objects[0] as Polyline);
    }

    const canFill = objects.every((o) => o.canChangeFill);
    const canStroke = objects.every(
        (o) => !["mask", "filter", "text"].includes(getObjectKind(o) ?? ""),
    );
    if (canFill)
        elementBarBody.add(
            propertyColor(
                propIcon("fill", kind === "text" ? "文字颜色" : "填充"),
                () => commonValue(objects, (o) => o.fill?.toString()),
                (v) =>
                    applyActiveRemember(kind, "fc", v, (o) => o.set("fill", v)),
            ),
        );
    if (canStroke) {
        elementBarBody.add([
            propertyColor(
                propIcon("stroke", "描边"),
                () => commonValue(objects, (o) => o.stroke?.toString()),
                (v) =>
                    applyActiveRemember(kind, "sc", v, (o) =>
                        o.set("stroke", v),
                    ),
            ),
            propertyRange(
                propIcon("width", "线宽"),
                0,
                undefined,
                1,
                () => commonValue(objects, (o) => o.strokeWidth),
                (v) =>
                    applyActiveRemember(kind, "sw", v, (o) =>
                        o.set("strokeWidth", v),
                    ),
            ),
        ]);
        if (single) {
            elementBarBody.add(
                propertySelect(
                    "虚线",
                    dashOptions,
                    () => {
                        const dash = (objects[0] as FabricObject)
                            .strokeDashArray;
                        if (!dash) return "solid";
                        return dash[0] <= 2 ? "dot" : "dash";
                    },
                    (v) =>
                        applyActiveRemember(kind, "dash", v, (o) =>
                            o.set("strokeDashArray", dashArray(v)),
                        ),
                ),
            );
        }
    }

    if (single && kind) {
        const o = objects[0];
        if (kind === "text") {
            elementBarBody.add([
                propertyText(
                    "内容",
                    () => (o as IText).text,
                    (v) =>
                        applyActive((x) => {
                            const t = x as IText;
                            t.set("text", v);
                            t.initDimensions();
                        }),
                ),
                propertyFont(
                    "字体",
                    () => (o as IText).fontFamily,
                    (v) =>
                        applyActiveRemember(kind, "fontFamily", v, (x) => {
                            const t = x as IText;
                            t.set("fontFamily", v);
                            t.initDimensions();
                        }),
                ),
                propertyNumber(
                    "字号",
                    () => (o as IText).fontSize,
                    (v) =>
                        applyActiveRemember(kind, "fontSize", v, (x) => {
                            const t = x as IText;
                            t.set("fontSize", v);
                            t.initDimensions();
                        }),
                    1,
                    0,
                    0,
                ),
                propertyRow(
                    "样式",
                    view("x")
                        .style({ gap: "2px", alignItems: "center" })
                        .add([
                            toggleButton(
                                "bold",
                                "加粗",
                                () => (o as IText).fontWeight === "bold",
                                (v) =>
                                    applyActiveRemember(
                                        kind,
                                        "fontWeight",
                                        v ? "bold" : "normal",
                                        (x) => {
                                            const t = x as IText;
                                            t.set(
                                                "fontWeight",
                                                v ? "bold" : "normal",
                                            );
                                            t.initDimensions();
                                        },
                                    ),
                            ),
                            toggleButton(
                                "italic",
                                "斜体",
                                () => (o as IText).fontStyle === "italic",
                                (v) =>
                                    applyActiveRemember(
                                        kind,
                                        "fontStyle",
                                        v ? "italic" : "normal",
                                        (x) => {
                                            const t = x as IText;
                                            t.set(
                                                "fontStyle",
                                                v ? "italic" : "normal",
                                            );
                                            t.initDimensions();
                                        },
                                    ),
                            ),
                            toggleButton(
                                "underline",
                                "下划线",
                                () => (o as IText).underline === true,
                                (v) =>
                                    applyActiveRemember(
                                        kind,
                                        "underline",
                                        v,
                                        (x) => {
                                            const t = x as IText;
                                            t.set("underline", v);
                                            t.initDimensions();
                                        },
                                    ),
                            ),
                        ]),
                ),
                propertySelect(
                    "对齐",
                    [
                        { name: "左", value: "left" },
                        { name: "中", value: "center" },
                        { name: "右", value: "right" },
                    ],
                    () => (o as IText).textAlign,
                    (v) =>
                        applyActiveRemember(kind, "textAlign", v, (x) =>
                            x.set("textAlign", v),
                        ),
                ),
                propertyNumber(
                    "行高",
                    () => (o as IText).lineHeight,
                    (v) =>
                        applyActiveRemember(kind, "lineHeight", v, (x) => {
                            const t = x as IText;
                            t.set("lineHeight", v);
                            t.initDimensions();
                        }),
                    0.01,
                    2,
                    0,
                ),
                propertyNumber(
                    "字距",
                    () => (o as IText).charSpacing,
                    (v) =>
                        applyActiveRemember(kind, "charSpacing", v, (x) => {
                            const t = x as IText;
                            t.set("charSpacing", v);
                            t.initDimensions();
                        }),
                    1,
                    0,
                ),
            ]);
        } else if (kind === "number") {
            const n = o as xnumber;
            elementBarBody.add([
                propertyNumber(
                    "数值",
                    () => Number(n.text),
                    (v) => applyActive((x) => x.set("text", String(v))),
                ),
                propertyNumber(
                    "字号",
                    () => n.fontSize,
                    (v) =>
                        applyActiveRemember(kind, "fontSize", v, (x) =>
                            x.set("fontSize", v),
                        ),
                    1,
                    0,
                    0,
                ),
                propertyNumber(
                    "半径",
                    () => n.radius,
                    (v) =>
                        applyActiveRemember(kind, "radius", v, (x) =>
                            x.set("radius", v),
                        ),
                    1,
                    0,
                    0,
                ),
            ]);
        } else if (kind === "arrow") {
            const a = o as arrow;
            elementBarBody.add([
                propertyNumber(
                    "头宽",
                    () => a.arrowW,
                    (v) =>
                        applyActiveRemember(kind, "arrowW", v, (x) =>
                            x.set("arrowW", v),
                        ),
                    1,
                    0,
                    0,
                ),
                propertyNumber(
                    "头高",
                    () => a.arrowH,
                    (v) =>
                        applyActiveRemember(kind, "arrowH", v, (x) =>
                            x.set("arrowH", v),
                        ),
                    1,
                    0,
                    0,
                ),
                propertySelect(
                    "样式",
                    [
                        { name: "实心", value: "fill" },
                        { name: "空心", value: "stroke" },
                    ],
                    () => a.arrowType,
                    (v) =>
                        applyActiveRemember(kind, "arrowType", v, (x) =>
                            x.set("arrowType", v),
                        ),
                ),
            ]);
        } else if (kind === "rect" || kind === "mask") {
            const r = o as Rect;
            elementBarBody.add(
                propertyNumber(
                    propIcon("corner", kind === "mask" ? "洞口圆角" : "圆角"),
                    () => r.rx || 0,
                    (v) =>
                        applyActiveRemember(kind, "rx", v, (x) =>
                            x.set({ rx: v, ry: v }),
                        ),
                    1,
                    0,
                    0,
                ),
            );
            if (kind === "mask")
                elementBarBody.add(
                    propertyNumber(
                        "羽化",
                        () => (o as mask).feather ?? 0,
                        (v) =>
                            applyActiveRemember(
                                kind,
                                "feather",
                                Math.max(0, v),
                                (x) => x.set("feather", Math.max(0, v)),
                            ),
                        1,
                        0,
                        0,
                    ),
                );
        } else if (kind === "filter") {
            const img = o as FabricImage;
            const values = Object.values(filtetMap);
            values.forEach((fl, index) => {
                if (!fl.value) return;
                const filter = img.filters?.[index];
                if (!filter) return;
                const value = Object.values(filter).find(
                    (v) => typeof v === "number",
                );
                if (typeof value !== "number") return;
                const filterKey = typedKeys(filtetMap)[index];
                elementBarBody.add(
                    propertyRange(
                        "强度",
                        fl.value.min ?? 0,
                        fl.value.max,
                        fl.value.step ?? 1,
                        () => value,
                        (v) => {
                            fl.value!.value = v;
                            applyFilter(index, fl.fun(v));
                            setShapeDefault(filterKey, "value", v);
                            schedulePropertyHistory();
                        },
                    ),
                );
            });
        }
    }

    setElementBarVisible(true);
}

function refreshPropertyPanel() {
    closeColorPopover();
    if (!fabricCanvas) return;
    const objects = fabricCanvas.getActiveObjects();
    if (!objects.length) {
        renderToolPropertyPanel();
        return;
    }
    renderElementPropertyPanel(objects);
}

function scheduleElementBarPosition() {
    if (!elementBarVisible || elementBarRaf) return;
    elementBarRaf = requestAnimationFrame(() => {
        elementBarRaf = 0;
        positionElementBar();
    });
}

function positionElementBar() {
    if (!elementBarVisible) return;
    const objects = fabricCanvas.getActiveObjects();
    const toolMode = objects.length === 0;
    let r: { left: number; top: number; width: number; height: number };
    if (toolMode) {
        const bar = drawBar.getBoundingClientRect();
        const sideVisible =
            !drawBarSideEl.el.classList.contains("draw_side_hide");
        const side = sideVisible
            ? drawBarSideEl.el.getBoundingClientRect()
            : undefined;
        const left = Math.min(bar.left, side?.left ?? bar.left);
        const top = Math.min(bar.top, side?.top ?? bar.top);
        const right = Math.max(bar.right, side?.right ?? bar.right);
        const bottom = Math.max(bar.bottom, side?.bottom ?? bar.bottom);
        r = {
            left,
            top,
            width: right - left,
            height: bottom - top,
        };
    } else {
        const rects = objects.map((o) => o.getBoundingRect());
        const left = Math.min(...rects.map((i) => i.left));
        const top = Math.min(...rects.map((i) => i.top));
        const right = Math.max(...rects.map((i) => i.left + i.width));
        const bottom = Math.max(...rects.map((i) => i.top + i.height));
        r = {
            left: (left + editorP.x) * editorP.zoom,
            top: (top + editorP.y) * editorP.zoom,
            width: (right - left) * editorP.zoom,
            height: (bottom - top) * editorP.zoom,
        };
    }
    const margin = 8;
    const gap = 8;
    const w = elementBar.el.offsetWidth || 180;
    const h = elementBar.el.offsetHeight || 100;
    const maxX = window.innerWidth - w - margin;
    const maxY = window.innerHeight - h - margin;
    const space = {
        right: window.innerWidth - (r.left + r.width) - gap,
        left: r.left - gap,
        bottom: window.innerHeight - (r.top + r.height) - gap,
        top: r.top - gap,
    };
    const order: (keyof typeof space)[] = toolMode
        ? ["bottom", "top"]
        : elementBarSide === "left"
          ? ["left", "right", "bottom", "top"]
          : elementBarSide === "bottom"
            ? ["bottom", "top", "right", "left"]
            : elementBarSide === "top"
              ? ["top", "bottom", "right", "left"]
              : ["right", "left", "bottom", "top"];
    const fits = (side: keyof typeof space) =>
        side === "right" || side === "left"
            ? space[side] >= w
            : space[side] >= h;
    const side =
        order.find(fits) ?? order.sort((a, b) => space[b] - space[a])[0];
    elementBarSide = side;
    let x = 0;
    let y = 0;
    if (side === "right") {
        x = r.left + r.width + gap;
        y = r.top;
    } else if (side === "left") {
        x = r.left - w - gap;
        y = r.top;
    } else if (side === "bottom") {
        x = r.left;
        y = r.top + r.height + gap;
    } else {
        x = r.left;
        y = r.top - h - gap;
    }
    x = Math.max(margin, Math.min(maxX, x));
    y = Math.max(margin, Math.min(maxY, y));
    elementBar.el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}

fabricCanvas.on("selection:created", refreshPropertyPanel);
fabricCanvas.on("selection:updated", refreshPropertyPanel);
fabricCanvas.on("selection:cleared", refreshPropertyPanel);
fabricCanvas.on("object:moving", scheduleElementBarPosition);
fabricCanvas.on("object:scaling", scheduleElementBarPosition);
fabricCanvas.on("object:rotating", scheduleElementBarPosition);
fabricCanvas.on("object:modified", refreshPropertyPanel);
new ResizeObserver(scheduleElementBarPosition).observe(elementBar.el);
window.addEventListener("resize", scheduleElementBarPosition);

// 编辑栏
const drawMainBar = drawBarMainEl.el;
const drawSideBar = drawBarSideEl.el;
showSideBar(false);
new ResizeObserver(scheduleElementBarPosition).observe(drawBarSideEl.el);

for (const tool of drawMainTools) {
    const e = tool.el;
    const category = tool.category;
    if (category === "select" || category === "more") {
        e.on("mouseenter", () => {
            // 用于防误触，防经过时误切换
            willShowITime = setTimeout(() => {
                showSideBarByCategory(category);
            }, 100);
        });
        e.on("pointerleave", () => {
            clearTimeout(willShowITime);
            setTimeout(() => {
                if (!isInDrawBar()) {
                    showSideBar(false);
                }
            }, 100);
        });
        e.on("contextmenu", (ev) => {
            ev.preventDefault();
            showSideBarByCategory(category);
        });
        if (category === "select") {
            e.on("click", () => {
                tool.run?.();
            });
        }
    } else {
        e.on("mouseenter", () => {
            clearTimeout(willShowITime);
            showSideBar(false);
        });
        e.on("click", () => {
            tool.run?.();
        });
    }
}

for (const el of drawBarSideElChildren) {
    el.el.on("pointerleave", () => {
        setTimeout(() => {
            if (!isInDrawBar()) showSideBar(false);
        }, 100);
    });
}

showBars(isShowBars);

hotkeys(store.get("其他快捷键.隐藏或显示栏"), () => {
    isShowBars = !isShowBars;
    showBars(isShowBars);
});

// 笔
drawSideFree.pencil.on("click", () => setEditType("draw", "free"));
// 橡皮
drawSideFree.eraser.on("click", () => setEditType("draw", "eraser"));
// 刷
drawSideFree.spray.on("click", () => setEditType("draw", "spray"));

// 几何
for (const [k, el] of Object.entries(drawSideShapes)) {
    el.on("click", () => {
        setEditType("shape", k as EditType["shape"]);
    });
}
// 层叠位置
drawSidePosition.front.on("click", () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) fabricCanvas.bringObjectToFront(activeObject);
});
drawSidePosition.forwards.on("click", () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) fabricCanvas.bringObjectForward(activeObject);
});
drawSidePosition.backwards.on("click", () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) fabricCanvas.sendObjectBackwards(activeObject);
});
drawSidePosition.back.on("click", () => {
    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) fabricCanvas.sendObjectToBack(activeObject);
});

// 删除快捷键
hotkeys("delete", fabricDelete);

fabricCanvas.on("mouse:down", (options) => {
    if (
        shape !== "" &&
        (shape === "number" || unnormalShapes.includes(shape)) &&
        (options.e as MouseEvent).detail > 1
    ) {
        return;
    }
    // 非常规状态下点击
    if (shape !== "" && !options.target) {
        drawingShape = true;
        fabricCanvas.selection = false;
        const x = options.viewportPoint.x;
        const y = options.viewportPoint.y;
        if (shape === "number") {
            drawNumber({ x, y });
        } else if (!unnormalShapes.includes(shape)) {
            drawOP = [x, y];
            draw(shape, "start", drawOP[0], drawOP[1], x, y);
        } else {
            // 定义最后一个点,双击,点重复,结束
            const polyOPL = polyOP.at(-1);
            if (!(x === polyOPL?.x && y === polyOPL?.y)) {
                polyOP.push({ x: x, y: y });
                drawPoly(shape);
            } else {
                if (previewShape) fabricCanvas.setActiveObject(previewShape);
                hisPush();
                polyOP = [];
                previewShape = null;
            }
        }
    }

    if (newFilterSelecting) {
        newFilterO = fabricCanvas.getViewportPoint(options.e);
    }
});
fabricCanvas.on("mouse:move", (options) => {
    if (drawingShape) {
        if (!unnormalShapes.includes(shape)) {
            if (shape !== "")
                draw(
                    shape,
                    "move",
                    drawOP[0],
                    drawOP[1],
                    options.viewportPoint.x,
                    options.viewportPoint.y,
                );
        }
    }
});
fabricCanvas.on("mouse:up", (options) => {
    drawingShape = false;
    if (!unnormalShapes.includes(shape)) {
        if (shape !== "") {
            if (previewShape) fabricCanvas.setActiveObject(previewShape);
            previewShape = null;
            hisPush();
        }
    }

    getFilters();

    if (newFilterSelecting && newFilterO) {
        newFilterSelect(newFilterO, fabricCanvas.getScenePoint(options.e));
        getFilters();
        hisPush();

        if (willFilter) {
            const i = filtetMap[willFilter] as (typeof filtetMap)["pixelate"];
            const index = Object.keys(filtetMap).indexOf(willFilter);
            const filter = i.fun(i.value?.value ?? 1);
            applyFilter(index, filter);
            getFilters();
            refreshPropertyPanel();
        }
    }

    if (fabricCanvas.isDrawingMode) {
        hisPush();
    }
});

class mask extends Rect {
    static type = "mask";
    static customProperties = ["形状", "canChangeFill", "feather"];
    /** 羽化半径，单位为对象坐标 */
    declare feather?: number;
    private bandCanvas?: HTMLCanvasElement;

    render(ctx: CanvasRenderingContext2D): void {
        const canvas = this.canvas;
        if (!canvas) return;

        const feather = Math.max(0, this.feather ?? 0);
        const radius = Math.min(this.rx || 0, this.width / 2, this.height / 2);
        const fill = this.fill?.toString() || "";

        if (feather <= 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, canvas.width, canvas.height);
            this.transform(ctx);
            ctx.roundRect(
                -this.width / 2,
                -this.height / 2,
                this.width,
                this.height,
                radius,
            );
            ctx.fillStyle = fill;
            ctx.fill("evenodd");
            ctx.restore();
            return;
        }

        // 只在洞口附近做模糊，避免整幅画布参与滤镜计算
        const center = this.getCenterPoint();
        const matrix = this.calcTransformMatrix();
        const scale = util.qrDecompose(matrix);
        const factor = (Math.abs(scale.scaleX) + Math.abs(scale.scaleY)) / 2;
        const blur = feather * factor;
        const size =
            Math.hypot(this.width * scale.scaleX, this.height * scale.scaleY) +
            blur * 6;
        const left = Math.max(0, Math.round(center.x - size / 2));
        const top = Math.max(0, Math.round(center.y - size / 2));
        const right = Math.min(canvas.width, Math.round(center.x + size / 2));
        const bottom = Math.min(canvas.height, Math.round(center.y + size / 2));
        const width = right - left;
        const height = bottom - top;
        if (width <= 0 || height <= 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.restore();
            return;
        }

        const band = this.getBandCanvas(width, height);
        const bctx = band.getContext("2d")!;
        bctx.setTransform(1, 0, 0, 1, 0, 0);
        bctx.filter = "none";
        bctx.globalCompositeOperation = "source-over";
        bctx.clearRect(0, 0, width, height);
        bctx.fillStyle = fill;
        bctx.fillRect(0, 0, width, height);
        bctx.globalCompositeOperation = "destination-out";
        bctx.translate(-left, -top);
        bctx.transform(...matrix);
        bctx.beginPath();
        bctx.roundRect(
            -this.width / 2,
            -this.height / 2,
            this.width,
            this.height,
            radius,
        );
        bctx.filter = `blur(${blur}px)`;
        bctx.fillStyle = "#000";
        bctx.fill();

        // 洞外区域平铺，和羽化区域按整数像素拼接，避免接缝
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.rect(left, top, width, height);
        ctx.fillStyle = fill;
        ctx.fill("evenodd");
        ctx.restore();
        ctx.drawImage(band, left, top);
    }

    private getBandCanvas(width: number, height: number) {
        if (
            !this.bandCanvas ||
            this.bandCanvas.width !== width ||
            this.bandCanvas.height !== height
        ) {
            this.bandCanvas = document.createElement("canvas");
            this.bandCanvas.width = width;
            this.bandCanvas.height = height;
        }
        return this.bandCanvas;
    }
}

classRegistry.setClass(mask);
classRegistry.setSVGClass(mask);

class xnumber extends Circle {
    static type = "number";
    static customProperties = ["text", "fontSize", "canChangeFill", "形状"];
    declare fontSize: number;
    declare text: string;
    constructor(
        options?: Partial<CircleProps & { fontSize: number; text: string }>,
    ) {
        super();
        this.setOptions(options);
    }
    _render(ctx: CanvasRenderingContext2D): void {
        super._render(ctx);
        ctx.save();

        const x = 0;
        const y = 5;

        // 绘制数字
        ctx.fillStyle = this.stroke?.toString() || "#000";
        ctx.font = `${this.fontSize}px ${字体.等宽字体 || "Arial"}`;
        ctx.textAlign = "center";
        ctx.fillText(String(this.text), x, y);
        ctx.restore();
    }
}

classRegistry.setClass(xnumber);
classRegistry.setSVGClass(xnumber);

const lineHitWidth = 12;

class line extends Polyline {
    static type = "line";
    static customProperties = ["形状"];
    constructor(
        points?: ConstructorParameters<typeof Polyline>[0],
        options?: ConstructorParameters<typeof Polyline>[1],
    ) {
        super(points, options);
        this.controls = controlsUtils.createPolyControls(this.points.length, {
            cursorStyle: "crosshair",
        });
        this.hasBorders = false;
    }
    getLocalPoints() {
        const { pathOffset } = this;
        return [
            new Point(this.points[0]).subtract(pathOffset),
            new Point(this.points[this.points.length - 1]).subtract(pathOffset),
        ];
    }
    getHitWidth() {
        const scale = Math.max(Math.abs(this.scaleX), Math.abs(this.scaleY));
        const zoom = this.canvas?.getZoom() ?? 1;
        return Math.max(
            (this.strokeWidth * scale) / 2,
            lineHitWidth / 2 / zoom,
        );
    }
    calcACoords() {
        const matrix = this.calcOwnMatrix();
        const [start, end] = this.getLocalPoints().map((p) =>
            p.transform(matrix),
        );
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (!length) return super.calcACoords();
        const half = this.getHitWidth();
        const nx = (-dy / length) * half;
        const ny = (dx / length) * half;
        return {
            tl: new Point(start.x + nx, start.y + ny),
            tr: new Point(end.x + nx, end.y + ny),
            br: new Point(end.x - nx, end.y - ny),
            bl: new Point(start.x - nx, start.y - ny),
        };
    }
}

classRegistry.setClass(line);

class arrow extends line {
    static type = "arrow";
    static customProperties = ["arrowW", "arrowH", "arrowType", "形状"];
    declare arrowW: number;
    declare arrowH: number;
    declare arrowType: "fill" | "stroke";
    constructor(
        points?: ConstructorParameters<typeof Polyline>[0],
        options?: ConstructorParameters<typeof Polyline>[1] & {
            arrowW?: number;
            arrowH?: number;
            arrowType?: "fill" | "stroke";
        },
    ) {
        super(points, options);
    }
    getHitWidth() {
        const scale = Math.max(Math.abs(this.scaleX), Math.abs(this.scaleY));
        return Math.max(
            super.getHitWidth(),
            ((this.arrowW ?? getArrowPro().arrowW) / 2) * scale,
        );
    }
    _render(ctx: CanvasRenderingContext2D): void {
        super._render(ctx);

        const [start, end] = this.getLocalPoints();
        const angle =
            Math.atan2(end.y - start.y, end.x - start.x) + Math.PI / 2;
        const pro = getArrowPro();
        const w = this.arrowW ?? pro.arrowW;
        const h = this.arrowH ?? pro.arrowH;
        const type = this.arrowType ?? pro.arrowType;

        const [x3, y3] = rotate(-w / 2, h, angle);
        const [x4, y4] = rotate(w / 2, h, angle);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x + x3, end.y + y3);
        if (type === "stroke") {
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(end.x + x4, end.y + y4);
        } else {
            ctx.lineTo(end.x + x4, end.y + y4);
            ctx.closePath();
        }

        ctx.fillStyle = this.stroke?.toString() || "";
        ctx.lineWidth = this.strokeWidth || 1;
        ctx.strokeStyle = this.stroke?.toString() || "";
        if (type !== "stroke") ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

classRegistry.setClass(arrow);
classRegistry.setSVGClass(arrow);

class polyline extends Polyline {
    constructor(
        points?: ConstructorParameters<typeof Polyline>[0],
        options?: ConstructorParameters<typeof Polyline>[1],
    ) {
        super(points, options);
        this.controls = controlsUtils.createPolyControls(this.points.length);
        this.hasBorders = false;
        this.perPixelTargetFind = true;
    }
}

class polygon extends Polygon {
    constructor(
        points?: ConstructorParameters<typeof Polygon>[0],
        options?: ConstructorParameters<typeof Polygon>[1],
    ) {
        super(points, options);
        this.controls = controlsUtils.createPolyControls(this.points.length);
        this.hasBorders = false;
        this.perPixelTargetFind = true;
    }
}

classRegistry.setClass(polyline);
classRegistry.setClass(polygon);

// 滤镜

for (const [id] of typedEntries(filtetMap)) {
    drawSideFiltersAll[id].on("click", () => {
        setEditType("filter", id);
    });
}

// 伽马

function gammaEl() {
    const g = new Array(3)
        .fill(0)
        .map(() =>
            rangeBar(0.01, 2.2, 0.01).on("input", () =>
                p.el.dispatchEvent(new Event("input")),
            ),
        );
    const p = view()
        .add(g)
        .bindGet(() => g.map((el) => el.gv))
        .bindSet((v: [number, number, number]) => {
            g[0].sv(v[0]);
            g[1].sv(v[1]);
            g[2].sv(v[2]);
        });
    return p;
}

hotkeys("esc", "drawing", () => {
    setEditType("select", "draw");
});

hotkeys("Ctrl+v", () => {
    fabricCopy();
});

setEditType("select", selectEditType);

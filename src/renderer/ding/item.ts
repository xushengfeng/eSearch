import {
    addClass,
    button,
    type ElType,
    image,
    spacer,
    trackPoint,
    txt,
    view,
} from "dkh-ui";
import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import store from "../../../lib/store/renderStore";
import type { IconType } from "../../iconTypes";
import type {
    CaptureSourceInfo,
    LiveDingData,
    NormRect,
} from "../../ShareTypes";
import { writeImage } from "../lib/clipboard";
import {
    encodeImageSource,
    type ImageFormat,
    imageFormatMime,
    isImageFormatSupported,
} from "../lib/imageExport";
import { Class, getImgUrl } from "../root/root";
import { dxdy, type Frame } from "./layout";
import { drawTranslation, preTranAndOcr, UnConfigTranslateError } from "./ocr";

const fs = require("node:fs") as typeof import("fs");

export type DingItemData = {
    id: string;
    /** 初始位置和大小，屏幕坐标 */
    rect: [number, number, number, number];
    url: string;
    translation: string;
    isTranslate: boolean;
    /** 窗口视频流，存在时为动态贴图 */
    live?: LiveDingData;
    /** 贴图所在显示器 */
    displayId?: number;
};

export type DingItemOptions = {
    data: DingItemData;
    /** 独立系统窗口：没有覆盖层里的 dock、最小化等 */
    single: boolean;
    /** 无法用程序移动窗口时（Wayland），用系统原生拖动 */
    nativeDrag?: boolean;
    /** 请求缩放（滚轮、大小控件） */
    zoom: (zoom: number, dx: number, dy: number, clip: boolean) => void;
    close: () => void;
    back: () => void;
    minimize?: (el: HTMLElement) => void;
    front?: () => void;
};

export type DingItem = {
    data: DingItemData;
    el: ElType<HTMLElement>;
    imageEl: ElType<HTMLElement>;
    translate: () => Promise<void>;
    /** @param zoom 1 为 100% */
    setSize: (zoom: number) => void;
    /** 宽度不足时缩小工具栏 */
    setToolbarZoom: (width: number) => void;
    /** 裁剪图片，null 表示图片填满 */
    setImageFrame: (frame: Frame | null) => void;
    setImageRendering: (zoom: number) => void;
    setOpacity: (v: number) => void;
    /** 数字键对应的变换 */
    transform: (index: number) => void;
    /** 当前画面，动态贴图取视频帧 */
    snapshot: () => string;
    /** 释放视频流等资源 */
    destroy: () => void;
    /** 是否在调整裁剪 */
    isAdjusting: () => boolean;
    /** 切换动态源 */
    switchSource: (live: LiveDingData, poster: string) => void;
};

const dingPhotoClass = addClass(
    {},
    {
        "&:hover": {
            boxShadow: "var(--shadow)",
        },
        "&:focus": {
            outline: "none",
        },
    },
);

const dingPhotoHightClass = addClass({ boxShadow: "var(--shadow)" }, {});

const toolBarButtonsClass = addClass(
    {},
    {
        "&>button": {
            height: "32px",
        },
    },
);

const toolBarIClass = addClass(
    {},
    {
        "&>div": {
            display: "flex",
            alignItems: "center",
            width: "auto",
        },
    },
);

const imageClass = addClass(
    { position: "relative", width: "100%", userSelect: "none" },
    { "&>*": { width: "100%", top: 0, left: 0 } },
);

const appDragClass = addClass(
    {
        // @ts-ignore
        "-webkit-app-region": "drag",
    },
    {},
);

const appNoDragClass = addClass(
    {
        // @ts-ignore
        "-webkit-app-region": "no-drag",
    },
    {},
);

const SMALL_TOOLBAR_WIDTH = 390;

/** 同一渲染进程内按源复用视频流 */
const liveStreamPool = new Map<string, { stream: MediaStream; refs: number }>();
const liveStreamPending = new Map<string, Promise<MediaStream>>();

const liveSourceRequests = new Map<
    number,
    (sources: CaptureSourceInfo[]) => void
>();
let liveSourceRequestId = 0;

renderOn("captureSources", ([requestId, sources]) => {
    const cb = liveSourceRequests.get(requestId);
    liveSourceRequests.delete(requestId);
    cb?.(sources);
});

function requestLiveSources(): Promise<CaptureSourceInfo[]> {
    return new Promise((resolve) => {
        const id = ++liveSourceRequestId;
        const timer = setTimeout(() => {
            liveSourceRequests.delete(id);
            resolve([]);
        }, 120_000);
        liveSourceRequests.set(id, (sources) => {
            clearTimeout(timer);
            resolve(sources);
        });
        renderSend("getCaptureSources", [id]);
    });
}

function findLiveSource(sources: CaptureSourceInfo[], live: LiveDingData) {
    const byId = sources.find((source) => {
        const p = source.id.split(":");
        return p[0] === "window" && Number(p[1]) === live.windowId;
    });
    if (byId) return byId;
    const title = (live.title || "").trim().toLowerCase();
    if (title) {
        const byTitle = sources.find(
            (source) => source.name.trim().toLowerCase() === title,
        );
        if (byTitle) return byTitle;
    }
    return sources.length === 1 ? sources[0] : null;
}

async function acquireLiveStream(sourceId: string, fps: number) {
    const entry = liveStreamPool.get(sourceId);
    if (entry) {
        entry.refs++;
        return entry.stream;
    }
    let pending = liveStreamPending.get(sourceId);
    if (!pending) {
        pending = navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: "desktop",
                    chromeMediaSourceId: sourceId,
                    maxFrameRate: fps,
                },
            },
        });
        liveStreamPending.set(sourceId, pending);
    }
    const stream = await pending;
    liveStreamPending.delete(sourceId);
    const now = liveStreamPool.get(sourceId);
    if (now) {
        now.refs++;
        return now.stream;
    }
    liveStreamPool.set(sourceId, { stream, refs: 1 });
    return stream;
}

function releaseLiveStream(sourceId: string) {
    const entry = liveStreamPool.get(sourceId);
    if (!entry) return;
    entry.refs--;
    if (entry.refs > 0) return;
    for (const track of entry.stream.getTracks()) track.stop();
    liveStreamPool.delete(sourceId);
}

const transformList = store.get("贴图.窗口.变换");
const tranStyle = document.createElement("style");
for (const [i, t] of transformList.entries()) {
    tranStyle.innerHTML += `.tran${i}{${t}}`;
}
document.body.appendChild(tranStyle);

export function iconEl(src: IconType): ElType<HTMLImageElement> {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}

export function getUrl(data: DingItemData) {
    return data.isTranslate ? data.translation : data.url;
}

export async function copyDing(data: DingItemData, url = getUrl(data)) {
    const response = await fetch(url);
    const blob = await response.blob();
    await writeImage(blob);
}

export async function saveDing(data: DingItemData, url = getUrl(data)) {
    const format = await dingSaveFormat();
    renderSend("windowTopest", [false]);
    const save = renderSendSync("save_file_path", [format]);
    renderSend("windowTopest", [true]);
    if (!save) return;
    try {
        fs.writeFileSync(save, await encodeDingSource(url, format));
    } catch (e) {
        console.error("保存失败", e);
        return;
    }
    renderSend("ok_save", [save]);
}

async function dingSaveFormat(): Promise<ImageFormat> {
    const format = store.get("保存.默认格式");
    if (format === "svg") return "png";
    if (await isImageFormatSupported(format)) return format;
    return "png";
}

/** 源数据就是目标格式时直接写入，避免重新编码 */
async function encodeDingSource(url: string, format: ImageFormat) {
    const match = /^data:(image\/[\w.+-]+);base64,/.exec(url);
    if (match?.[1] === imageFormatMime[format])
        return Buffer.from(url.slice(match[0].length), "base64");
    return encodeImageSource(url, format);
}

export function editDing(data: DingItemData, url = getUrl(data)) {
    const b = Buffer.from(
        url.replace(/^data:image\/\w+;base64,/, ""),
        "base64",
    );
    renderSend("edit_pic", [b]);
}

export function createDingItem(opts: DingItemOptions): DingItem {
    const { data, single } = opts;
    const wid = data.id;

    const div = view()
        .attr({ id: wid, tabIndex: 0 })
        .style({ position: "fixed", overflow: "hidden" })
        .class(dingPhotoClass);
    if (store.get("贴图.窗口.提示")) div.class(dingPhotoHightClass);

    const img = image(data.url, "").attr({ draggable: false });
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.position = "absolute";
    video.style.pointerEvents = "none";
    video.style.opacity = "0";
    video.style.transition = "opacity 0.2s";
    video.style.maxWidth = "none";
    video.style.maxHeight = "none";
    const imageP = view()
        .class("img")
        .add(img)
        .class(imageClass)
        .class(Class.transition);
    if (data.live) imageP.add(video);

    const liveStateText = txt();
    const liveStateBar = view("x")
        .class(Class.glassBar)
        .class(Class.hide)
        .style({
            padding: "4px",
            gap: "4px",
            bottom: "4px",
            borderRadius: "4px",
            alignItems: "center",
            position: "absolute",
            zIndex: 2,
            left: "50%",
            transform: "translateX(-50%)",
        })
        .add(liveStateText);

    let destroyed = false;
    let liveFailed = false;
    let liveFps = data.live?.fps || 30;
    let liveSourceId = data.live?.sourceId ?? null;
    let liveReleased = false;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

    function cropOf() {
        const crop = data.live?.crop;
        if (!crop) return null;
        return {
            x: clamp01(crop.x),
            y: clamp01(crop.y),
            w: clamp01(crop.w),
            h: clamp01(crop.h),
        };
    }

    function updateVideoLayout() {
        const crop = cropOf();
        if (!crop || !video.videoWidth || !video.videoHeight) return;
        const W = imageP.el.offsetWidth;
        const H = imageP.el.offsetHeight;
        if (!(W > 0) || !(H > 0)) return;
        const videoW = W / crop.w;
        const videoH = videoW * (video.videoHeight / video.videoWidth);
        video.style.width = `${videoW}px`;
        video.style.height = `${videoH}px`;
        video.style.left = `${-crop.x * videoW}px`;
        video.style.top = `${-crop.y * videoH}px`;
    }

    function snapshot() {
        const crop = cropOf();
        if (
            !data.live ||
            !crop ||
            !video.videoWidth ||
            !video.videoHeight ||
            video.readyState < 2
        )
            return data.url;
        const sx = crop.x * video.videoWidth;
        const sy = crop.y * video.videoHeight;
        const sw = Math.max(1, Math.round(crop.w * video.videoWidth));
        const sh = Math.max(1, Math.round(crop.h * video.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d");
        if (!ctx) return data.url;
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        return canvas.toDataURL("image/png");
    }

    async function startLive() {
        const sourceId = liveSourceId;
        if (!sourceId) return;
        try {
            const stream = await acquireLiveStream(sourceId, liveFps);
            if (destroyed) {
                releaseLiveStream(sourceId);
                liveReleased = true;
                return;
            }
            video.srcObject = stream;
            for (const track of stream.getVideoTracks()) {
                track.onended = () => {
                    liveFailed = true;
                    liveStreamPool.delete(sourceId);
                    video.style.opacity = "0";
                    liveStateText.sv("动态源已断开");
                    liveStateBar.el.classList.remove(Class.hide);
                    reconnectB.style({ display: "" });
                    setToolbarZoom(div.el.offsetWidth);
                };
            }
            await video.play().catch(() => {});
            video.style.opacity = "1";
            reconnectB.style({ display: "none" });
            setToolbarZoom(div.el.offsetWidth);
            updateVideoLayout();
        } catch (error) {
            liveFailed = true;
            console.error("动态贴图启动失败", error);
            liveStateText.sv("无法启动动态贴图");
            liveStateBar.el.classList.remove(Class.hide);
            reconnectB.style({ display: "" });
            setToolbarZoom(div.el.offsetWidth);
        }
    }

    const resizeObserver = data.live
        ? new ResizeObserver(() => updateVideoLayout())
        : null;
    resizeObserver?.observe(imageP.el);

    video.addEventListener("loadedmetadata", () => {
        updateVideoLayout();
        video.style.opacity = "1";
        liveStateBar.el.classList.add(Class.hide);
    });

    let adjusting = false;
    let adjustPausedBefore = false;
    let panStart: { x: number; y: number; crop: NormRect } | null = null;
    const adjustText = txt();
    const adjustBar = view("x")
        .class(Class.glassBar)
        .class(Class.hide)
        .style({
            padding: "4px 8px",
            gap: "8px",
            bottom: "4px",
            borderRadius: "4px",
            alignItems: "center",
            position: "absolute",
            zIndex: 3,
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
        })
        .add([
            adjustText,
            button("完成")
                .style({ width: "auto", padding: "0 8px" })
                .on("click", () => setAdjust(false)),
        ]);

    function setAdjust(v: boolean) {
        if (!data.live) return;
        if (v === adjusting) return;
        adjusting = v;
        if (v) {
            adjustPausedBefore = !video.paused;
            video.pause();
            adjustText.sv("拖动画面调整位置，滚轮缩放范围");
            adjustBar.el.classList.remove(Class.hide);
            liveStateBar.el.classList.add(Class.hide);
            imageP.style({
                outline: "2px dashed #4c9aff",
                outlineOffset: "-2px",
            });
        } else {
            adjustBar.el.classList.add(Class.hide);
            imageP.style({ outline: "", outlineOffset: "" });
            if (adjustPausedBefore) void video.play().catch(() => {});
            adjustPausedBefore = false;
        }
    }

    imageP.el.addEventListener("pointerdown", (e) => {
        if (!adjusting || !data.live) return;
        e.preventDefault();
        e.stopPropagation();
        panStart = {
            x: e.clientX,
            y: e.clientY,
            crop: { ...data.live.crop },
        };
        imageP.el.setPointerCapture(e.pointerId);
    });

    imageP.el.addEventListener("pointermove", (e) => {
        if (!adjusting || !panStart || !data.live) return;
        e.preventDefault();
        e.stopPropagation();
        const vw = video.offsetWidth;
        const vh = video.offsetHeight;
        if (!(vw > 0) || !(vh > 0)) return;
        const crop = data.live.crop;
        const dx = (e.clientX - panStart.x) / vw;
        const dy = (e.clientY - panStart.y) / vh;
        crop.x = clamp01(Math.min(panStart.crop.x - dx, 1 - crop.w));
        crop.y = clamp01(Math.min(panStart.crop.y - dy, 1 - crop.h));
        updateVideoLayout();
    });

    imageP.el.addEventListener("pointerup", (e) => {
        if (!panStart) return;
        panStart = null;
        try {
            imageP.el.releasePointerCapture(e.pointerId);
        } catch {}
    });

    const toolBar = view().style({
        overflow: "hidden",
        width: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 2,
    });
    const toolBarC = view("x")
        .attr({ id: "tool_bar_c" })
        .style({
            padding: "4px",
            gap: "4px",
            boxSizing: "border-box",
            width: "100%",
            alignItems: "center",
            userSelect: "none",
        })
        .class(Class.glassBar)
        .class(toolBarIClass)
        .bindSet((v: { forceShow?: boolean; show?: boolean }, el) => {
            if (v.forceShow !== undefined)
                el.setAttribute("data-force-show", String(v.forceShow));
            if (v.show !== undefined)
                el.setAttribute("data-show", String(v.show));
            if (el.getAttribute("data-force-show") === "true") {
                el.style.transform = "translateY(0)";
            } else {
                el.style.transform =
                    el.getAttribute("data-show") === "true"
                        ? "translateY(0)"
                        : "translateY(-105%)";
            }
        })
        .sv({ show: false })
        .class(Class.transition);
    toolBar.add(toolBarC);

    // 原生拖动：整个贴图可以拖动，顶栏不拖动，保证按钮可点、鼠标移到顶部能唤出顶栏
    if (opts.nativeDrag) {
        div.class(appDragClass);
        toolBar.class(appNoDragClass);
        toolBarC.class(appNoDragClass);
    }

    div.el.onmouseenter = () => {
        toolBarC.sv({ show: true });
    };
    div.el.onmouseleave = () => {
        toolBarC.sv({ show: false });
    };

    const concorlClass = addClass(
        {
            cursor: "ew-resize",
        },
        {
            "& .icon": {
                width: "32px",
                position: "initial",
            },
        },
    );

    // 透明
    const opacityEl = txt()
        .bindSet((v: string, el) => {
            el.innerText = `${v}%`;
            imageP.el.style.opacity = `${Number(v) / 100}`;
        })
        .sv("100");
    const opacityElP = view("x")
        .class(concorlClass)
        .class(appNoDragClass)
        .attr({ title: "不透明度" })
        .add([iconEl("opacity"), opacityEl]);

    trackPoint(opacityElP, {
        start: () => {
            toolBarC.sv({ forceShow: true });
            return { x: 0, y: 0, data: Number.parseInt(opacityEl.gv, 10) };
        },
        ing: (p, _e, { startData }) => {
            const d = Math.round(p.x / 2);
            const newOp = Math.max(0, Math.min(100, startData + d));
            opacityEl.sv(newOp.toString());
        },
        end: () => {
            toolBarC.sv({ forceShow: false });
        },
    });

    toolBarC.add(opacityElP);

    // 大小
    const sizeInput = txt()
        .bindSet((v: string, el) => {
            el.innerText = `${v}%`;
        })
        .bindGet((el) => {
            return Number.parseInt(el.innerText, 10);
        })
        .sv("100");
    const sizeEl = view("x")
        .class(concorlClass)
        .class(appNoDragClass)
        .attr({ title: "大小" })
        .add([iconEl("size"), sizeInput]);

    trackPoint(sizeEl, {
        start: () => {
            toolBarC.sv({ forceShow: true });
            return { x: 0, y: 0, data: sizeInput.gv };
        },
        ing: (p, _e, { startData }) => {
            const d = Math.round(p.x / 2);
            const newS = Math.max(0, startData + d);
            sizeInput.sv(newS.toString());
            const zoom = Math.max(newS / 100, 0.05);
            if (Number.isFinite(zoom)) opts.zoom(zoom, 0, 0, false);
        },
        end: () => {
            toolBarC.sv({ forceShow: false });
        },
    });

    toolBarC.add(sizeEl);

    // 滚轮缩放
    div.el.onwheel = (e) => {
        if (adjusting && data.live) {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 1.1 : 0.9;
            const crop = data.live.crop;
            const cx = crop.x + crop.w / 2;
            const cy = crop.y + crop.h / 2;
            let w = Math.min(1, crop.w * factor);
            let h = (w * crop.h) / crop.w;
            if (h > 1) {
                h = 1;
                w = (h * crop.w) / crop.h;
            }
            crop.w = w;
            crop.h = h;
            crop.x = Math.max(0, Math.min(1 - w, cx - w / 2));
            crop.y = Math.max(0, Math.min(1 - h, cy - h / 2));
            updateVideoLayout();
            return;
        }
        if (e.deltaY !== 0) {
            let zoom = Number(sizeInput.gv) / 100;
            const zz = 1 + Math.abs(e.deltaY) / 300;
            zoom = e.deltaY > 0 ? zoom / zz : zoom * zz;
            if (zoom < 0.05) zoom = 0.05;
            const clip = !single && e.ctrlKey;
            const d = dxdy(e, clip ? imageP : div);
            opts.zoom(zoom, d.dx, d.dy, clip);
        }
    };

    const ocrTransStateBarText = txt();
    const ocrTransStateBar = view("x")
        .class(Class.glassBar)
        .class(Class.hide)
        .style({
            padding: "4px",
            gap: "4px",
            bottom: "4px",
            borderRadius: "4px",
            alignItems: "center",
            position: "absolute",
            zIndex: 2,
            left: "50%",
            transform: "translateX(-50%)",
        })
        .add([
            ocrTransStateBarText,
            button(iconEl("close"))
                .attr({ title: "关闭" })
                .on("click", () => {
                    ocrTransStateBar.class(Class.hide);
                }),
        ])
        .bindSet((v: string) => {
            ocrTransStateBarText.sv(v);
        });
    if (opts.nativeDrag) ocrTransStateBar.class(appNoDragClass);

    async function translate() {
        ocrTransStateBar.el.classList.remove(Class.hide);
        ocrTransStateBar.sv("正在OCR识别...");
        const shot = snapshot();
        const p = await preTranAndOcr(shot);
        ocrTransStateBar.sv("正在翻译...");
        try {
            await drawTranslation(
                imageP,
                data,
                p,
                shot === data.url ? undefined : shot,
            );
            ocrTransStateBar.class(Class.hide);
        } catch (error) {
            if (error instanceof UnConfigTranslateError) {
                ocrTransStateBar.sv("未配置翻译引擎");
            } else ocrTransStateBar.sv("翻译失败");
        }
    }

    const transB = button(iconEl("translate"))
        .attr({ title: "翻译" })
        .on("click", async () => {
            if (adjusting) setAdjust(false);
            const t = data.isTranslate;
            data.isTranslate = !t;
            if (t) {
                div.query("canvas")?.style({ display: "none" });
                if (data.live) {
                    video.style.display = "block";
                    void video.play().catch(() => {});
                }
            } else {
                if (!data.translation) await translate();
                div.query("canvas")?.style({ display: "" });
                if (data.live) {
                    video.pause();
                    video.style.display = "none";
                }
            }
        });

    let livePaused = false;
    const pauseB = button(iconEl("play_pause"))
        .attr({ title: "暂停动态" })
        .on("click", () => {
            if (!data.live || adjusting) return;
            livePaused = !livePaused;
            if (livePaused) video.pause();
            else void video.play().catch(() => {});
            pauseB.attr({ title: livePaused ? "继续动态" : "暂停动态" });
        });

    const adjustB = button(iconEl("rect_select"))
        .attr({ title: "调整裁剪" })
        .on("click", () => setAdjust(!adjusting));

    const reconnectB = button(iconEl("reload"))
        .attr({ title: "重新连接" })
        .style({ display: "none" })
        .on("click", () => {
            void reconnect();
        });

    let reconnecting = false;
    async function reconnect() {
        if (!data.live || reconnecting) return;
        reconnecting = true;
        try {
            if (adjusting) setAdjust(false);
            livePaused = false;
            pauseB.attr({ title: "暂停动态" });
            const sources = await requestLiveSources();
            const source = findLiveSource(sources, data.live);
            if (!source) {
                liveFailed = true;
                liveStateText.sv("找不到源窗口");
                liveStateBar.el.classList.remove(Class.hide);
                reconnectB.style({ display: "" });
                setToolbarZoom(div.el.offsetWidth);
                return;
            }
            const oldSourceId = liveSourceId;
            if (oldSourceId && !liveReleased) releaseLiveStream(oldSourceId);
            liveStreamPool.delete(source.id);
            if (oldSourceId) liveStreamPool.delete(oldSourceId);
            data.live.sourceId = source.id;
            data.live.title = source.name;
            const numericId = Number(source.id.split(":")[1]);
            if (Number.isFinite(numericId)) data.live.windowId = numericId;
            liveSourceId = source.id;
            liveReleased = false;
            liveFailed = false;
            video.srcObject = null;
            video.style.opacity = "0";
            await startLive();
        } finally {
            reconnecting = false;
        }
    }

    const stopB = button(iconEl("stop_record"))
        .attr({ title: "转为静态" })
        .on("click", () => {
            if (!data.live) return;
            const shot = snapshot();
            setAdjust(false);
            data.url = shot;
            img.el.src = shot;
            data.live = undefined;
            video.srcObject = null;
            video.remove();
            if (liveSourceId && !liveReleased) {
                releaseLiveStream(liveSourceId);
                liveReleased = true;
                liveSourceId = null;
            }
            resizeObserver?.disconnect();
            pauseB.remove();
            adjustB.remove();
            stopB.remove();
            reconnectB.remove();
            changeB.remove();
            liveStateText.sv("已转为静态");
            liveStateBar.el.classList.remove(Class.hide);
            setTimeout(() => {
                liveStateBar.el.classList.add(Class.hide);
            }, 2000);
            setToolbarZoom(div.el.offsetWidth);
            renderSend("dingLiveStop", [Number(wid)]);
        });

    const changeB = button(iconEl("replace"))
        .attr({ title: "换源" })
        .on("click", () => {
            if (!data.live) return;
            setAdjust(false);
            renderSend("dingLiveChangeSource", [
                {
                    id: Number(wid),
                    rect: {
                        x: data.rect[0],
                        y: data.rect[1],
                        w: data.rect[2],
                        h: data.rect[3],
                    },
                    poster: snapshot(),
                    displayId: data.displayId,
                },
            ]);
        });

    function switchSource(live: LiveDingData, poster: string) {
        if (adjusting) setAdjust(false);
        if (liveSourceId && !liveReleased) releaseLiveStream(liveSourceId);
        if (liveSourceId) liveStreamPool.delete(liveSourceId);
        data.live = live;
        data.url = poster;
        liveFps = live.fps || 30;
        data.isTranslate = false;
        data.translation = "";
        div.query("canvas")?.remove();
        img.el.src = poster;
        liveSourceId = live.sourceId;
        liveReleased = false;
        liveFailed = false;
        livePaused = false;
        pauseB.attr({ title: "暂停动态" });
        video.srcObject = null;
        video.style.opacity = "0";
        video.style.display = "";
        reconnectB.style({ display: "none" });
        setToolbarZoom(div.el.offsetWidth);
        liveStateText.sv(live.appName || live.title || "动态贴图");
        liveStateBar.el.classList.remove(Class.hide);
        setTimeout(() => {
            if (!liveFailed) liveStateBar.el.classList.add(Class.hide);
        }, 2500);
        void startLive();
    }

    const toolButtons = [
        transB,
        button(iconEl("free_draw"))
            .attr({ title: "编辑" })
            .on("click", () => editDing(data, snapshot())),
        button(iconEl("save"))
            .attr({ title: "保存" })
            .on("click", () => saveDing(data, snapshot())),
        button(iconEl("copy"))
            .attr({ title: "复制" })
            .on("click", () => copyDing(data, snapshot())),
    ];
    if (data.live)
        toolButtons.unshift(pauseB, adjustB, changeB, stopB, reconnectB);
    if (!single) {
        toolButtons.push(
            button(iconEl("minimize"))
                .attr({ title: "最小化" })
                .on("click", () => opts.minimize?.(div.el)),
        );
    }
    toolButtons.push(
        button(iconEl("back"))
            .attr({ title: "归位" })
            .on("click", () => opts.back()),
        button(iconEl("close"))
            .attr({ title: "关闭" })
            .on("click", () => opts.close()),
    );

    toolBarC.add([
        spacer(),
        view()
            .class(Class.transition, toolBarButtonsClass)
            .class(appNoDragClass)
            .add(toolButtons),
    ]);

    // 双击行为
    div.el.ondblclick = () => {
        if (store.get("贴图.窗口.双击") === "归位") opts.back();
        else opts.close();
    };
    // 放到前面
    div.el.onclick = () => {
        opts.front?.();
    };
    // 快捷键
    div.on("keydown", (e) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (e.key === "Escape") {
            if (adjusting) {
                setAdjust(false);
                return;
            }
            opts.close();
        }
        if (!Number.isNaN(Number(e.key))) {
            transform(Number(e.key) - 1);
        }
    });
    // 图片在前、顶栏在后：-webkit-app-region 会继承，图片的拖动区会覆盖顶栏，必须在顶栏之后处理 no-drag
    div.add(imageP)
        .add(toolBar)
        .add(ocrTransStateBar)
        .add(liveStateBar)
        .add(adjustBar);
    if (data.live) {
        liveStateText.sv(data.live.appName || data.live.title || "动态贴图");
        setTimeout(() => {
            if (!liveFailed) liveStateBar.el.classList.add(Class.hide);
        }, 2500);
        void startLive();
    }

    const setSize = (zoom: number) => {
        sizeInput.sv(String(Math.round(zoom * 100)));
    };
    const setToolbarZoom = (width: number) => {
        const base = data.live ? 540 : SMALL_TOOLBAR_WIDTH;
        toolBarC.style({
            zoom: width <= base ? String(width / base) : "",
        });
    };
    const setImageFrame = (frame: Frame | null) => {
        if (frame) {
            imageP.style({
                left: `${frame.x}px`,
                top: `${frame.y}px`,
                width: `${frame.w}px`,
                height: `${frame.h}px`,
            });
        } else {
            imageP.style({
                left: "0",
                top: "0",
                width: "100%",
                height: "",
            });
        }
    };
    const setImageRendering = (zoom: number) => {
        for (const i of div.queryAll(".img>*")) {
            i.style({
                "image-rendering": zoom > 1.5 ? "pixelated" : "initial",
            });
        }
    };
    const transform = (index: number) => {
        const target = `tran${index}`;
        const classes = Array.from(img.el.classList.values()).filter((c) =>
            /^tran\d+$/.test(c),
        );
        const onlyTarget = classes.length === 1 && classes[0] === target;
        for (const el of [img.el, video]) {
            el.classList.remove(...classes);
            if (index >= 0 && index < transformList.length && !onlyTarget) {
                el.classList.add(target);
            }
        }
    };
    const setOpacity = (v: number | string) => {
        opacityEl.sv(String(v));
    };

    const destroy = () => {
        destroyed = true;
        resizeObserver?.disconnect();
        video.srcObject = null;
        if (liveSourceId && !liveReleased) {
            releaseLiveStream(liveSourceId);
            liveReleased = true;
            liveSourceId = null;
        }
    };

    return {
        data,
        el: div,
        imageEl: imageP,
        translate,
        setSize,
        setToolbarZoom,
        setImageFrame,
        setImageRendering,
        setOpacity,
        transform,
        snapshot,
        destroy,
        isAdjusting: () => adjusting,
        switchSource,
    };
}

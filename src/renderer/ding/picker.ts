import { addStyle, button, spacer, txt, view } from "dkh-ui";
import { renderOn, renderSend } from "../../../lib/ipc";
import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import type { CaptureSourceInfo, NormRect } from "../../ShareTypes";
import { Class, initStyle, setTitle } from "../root/root";
import { loadImageCached, matchPosterInFrame } from "./align";

initStyle(store);
setTitle(t("动态贴图"));

addStyle({
    body: {
        margin: "0",
        background: "var(--bg)",
        color: "var(--font-color)",
        overflow: "hidden",
        userSelect: "none",
    },
    "#picker_header": {
        display: "flex",
        alignItems: "center",
        gap: "var(--o-padding)",
        padding: "var(--o-padding)",
        margin: "var(--o-padding) var(--o-padding) 0",
        flexShrink: "0",
        flexWrap: "wrap",
        borderRadius: "var(--border-radius)",
        boxShadow: "var(--shadow)",
    },
    "#picker_grid": {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "var(--o-padding)",
        padding: "var(--o-padding)",
        overflowY: "auto",
        flex: "1",
        minHeight: "0",
    },
    "#picker_confirm": {
        position: "fixed",
        left: "50%",
        bottom: "var(--o-padding)",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "var(--o-padding)",
        padding: "var(--o-padding)",
        borderRadius: "var(--border-radius)",
        boxShadow: "var(--shadow)",
        zIndex: "10",
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: "95vw",
    },
});

type Rect = { x: number; y: number; w: number; h: number };

type SourceCard = {
    source: CaptureSourceInfo;
    el: ReturnType<typeof view>;
    video: HTMLVideoElement;
    thumb: HTMLImageElement;
    layer: HTMLElement;
    status: ReturnType<typeof txt>;
    box: HTMLDivElement | null;
    started: boolean;
    bounds: Rect | null;
    mask: HTMLDivElement[];
    matched: boolean;
    matchTries: number;
    matchCrop: NormRect | null;
    matchScore: number | null;
};

let selectionRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
let selected: { card: SourceCard; crop: NormRect; poster: string } | null =
    null;
let cards: SourceCard[] = [];
let rootEl: HTMLElement | null = null;
let confirmBar: ReturnType<typeof view>;
let confirmPreview: HTMLCanvasElement;
let confirmText: ReturnType<typeof txt>;
let posterImagePromise: Promise<HTMLImageElement | null> | null = null;
let userInteracted = false;
let autoSelectTimer: number | null = null;
let headerHint: ReturnType<typeof txt> | null = null;
let hintTimer: number | null = null;

const loadingEl = view("y")
    .style({
        position: "fixed",
        inset: "0",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--o-padding)",
        fontSize: "14px",
        opacity: "0.9",
        pointerEvents: "none",
        zIndex: "5",
        background: "var(--bg)",
    })
    .add(txt(t("正在获取窗口...")))
    .add(
        txt(
            t("如果系统弹出窗口选择框，请选择一个窗口，不要选择整个屏幕"),
        ).style({
            fontSize: "12px",
            color: "var(--font-color-l)",
        }),
    )
    .addInto();

function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
}

function videoBounds(card: SourceCard): Rect | null {
    const vw = card.video.videoWidth;
    const vh = card.video.videoHeight;
    const cw = card.layer.clientWidth;
    const ch = card.layer.clientHeight;
    if (!(vw > 0) || !(vh > 0) || !(cw > 0) || !(ch > 0)) return null;
    const scale = Math.min(cw / vw, ch / vh);
    return {
        x: (cw - vw * scale) / 2,
        y: (ch - vh * scale) / 2,
        w: vw * scale,
        h: vh * scale,
    };
}

function createCard(source: CaptureSourceInfo, single = false): SourceCard {
    const el = view().style(
        single
            ? {
                  position: "relative",
                  flex: "1",
                  minHeight: "0",
                  overflow: "hidden",
                  borderRadius: "var(--border-radius)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg)",
              }
            : {
                  position: "relative",
                  aspectRatio: "16 / 10",
                  overflow: "hidden",
                  borderRadius: "var(--border-radius)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg)",
              },
    );
    const thumb = document.createElement("img");
    thumb.draggable = false;
    if (source.thumbnail) thumb.src = source.thumbnail;
    thumb.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:1;";
    const video = document.createElement("video");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;background:var(--bg);pointer-events:none;";
    const layer = document.createElement("div");
    layer.style.cssText =
        "position:absolute;inset:0;cursor:crosshair;touch-action:none;";
    const status = txt()
        .style({
            position: "absolute",
            left: "var(--o-padding)",
            top: "var(--o-padding)",
            padding: "2px var(--o-padding)",
            borderRadius: "var(--border-radius)",
            background: "var(--bar-bg)",
            color: "var(--font-color)",
            backdropFilter: "var(--blur)",
            fontSize: "12px",
            display: "none",
            pointerEvents: "none",
            zIndex: "2",
        })
        .addInto(el);
    const label = view("x")
        .style({
            position: "absolute",
            left: "var(--o-padding)",
            right: "var(--o-padding)",
            bottom: "var(--o-padding)",
            padding: "2px var(--o-padding)",
            borderRadius: "var(--border-radius)",
            background: "var(--bar-bg)",
            color: "var(--font-color)",
            backdropFilter: "var(--blur)",
            fontSize: "12px",
            pointerEvents: "none",
            gap: "4px",
            alignItems: "center",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            zIndex: "2",
        })
        .add(txt(source.name || t("未知窗口")));
    el.add([thumb, video, layer, label]);
    return {
        source,
        el,
        video,
        thumb,
        layer,
        status,
        box: null,
        started: false,
        bounds: null,
        mask: [],
        matched: false,
        matchTries: 0,
        matchCrop: null,
        matchScore: null,
    };
}

async function startCard(card: SourceCard) {
    if (card.started) return;
    card.started = true;
    card.status.sv(t("正在启动视频流..."));
    card.status.style({ display: "block" });
    card.video.addEventListener("loadedmetadata", () => {
        card.bounds = videoBounds(card);
    });
    try {
        renderSend("dingPickerTop", [false]);
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: "desktop",
                    chromeMediaSourceId: card.source.id,
                    maxFrameRate: store.get("贴图.动态.帧率") || 30,
                },
            },
        });
        card.video.srcObject = stream;
        await card.video.play().catch(() => {});
        card.bounds = videoBounds(card);
        card.thumb.style.opacity = "0";
        card.video.style.opacity = "1";
        card.status.style({ display: "none" });
        renderSend("dingPickerTop", [true]);
        setTimeout(() => {
            void autoMatchCard(card);
        }, 300);
    } catch (error) {
        renderSend("dingPickerTop", [true]);
        console.error(error);
        card.status.sv(t("无法启动视频流，请检查屏幕录制权限"));
    }
}

function cropToRect(card: SourceCard, crop: NormRect): Rect | null {
    const b = card.bounds;
    if (!b) return null;
    return {
        x: b.x + crop.x * b.w,
        y: b.y + crop.y * b.h,
        w: crop.w * b.w,
        h: crop.h * b.h,
    };
}

async function autoMatchCard(card: SourceCard) {
    if (card.matched || userInteracted || selected) return;
    if (card.video.readyState < 2 || !card.video.videoWidth) {
        if (card.matchTries++ < 5) {
            setTimeout(() => {
                void autoMatchCard(card);
            }, 500);
        }
        return;
    }
    card.matched = true;
    const poster = await posterImagePromise;
    if (!poster || userInteracted || selected || !cards.includes(card)) return;
    const result = await matchPosterInFrame(poster, card.video, {
        scaleSearch: cards.length === 1,
    });
    const finalResult =
        result ??
        (cards.length > 1 && cards.length <= 3
            ? await matchPosterInFrame(poster, card.video, {
                  scaleSearch: true,
              })
            : null);
    if (!finalResult || userInteracted || selected || !cards.includes(card)) {
        if (
            !finalResult &&
            !userInteracted &&
            !selected &&
            card.matchTries++ < 2
        ) {
            card.matched = false;
            setTimeout(() => {
                void autoMatchCard(card);
            }, 600);
        }
        return;
    }
    card.matchCrop = finalResult.crop;
    card.matchScore = finalResult.score;
    if (cards.length === 1) {
        if (finalResult.score < 0.8) return;
        const rect = cropToRect(card, finalResult.crop);
        if (!rect) return;
        setTimeout(() => {
            if (userInteracted || selected) return;
            finishSelect(card, rect, "match");
        }, 0);
        return;
    }
    scheduleAutoSelect();
}

function scheduleAutoSelect() {
    if (autoSelectTimer) clearTimeout(autoSelectTimer);
    autoSelectTimer = window.setTimeout(() => {
        autoSelectTimer = null;
        if (userInteracted || selected) return;
        const scored = cards
            .filter((card) => card.matchScore !== null && card.matchCrop)
            .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
        if (!scored.length) return;
        const best = scored[0];
        const second = scored[1];
        const bestScore = best.matchScore ?? 0;
        if (bestScore < 0.85) return;
        if (second && bestScore - (second.matchScore ?? 0) < 0.08) return;
        const rect = best.matchCrop ? cropToRect(best, best.matchCrop) : null;
        if (!rect) return;
        finishSelect(best, rect, "match");
        best.el.el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 1200);
}

function clearSelection() {
    for (const card of cards) {
        card.box?.remove();
        card.box = null;
        clearMask(card);
        card.el.style({ outline: "" });
    }
    selected = null;
    confirmBar.style({ display: "none" });
}

function setBoxRect(box: HTMLElement, rect: Rect) {
    box.style.left = `${rect.x}px`;
    box.style.top = `${rect.y}px`;
    box.style.width = `${rect.w}px`;
    box.style.height = `${rect.h}px`;
}

function createMask(card: SourceCard, rect: Rect) {
    const color = store.get("框选.颜色.遮罩");
    const layer = card.layer;
    const els = Array.from({ length: 4 }, () => {
        const el = document.createElement("div");
        el.style.cssText = `position:absolute;background:${color};pointer-events:none;z-index:1;`;
        layer.appendChild(el);
        return el;
    });
    const update = (r: Rect) => {
        const w = layer.clientWidth;
        const h = layer.clientHeight;
        const set = (
            el: HTMLDivElement,
            x: number,
            y: number,
            ww: number,
            hh: number,
        ) => {
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.style.width = `${Math.max(0, ww)}px`;
            el.style.height = `${Math.max(0, hh)}px`;
        };
        set(els[0], 0, 0, w, r.y);
        set(els[1], 0, r.y + r.h, w, h - (r.y + r.h));
        set(els[2], 0, r.y, r.x, r.h);
        set(els[3], r.x + r.w, r.y, w - (r.x + r.w), r.h);
    };
    update(rect);
    card.mask = els;
    return update;
}

function clearMask(card: SourceCard) {
    for (const el of card.mask) el.remove();
    card.mask = [];
}

function createSelectionBox(card: SourceCard, rect: Rect) {
    clearMask(card);
    const updateMask = createMask(card, rect);
    const box = document.createElement("div");
    box.style.cssText =
        "position:absolute;border:2px solid var(--emphasis-color);background:transparent;box-sizing:border-box;pointer-events:auto;cursor:move;z-index:2;";
    setBoxRect(box, rect);
    card.layer.appendChild(box);
    card.box = box;

    const b0 = card.bounds;
    if (b0 && card.video.videoWidth > 0) {
        const size = document.createElement("div");
        const pw = Math.round((rect.w / b0.w) * card.video.videoWidth);
        const ph = Math.round((rect.h / b0.h) * card.video.videoHeight);
        size.textContent = `${pw} × ${ph}`;
        size.style.cssText =
            "position:absolute;left:50%;top:0;transform:translateX(-50%);padding:2px var(--o-padding);border-radius:var(--border-radius);background:var(--bar-bg);color:var(--font-color);backdrop-filter:var(--blur);font-size:12px;pointer-events:none;white-space:nowrap;";
        box.appendChild(size);
    }

    box.addEventListener("pointerdown", (e) => {
        if (e.target !== box) return;
        e.stopPropagation();
        e.preventDefault();
        const b = card.bounds;
        if (!b) return;
        const sx = e.clientX;
        const sy = e.clientY;
        const start = { ...rect };
        let current = { ...rect };
        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - sx;
            const dy = ev.clientY - sy;
            current = {
                x: clamp(start.x + dx, b.x, b.x + b.w - start.w),
                y: clamp(start.y + dy, b.y, b.y + b.h - start.h),
                w: start.w,
                h: start.h,
            };
            setBoxRect(box, current);
            updateMask(current);
        };
        const onUp = (ev: PointerEvent) => {
            box.removeEventListener("pointermove", onMove);
            try {
                box.releasePointerCapture(ev.pointerId);
            } catch {}
            finishSelect(card, current, false);
        };
        box.addEventListener("pointermove", onMove);
        box.addEventListener("pointerup", onUp, { once: true });
        box.setPointerCapture(e.pointerId);
    });

    for (const [hx, hy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
    ] as const) {
        const handle = document.createElement("div");
        handle.style.cssText = `position:absolute;left:${hx * 100}%;top:${hy * 100}%;width:10px;height:10px;background:var(--bg);border:2px solid var(--emphasis-color);border-radius:50%;box-sizing:border-box;transform:translate(-50%,-50%);pointer-events:auto;cursor:${
            hx === hy ? "nwse-resize" : "nesw-resize"
        };`;
        handle.addEventListener("pointerdown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            const b = card.bounds;
            if (!b) return;
            const start = { ...rect };
            let current = { ...rect };
            const onMove = (ev: PointerEvent) => {
                const lr = card.layer.getBoundingClientRect();
                const x = clamp(ev.clientX - lr.left, b.x, b.x + b.w);
                const y = clamp(ev.clientY - lr.top, b.y, b.y + b.h);
                let left = start.x;
                let top = start.y;
                let right = start.x + start.w;
                let bottom = start.y + start.h;
                if (hx === 0) left = Math.min(x, right - 8);
                else right = Math.max(x, left + 8);
                if (hy === 0) top = Math.min(y, bottom - 8);
                else bottom = Math.max(y, top + 8);
                current = {
                    x: left,
                    y: top,
                    w: right - left,
                    h: bottom - top,
                };
                setBoxRect(box, current);
                updateMask(current);
            };
            const onUp = (ev: PointerEvent) => {
                handle.removeEventListener("pointermove", onMove);
                try {
                    handle.releasePointerCapture(ev.pointerId);
                } catch {}
                finishSelect(card, current, false);
            };
            handle.addEventListener("pointermove", onMove);
            handle.addEventListener("pointerup", onUp, { once: true });
            handle.setPointerCapture(e.pointerId);
        });
        box.appendChild(handle);
    }
}

function finishSelect(
    card: SourceCard,
    rect: Rect,
    auto: false | "match" = false,
) {
    const b = card.bounds;
    if (!b) return;
    const vw = card.video.videoWidth;
    const vh = card.video.videoHeight;
    const crop: NormRect = {
        x: clamp((rect.x - b.x) / b.w, 0, 1),
        y: clamp((rect.y - b.y) / b.h, 0, 1),
        w: clamp(rect.w / b.w, 0, 1),
        h: clamp(rect.h / b.h, 0, 1),
    };
    const sw = Math.max(1, Math.round(crop.w * vw));
    const sh = Math.max(1, Math.round(crop.h * vh));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(card.video, crop.x * vw, crop.y * vh, sw, sh, 0, 0, sw, sh);
    const poster = canvas.toDataURL("image/png");
    for (const c of cards) {
        c.box?.remove();
        c.box = null;
        clearMask(c);
        c.el.style({ outline: "" });
    }
    createSelectionBox(card, rect);
    card.el.style({ outline: "2px solid var(--emphasis-color)" });
    selected = { card, crop, poster };
    if (hintTimer) {
        clearTimeout(hintTimer);
        hintTimer = null;
    }
    headerHint?.sv(t("可拖动选框或拉角微调"));
    showConfirm(card, poster, auto);
}

function bindSelect(card: SourceCard) {
    const layer = card.layer;
    let start: { x: number; y: number } | null = null;
    let updateDragMask: ((rect: Rect) => void) | null = null;

    layer.addEventListener("pointerdown", (e) => {
        const b = card.bounds;
        if (!b) return;
        userInteracted = true;
        const r = layer.getBoundingClientRect();
        start = {
            x: clamp(e.clientX - r.left, b.x, b.x + b.w),
            y: clamp(e.clientY - r.top, b.y, b.y + b.h),
        };
        card.box?.remove();
        clearMask(card);
        const box = document.createElement("div");
        box.style.cssText =
            "position:absolute;border:2px solid var(--emphasis-color);background:transparent;pointer-events:none;box-sizing:border-box;z-index:2;";
        box.style.left = `${start.x}px`;
        box.style.top = `${start.y}px`;
        box.style.width = "0";
        box.style.height = "0";
        layer.appendChild(box);
        card.box = box;
        updateDragMask = createMask(card, {
            x: start.x,
            y: start.y,
            w: 0,
            h: 0,
        });
        layer.setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    layer.addEventListener("pointermove", (e) => {
        if (!start || !card.box) return;
        const b = card.bounds;
        if (!b) return;
        const r = layer.getBoundingClientRect();
        const x = clamp(e.clientX - r.left, b.x, b.x + b.w);
        const y = clamp(e.clientY - r.top, b.y, b.y + b.h);
        const rect = {
            x: Math.min(start.x, x),
            y: Math.min(start.y, y),
            w: Math.abs(x - start.x),
            h: Math.abs(y - start.y),
        };
        setBoxRect(card.box, rect);
        updateDragMask?.(rect);
    });

    layer.addEventListener("pointerup", (e) => {
        if (!start || !card.box || !card.bounds) return;
        const b = card.bounds;
        const r = layer.getBoundingClientRect();
        const x = clamp(e.clientX - r.left, b.x, b.x + b.w);
        const y = clamp(e.clientY - r.top, b.y, b.y + b.h);
        let rect: Rect = {
            x: Math.min(start.x, x),
            y: Math.min(start.y, y),
            w: Math.abs(x - start.x),
            h: Math.abs(y - start.y),
        };
        if (rect.w < 8 || rect.h < 8) rect = { ...b };
        start = null;
        updateDragMask = null;
        finishSelect(card, rect);
        try {
            layer.releasePointerCapture(e.pointerId);
        } catch {}
    });

    layer.addEventListener("pointercancel", () => {
        start = null;
        updateDragMask = null;
        card.box?.remove();
        card.box = null;
        clearMask(card);
    });
}

function showConfirm(
    card: SourceCard,
    poster: string,
    auto: false | "match" = false,
) {
    const label = auto === "match" ? t("已自动匹配") : "";
    confirmText.sv(
        `${label ? `${label} · ` : ""}${card.source.name || t("未知窗口")}`,
    );
    const image = new Image();
    image.onload = () => {
        confirmPreview.width = 160;
        confirmPreview.height = Math.max(
            1,
            Math.round((160 * image.height) / image.width),
        );
        confirmPreview
            .getContext("2d")
            ?.drawImage(
                image,
                0,
                0,
                confirmPreview.width,
                confirmPreview.height,
            );
    };
    image.src = poster;
    confirmBar.style({ display: "flex" });
}

function useSelection() {
    if (!selected) return;
    const video = selected.card.video;
    const aspect =
        (selected.crop.w * video.videoWidth) /
        (selected.crop.h * video.videoHeight);
    let w = selectionRect.w;
    let h = w / aspect;
    if (h > selectionRect.h) {
        h = selectionRect.h;
        w = h * aspect;
    }
    renderSend("dingLivePick", [
        {
            sourceId: selected.card.source.id,
            crop: selected.crop,
            poster: selected.poster,
            rect: {
                x: selectionRect.x + (selectionRect.w - w) / 2,
                y: selectionRect.y + (selectionRect.h - h) / 2,
                w,
                h,
            },
            title: selected.card.source.name,
        },
    ]);
}

function build(sources: CaptureSourceInfo[]) {
    loadingEl.style({ display: "none" });
    userInteracted = false;
    if (autoSelectTimer) {
        clearTimeout(autoSelectTimer);
        autoSelectTimer = null;
    }
    for (const card of cards) {
        const stream = card.video.srcObject as MediaStream | null;
        stream?.getTracks().forEach((track) => {
            track.stop();
        });
        card.video.srcObject = null;
    }
    selected = null;
    cards = [];
    rootEl?.remove();
    confirmBar?.el.remove();
    const root = view("y")
        .style({
            width: "100vw",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg)",
        })
        .addInto();
    rootEl = root.el;

    const single = sources.length === 1;
    headerHint = txt(t("正在自动匹配区域，也可以直接手动框选")).style({
        fontSize: "12px",
        color: "var(--font-color-l)",
    });
    const header = view("x")
        .attr({ id: "picker_header" })
        .class(Class.glassBar)
        .class(Class.transition)
        .add([
            txt(single ? t("已选择窗口") : t("选择要动态贴图的窗口")).style({
                fontSize: "16px",
                fontWeight: "600",
            }),
            headerHint,
            spacer(),
        ]);
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
        headerHint?.sv(t("可拖动选框或拉角微调"));
    }, 5000);
    if (single) {
        header.add(
            button(t("重新选择窗口"))
                .style({ width: "auto", padding: "4px 14px" })
                .on("click", () => {
                    loadingEl.style({ display: "flex" });
                    renderSend("dingPickerRefresh", []);
                }),
        );
    }
    header.add(
        button(t("取消"))
            .style({ width: "auto", padding: "4px 14px" })
            .on("click", () => renderSend("dingLiveCancel", [])),
    );
    const grid = view().attr({ id: "picker_grid" });
    if (single) grid.style({ display: "flex" });
    root.add(header).add(grid);

    confirmPreview = document.createElement("canvas");
    confirmPreview.style.cssText =
        "width:80px;height:auto;max-height:60px;object-fit:contain;background:var(--bg);border:1px solid var(--border-color);border-radius:var(--border-radius);";
    confirmText = txt().style({
        maxWidth: "240px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: "12px",
    });
    confirmBar = view("x")
        .attr({ id: "picker_confirm" })
        .class(Class.glassBar)
        .class(Class.transition)
        .style({ display: "none" })
        .add([
            confirmPreview,
            confirmText,
            button(t("重新选择"))
                .style({ width: "auto", padding: "4px 12px" })
                .on("click", clearSelection),
            button(t("使用这个区域"))
                .style({
                    width: "auto",
                    padding: "4px 14px",
                    backgroundColor: "var(--emphasis-color)",
                    color: "var(--font-color-emphasis)",
                })
                .on("click", useSelection),
            button(t("取消"))
                .style({ width: "auto", padding: "4px 14px" })
                .on("click", () => renderSend("dingLiveCancel", [])),
        ])
        .addInto();

    if (sources.length === 0) {
        grid.add(
            view("y")
                .style({
                    gridColumn: "1 / -1",
                    alignItems: "center",
                    padding: "60px 20px",
                    gap: "var(--o-padding)",
                })
                .add([
                    txt(t("没有可捕获的窗口")),
                    txt(
                        t("当前环境无法枚举窗口，或系统尚未授予屏幕录制权限"),
                    ).style({
                        fontSize: "12px",
                        color: "var(--font-color-l)",
                    }),
                    button(t("重新选择窗口"))
                        .style({ width: "auto", padding: "4px 14px" })
                        .on("click", () => {
                            loadingEl.style({ display: "flex" });
                            renderSend("dingPickerRefresh", []);
                        }),
                    button(t("取消"))
                        .style({ width: "auto", padding: "4px 14px" })
                        .on("click", () => renderSend("dingLiveCancel", [])),
                ]),
        );
        return;
    }

    cards = [];
    for (const source of sources) {
        const card = createCard(source, single);
        cards.push(card);
        grid.add(card.el);
        bindSelect(card);
    }

    if (cards.length <= 12) {
        for (const card of cards) void startCard(card);
    } else {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const card = cards.find((c) => c.el.el === entry.target);
                    if (card) void startCard(card);
                    observer.unobserve(entry.target);
                }
            },
            { root: grid.el, rootMargin: "200px" },
        );
        for (const card of cards) observer.observe(card.el.el);
    }

    window.addEventListener("resize", () => {
        for (const card of cards) {
            if (card.started) card.bounds = videoBounds(card);
        }
    });
}

renderOn("dingPickerInit", ([data]) => {
    selectionRect = data.rect;
    posterImagePromise = loadImageCached(data.poster);
    clearSelectionSafely();
    build(data.sources);
});

renderOn("dingPickerSources", ([sources]) => {
    build(sources);
});

function clearSelectionSafely() {
    selected = null;
    if (confirmBar) confirmBar.style({ display: "none" });
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") renderSend("dingLiveCancel", []);
});

document.addEventListener(
    "pointerdown",
    () => {
        userInteracted = true;
    },
    true,
);

document.addEventListener(
    "wheel",
    () => {
        userInteracted = true;
    },
    { capture: true, passive: true },
);

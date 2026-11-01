import type { Dire } from "../../ShareTypes";

/** 屏幕坐标下的矩形 */
export type Frame = { x: number; y: number; w: number; h: number };

const EDGE = 8;

/** 指针在贴图上的拖动方向 */
export function dire(el: HTMLElement, p: { x: number; y: number }): Dire {
    const rect = el.getBoundingClientRect();
    const pX = p.x - rect.left;
    const pY = p.y - rect.top;
    const width = rect.width;
    const height = rect.height;

    const w = () => 0 <= pX && pX <= EDGE;
    const e = () => width - EDGE <= pX && pX <= width;
    const n = () => 0 <= pY && pY <= EDGE;
    const s = () => height - EDGE <= pY && pY <= height;

    if (0 <= pX && pX <= width && 0 <= pY && pY <= height) {
        if (w() && n()) return "西北";
        if (w() && s()) return "西南";
        if (e() && n()) return "东北";
        if (e() && s()) return "东南";
        if (w()) return "西";
        if (e()) return "东";
        if (n()) return "北";
        if (s()) return "南";
        return "move";
    }
    return "";
}

let lastCursor: Dire = "";

export function cursor(d: Dire) {
    if (d === lastCursor) return;
    lastCursor = d;
    const m: Record<Dire, string> = {
        西北: "nwse-resize",
        东南: "nwse-resize",
        东北: "nesw-resize",
        西南: "nesw-resize",
        西: "ew-resize",
        东: "ew-resize",
        北: "ns-resize",
        南: "ns-resize",
        move: "default",
        "": "default",
    };
    (document.querySelector("html") as HTMLElement).style.cursor = m[d];
}

/** 指针相对元素的比例位置 */
export function dxdy(
    e: MouseEvent,
    el: { el: HTMLElement },
): { dx: number; dy: number } {
    const r = el.el.getBoundingClientRect();
    return {
        dx: (e.clientX - r.left) / el.el.offsetWidth,
        dy: (e.clientY - r.top) / el.el.offsetHeight,
    };
}

/**
 * 拖动（或缩放）后的矩形，保持比例并锚定拖动方向的对边
 * @param frame 起始矩形
 * @param direction 拖动方向
 * @param dx 指针在屏幕坐标下的偏移
 * @param dy 指针在屏幕坐标下的偏移
 */
export function calcFrame(
    frame: Frame,
    direction: Dire,
    dx: number,
    dy: number,
): Frame | null {
    const { x: ox, y: oy, w: ow, h: oh } = frame;
    if (direction === "move") {
        return { x: ox + dx, y: oy + dy, w: ow, h: oh };
    }
    if (ow <= 0 || oh <= 0) return null;

    const ratio = Math.atan(oh / ow);
    const k =
        direction === "西北" || direction === "东南"
            ? -1 / (oh / ow)
            : 1 / (oh / ow);
    const baseLen = Math.sqrt(ow ** 2 + oh ** 2);
    let target: Frame | null = null;

    switch (direction) {
        case "西北": {
            const d = (k * dx - dy) / Math.sqrt(k ** 2 + 1) + baseLen;
            const w = d * Math.cos(ratio);
            const h = d * Math.sin(ratio);
            target = { x: ox + ow - w, y: oy + oh - h, w, h };
            break;
        }
        case "东南": {
            const d = -(k * dx - dy) / Math.sqrt(k ** 2 + 1) + baseLen;
            const w = d * Math.cos(ratio);
            const h = d * Math.sin(ratio);
            target = { x: ox, y: oy, w, h };
            break;
        }
        case "东北": {
            const d = (k * dx - dy) / Math.sqrt(k ** 2 + 1) + baseLen;
            const w = d * Math.cos(ratio);
            const h = d * Math.sin(ratio);
            target = { x: ox, y: oy + oh - h, w, h };
            break;
        }
        case "西南": {
            const d = -(k * dx - dy) / Math.sqrt(k ** 2 + 1) + baseLen;
            const w = d * Math.cos(ratio);
            const h = d * Math.sin(ratio);
            target = { x: ox + ow - w, y: oy, w, h };
            break;
        }
        case "西": {
            const r = (ow - dx) / ow;
            target = { x: ox + dx, y: oy, w: ow - dx, h: oh * r };
            break;
        }
        case "东": {
            const r = (ow + dx) / ow;
            target = { x: ox, y: oy, w: ow + dx, h: oh * r };
            break;
        }
        case "北": {
            const r = (oh - dy) / oh;
            target = { x: ox, y: oy + dy, w: ow * r, h: oh - dy };
            break;
        }
        case "南": {
            const r = (oh + dy) / oh;
            target = { x: ox, y: oy, w: ow * r, h: oh + dy };
            break;
        }
        default:
            return null;
    }
    return target;
}

/**
 * 以 zoom 缩放后的矩形
 * @param frame 当前矩形
 * @param base 初始矩形（100% 大小）
 * @param dx 缩放时保持不动的横向比例位置（0 左，1 右）
 * @param dy 缩放时保持不动的纵向比例位置（0 上，1 下）
 */
export function resizeFrame(
    frame: Frame,
    base: [number, number, number, number],
    zoom: number,
    dx: number,
    dy: number,
): Frame {
    const w = base[2] * zoom;
    const h = base[3] * zoom;
    const px = frame.x + frame.w * dx;
    const py = frame.y + frame.h * dy;
    return { x: px - w * dx, y: py - h * dy, w, h };
}

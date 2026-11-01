import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import type { Dire } from "../../ShareTypes";
import { createDingItem, type DingItem, type DingItemData } from "./item";
import { calcFrame, cursor, dire, type Frame, resizeFrame } from "./layout";

const MIN_ZOOM = 0.05;

/** Wayland 下读不到窗口位置、也不能程序移动，改用系统原生拖动 */
function isNativeDrag() {
    if (process.platform !== "linux") return false;
    const ozone = process.argv.find((a) => a.startsWith("--ozone-platform="));
    if (ozone) return ozone === "--ozone-platform=wayland";
    // 拿不到平台参数时按会话和窗口位置猜测
    return (
        process.env.XDG_SESSION_TYPE === "wayland" &&
        window.screenX === 0 &&
        window.screenY === 0
    );
}

/** 每个贴图一个系统窗口：窗口本身就是贴图的矩形 */
export function init() {
    let item: DingItem | null = null;
    let base: [number, number, number, number] = [0, 0, 0, 0];
    let frame: Frame = { x: 0, y: 0, w: 0, h: 0 };
    let dragging = false;
    /** 无法程序移动窗口（Wayland），改用系统原生拖动 */
    let nativeDrag = false;
    let direction: Dire = "";
    let startFrame: Frame = frame;
    let startAbs = { x: 0, y: 0 };

    const zoomOf = (width: number) => (base[2] ? width / base[2] : 1);

    function applyFrame(f: Frame, zoom = zoomOf(f.w)) {
        frame = f;
        item?.setSize(zoom);
        item?.setToolbarZoom(f.w);
        item?.setImageRendering(zoom);
        renderSend("dingSetBounds", [
            Math.round(f.x),
            Math.round(f.y),
            Math.max(1, Math.round(f.w)),
            Math.max(1, Math.round(f.h)),
        ]);
    }

    function back() {
        applyFrame({ x: base[0], y: base[1], w: base[2], h: base[3] }, 1);
        item?.setOpacity(100);
    }

    function zoomTo(zoom: number, dx: number, dy: number) {
        const z = Math.max(zoom, MIN_ZOOM);
        applyFrame(resizeFrame(frame, base, z, dx, dy), z);
    }

    renderOn("dingInit", ([id, x, y, w, h, url, type]) => {
        if (item) return;
        nativeDrag = isNativeDrag();
        base = [x, y, w, h];
        frame = { x, y, w, h };
        const data: DingItemData = {
            id: String(id),
            rect: base,
            url,
            translation: "",
            isTranslate: false,
        };
        item = createDingItem({
            data,
            single: true,
            nativeDrag,
            zoom: zoomTo,
            close: () => renderSend("windowClose", []),
            back,
        });
        item.el.style({
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
        });
        item.el.addInto();
        applyFrame(frame, 1);

        if (type === "translate") {
            item.translate();
        }
    });

    renderOn("dingMouse", ([x, y, absX, absY]) => {
        if (!item || nativeDrag || absX === undefined || absY === undefined)
            return;
        if (dragging) {
            const dx = absX - startAbs.x;
            const dy = absY - startAbs.y;
            if (direction === "move") {
                applyFrame({
                    x: startFrame.x + dx,
                    y: startFrame.y + dy,
                    w: startFrame.w,
                    h: startFrame.h,
                });
            } else {
                const target = calcFrame(startFrame, direction, dx, dy);
                if (target) applyFrame(target);
            }
        } else {
            cursor(dire(item.el.el, { x, y }));
        }
    });

    document.onmousedown = (e) => {
        if (!item || nativeDrag) return;
        const el = e.target as HTMLElement;
        const stickerImg = el.tagName === "IMG" && !el.closest("#tool_bar_c");
        if (el.id !== "tool_bar_c" && !stickerImg) return;
        const { ab, po } = renderSendSync("getMousePos", []);
        frame = {
            x: ab.x - po.x,
            y: ab.y - po.y,
            w: window.outerWidth,
            h: window.outerHeight,
        };
        startFrame = { ...frame };
        startAbs = { x: frame.x + e.clientX, y: frame.y + e.clientY };
        direction = dire(item.el.el, {
            x: e.clientX,
            y: e.clientY,
        });
        dragging = true;
        cursor(direction);
    };

    document.onmouseup = () => {
        if (!dragging) return;
        dragging = false;
        direction = "";
        cursor(direction);
    };

    // 窗口被窗口管理器改变大小时同步
    window.addEventListener("resize", () => {
        if (dragging) return;
        frame.w = window.outerWidth;
        frame.h = window.outerHeight;
        item?.setSize(zoomOf(frame.w));
        item?.setToolbarZoom(frame.w);
    });

    // 拖动时鼠标在窗口外松开可能收不到 mouseup，失去焦点时结束拖动
    window.addEventListener("blur", () => {
        if (!dragging) return;
        dragging = false;
        direction = "";
        cursor(direction);
    });
}

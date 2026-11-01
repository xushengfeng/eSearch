import {
    addClass,
    addStyle,
    button,
    type ElType,
    image,
    trackPoint,
    view,
} from "dkh-ui";
import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import store from "../../../lib/store/renderStore";
import type { DingStart, Dire } from "../../ShareTypes";
import { Class, cssVar } from "../root/root";
import {
    createDingItem,
    type DingItem,
    type DingItemData,
    getUrl,
    iconEl,
} from "./item";
import {
    calcFrame,
    cursor,
    dire,
    dxdy,
    type Frame,
    resizeFrame,
} from "./layout";

/** 全屏覆盖层窗口之间共享的贴图列表，窗口只是画布 */
const items = new Map<string, DingItem>();

let photoEl: ElType<HTMLElement>;

/** 最高窗口 */
let toppest = 1;

let windowDiv: ElType<HTMLElement> | null = null;
let changing: { x: number; y: number } | null = null;
let oPs: Frame | null = null;
let direction: Dire = "";
let resizeSender = false;

function itemOf(el: HTMLElement) {
    for (const item of items.values()) {
        if (item.el.el.contains(el)) return item;
    }
}

function front(id: string) {
    const item = items.get(id);
    if (!item) return;
    item.el.el.style.zIndex = String(toppest + 1);
    dockEl.el.style.zIndex = String(toppest + 2);
    toppest += 1;
}

function back(id: string) {
    renderSend("dingShare", [{ type: "back", id }]);
}

function back2(id: string) {
    const item = items.get(id);
    if (!item) return;
    const pS = item.data.rect;
    item.el.el.style.transition = cssVar("transition");
    setTimeout(() => {
        item.el.el.style.transition = "";
        resizeSender = true;
        resize(id, 1, 0, 0);
        resizeSender = false;
    }, 400);
    item.el.style({
        left: `${pS[0]}px`,
        top: `${pS[1]}px`,
        width: `${pS[2]}px`,
        height: `${pS[3]}px`,
    });
    item.setImageFrame(null);
    item.setOpacity(100);
}

function close(id: string) {
    renderSend("dingShare", [
        { type: "close", id, closeAll: items.size === 1 },
    ]);
}

function close2(id: string) {
    items.get(id)?.el.remove();
    items.delete(id);
    dockI();
}

// dock
const dockP = store.get("ding_dock");

const dockClassSmall = addClass(
    {
        height: "40px",
        width: "12px",
        left: "var(--dock-left)",
        top: "var(--dock-top)",
    },
    {},
);

const dockEl = view()
    .attr({ id: "dock" })
    .bindSet((v: { x: number; y: number }) => {
        dockEl.style({
            "--dock-left": `${v.x}px`,
            "--dock-top": `${v.y}px`,
        });
    })
    .style({
        position: "fixed",
        zIndex: "2",
    })
    .class(Class.screenBar)
    .class(dockClassSmall);

const dockClassBigLeft = addClass(
    {
        height: "100%",
        width: "200px",
        top: "0",
        left: "0",
        borderRadius: "0",
    },
    {},
);

const dockClassBigRight = addClass(
    {
        height: "100%",
        width: "200px",
        top: "0",
        left: "calc(100vw - 200px)",
        borderRadius: "0",
    },
    {},
);

const dockView = view().style({
    overflowX: "hidden",
    overflowY: "auto",
    width: "100%",
    display: "none",
});

let dockShow = false;

function showDock() {
    dockShow = !dockShow;
    if (dockShow) {
        if (
            dockEl.el.offsetLeft + 5 <=
            (document.querySelector("html") as HTMLElement).offsetWidth / 2
        ) {
            dockEl.el.classList.remove(dockClassBigRight);
            dockEl.el.classList.add(dockClassBigLeft);
        } else {
            dockEl.el.classList.remove(dockClassBigLeft);
            dockEl.el.classList.add(dockClassBigRight);
        }
        dockView.style({ display: "block" });
    } else {
        dockEl.el.classList.remove(dockClassBigLeft);
        dockEl.el.classList.remove(dockClassBigRight);
        dockEl.el.style.transition = "";
        dockView.style({ display: "none" });
    }
}

function dockI() {
    dockView.clear();
    for (const [id, item] of items) {
        let iIgnore_v = false;
        let iTran_v = -1;

        const dockItem = view();
        const iPhoto = image(getUrl(item.data), "预览")
            .style({ width: "100%" })
            .on("click", () => {
                const div = document.getElementById(id);
                if (div?.classList.contains(minimizeClass)) {
                    div.style.transition = cssVar("transition");
                    setTimeout(() => {
                        div.style.transition = "";
                    }, 400);
                    div.classList.remove(minimizeClass);
                } else {
                    back(id);
                }
                if (div) div.style.zIndex = String(toppest + 1);
                toppest += 1;
            });
        const iClose = view()
            .add(iconEl("close"))
            .attr({ title: "关闭" })
            .on("click", () => {
                close(id);
            });
        const iIgnore = view()
            .add(iconEl("ignore"))
            .attr({ title: "鼠标穿透" })
            .on("click", () => {
                iIgnore_v = !iIgnore_v;
                ignore(id, iIgnore_v);
            });
        const iTran = view()
            .add(iconEl("replace"))
            .attr({ title: "窗口变换" })
            .on("click", () => {
                iTran_v = iTran_v === -1 ? 0 : -1;
                item.transform(iTran_v);
            });

        dockItem
            .add([
                view("x")
                    .add([iTran, iIgnore, iClose])
                    .style({
                        position: "absolute",
                        right: "8px",
                        borderRadius: cssVar("o-padding"),
                    })
                    .class(Class.smallSize, Class.glassBar),
                iPhoto,
            ])
            .addInto(dockView);
    }
}

const minimizeClass = addClass(
    {
        opacity: "0 !important",
        // @ts-expect-error
        pointerEvents: "none !important",
    },
    {},
);

function minimize(el: HTMLElement) {
    el.style.transition = cssVar("transition");
    setTimeout(() => {
        el.style.transition = "";
    }, 400);
    el.classList.add(minimizeClass);
}

let ignoreEl: HTMLElement[] = [];
function ignore(id: string, v: boolean) {
    const el = items.get(id)?.el.el;
    if (!el) return;
    if (v) {
        ignoreEl.push(el);
    } else {
        ignoreEl = ignoreEl.filter((e) => e !== el);
    }
}

function move(el: ElType<HTMLElement>, e: { x: number; y: number }) {
    if (changing == null || !oPs) return;
    const dx = e.x - changing.x;
    const dy = e.y - changing.y;
    const target = calcFrame(oPs, direction, dx, dy);
    if (!target) return;
    if (direction === "move") {
        el.style({
            left: `${target.x}px`,
            top: `${target.y}px`,
            width: `${target.w}px`,
            height: `${target.h}px`,
        });
        return;
    }
    const item = items.get(el.el.id);
    if (!item) return;
    const zoom = target.w / item.data.rect[2];
    const anchorX =
        direction === "西北" || direction === "西南" || direction === "西"
            ? 1
            : 0;
    const anchorY =
        direction === "西北" || direction === "东北" || direction === "北"
            ? 1
            : 0;
    resize(el.el.id, zoom, anchorX, anchorY);
}

function resize(
    id: string,
    zoom: number,
    dx: number,
    dy: number,
    clip?: boolean,
) {
    const item = items.get(id);
    if (!item) return;
    const el = item.el;
    const frame = {
        x: el.el.offsetLeft,
        y: el.el.offsetTop,
        w: el.el.offsetWidth,
        h: el.el.offsetHeight,
    };
    item.setSize(zoom);
    const target = resizeFrame(frame, item.data.rect, zoom, dx, dy);
    const useClip = !!clip && target.w >= frame.w;

    if (useClip) {
        item.setImageFrame({
            x: target.x - frame.x,
            y: target.y - frame.y,
            w: target.w,
            h: target.h,
        });
    } else {
        item.setImageFrame(null);
        el.style({
            left: `${target.x}px`,
            top: `${target.y}px`,
            width: `${target.w}px`,
            height: `${target.h}px`,
        });
        item.setToolbarZoom(target.w);
    }

    item.setImageRendering(zoom);

    if (resizeSender)
        renderSend("dingShare", [
            { type: "resize", more: { id: id, zoom, dx, dy, clip } },
        ]);
}

function mouseStart(op: DingStart) {
    const item = items.get(op.id);
    if (!item) return;
    windowDiv = item.el;
    const {
        po: { x, y },
    } = renderSendSync("getMousePos", []);
    windowDiv.style({
        left: `${x - windowDiv.el.offsetWidth * op.dx}px`,
        top: `${y - windowDiv.el.offsetHeight * op.dy}px`,
    });
    oPs = {
        x: windowDiv.el.offsetLeft,
        y: windowDiv.el.offsetTop,
        w: windowDiv.el.offsetWidth,
        h: windowDiv.el.offsetHeight,
    };
    changing = { x: x, y: y };
    direction = op.d;
    cursor(direction);
}

function mouseMove(el: HTMLElement | undefined, x: number, y: number) {
    if (direction) {
        if (windowDiv) move(windowDiv, { x, y });
    } else if (!el) {
        cursor("");
    } else {
        const item = itemOf(el);
        if (item) {
            cursor(dire(item.el.el, { x, y }));
        } else {
            cursor("");
        }
    }
}

function mouseEnd() {
    oPs = null;
    changing = null;
    windowDiv = null;
    direction = "";
    cursor(direction);
}

export function init() {
    addStyle({
        body: {
            width: "100vw",
            height: "100vh",
            "--hover-color": "var(--bar-hover-color) !important;",
        },
    });

    photoEl = view().style({ width: "100%", height: "100%" }).addInto();

    dockEl.addInto();
    dockView.addInto(dockEl);
    dockEl.sv({ x: dockP[0], y: dockP[1] });

    trackPoint(dockEl, {
        start: () => {
            dockEl.el.style.transition = "0s";
            return { x: dockEl.el.offsetLeft, y: dockEl.el.offsetTop };
        },
        ing: (p) => {
            dockEl.sv(p);
            return p;
        },
        end: (_, { moved, ingData }) => {
            if (!moved) {
                showDock();
            } else {
                store.set("ding_dock", [ingData.x, ingData.y]);
            }
            dockEl.el.style.transition = cssVar("transition");
        },
    });

    renderOn("dingShare", ([data]) => {
        console.log(data);
        switch (data.type) {
            case "close":
                close2(data.id);
                break;
            case "move_start":
                mouseStart(data.more);
                break;
            case "move_end":
                mouseEnd();
                break;
            case "back":
                back2(data.id);
                break;
            case "resize":
                if (!resizeSender) {
                    const more = data.more;
                    resize(more.id, more.zoom, more.dx, more.dy, more.clip);
                }
                break;
        }
    });

    renderOn("dingMouse", ([x, y]) => {
        const els = document.elementsFromPoint(x, y);
        let ignorex = false;
        for (const el of ignoreEl) {
            if (els.includes(el)) {
                ignorex = true;
                break;
            }
        }
        if (els[0] === photoEl.el || ignorex) {
            renderSend("dingIgnore", [true]);
        } else {
            renderSend("dingIgnore", [false]);
        }

        mouseMove(els[0] as HTMLElement, x, y);
    });

    renderOn("addDing", ([wid, x, y, w, h, url, type]) => {
        addDing(String(wid), x, y, w, h, url, type);
    });

    document.onmousedown = (e) => {
        const el = e.target as HTMLElement;
        const item = itemOf(el);
        if (item && (el.id === "tool_bar_c" || el.tagName === "IMG")) {
            const { dx, dy } = dxdy(e, item.el);
            renderSend("dingShare", [
                {
                    type: "move_start",
                    more: {
                        id: item.data.id,
                        dx,
                        dy,
                        d: dire(item.el.el, {
                            x: e.clientX,
                            y: e.clientY,
                        }),
                    },
                },
            ]);
        }
        resizeSender = true;
    };

    document.onmouseup = () => {
        renderSend("dingShare", [{ type: "move_end" }]);
        resizeSender = false;
    };
}

function addDing(
    wid: string,
    x: number,
    y: number,
    w: number,
    h: number,
    url: string,
    type: "translate" | "ding",
) {
    const data: DingItemData = {
        id: wid,
        rect: [x, y, w, h],
        url,
        translation: "",
        isTranslate: false,
    };
    const item = createDingItem({
        data,
        single: false,
        zoom: (zoom, dx, dy, clip) => {
            resizeSender = true;
            resize(wid, zoom, dx, dy, clip);
            resizeSender = false;
        },
        close: () => close(wid),
        back: () => back(wid),
        minimize: minimize,
        front: () => front(wid),
    });
    item.el.style({
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
    });
    items.set(wid, item);
    photoEl.add(item.el);

    dockI();
    resize(wid, 1, 0, 0);

    if (type === "translate") {
        item.translate();
    }
}

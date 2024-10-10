const { ipcRenderer, clipboard, nativeImage } =
    require("electron") as typeof import("electron");
const fs = require("node:fs") as typeof import("fs");
const path = require("node:path") as typeof import("path");
const os = require("node:os") as typeof import("os");
import { getImgUrl, initStyle } from "../root/root";
import store from "../../../lib/store/renderStore";
import xtranslator from "xtranslator";
import {
    button,
    ele,
    elFromId,
    type ElType,
    frame,
    image,
    input,
    txt,
    view,
} from "dkh-ui";
initStyle(store);

let lo: import("esearch-ocr").initType;
let translateE = async (input: string[]) => input;

// @auto-path:../assets/icons/$.svg
function iconEl(src: string) {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}

ipcRenderer.on("ding", (_event, type, id, more) => {
    console.log(type, id, more);
    switch (type) {
        case "close":
            close2(document.getElementById(id));
            break;
        case "move_start":
            mouseStart(more);
            break;
        case "move_end":
            mouseEnd();
            break;
        case "back":
            back2(id);
            break;
        case "resize":
            if (!resizeSender)
                resize(
                    elFromId(more.id),
                    more.zoom,
                    more.dx,
                    more.dy,
                    more.clip,
                );
            break;
    }
});

function sendEvent(
    type: "close" | "move_start" | "move_end" | "back" | "resize",
    id: string,
    more?: unknown,
) {
    ipcRenderer.send("ding_event", type, id, more);
}

const dives: ElType<HTMLElement>[] = [];

let changing: { x: number; y: number } = null;
const photos: { [key: string]: [number, number, number, number] } = {};
let elMap: ReturnType<typeof setNewDing>[] = [];
const urls = {};
const setNewDing = (
    wid: string,
    x: number,
    y: number,
    w: number,
    h: number,
    url: string,
    type: "translate" | "ding",
) => {
    photos[wid] = [x, y, w, h];
    urls[wid] = url;
    const div = view().attr({ id: wid }).class("ding_photo");
    dives.push(div);
    if (store.get("贴图.窗口.提示")) div.class("ding_photo_h");
    div.style({
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
    });
    const img = image(url, "").attr({ draggable: false }).class("img");
    const toolBar = view().attr({ id: "tool_bar" });
    const toolBarC = view("x").attr({ id: "tool_bar_c" });
    toolBar.add(toolBarC);
    // 顶栏
    div.el.onmouseenter = () => {
        toolBarC.el.style.transform = "translateY(0)";
    };
    div.el.onmouseleave = () => {
        toolBarC.el.style.transform = "translateY(-105%)";
    };
    // 透明
    const opacityEl = frame("opacity", {
        _: view().attr({ id: "opacity" }),
        icon: view().class("opacity").add(iconEl("opacity")),
        input: input("range")
            .attr({ id: "透明度", min: "0", max: "100" })
            .on("input", (_, el) => {
                opacityElP.sv(el.gv);
            }),
        p: txt()
            .attr({ id: "透明度_p" })
            .bindSet((v: string, el) => {
                el.innerText = `${v}%`;
            }),
    });

    const opacityElP = opacityEl.el
        .bindSet((v: string) => {
            img.el.style.opacity = `${Number(v) / 100}`;
            opacityEl.els.input.sv(v);
            opacityEl.els.p.sv(v);
        })
        .sv("100");
    toolBarC.add(opacityElP);
    // 大小
    const sizeEl = view()
        .attr({ id: "window_size" })
        .add(view().class("size").add(iconEl("size")));
    const sizeInput = input("number")
        .on("blur", sizeChange)
        .on("change", sizeChange)
        .sv("100");

    function sizeChange() {
        if (Number.isFinite(Number(sizeInput.gv))) {
            let zoom = Number(sizeInput.gv) / 100;
            if (zoom < 0.05) zoom = 0.05;
            resizeSender = true;
            resize(div, zoom, 0, 0);
            resizeSender = false;
        }
    }

    toolBarC.add(
        sizeEl.add(ele("span").attr({ id: "size" }).add([sizeInput, "%"])),
    );

    // 滚轮缩放
    div.el.onwheel = (e) => {
        if (e.deltaY !== 0) {
            let zoom = Number(sizeInput.gv) / 100;
            const zz = 1 + Math.abs(e.deltaY) / 300;
            zoom = e.deltaY > 0 ? zoom / zz : zoom * zz;
            if (zoom < 0.05) zoom = 0.05;
            resizeSender = true;
            const d = dxdy(e, e.ctrlKey ? img : div);
            resize(div, zoom, d.dx, d.dy, e.ctrlKey);
            resizeSender = false;
        }
    };
    // 工具栏
    toolBarC.add(
        view()
            .attr({ id: "b" })
            .add([
                button(iconEl("free_draw")).on("click", () => {
                    edit(wid);
                }),
                button(iconEl("save")).on("click", () => {
                    save(wid);
                }),
                button(iconEl("copy")).on("click", () => {
                    copy(wid);
                }),
                button(iconEl("minimize")).on("click", () => {
                    minimize(div.el);
                }),
                button(iconEl("back")).on("click", () => {
                    back(wid);
                }),
                button(iconEl("close")).on("click", () => {
                    close(wid);
                }),
            ]),
    );
    // 双击行为
    div.el.ondblclick = () => {
        if (store.get("贴图.窗口.双击") === "归位") back(wid);
        else close(wid);
    };
    // 放到前面
    div.el.onclick = () => {
        div.el.style.zIndex = String(toppest + 1);
        document.getElementById("dock").style.zIndex = String(toppest + 2);
        toppest += 1;
    };
    div.add(toolBar).add(img);
    document.querySelector("#photo").appendChild(div.el);

    // dock
    dockI();

    resize(div, 1, 0, 0);

    if (type === "translate") {
        const transE = store.get("翻译.翻译器");

        if (transE.length > 0) {
            const x = transE[0];
            // @ts-ignore
            xtranslator.e[x.type].setKeys(x.keys);
            const lan = store.get("屏幕翻译.语言");
            translateE = (input: string[]) =>
                // @ts-ignore
                xtranslator.e[x.type].run(input, lan.from, lan.to);
        }
        initOCR().then(async () => {
            const p = await ocr(url);
            transAndDraw(div, p);
        });
    }

    return {
        opacity: (v: string) => opacityElP.sv(v),
        size: (v: string) => sizeInput.sv(v),
        id: wid,
    };
};

async function initOCR() {
    const l = store.get("离线OCR").find((i) => i[0] === "默认");
    function ocrPath(p: string) {
        return path.join(
            path.isAbsolute(p) ? "" : path.join(__dirname, "../../ocr/ppocr"),
            p,
        );
    }
    const detp = ocrPath(l[1]);
    const recp = ocrPath(l[2]);
    const 字典 = ocrPath(l[3]);
    if (!lo) {
        const localOCR = require("esearch-ocr") as typeof import("esearch-ocr");
        const ort = require("onnxruntime-node");
        const provider = store.get("AI.运行后端") || "cpu";
        lo = await localOCR.init({
            detPath: detp,
            recPath: recp,
            dic: fs.readFileSync(字典).toString(),
            detShape: [640, 640],
            ort,
            ortOption: { executionProviders: [{ name: provider }] },
        });
    }
}

ipcRenderer.on("mouse", (_e, x, y) => {
    const els = document.elementsFromPoint(x, y);
    let ignorex = false;
    for (const el of ignoreEl) {
        if (els.includes(el)) {
            ignorex = true;
            break;
        }
    }
    if (els[0] === document.getElementById("photo") || ignorex) {
        ipcRenderer.send("ding_ignore", true);
    } else {
        ipcRenderer.send("ding_ignore", false);
    }

    mouseMove(els[0] as HTMLElement, x, y);
});

function minimize(el: HTMLElement) {
    el.style.transition = "var(--transition)";
    setTimeout(() => {
        el.style.transition = "";
    }, 400);
    el.classList.add("minimize");
}
let ignoreEl = [];
function ignore(el: HTMLElement, v: boolean) {
    if (v) {
        ignoreEl.push(el);
    } else {
        ignoreEl = ignoreEl.filter((e) => e !== el);
    }
}
const tranStyle = document.createElement("style");
tranStyle.innerHTML = `.tran{${store.get("贴图.窗口.变换")}}`;
document.body.appendChild(tranStyle);
/**
 * 窗口变换
 * @param {HTMLElement} el 窗口
 * @param {boolean} v 是否变换
 */
function transform(el, v) {
    if (v) {
        el.querySelector(".img").classList.add("tran");
    } else {
        el.querySelector(".img").classList.remove("tran");
    }
}
function back(id: string) {
    sendEvent("back", id);
}
function back2(id: string) {
    const el = elFromId(id);
    el.el.style.transition = "var(--transition)";
    setTimeout(() => {
        el.el.style.transition = "";
        resizeSender = true;
        resize(el, 1, 0, 0);
        resizeSender = false;
    }, 400);
    const pS = photos[el.el.id];
    el.style({
        left: `${pS[0]}px`,
        top: `${pS[1]}px`,
        width: `${pS[2]}px`,
        height: `${pS[3]}px`,
    });
    el.query(".img").style({
        left: "0",
        top: "0",
        width: "100%",
        height: "",
    });
    ipcRenderer.send("ding_p_s", el.el.id, pS);

    const x = elMap.find((e) => e.id === id);
    if (!x) return;
    x.opacity("100");
}
function close(id: string) {
    ipcRenderer.send(
        "ding_event",
        "close",
        id,
        Object.keys(photos).length === 1,
    );
}
function close2(el: HTMLElement) {
    el.remove();
    delete photos[el.id];
    delete urls[el.id];
    elMap = elMap.filter((e) => e.id !== el.id);
    dockI();
}
function copy(id: string) {
    clipboard.writeImage(nativeImage.createFromDataURL(urls[id]));
}
function save(id: string) {
    const b = Buffer.from(
        urls[id].replace(/^data:image\/\w+;base64,/, ""),
        "base64",
    );
    // todo 自动保存
    const save = ipcRenderer.sendSync("get_save_file_path", "png");
    fs.writeFileSync(save, b);
}
function edit(id: string) {
    const b = Buffer.from(
        urls[id].replace(/^data:image\/\w+;base64,/, ""),
        "base64",
    );
    const save = path.join(
        os.tmpdir(),
        "eSearch",
        `${new Date().getTime()}.png`,
    );
    fs.writeFile(save, b, () => {
        ipcRenderer.send("ding_edit", save);
    });
}

async function ocr(img: string) {
    const p = await lo.ocr(img);
    return p.parragraphs;
}

function transAndDraw(
    el: ElType<HTMLElement>,
    p: Awaited<ReturnType<typeof ocr>>,
) {
    const canvas = ele("canvas")
        .attr({
            width: photos[el.el.id][2],
            height: photos[el.el.id][3],
        })
        .addInto(el).el;
    const ctx = canvas.getContext("2d");
    console.log(p);
}

// 最高窗口
let toppest = 1;
let oPs: number[];
let windowDiv: ElType<HTMLElement> = null;

let resizeSender = false;

type start = {
    id: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
    d: string;
};

type Resize = {
    id: string;
    zoom: number;
    dx: number;
    dy: number;
    clip: boolean;
};

document.onmousedown = (e) => {
    const el = e.target as HTMLElement;
    const div = dives.find((d) => d.el.contains(el));
    if (div && (el.id === "tool_bar_c" || el.tagName === "IMG")) {
        const { dx, dy } = dxdy(e, div);
        sendEvent("move_start", null, {
            id: div.el.id,
            x: e.clientX,
            y: e.clientY,
            dx,
            dy,
            d: dire(div.el, { x: e.clientX, y: e.clientY }),
        } as start);
    }
    resizeSender = true;
};
function mouseStart(op: start) {
    windowDiv = elFromId(op.id);
    const div = windowDiv;
    div.style({
        left: `${op.x - div.el.offsetWidth * op.dx}px`,
        top: `${op.y - div.el.offsetHeight * op.dy}px`,
    });
    oPs = [
        div.el.offsetLeft,
        div.el.offsetTop,
        div.el.offsetWidth,
        div.el.offsetHeight,
    ];
    changing = { x: op.x, y: op.y };
    direction = op.d;
    cursor(direction);
}
function mouseMove(el: HTMLElement, x: number, y: number) {
    if (direction) {
        move(windowDiv, { x, y });
    } else {
        const div = dives.find((d) => d.el.contains(el));
        if (div && (el.id === "tool_bar_c" || el.tagName === "IMG")) {
            const d = dire(div.el, { x, y });
            cursor(d);
        }
    }
}
document.onmouseup = (_e) => {
    sendEvent("move_end", null);
    resizeSender = false;
};
function mouseEnd() {
    oPs = [];
    changing = null;
    windowDiv = null;
    direction = "";
    cursor(direction);
}

let direction = "";
function dire(el: HTMLElement, e: { x: number; y: number }) {
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const pX = e.x - el.offsetLeft;
    const pY = e.y - el.offsetTop;
    let direction = "";

    const num = 8;
    // 光标样式
    switch (true) {
        case pX <= num && pY <= num:
            direction = "西北";
            break;
        case pX >= width - num && pY >= height - num:
            direction = "东南";
            break;
        case pX >= width - num && pY <= num:
            direction = "东北";
            break;
        case pX <= num && pY >= height - num:
            direction = "西南";
            break;
        case pX <= num:
            direction = "西";
            break;
        case pX >= width - num:
            direction = "东";
            break;
        case pY <= num:
            direction = "北";
            break;
        case pY >= height - num:
            direction = "南";
            break;
        case num < pX && pX < width - num && num < pY && pY < height - num:
            direction = "move";
            break;
        default:
            direction = "";
            break;
    }
    return direction;
}

function cursor(d: string) {
    const m = {
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
    document.querySelector("html").style.cursor = m[d];
}

function move(el: ElType<HTMLElement>, e: { x: number; y: number }) {
    if (changing != null && oPs.length !== 0) {
        const oE = changing;
        const dx = e.x - oE.x;
        const dy = e.y - oE.y;
        const [ox, oy, ow, oh] = oPs;
        let pS: [number, number, number, number];
        const zp = { x: 0, y: 0 };
        switch (direction) {
            case "西北": {
                const k = -1 / (oh / ow);
                const d =
                    (k * dx - dy) / Math.sqrt(k ** 2 + 1) +
                    Math.sqrt(ow ** 2 + oh ** 2);
                const w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                const h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox + ow - w, oy + oh - h, w, h];
                zp.x = 1;
                zp.y = 1;
                break;
            }
            case "东南": {
                const k = -1 / (oh / ow);
                const d =
                    -(k * dx - dy) / Math.sqrt(k ** 2 + 1) +
                    Math.sqrt(ow ** 2 + oh ** 2);
                const w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                const h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox, oy, w, h];
                break;
            }
            case "东北": {
                const k = 1 / (oh / ow);
                const d =
                    (k * dx - dy) / Math.sqrt(k ** 2 + 1) +
                    Math.sqrt(ow ** 2 + oh ** 2);
                const w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                const h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox, oy + oh - h, w, h];
                zp.y = 1;
                break;
            }
            case "西南": {
                const k = 1 / (oh / ow);
                const d =
                    -(k * dx - dy) / Math.sqrt(k ** 2 + 1) +
                    Math.sqrt(ow ** 2 + oh ** 2);
                const w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                const h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox + ow - w, oy, w, h];
                zp.x = 1;
                break;
            }
            case "西": {
                const r = (ow - dx) / ow;
                pS = [ox + dx, oy, ow - dx, oh * r];
                zp.x = 1;
                break;
            }
            case "东": {
                const r = (ow + dx) / ow;
                pS = [ox, oy, ow + dx, oh * r];
                break;
            }
            case "北": {
                const r = (oPs[3] - dy) / oh;
                pS = [ox, oy + dy, ow * r, oh - dy];
                zp.y = 1;
                break;
            }
            case "南": {
                const r = (oPs[3] + dy) / oh;
                pS = [ox, oy, ow * r, oh + dy];
                break;
            }
            case "move":
                pS = [ox + dx, oy + dy, ow, oh];
                el.style({
                    left: `${pS[0]}px`,
                    top: `${pS[1]}px`,
                    width: `${pS[2]}px`,
                    height: `${pS[3]}px`,
                });
                return;
        }
        resize(el, pS[2] / photos[el.el.id][2], zp.x, zp.y);
    }
}

function dxdy(e: MouseEvent, el: ElType<HTMLElement>) {
    const r = el.el.getBoundingClientRect();
    return {
        dx: (e.clientX - r.left) / el.el.offsetWidth,
        dy: (e.clientY - r.top) / el.el.offsetHeight,
    };
}

function resize(
    el: ElType<HTMLElement>,
    zoom: number,
    dx: number,
    dy: number,
    _clip?: boolean,
) {
    const id = el.el.id;
    elMap.find((i) => i.id === id)?.size(String(Math.round(zoom * 100)));
    const rect = [
        el.el.offsetLeft,
        el.el.offsetTop,
        el.el.offsetWidth,
        el.el.offsetHeight,
    ];
    const toWidth = photos[id][2] * zoom;
    const toHeight = photos[id][3] * zoom;
    const point = { x: rect[0] + rect[2] * dx, y: rect[1] + rect[3] * dy };
    const x = point.x - toWidth * dx;
    const y = point.y - toHeight * dy;
    const pS = [x, y, toWidth, toHeight];
    const clip = toWidth < rect[2] ? false : _clip;

    const bar = el.query("#tool_bar_c");
    const w = pS[2];
    if (!clip && w <= 240) {
        bar.el.style.flexDirection = "column";
    } else {
        bar.el.style.flexDirection = "";
    }
    let zoomN = "";
    if (w <= 100) {
        zoomN = "0.3";
    } else if (w <= 130) {
        zoomN = "0.4";
    } else if (w <= 300) {
        zoomN = "0.5";
    } else if (w <= 340) {
        zoomN = "0.6";
    } else if (w <= 380) {
        zoomN = "0.7";
    } else if (w <= 420) {
        zoomN = "0.8";
    } else if (w <= 500) {
        zoomN = "0.9";
    } else {
        zoomN = "";
    }
    if (!clip) bar.style({ zoom: zoomN });

    if (clip) {
        el.query(".img").style({
            left: `${pS[0] - rect[0]}px`,
            top: `${pS[1] - rect[1]}px`,
            width: `${pS[2]}px`,
            height: `${pS[3]}px`,
        });
    } else {
        el.query(".img").style({
            left: 0,
            top: 0,
            width: "100%",
            height: "",
        });
        el.style({
            left: `${pS[0]}px`,
            top: `${pS[1]}px`,
            width: `${pS[2]}px`,
            height: `${pS[3]}px`,
        });
    }

    el.query(".img").style({
        "image-rendering": zoom > 1 ? "pixelated" : "initial",
    });

    if (resizeSender)
        sendEvent("resize", null, { id: id, zoom, dx, dy, clip } as Resize);
}

const dockP = store.get("ding_dock");
const dockEl = document.getElementById("dock");
dockEl.style.left = `${dockP[0]}px`;
dockEl.style.top = `${dockP[1]}px`;

let dockShow = false;
let dockPS = [];

let dockMoveStart: PointerEvent = null;
let dockMoveStartP = [...dockP];
let dockMoved = false;

dockEl.addEventListener("pointerdown", (e) => {
    dockMoveStartP = [dockEl.offsetLeft, dockEl.offsetTop];
    dockMoveStart = e;
    dockEl.style.transition = "0s";
});
document.addEventListener("pointermove", (e) => {
    if (dockMoveStart) {
        dockMoved = true;
        moveDock(e);
    }
});
document.addEventListener("pointerup", (e) => {
    if (!dockMoveStart) return;
    moveDock(e);
    if (!dockMoved) {
        showDock();
    } else {
        store.set("ding_dock", [dockEl.offsetLeft, dockEl.offsetTop]);
    }

    dockMoved = false;
    dockMoveStart = null;
    dockEl.style.transition = "var(--transition)";
});

function moveDock(e: PointerEvent) {
    const x = e.clientX - dockMoveStart.clientX + dockMoveStartP[0];
    const y = e.clientY - dockMoveStart.clientY + dockMoveStartP[1];

    dockEl.style.left = `${x}px`;
    dockEl.style.top = `${y}px`;
}

const showDock = () => {
    const dock = dockEl;
    dockShow = !dockShow;
    if (dockShow) {
        dockPS = [dock.offsetLeft, dock.offsetTop];
        if (
            dock.offsetLeft + 5 <=
            document.querySelector("html").offsetWidth / 2
        ) {
            dock.style.left = "0";
        } else {
            dock.style.left = `${document.querySelector("html").offsetWidth - 200}px`;
        }

        dock.className = "dock";
        dock.querySelector("div").style.display = "block";
    } else {
        dock.style.transition = dock.className = "";
        dock.querySelector("div").style.display = "none";
        dock.style.left = `${dockPS[0]}px`;
        dock.style.top = `${dockPS[1]}px`;
    }
};

// 刷新dock
function dockI() {
    document.querySelector("#dock > div").innerHTML = "";
    for (const o in urls) {
        ((i) => {
            const dockItem = document
                .querySelector("#dock_item")
                .cloneNode(true) as HTMLElement;
            dockItem.style.display = "block";
            (<HTMLImageElement>dockItem.querySelector("#i_photo")).src =
                urls[i];
            dockItem.onclick = (e) => {
                const el = e.target as HTMLElement;
                if (el.id !== "i_close" && el.id !== "i_ignore") {
                    const div = document.getElementById(i);
                    if (div.classList.contains("minimize")) {
                        div.style.transition = "var(--transition)";
                        setTimeout(() => {
                            div.style.transition = "";
                        }, 400);
                        div.classList.remove("minimize");
                    } else {
                        back(div.id);
                    }
                    div.style.zIndex = String(toppest + 1);
                    toppest += 1;
                }
            };
            const iClose = dockItem.querySelector("#i_close") as HTMLElement;
            iClose.style.display = "block";
            iClose.onclick = () => {
                close(i);
            };
            const iIgnore = dockItem.querySelector("#i_ignore") as HTMLElement;
            iIgnore.style.display = "block";
            iIgnore.setAttribute("data-ignore", "false");
            let iIgnore_v = false;
            iIgnore.onclick = () => {
                iIgnore_v = !iIgnore_v;
                ignore(document.getElementById(i), iIgnore_v);
            };
            let iTran_v = false;
            const iTran = dockItem.querySelector("#i_tran") as HTMLElement;
            iTran.style.display = "block";
            iTran.onclick = () => {
                iTran_v = !iTran_v;
                transform(document.getElementById(i), iTran_v);
            };

            document.querySelector("#dock > div").appendChild(dockItem);
        })(o);
    }
}
ipcRenderer.on("img", (_event, wid, x, y, w, h, url, type) => {
    elMap.push(setNewDing(String(wid), x, y, w, h, url, type));
});

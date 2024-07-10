const { ipcRenderer, clipboard, nativeImage } = require("electron") as typeof import("electron");
const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");
const os = require("os") as typeof import("os");
import initStyle from "../root/root";
let configPath = new URLSearchParams(location.search).get("config_path");
const Store = require("electron-store");
var store = new Store({
    cwd: configPath || "",
});
initStyle(Store);

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
            back2(document.getElementById(id));
            break;
        case "resize":
            if (!resizeSender) resize(document.getElementById(more.id), more.zoom, more.dx, more.dy);
            break;
    }
});

function sendEvent(type: "close" | "move_start" | "move_end" | "back" | "resize", id: string, more?: any) {
    ipcRenderer.send("ding_event", type, id, more);
}

/**
 * x,y都是小数百分比
 */
type move_type = { x: number; y: number; zoom: number };

var dives: HTMLElement[] = [];

var changing: { x: number; y: number } = null;
var photos: { [key: string]: [number, number, number, number] } = {};
var urls = {};
ipcRenderer.on("img", (_event, wid, x, y, w, h, url) => {
    photos[wid] = [x, y, w, h];
    urls[wid] = url;
    let div = document.createElement("div");
    dives.push(div);
    div.id = wid;
    div.className = "ding_photo";
    if (store.get("贴图.窗口.提示")) div.classList.add("ding_photo_h");
    div.style.left = x + "px";
    div.style.top = y + "px";
    div.style.width = w + "px";
    div.style.height = h + "px";
    var img = document.createElement("img");
    img.draggable = false;
    img.src = url;
    img.className = "img";
    var toolBar = document.querySelector("#tool_bar").cloneNode(true) as HTMLElement;
    (<HTMLElement>toolBar.querySelector("#tool_bar_c")).style.display = "flex";
    // 顶栏
    div.onmouseenter = () => {
        (<HTMLElement>toolBar.querySelector("#tool_bar_c")).style.transform = "translateY(0)";
    };
    div.onmouseleave = () => {
        (<HTMLElement>toolBar.querySelector("#tool_bar_c")).style.transform = "translateY(-105%)";
    };
    // 透明
    (<HTMLElement>toolBar.querySelector("#透明度")).oninput = () => {
        img.style.opacity = `${Number((<HTMLInputElement>toolBar.querySelector("#透明度")).value) / 100}`;
        (<HTMLElement>toolBar.querySelector("#透明度_p")).innerHTML =
            (<HTMLInputElement>toolBar.querySelector("#透明度")).value + "%";
    };
    // 大小
    (<HTMLElement>toolBar.querySelector("#size > span")).onblur = () => {
        if (isFinite(Number((<HTMLElement>toolBar.querySelector("#size > span")).innerHTML))) {
            var zoom = Number((<HTMLElement>toolBar.querySelector("#size > span")).innerHTML) / 100;
            if (zoom < 0.05) zoom = 0.05;
            resizeSender = true;
            resize(div, zoom, 0, 0);
            resizeSender = false;
        }
    };
    (<HTMLElement>toolBar.querySelector("#size > span")).onkeydown = (e) => {
        if (e.key == "Enter") {
            e.preventDefault();
            if (isFinite(Number((<HTMLElement>toolBar.querySelector("#size > span")).innerHTML))) {
                var zoom = Number((<HTMLElement>toolBar.querySelector("#size > span")).innerHTML) / 100;
                if (zoom < 0.05) zoom = 0.05;
                resizeSender = true;
                resize(div, zoom, 0, 0);
                resizeSender = false;
            }
        }
    };
    // 滚轮缩放
    div.onwheel = (e) => {
        if (e.deltaY != 0) {
            let zoom = Number(div.querySelector("#size > span").innerHTML) / 100;
            let zz = 1 + Math.abs(e.deltaY) / 300;
            zoom = e.deltaY > 0 ? zoom / zz : zoom * zz;
            if (zoom < 0.05) zoom = 0.05;
            resizeSender = true;
            resize(div, zoom, e.offsetX / div.offsetWidth, e.offsetY / div.offsetHeight);
            resizeSender = false;
        }
    };
    // 三个按钮
    (<HTMLElement>toolBar.querySelector("#minimize")).onclick = () => {
        minimize(div);
    };
    (<HTMLElement>toolBar.querySelector("#back")).onclick = () => {
        back(div);
    };
    (<HTMLElement>toolBar.querySelector("#close")).onclick = () => {
        close(div);
    };
    (<HTMLElement>toolBar.querySelector("#copy")).onclick = () => {
        copy(div);
    };
    (<HTMLElement>toolBar.querySelector("#edit")).onclick = () => {
        edit(div);
    };
    // 双击行为
    div.ondblclick = () => {
        if (store.get("贴图.窗口.双击") == "归位") back(div);
        else close(div);
    };
    // 放到前面
    div.onclick = () => {
        div.style.zIndex = String(toppest + 1);
        document.getElementById("dock").style.zIndex = String(toppest + 2);
        toppest += 1;
    };
    div.appendChild(toolBar);
    div.appendChild(img);
    document.querySelector("#photo").appendChild(div);

    // dock
    dockI();

    resize(div, 1, 0, 0);
});

ipcRenderer.on("mouse", (_e, x, y) => {
    let els = document.elementsFromPoint(x, y);
    let ignorex = false;
    for (let el of ignoreEl) {
        if (els.includes(el)) {
            ignorex = true;
            break;
        }
    }
    if (els[0] == document.getElementById("photo") || ignorex) {
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
var ignoreEl = [];
function ignore(el: HTMLElement, v: boolean) {
    if (v) {
        ignoreEl.push(el);
    } else {
        ignoreEl = ignoreEl.filter((e) => e != el);
    }
}
var tranStyle = document.createElement("style");
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
function back(el: HTMLElement) {
    sendEvent("back", el.id);
}
function back2(el: HTMLElement) {
    el.style.transition = "var(--transition)";
    setTimeout(() => {
        el.style.transition = "";
        resizeSender = true;
        resize(el, 1, 0, 0);
        resizeSender = false;
    }, 400);
    var pS = photos[el.id];
    el.style.left = pS[0] + "px";
    el.style.top = pS[1] + "px";
    el.style.width = pS[2] + "px";
    el.style.height = pS[3] + "px";
    ipcRenderer.send("ding_p_s", el.id, pS);

    (el.querySelector("#透明度") as HTMLInputElement).value = "100";
    el.querySelector("#透明度_p").innerHTML = "100%";
    (el.querySelector(".img") as HTMLImageElement).style.opacity = "1";
}
function close(el: HTMLElement) {
    ipcRenderer.send("ding_event", "close", el.id, Object.keys(photos).length == 1);
}
function close2(el: HTMLElement) {
    el.remove();
    delete photos[el.id];
    delete urls[el.id];
    dockI();
}
function copy(el: HTMLElement) {
    clipboard.writeImage(nativeImage.createFromDataURL(urls[el.id]));
}
function edit(el: HTMLElement) {
    let b = Buffer.from(urls[el.id].replace(/^data:image\/\w+;base64,/, ""), "base64");
    let save = path.join(os.tmpdir(), "eSearch", new Date().getTime() + ".png");
    fs.writeFile(save, b, () => {
        ipcRenderer.send("ding_edit", save);
    });
}

// 最高窗口
var toppest = 1;
var oPs: number[];
var windowDiv = null;

var resizeSender = false;

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
};

document.onmousedown = (e) => {
    const el = e.target as HTMLElement;
    const div = dives.find((d) => d.contains(el));
    if (div && (el.id === "tool_bar_c" || el.tagName === "IMG")) {
        sendEvent("move_start", null, {
            id: div.id,
            x: e.clientX,
            y: e.clientY,
            dx: e.offsetX / div.offsetWidth,
            dy: e.offsetY / div.offsetHeight,
            d: dire(div, { x: e.clientX, y: e.clientY }),
        } as start);
    }
    resizeSender = true;
};
function mouseStart(op: start) {
    windowDiv = document.getElementById(op.id);
    const div = windowDiv as HTMLElement;
    div.style.left = op.x - div.offsetWidth * op.dx + "px";
    div.style.top = op.y - div.offsetHeight * op.dy + "px";
    oPs = [div.offsetLeft, div.offsetTop, div.offsetWidth, div.offsetHeight];
    changing = { x: op.x, y: op.y };
    direction = op.d;
    cursor(direction);
}
function mouseMove(el: HTMLElement, x: number, y: number) {
    if (direction) {
        move(windowDiv, { x, y });
    } else {
        const div = dives.find((d) => d.contains(el));
        if (div && (el.id === "tool_bar_c" || el.tagName === "IMG")) {
            let d = dire(div, { x, y });
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

var direction = "";
function dire(el: HTMLElement, e: { x: number; y: number }) {
    const width = el.offsetWidth,
        height = el.offsetHeight;
    const pX = e.x - el.offsetLeft,
        pY = e.y - el.offsetTop;
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

function move(el: HTMLElement, e: { x: number; y: number }) {
    if (changing != null && oPs.length != 0) {
        var oE = changing;
        var dx = e.x - oE.x,
            dy = e.y - oE.y;
        var [ox, oy, ow, oh] = oPs;
        var pS;
        let zp = { x: 0, y: 0 };
        switch (direction) {
            case "西北":
                var k = -1 / (oh / ow);
                var d = (k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                var h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox + ow - w, oy + oh - h, w, h];
                zp.x = 1;
                zp.y = 1;
                break;
            case "东南":
                var k = -1 / (oh / ow);
                var d = -(k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                var h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox, oy, w, h];
                break;
            case "东北":
                var k = 1 / (oh / ow);
                var d = (k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                var h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox, oy + oh - h, w, h];
                zp.y = 1;
                break;
            case "西南":
                var k = 1 / (oh / ow);
                var d = -(k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                var h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox + ow - w, oy, w, h];
                zp.x = 1;
                break;
            case "西":
                var r = (ow - dx) / ow;
                pS = [ox + dx, oy, ow - dx, oh * r];
                zp.x = 1;
                break;
            case "东":
                var r = (ow + dx) / ow;
                pS = [ox, oy, ow + dx, oh * r];
                break;
            case "北":
                var r = (oPs[3] - dy) / oh;
                pS = [ox, oy + dy, ow * r, oh - dy];
                zp.y = 1;
                break;
            case "南":
                var r = (oPs[3] + dy) / oh;
                pS = [ox, oy, ow * r, oh + dy];
                break;
            case "move":
                pS = [ox + dx, oy + dy, ow, oh];
                el.style.left = pS[0] + "px";
                el.style.top = pS[1] + "px";
                el.style.width = pS[2] + "px";
                el.style.height = pS[3] + "px";
                return;
        }
        resize(el, pS[2] / photos[el.id][2], zp.x, zp.y);
    }
}

function resize(el: HTMLElement, zoom: number, dx: number, dy: number) {
    (el.querySelector("#size > span") as HTMLElement).innerHTML = String(Math.round(zoom * 100));
    const rect = [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight];
    let toWidth = photos[el.id][2] * zoom;
    let toHeight = photos[el.id][3] * zoom;
    const point = { x: rect[0] + rect[2] * dx, y: rect[1] + rect[3] * dy };
    const x = point.x - toWidth * dx,
        y = point.y - toHeight * dy;
    const pS = [x, y, toWidth, toHeight];
    const bar = el.querySelector("#tool_bar_c") as HTMLElement;
    const w = pS[2];
    if (w <= 240) {
        bar.style.flexDirection = "column";
    } else {
        bar.style.flexDirection = "";
    }
    if (w <= 100) {
        // @ts-ignore
        bar.style.zoom = "0.3";
    } else if (w <= 130) {
        // @ts-ignore
        bar.style.zoom = "0.4";
    } else if (w <= 300) {
        // @ts-ignore
        bar.style.zoom = "0.5";
    } else if (w <= 340) {
        // @ts-ignore
        bar.style.zoom = "0.6";
    } else if (w <= 380) {
        // @ts-ignore
        bar.style.zoom = "0.7";
    } else if (w <= 420) {
        // @ts-ignore
        bar.style.zoom = "0.8";
    } else if (w <= 500) {
        // @ts-ignore
        bar.style.zoom = "0.9";
    } else {
        // @ts-ignore
        bar.style.zoom = "";
    }

    el.style.left = pS[0] + "px";
    el.style.top = pS[1] + "px";
    el.style.width = pS[2] + "px";
    el.style.height = pS[3] + "px";

    if (resizeSender) sendEvent("resize", null, { id: el.id, zoom, dx, dy } as Resize);
}

var dockP = store.get("ding_dock");
const dockEl = document.getElementById("dock");
dockEl.style.left = dockP[0] + "px";
dockEl.style.top = dockP[1] + "px";

var dockShow = false;
var dockPS = [];

var dockMoveStart: PointerEvent = null;
var dockMoveStartP = [...dockP];
var dockMoved = false;

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
    let x = e.clientX - dockMoveStart.clientX + dockMoveStartP[0];
    let y = e.clientY - dockMoveStart.clientY + dockMoveStartP[1];

    dockEl.style.left = x + "px";
    dockEl.style.top = y + "px";
}

const showDock = () => {
    var dock = dockEl;
    dockShow = !dockShow;
    if (dockShow) {
        dockPS = [dock.offsetLeft, dock.offsetTop];
        if (dock.offsetLeft + 5 <= document.querySelector("html").offsetWidth / 2) {
            dock.style.left = "0";
        } else {
            dock.style.left = document.querySelector("html").offsetWidth - 200 + "px";
        }

        dock.className = "dock";
        dock.querySelector("div").style.display = "block";
    } else {
        dock.style.transition = dock.className = "";
        dock.querySelector("div").style.display = "none";
        dock.style.left = dockPS[0] + "px";
        dock.style.top = dockPS[1] + "px";
    }
};

// 刷新dock
function dockI() {
    document.querySelector("#dock > div").innerHTML = "";
    for (let o in urls) {
        (function (i) {
            var dockItem = document.querySelector("#dock_item").cloneNode(true) as HTMLElement;
            dockItem.style.display = "block";
            (<HTMLImageElement>dockItem.querySelector("#i_photo")).src = urls[i];
            dockItem.onclick = (e) => {
                let el = e.target as HTMLElement;
                if (el.id != "i_close" && el.id != "i_ignore") {
                    var div = document.getElementById(i);
                    if (div.classList.contains("minimize")) {
                        div.style.transition = "var(--transition)";
                        setTimeout(() => {
                            div.style.transition = "";
                        }, 400);
                        div.classList.remove("minimize");
                    } else {
                        back(div);
                    }
                    div.style.zIndex = String(toppest + 1);
                    toppest += 1;
                }
            };
            const iClose = dockItem.querySelector("#i_close") as HTMLElement;
            iClose.style.display = "block";
            iClose.onclick = () => {
                close(document.getElementById(i));
            };
            const iIgnore = dockItem.querySelector("#i_ignore") as HTMLElement;
            iIgnore.style.display = "block";
            iIgnore.setAttribute("data-ignore", "false");
            var iIgnore_v = false;
            iIgnore.onclick = () => {
                iIgnore_v = !iIgnore_v;
                ignore(document.getElementById(i), iIgnore_v);
            };
            var iTran_v = false;
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

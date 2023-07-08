const { ipcRenderer, clipboard, nativeImage } = require("electron") as typeof import("electron");
const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");
const os = require("os") as typeof import("os");
import root_init from "../root/root";
root_init();
let configPath = new URLSearchParams(location.search).get("config_path");
const Store = require("electron-store");
var store = new Store({
    cwd: configPath || "",
});

var screenId = "";
ipcRenderer.on("screen_id", (_event, id) => {
    screenId = id;
});

var move: { id: string; screenid: string; more: move_type };

ipcRenderer.on("ding", (_event, type, id, screenid, more) => {
    console.log(type, id, screenid, more);
    switch (type) {
        case "close":
            close2(document.getElementById(id));
            break;
        case "move_start":
            move = { id, screenid, more };
            break;
        case "move_end":
            move = null;
            break;
        case "move_hide":
            if (screenId != screenid) {
                document.getElementById(id).style.display = "none";
                break;
            }
    }
});

function sendEvent(type: "close" | "move_start" | "move_end" | "move_hide", id: string, more?: any) {
    ipcRenderer.send("ding_event", type, id, screenId, more);
}

/**
 * x,y都是小数百分比
 */
type move_type = { x: number; y: number; zoom: number };

var ratio = window.devicePixelRatio;
var changing = null;
var photos: { [key: string]: [number, number, number, number] } = {};
var urls = {};
ipcRenderer.on("img", (_event, screenid, wid, x, y, w, h, url) => {
    if (!screenid) screenid = screenId;
    photos[wid] = [x, y, w, h];
    urls[wid] = url;
    let div = document.createElement("div");
    div.id = wid;
    div.className = "ding_photo";
    // 防止延迟
    ratio = window.devicePixelRatio;
    div.style.left = x / ratio + "px";
    div.style.top = y / ratio + "px";
    div.style.width = w / ratio + "px";
    div.style.height = h / ratio + "px";
    if (screenid != screenId) {
        div.style.display = "none";
    }
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
            div_zoom(div, zoom, 0, 0, false);
            setTimeout(() => {
                resize(div, zoom);
            }, 400);
        }
    };
    (<HTMLElement>toolBar.querySelector("#size > span")).onkeydown = (e) => {
        if (e.key == "Enter") {
            e.preventDefault();
            if (isFinite(Number((<HTMLElement>toolBar.querySelector("#size > span")).innerHTML))) {
                var zoom = Number((<HTMLElement>toolBar.querySelector("#size > span")).innerHTML) / 100;
                if (zoom < 0.05) zoom = 0.05;
                div_zoom(div, zoom, 0, 0, false);
                setTimeout(() => {
                    resize(div, zoom);
                }, 400);
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
            div_zoom(div, zoom, e.offsetX, e.offsetY, true);
            resize(div, zoom);
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

    resize(div, 1);
});

ipcRenderer.on("mouse", (_e, x, y) => {
    let els = document.elementsFromPoint(x, y);
    if (screenId) {
        let ignorex = false;
        for (let el of ignoreEl) {
            if (els.includes(el)) {
                ignorex = true;
                break;
            }
        }
        if (els.length != 0) {
            if (move) {
                if (move.screenid != screenId) {
                    let el = document.getElementById(move.id);
                    el.style.display = "";
                    sendEvent("move_hide", move.id);
                    let xx = x - photos[move.id][2] * move.more.zoom * move.more.x;
                    let yy = y - photos[move.id][3] * move.more.zoom * move.more.y;
                    el.style.left = xx + "px";
                    el.style.top = yy + "px";
                    el.style.width = photos[move.id][2] * move.more.zoom + "px";
                    el.style.height = photos[move.id][3] * move.more.zoom + "px";
                    resize(el, move.more.zoom);
                }
            }
        }
        if (els[0] == document.getElementById("photo") || ignorex) {
            ipcRenderer.send("ding_ignore", screenId, true);
        } else {
            ipcRenderer.send("ding_ignore", screenId, false);
        }
    }
});

function minimize(el) {
    div.style.transition = "var(--transition)";
    setTimeout(() => {
        div.style.transition = "";
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
function back(el) {
    el.style.transition = "var(--transition)";
    setTimeout(() => {
        el.style.transition = "";
        resize(el, 1);
    }, 400);
    var pS = photos[el.id];
    el.style.left = pS[0] / ratio + "px";
    el.style.top = pS[1] / ratio + "px";
    el.style.width = pS[2] / ratio + "px";
    el.style.height = pS[3] / ratio + "px";
    ipcRenderer.send("ding_p_s", el.id, pS);

    el.querySelector("#透明度").value = "100";
    el.querySelector("#透明度_p").innerHTML = "100%";
    el.querySelector(".img").style.opacity = 1;
}
function close(el: HTMLElement) {
    ipcRenderer.send("ding_event", "close", el.id, screenId, Object.keys(photos).length == 1);
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
var div: HTMLElement;
document.onmousedown = (e) => {
    let el = e.target as HTMLElement;
    if (el.id == "dock" || el.offsetParent.id == "dock") {
        if (!dockShow) {
            div = el;
            windowDiv = div;
            oPs = [div.offsetLeft, div.offsetTop, div.offsetWidth, div.offsetHeight];
            changing = e;
            div.style.transition = "none";
        }
    } else if (el.id != "透明度" && el.id != "size") {
        div = el;
        if (div.id != "photo")
            while (div.className != "ding_photo") {
                div = div.offsetParent as HTMLElement;
            }
        windowDiv = div;
        oPs = [div.offsetLeft, div.offsetTop, div.offsetWidth, div.offsetHeight];
        changing = e;

        sendEvent("move_start", div.id, {
            x: e.offsetX / div.offsetWidth,
            y: e.offsetY / div.offsetHeight,
            zoom: div.offsetWidth / photos[div.id][2],
        } as move_type);
    }
};
document.onmousemove = (e) => {
    let el = e.target as HTMLElement;
    if (!move && (el.id == "dock" || el.offsetParent.id == "dock")) {
        if (!dockShow) {
            if (windowDiv == null) {
                div = el;
                cursor(div, e);
            } else {
                cursor(windowDiv, e);
            }
        }
    } else {
        if (windowDiv == null) {
            div = el;
            if (div.id != "photo")
                while (div.className != "ding_photo") {
                    div = div?.offsetParent as HTMLElement;
                }
            cursor(div, e);
        } else {
            cursor(windowDiv, e);
        }
    }
};
document.onmouseup = (_e) => {
    if (windowDiv != null)
        store.set("ding_dock", [document.getElementById("dock").offsetLeft, document.getElementById("dock").offsetTop]);
    oPs = [];
    changing = null;
    sendEvent("move_end", windowDiv.id);
    windowDiv = null;
    div.style.transition = ""; // 用于dock动画
};

var direction = "";
function cursor(el, e) {
    var width = el.offsetWidth,
        height = el.offsetHeight;
    var pX = e.clientX - el.offsetLeft,
        pY = e.clientY - el.offsetTop;

    var num = 8;
    // 光标样式
    if (el.id == "dock" || el.offsetParent?.id == "dock") {
        if (windowDiv == null) {
            if (0 < pX && pX < width && 0 < pY && pY < height) {
                document.querySelector("html").style.cursor = "default";
                direction = "move";
            } else {
                direction = "";
            }
        }
    } else {
        // 不等于null移动中,自锁;等于,随时变
        if (windowDiv == null)
            switch (true) {
                case pX <= num && pY <= num:
                    document.querySelector("html").style.cursor = "nwse-resize";
                    direction = "西北";
                    break;
                case pX >= width - num && pY >= height - num:
                    document.querySelector("html").style.cursor = "nwse-resize";
                    direction = "东南";
                    break;
                case pX >= width - num && pY <= num:
                    document.querySelector("html").style.cursor = "nesw-resize";
                    direction = "东北";
                    break;
                case pX <= num && pY >= height - num:
                    document.querySelector("html").style.cursor = "nesw-resize";
                    direction = "西南";
                    break;
                case pX <= num:
                    document.querySelector("html").style.cursor = "ew-resize";
                    direction = "西";
                    break;
                case pX >= width - num:
                    document.querySelector("html").style.cursor = "ew-resize";
                    direction = "东";
                    break;
                case pY <= num:
                    document.querySelector("html").style.cursor = "ns-resize";
                    direction = "北";
                    break;
                case pY >= height - num:
                    document.querySelector("html").style.cursor = "ns-resize";
                    direction = "南";
                    break;
                case num < pX && pX < width - num && num < pY && pY < height - num:
                    document.querySelector("html").style.cursor = "default";
                    direction = "move";
                    break;
                default:
                    document.querySelector("html").style.cursor = "default";
                    direction = "";
                    break;
            }
    }
    if (changing != null && oPs.length != 0) {
        var oE = changing;
        var dx = e.clientX - oE.clientX,
            dy = e.clientY - oE.clientY;
        var [ox, oy, ow, oh] = oPs;
        var pS;
        switch (direction) {
            case "西北":
                var k = -1 / (oh / ow);
                var d = (k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                var h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox + ow - w, oy + oh - h, w, h];
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
                break;
            case "西南":
                var k = 1 / (oh / ow);
                var d = -(k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(oPs[3] / oPs[2]));
                var h = d * Math.sin(Math.atan(oPs[3] / oPs[2]));
                pS = [ox + ow - w, oy, w, h];
                break;
            case "西":
                var r = (ow - dx) / ow;
                pS = [ox + dx, oy, ow - dx, oh * r];
                break;
            case "东":
                var r = (ow + dx) / ow;
                pS = [ox, oy, ow + dx, oh * r];
                break;
            case "北":
                var r = (oPs[3] - dy) / oh;
                pS = [ox, oy + dy, ow * r, oh - dy];
                break;
            case "南":
                var r = (oPs[3] + dy) / oh;
                pS = [ox, oy, ow * r, oh + dy];
                break;
            case "move":
                pS = [ox + dx, oy + dy, ow, oh];
                break;
        }
        el.style.left = pS[0] + "px";
        el.style.top = pS[1] + "px";
        el.style.width = pS[2] + "px";
        el.style.height = pS[3] + "px";

        if (el.id != "dock") {
            el.querySelector("#tool_bar_c").style.transform = "translateY(0)";

            resize(el, pS[2] / photos[el.id][2]);
        }
    }
}

// 滚轮缩放
function div_zoom(el, zoom, dx, dy, wheel) {
    var w = photos[el.id][2];
    var h = photos[el.id][3];
    var nw = el.offsetWidth;
    var nh = el.offsetHeight;
    // 以鼠标为中心缩放
    var x = el.offsetLeft + dx - w * zoom * (dx / nw);
    var y = el.offsetTop + dy - h * zoom * (dy / nh);
    var pS = [x, y, Math.round(w * zoom), Math.round(h * zoom)];
    if (!wheel) {
        el.style.transition = "var(--transition)";
        setTimeout(() => {
            el.style.transition = "";
        }, 400);
    }
    el.style.left = pS[0] + "px";
    el.style.top = pS[1] + "px";
    el.style.width = pS[2] + "px";
    el.style.height = pS[3] + "px";
}

// 缩放文字实时更新,顶栏大小自适应
function resize(el, zoom) {
    el.querySelector("#size > span").innerHTML = Math.round(zoom * 100);
    var w = el.offsetWidth;
    if (w <= 240) {
        el.querySelector("#tool_bar_c").style.flexDirection = "column";
    } else {
        el.querySelector("#tool_bar_c").style.flexDirection = "";
    }
    if (w <= 100) {
        el.querySelector("#tool_bar_c").style.zoom = "0.3";
    } else if (w <= 130) {
        el.querySelector("#tool_bar_c").style.zoom = "0.4";
    } else if (w <= 300) {
        el.querySelector("#tool_bar_c").style.zoom = "0.5";
    } else if (w <= 340) {
        el.querySelector("#tool_bar_c").style.zoom = "0.6";
    } else if (w <= 380) {
        el.querySelector("#tool_bar_c").style.zoom = "0.7";
    } else if (w <= 420) {
        el.querySelector("#tool_bar_c").style.zoom = "0.8";
    } else if (w <= 500) {
        el.querySelector("#tool_bar_c").style.zoom = "0.9";
    } else {
        el.querySelector("#tool_bar_c").style.zoom = "";
    }
}

var dockP = store.get("ding_dock");
const dockEl = document.getElementById("dock");
dockEl.style.left = dockP[0] + "px";
dockEl.style.top = dockP[1] + "px";

var dockShow = false;
var dockPS = [];
dockEl.onclick = () => {
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

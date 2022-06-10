const { ipcRenderer } = require("electron");

var ratio = window.devicePixelRatio;
var changing = null;
var photos = {};
var urls = {};
ipcRenderer.on("img", (event, wid, x, y, w, h, url) => {
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
    var img = document.createElement("img");
    img.draggable = false;
    img.src = url;
    img.className = "img";
    var tool_bar = document.querySelector("#tool_bar").cloneNode(true);
    tool_bar.querySelector("#tool_bar_c").style.display = "flex";
    // 顶栏
    div.onmouseenter = () => {
        tool_bar.querySelector("#tool_bar_c").style.transform = "translateY(0)";
    };
    div.onmouseleave = () => {
        tool_bar.querySelector("#tool_bar_c").style.transform = "translateY(-105%)";
    };
    // 透明
    tool_bar.querySelector("#透明度").oninput = () => {
        img.style.opacity = `${tool_bar.querySelector("#透明度").value / 100}`;
        tool_bar.querySelector("#透明度_p").innerHTML = tool_bar.querySelector("#透明度").value + "%";
    };
    // 大小
    tool_bar.querySelector("#size > span").onblur = () => {
        if (isFinite(tool_bar.querySelector("#size > span").innerHTML - 0)) {
            var zoom = (tool_bar.querySelector("#size > span").innerHTML - 0) / 100;
            if (zoom < 0.05) zoom = 0.05;
            div_zoom(div, zoom, 0, 0, false);
            setTimeout(() => {
                resize(div, zoom);
            }, 400);
        }
    };
    tool_bar.querySelector("#size > span").onkeydown = (e) => {
        if (e.key == "Enter") {
            e.preventDefault();
            if (isFinite(tool_bar.querySelector("#size > span").innerHTML - 0)) {
                var zoom = (tool_bar.querySelector("#size > span").innerHTML - 0) / 100;
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
            var zoom = (div.querySelector("#size > span").innerHTML - 0 - (e.deltaY / Math.abs(e.deltaY)) * 10) / 100;
            if (zoom < 0.05) zoom = 0.05;
            div_zoom(div, zoom, e.offsetX, e.offsetY, true);
            resize(div, zoom);
        }
    };
    // 三个按钮
    tool_bar.querySelector("#minimize").onclick = () => {
        minimize(div);
    };
    tool_bar.querySelector("#back").onclick = () => {
        back(div);
    };
    tool_bar.querySelector("#close").onclick = () => {
        close(div);
    };
    // 双击归位
    div.ondblclick = () => {
        back(div);
    };
    // 放到前面
    div.onclick = () => {
        div.style.zIndex = toppest + 1;
        document.getElementById("dock").style.zIndex = toppest + 2;
        toppest += 1;
    };
    div.appendChild(tool_bar);
    div.appendChild(img);
    document.querySelector("#photo").appendChild(div);

    // dock
    dock_i();

    resize(div, 1);
});

function minimize(el) {
    div.style.transition = "var(--transition)";
    setTimeout(() => {
        div.style.transition = "";
    }, 400);
    el.classList.add("minimize");
    ding_p_s(el.id, [0, 0, 0, 0]);
}
function ignore(el, v) {
    var i = el.id;
    if (v) {
        ding_p_s(i, [0, 0, 0, 0]);
    } else {
        ding_p_s(i, [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight]);
    }
}
function back(el) {
    el.style.transition = "var(--transition)";
    setTimeout(() => {
        el.style.transition = "";
        resize(el, 1);
    }, 400);
    var p_s = photos[el.id];
    el.style.left = p_s[0] / ratio + "px";
    el.style.top = p_s[1] / ratio + "px";
    el.style.width = p_s[2] / ratio + "px";
    el.style.height = p_s[3] / ratio + "px";
    ipcRenderer.send("ding_p_s", el.id, p_s);

    el.querySelector("#透明度").value = "100";
    el.querySelector("#透明度_p").innerHTML = "100%";
    el.querySelector(".img").style.opacity = 1;
}
function close(el) {
    el.innerHTML = "";
    el.parentNode.removeChild(el);
    delete photos[el.id];
    delete urls[el.id];
    ipcRenderer.send("ding_close", el.id);
    dock_i();
}

function ding_p_s(id, p_s) {
    ipcRenderer.send("ding_p_s", id, [p_s[0] * ratio, p_s[1] * ratio, p_s[2] * ratio, p_s[3] * ratio]);
}

// 最高窗口
var toppest = 1;
var o_ps;
var window_div = null;
var div;
document.onmousedown = (e) => {
    if (e.target.id == "dock" || e.target.offsetParent.id == "dock") {
        if (!dock_show) {
            div = e.target;
            window_div = div;
            o_ps = [div.offsetLeft, div.offsetTop, div.offsetWidth, div.offsetHeight];
            changing = e;
            div.style.transition = "none";
            ipcRenderer.send("ding_ignore", false);
        }
    } else if (e.target.id != "透明度" && e.target.id != "size") {
        div = e.target;
        if (div.id != "photo")
            while (div.className != "ding_photo") {
                div = div.offsetParent;
            }
        window_div = div;
        o_ps = [div.offsetLeft, div.offsetTop, div.offsetWidth, div.offsetHeight];
        changing = e;
        ipcRenderer.send("ding_ignore", false);
    }
};
document.onmousemove = (e) => {
    if (e.target.id == "dock" || e.target.offsetParent.id == "dock") {
        if (!dock_show) {
            if (window_div == null) {
                div = e.target;
                cursor(div, e);
            } else {
                cursor(window_div, e);
            }
        }
    } else {
        if (window_div == null) {
            div = e.target;
            if (div.id != "photo")
                while (div.className != "ding_photo") {
                    div = div?.offsetParent;
                }
            cursor(div, e);
        } else {
            cursor(window_div, e);
        }
    }
};
document.onmouseup = (e) => {
    if (window_div != null)
        store.set("ding_dock", [document.getElementById("dock").offsetLeft, document.getElementById("dock").offsetTop]);
    o_ps = [];
    changing = null;
    window_div = null;
    div.style.transition = ""; // 用于dock动画
    ipcRenderer.send("ding_ignore", true);
};

var direction = "";
function cursor(el, e) {
    var width = el.offsetWidth,
        height = el.offsetHeight;
    var p_x = e.clientX - el.offsetLeft,
        p_y = e.clientY - el.offsetTop;

    var num = 8;
    // 光标样式
    if (el.id == "dock" || el.offsetParent?.id == "dock") {
        if (window_div == null) {
            if (0 < p_x && p_x < width && 0 < p_y && p_y < height) {
                document.querySelector("html").style.cursor = "default";
                direction = "move";
            } else {
                direction = "";
            }
        }
    } else {
        // 不等于null移动中,自锁;等于,随时变
        if (window_div == null)
            switch (true) {
                case p_x <= num && p_y <= num:
                    document.querySelector("html").style.cursor = "nwse-resize";
                    direction = "西北";
                    break;
                case p_x >= width - num && p_y >= height - num:
                    document.querySelector("html").style.cursor = "nwse-resize";
                    direction = "东南";
                    break;
                case p_x >= width - num && p_y <= num:
                    document.querySelector("html").style.cursor = "nesw-resize";
                    direction = "东北";
                    break;
                case p_x <= num && p_y >= height - num:
                    document.querySelector("html").style.cursor = "nesw-resize";
                    direction = "西南";
                    break;
                case p_x <= num:
                    document.querySelector("html").style.cursor = "ew-resize";
                    direction = "西";
                    break;
                case p_x >= width - num:
                    document.querySelector("html").style.cursor = "ew-resize";
                    direction = "东";
                    break;
                case p_y <= num:
                    document.querySelector("html").style.cursor = "ns-resize";
                    direction = "北";
                    break;
                case p_y >= height - num:
                    document.querySelector("html").style.cursor = "ns-resize";
                    direction = "南";
                    break;
                case num < p_x && p_x < width - num && num < p_y && p_y < height - num:
                    document.querySelector("html").style.cursor = "default";
                    direction = "move";
                    break;
                default:
                    document.querySelector("html").style.cursor = "default";
                    direction = "";
                    break;
            }
    }
    if (changing != null && o_ps != []) {
        var o_e = changing;
        var dx = e.clientX - o_e.clientX,
            dy = e.clientY - o_e.clientY;
        var [ox, oy, ow, oh] = o_ps;
        var p_s;
        switch (direction) {
            case "西北":
                var k = -1 / (oh / ow);
                var d = (k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(o_ps[3] / o_ps[2]));
                var h = d * Math.sin(Math.atan(o_ps[3] / o_ps[2]));
                p_s = [ox + ow - w, oy + oh - h, w, h];
                break;
            case "东南":
                var k = -1 / (oh / ow);
                var d = -(k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(o_ps[3] / o_ps[2]));
                var h = d * Math.sin(Math.atan(o_ps[3] / o_ps[2]));
                p_s = [ox, oy, w, h];
                break;
            case "东北":
                var k = 1 / (oh / ow);
                var d = (k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(o_ps[3] / o_ps[2]));
                var h = d * Math.sin(Math.atan(o_ps[3] / o_ps[2]));
                p_s = [ox, oy + oh - h, w, h];
                break;
            case "西南":
                var k = 1 / (oh / ow);
                var d = -(k * dx - dy) / Math.sqrt(k ** 2 + 1) + Math.sqrt(ow ** 2 + oh ** 2);
                var w = d * Math.cos(Math.atan(o_ps[3] / o_ps[2]));
                var h = d * Math.sin(Math.atan(o_ps[3] / o_ps[2]));
                p_s = [ox + ow - w, oy, w, h];
                break;
            case "西":
                var r = (ow - dx) / ow;
                p_s = [ox + dx, oy, ow - dx, oh * r];
                break;
            case "东":
                var r = (ow + dx) / ow;
                p_s = [ox, oy, ow + dx, oh * r];
                break;
            case "北":
                var r = (o_ps[3] - dy) / oh;
                p_s = [ox, oy + dy, ow * r, oh - dy];
                break;
            case "南":
                var r = (o_ps[3] + dy) / oh;
                p_s = [ox, oy, ow * r, oh + dy];
                break;
            case "move":
                p_s = [ox + dx, oy + dy, ow, oh];
                break;
        }
        el.style.left = p_s[0] + "px";
        el.style.top = p_s[1] + "px";
        el.style.width = p_s[2] + "px";
        el.style.height = p_s[3] + "px";
        ding_p_s(el.id, p_s);

        if (el.id != "dock") {
            el.querySelector("#tool_bar_c").style.transform = "translateY(0)";

            resize(el, p_s[2] / photos[el.id][2]);
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
    var p_s = [x, y, Math.round(w * zoom), Math.round(h * zoom)];
    if (!wheel) {
        el.style.transition = "var(--transition)";
        setTimeout(() => {
            el.style.transition = "";
        }, 400);
    }
    el.style.left = p_s[0] + "px";
    el.style.top = p_s[1] + "px";
    el.style.width = p_s[2] + "px";
    el.style.height = p_s[3] + "px";
    ding_p_s(el.id, p_s);
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

var dock_p = store.get("ding_dock");
document.querySelector("#dock").style.left = dock_p[0] + "px";
document.querySelector("#dock").style.top = dock_p[1] + "px";
ding_p_s("dock", [dock_p[0], dock_p[1], 10, 50]);

var dock_show = false;
var dock_p_s = [];
document.querySelector("#dock").onclick = () => {
    var dock = document.querySelector("#dock");
    dock_show = !dock_show;
    if (dock_show) {
        dock_p_s = [dock.offsetLeft, dock.offsetTop];
        if (dock.offsetLeft + 5 <= document.querySelector("html").offsetWidth / 2) {
            dock.style.left = "0";
        } else {
            dock.style.left = document.querySelector("html").offsetWidth - 200 + "px";
        }

        dock.className = "dock";
        dock.querySelector("div").style.display = "block";
        ding_p_s("dock", [dock.style.left.replace("px", "") - 0, 0, 200, document.querySelector("html").offsetHeight]);
    } else {
        dock.style.transition = dock.className = "";
        dock.querySelector("div").style.display = "none";
        dock.style.left = dock_p_s[0] + "px";
        dock.style.top = dock_p_s[1] + "px";
        ding_p_s("dock", [dock_p_s[0], dock_p_s[1], 10, 50]);
    }
};

// 刷新dock
function dock_i() {
    document.querySelector("#dock > div").innerHTML = "";
    for (let o in urls) {
        (function (i) {
            var dock_item = document.querySelector("#dock_item").cloneNode(true);
            dock_item.style.display = "block";
            dock_item.querySelector("#i_photo").src = urls[i];
            dock_item.onclick = (e) => {
                if (e.target.id != "i_close" && e.target.id != "i_ignore") {
                    var div = document.getElementById(i);
                    if (div.classList.contains("minimize")) {
                        div.style.transition = "var(--transition)";
                        setTimeout(() => {
                            div.style.transition = "";
                        }, 400);
                        div.classList.remove("minimize");
                        if (!i_ignore_v)
                            ding_p_s(i, [div.offsetLeft, div.offsetTop, div.offsetWidth, div.offsetHeight]);
                    } else {
                        back(div);
                    }
                    div.style.zIndex = toppest + 1;
                    toppest += 1;
                }
            };
            dock_item.querySelector("#i_close").style.display = "block";
            dock_item.querySelector("#i_close").onclick = () => {
                close(document.getElementById(i));
            };
            dock_item.querySelector("#i_ignore").style.display = "block";
            dock_item.querySelector("#i_ignore").setAttribute("data-ignore", "false");
            var i_ignore_v = false;
            dock_item.querySelector("#i_ignore").onclick = () => {
                i_ignore_v = !i_ignore_v;
                ignore(document.getElementById(i), i_ignore_v);
            };
            document.querySelector("#dock > div").appendChild(dock_item);
        })(o);
    }
}

const { ipcRenderer } = require("electron");

var changing = null;
var photos = {};
var urls = {};
ipcRenderer.on("img", (event, wid, x, y, w, h, url) => {
    photos[wid] = [x, y, w, h];
    urls[wid] = url;
    var div = document.createElement("div");
    div.id = wid;
    div.className = "ding_photo";
    div.style.left = x + "px";
    div.style.top = y + "px";
    div.style.width = w + "px";
    div.style.height = h + "px";
    var img = document.createElement("img");
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
            div_zoom(div, zoom, 0, 0, false);
        }
    };
    tool_bar.querySelector("#size > span").onkeydown = (e) => {
        if (e.key == "Enter") {
            e.preventDefault();
            if (isFinite(tool_bar.querySelector("#size > span").innerHTML - 0)) {
                var zoom = (tool_bar.querySelector("#size > span").innerHTML - 0) / 100;
                div_zoom(div, zoom, 0, 0, false);
            }
        }
    };
    div.onwheel = (e) => {
        if (e.deltaY != 0) {
            var zoom = (div.querySelector("#size > span").innerHTML - 0 - (e.deltaY / Math.abs(e.deltaY)) * 10) / 100;
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
        dock_i();
    };
    // 放到前面
    div.onclick = () => {
        div.style.zIndex = toppest + 1;
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
    el.style.opacity = 0;
    ipcRenderer.send("ding_p_s", el.id, [0, 0, 0, 0]);
}
function back(el) {
    el.style.transition = "var(--transition)";
    setTimeout(() => {
        el.style.transition = "";
        resize(el, 1);
    }, 400);
    var p_s = photos[el.id];
    el.style.left = p_s[0] + "px";
    el.style.top = p_s[1] + "px";
    el.style.width = p_s[2] + "px";
    el.style.height = p_s[3] + "px";
    ipcRenderer.send("ding_p_s", el.id, p_s);

    el.querySelector("#透明度").value = "100";
    el.querySelector("#透明度_p").innerHTML = "100%";
    el.querySelector("img").style.opacity = 1;
}
function close(el) {
    el.innerHTML = "";
    el.parentNode.removeChild(el);
    delete photos[el.id];
    delete urls[el.id];
    ipcRenderer.send("ding_close", el.id);
}

// 最高窗口
toppest = 1;

window_div = null;
document.onmousedown = (e) => {
    if (e.target.id == "dock" || e.target.offsetParent.id == "dock") {
        if (!dock_show) {
            div = e.target;
            window_div = div;
            o_ps = [div.offsetLeft, div.offsetTop, div.offsetWidth, div.offsetHeight];
            changing = e;
            div.style.transition = "none";
            ipcRenderer.send("ding_ignore", true);
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
        ipcRenderer.send("ding_ignore", true);
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
    o_ps = [];
    changing = null;
    window_div = null;
    div.style.transition = "";
    ipcRenderer.send("ding_ignore", false);
};

direction = "";
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
                    document.querySelector("html").style.cursor = "nw-resize";
                    direction = "西北";
                    break;
                case p_x >= width - num && p_y >= height - num:
                    document.querySelector("html").style.cursor = "se-resize";
                    direction = "东南";
                    break;
                case p_x >= width - num && p_y <= num:
                    document.querySelector("html").style.cursor = "ne-resize";
                    direction = "东北";
                    break;
                case p_x <= num && p_y >= height - num:
                    document.querySelector("html").style.cursor = "sw-resize";
                    direction = "西南";
                    break;
                case p_x <= num:
                    document.querySelector("html").style.cursor = "w-resize";
                    direction = "西";
                    break;
                case p_x >= width - num:
                    document.querySelector("html").style.cursor = "e-resize";
                    direction = "东";
                    break;
                case p_y <= num:
                    document.querySelector("html").style.cursor = "n-resize";
                    direction = "北";
                    break;
                case p_y >= height - num:
                    document.querySelector("html").style.cursor = "s-resize";
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
                r = (ow - dx) / ow;
                p_s = [ox + dx, oy, ow - dx, oh * r];
                break;
            case "东":
                r = (ow + dx) / ow;
                p_s = [ox, oy, ow + dx, oh * r];
                break;
            case "北":
                r = (o_ps[3] - dy) / oh;
                p_s = [ox, oy + dy, ow * r, oh - dy];
                break;
            case "南":
                r = (o_ps[3] + dy) / oh;
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
        ipcRenderer.send("ding_p_s", el.id, p_s);

        if (el.id != "dock") {
            el.querySelector("#tool_bar_c").style.transform = "translateY(0)";

            resize(el, p_s[2] / photos[el.id][2]);
        }
    }
}

function div_zoom(el, zoom, dx, dy, wheel) {
    var w = photos[el.id][2];
    var h = photos[el.id][3];
    if (zoom < 0.25) zoom = 0.25;
    if (zoom > 3) zoom = 3;
    var nw = el.offsetWidth;
    var nh = el.offsetHeight;
    // 以鼠标为中心缩放
    var x = el.offsetLeft + dx - w * zoom * (dx / nw);
    var y = el.offsetTop + dy - h * zoom * (dy / nh);
    if (x < 0) x = 0;
    if (y < 0) y = 0;
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
    ipcRenderer.send("ding_p_s", el.id, p_s);
}

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

dock_show = false;
dock_p_s = [];
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
        dock.querySelector("div").style.width = "100%";
        ipcRenderer.send("ding_p_s", "dock", [
            dock.style.left.replace("px", "") - 0,
            0,
            200,
            document.querySelector("html").offsetHeight,
        ]);
    } else {
        dock.style.transition = dock.className = "";
        dock.querySelector("div").style.width = "0";
        dock.style.left = dock_p_s[0] + "px";
        dock.style.top = dock_p_s[1] + "px";
        ipcRenderer.send("ding_p_s", "dock", [dock_p_s[0], dock_p_s[1], 10, 50]);
    }
};

function dock_i() {
    document.querySelector("#dock > div").innerHTML = "";
    for (o in urls) {
        (function (i) {
            var dock_item = document.querySelector("#dock_item").cloneNode(true);
            dock_item.style.display = "block";
            dock_item.querySelector("img").src = urls[i];
            dock_item.onclick = () => {
                var div = document.getElementById(i);
                div.style.transition = "var(--transition)";
                setTimeout(() => {
                    div.style.transition = "";
                }, 400);
                div.style.opacity = 1;
                ipcRenderer.send("ding_p_s", i, [div.offsetLeft, div.offsetTop, div.offsetWidth, div.offsetHeight]);
                div.style.zIndex = toppest + 1;
                toppest += 1;
            };
            document.querySelector("#dock > div").appendChild(dock_item);
        })(o);
    }
}

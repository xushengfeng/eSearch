const { ipcRenderer, ipcMain } = require("electron");

var changing = null;
var photos = {};
var photos2 = {};
ipcRenderer.on("img", (event, wid, x, y, w, h, url) => {
    photos[wid] = photos2[wid] = [x, y, w, h];
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
    窗口透明度 = tool_bar.querySelector("#透明度");
    窗口透明度.oninput = () => {
        img.style.opacity = `${窗口透明度.value / 100}`;
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
    // 三个按钮
    tool_bar.querySelector("#minimize").onclick = () => {
        minimize(wid);
    };
    tool_bar.querySelector("#back").onclick = () => {
        back(div);
    };
    tool_bar.querySelector("#close").onclick = () => {
        close(div);
    };
    // 放到前面
    div.onclick = () => {
        div.style.zIndex = toppest + 1;
        toppest += 1;
    };
    div.appendChild(tool_bar);
    div.appendChild(img);
    document.querySelector("#photo").appendChild(div);
});

function minimize(id) {}
function back(el) {
    el.style.transition = "var(--transition)";
    setTimeout(() => {
        el.style.transition = "";
    }, 400);
    var p_s = photos[el.id];
    el.style.left = p_s[0] + "px";
    el.style.top = p_s[1] + "px";
    el.style.width = p_s[2] + "px";
    el.style.height = p_s[3] + "px";
    ipcRenderer.send("ding_p_s", el.id, p_s);

    el.querySelector("#size > span").innerHTML = "100";
}
function close(el) {
    el.innerHTML = "";
    el.parentNode.removeChild(el);
    delete photos[el.id];
    delete photos2[el.id];
    ipcRenderer.send("ding_close", el.id);
}

// 最高窗口
toppest = 1;

window_div = null;
document.onmousedown = (e) => {
    if (e.target.id != "透明度" && e.target.id != "size") {
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
};
document.onmouseup = (e) => {
    o_ps = [];
    changing = null;
    window_div = null;
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
    if (window_div == null)
        switch (true) {
            case p_x <= num && p_y <= num:
                el.style.cursor = "nw-resize";
                direction = "西北";
                break;
            case p_x >= width - num && p_y >= height - num:
                el.style.cursor = "se-resize";
                direction = "东南";
                break;
            case p_x >= width - num && p_y <= num:
                el.style.cursor = "ne-resize";
                direction = "东北";
                break;
            case p_x <= num && p_y >= height - num:
                el.style.cursor = "sw-resize";
                direction = "西南";
                break;
            case p_x <= num:
                el.style.cursor = "w-resize";
                direction = "西";
                break;
            case p_x >= width - num:
                el.style.cursor = "e-resize";
                direction = "东";
                break;
            case p_y <= num:
                el.style.cursor = "n-resize";
                direction = "北";
                break;
            case p_y >= height - num:
                el.style.cursor = "s-resize";
                direction = "南";
                break;
            case num < p_x && p_x < width - num && num < p_y && p_y < height - num:
                el.style.cursor = "default";
                direction = "move";
                break;
            default:
                el.style.cursor = "default";
                direction = "";
                break;
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

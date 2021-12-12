const { ipcRenderer, ipcMain } = require("electron");

var changing = null;
var photos = {};
ipcRenderer.on("img", (event, wid, x, y, w, h, url) => {
    photos[wid] = [x, y, w, h];
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
    tool_bar.style.display = "flex";
    tool_bar.querySelector("#minimize").onclick = () => {
        minimize(wid);
    };
    tool_bar.querySelector("#back").onclick = () => {
        back(div);
    };
    tool_bar.querySelector("#close").onclick = () => {
        close(div);
    };
    div.onclick = () => {
        div.style.zIndex = toppest + 1;
        toppest += 1;
    };
    div.onkeydown = (e) => {
        if (e.target.id != "透明度" || e.target.id != "size") {
            changing = e;
        }
    };
    div.onkeymove = (e) => {
        if (changing != null) {
            change(div, changing, e);
        }
    };
    div.onkeydown = (e) => {
        changing = null;
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
    ipcMain.send("ding_p_s", el.id, p_s);
}
function close(el) {
    el.innerHTML = "";
    el.parentNode.removeChild(el);
    delete photos[el.id];
    ipcRenderer.send("ding_close", el.id);
}

// 最高窗口
toppest = 1;

function change(el, o_e, e) {
    var x1 = photos[el.id][0],
        y1 = photos[el.id][1],
        x2 = photos[el.id][0] + photos[el.id][2],
        y2 = photos[el.id][0] + photos[el.id][3];
    var o_x = o_e.screenX,
        n_x = e.screenX,
        o_y = o_e.screenY,
        n_y = e.screenY;
    var dx = n_x - o_x,
        dy = n_y - o_y;

    ipcMain.send("ding_p_s", el.id, [x, y, w, h]);
}

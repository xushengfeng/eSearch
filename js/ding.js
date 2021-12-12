const { ipcRenderer } = require("electron");

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
}
function close(el) {
    el.innerHTML = "";
    el.parentNode.removeChild(el);
    delete photos[el.id];
    ipcRenderer.send("ding_close", el.id);
}

// 最高窗口
toppest = 1;

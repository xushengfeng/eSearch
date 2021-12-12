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
    tool_bar.querySelector("#minimize").onclick = () => {
        minimize(wid);
    };
    tool_bar.querySelector("#back").onclick = () => {
        back(wid);
    };
    tool_bar.querySelector("#close").onclick = () => {
        close(wid);
    };
    div.appendChild(tool_bar);
    div.appendChild(img);
    document.querySelector("#photo").appendChild(div);
});

function minimize(id) {}
function back(id) {}
function close(id) {
    document.getElementById(id).innerHTML = "";
    document.getElementById(id).parentNode.removeChild(document.getElementById(id));
    delete photos[id]
    ipcRenderer.send("ding_close", id);
}

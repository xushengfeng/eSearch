const { ipcRenderer } = require("electron");

var photos = [];
ipcRenderer.on("img", (event, x, y, w, h, url) => {
    photos.push({ x, y, w, h });
    var div = document.createElement("div");
    div.className = "ding_photo";
    div.style.left = x + "px";
    div.style.top = y + "px";
    div.style.width = w + "px";
    div.style.height = h + "px";
    var img = document.createElement("img");
    img.src = url;
    img.className="img"
    var tool_bar = document.querySelector("#tool_bar").cloneNode(true);
    div.appendChild(tool_bar);
    div.appendChild(img);
    document.querySelector("#photo").appendChild(div);
});

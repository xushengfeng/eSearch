const { ipcRenderer } = require("electron");
ipcRenderer.on("img", (event, url) => {
    document.getElementById("ding_photo").src = url;
});
ipcRenderer.on("window_name", (event, name) => {
    window_name = name;
});
ipcRenderer.on("window_size", (event, size) => {
    window_size = size;
});
窗口透明度 = document.getElementById("透明度");
窗口透明度.addEventListener("input", () => {
    document.getElementById("ding_photo").style.opacity = `${窗口透明度.value / 100}`;
});
document.getElementById("re").addEventListener("click", () => {
    ipcRenderer.send("ding_resize", window_name, window_size);
});
document.getElementById("close").addEventListener("click", () => {
    ipcRenderer.send("ding_close", window_name);
});

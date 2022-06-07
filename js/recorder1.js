const { ipcRenderer } = require("electron");

const { uIOhook, UiohookKey } = require("uiohook-napi");

var keycode2key = {};

for (let i in UiohookKey) {
    keycode2key[UiohookKey[i]] = i;
}
console.log(keycode2key);

var key_o = {};

uIOhook.on("keydown", (e) => {
    key_o[e.keycode] = "";
    document.getElementById("key").innerText = Object.keys(key_o)
        .map((v) => keycode2key[v])
        .join("+");
});
uIOhook.on("keyup", (e) => {
    delete key_o[e.keycode];
    document.getElementById("key").innerText = Object.keys(key_o)
        .map((v) => keycode2key[v])
        .join("+");
});

uIOhook.on("mousedown", (e) => {});
uIOhook.on("mousemove", (e) => {
    document.getElementById("mouse_c").style.left = e.x + "px";
    document.getElementById("mouse_c").style.top = e.y + "px";
});
uIOhook.on("mouseup", (e) => {});

uIOhook.start();

ipcRenderer.on("record", async (event, t, arg) => {
    switch (t) {
        case "init":
            document.getElementById("rect").style.left = arg[0] + "px";
            document.getElementById("rect").style.top = arg[1] + "px";
            document.getElementById("rect").style.width = arg[2] + "px";
            document.getElementById("rect").style.height = arg[3] + "px";
            break;
    }
});

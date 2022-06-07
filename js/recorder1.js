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

var m2m = { 1: 0, 3: 1, 2: 2 };
var mouse_el = document.getElementById("mouse").querySelectorAll("div");

uIOhook.on("mousedown", (e) => {
    mouse_el[m2m[e.button]].style.backgroundColor = "#00f";
});
uIOhook.on("mouseup", (e) => {
    mouse_el[m2m[e.button]].style.backgroundColor = "";
});

let time_out;
uIOhook.on("wheel", (e) => {
    mouse_el[1].style.backgroundColor = "#0f0";
    clearTimeout(time_out);
    time_out = setTimeout(() => {
        mouse_el[1].style.backgroundColor = "";
    }, 200);
});

uIOhook.start();

ipcRenderer.on("record", async (event, t, arg) => {
    switch (t) {
        case "init":
            document.getElementById("rect").style.left = arg[0] + "px";
            document.getElementById("rect").style.top = arg[1] + "px";
            document.getElementById("rect").style.width = arg[2] + "px";
            document.getElementById("rect").style.height = arg[3] + "px";
            break;
        case "mouse":
            document.getElementById("mouse_c").style.left = arg.x + "px";
            document.getElementById("mouse_c").style.top = arg.y + "px";
            break;
    }
});

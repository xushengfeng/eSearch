const { ipcRenderer } = require("electron");
const Store = require("electron-store");
var store = new Store();

if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
    var { uIOhook, UiohookKey } = require("uiohook-napi");

function r_key() {
    var keycode2key = {};

    for (let i in UiohookKey) {
        keycode2key[UiohookKey[i]] = i;
    }
    console.log(keycode2key);

    var key_o = [];

    uIOhook.on("keydown", (e) => {
        if (!key_o.includes(e.keycode)) key_o.push(e.keycode);
        document.getElementById("key").innerHTML = `<kbd>${key_o
            .map((v) => keycode2key[v])
            .join("</kbd>+<kbd>")}</kbd>`;
    });
    uIOhook.on("keyup", (e) => {
        key_o = key_o.filter((i) => i != e.keycode);
        document.getElementById("key").innerHTML =
            key_o.length == 0 ? "" : `<kbd>${key_o.map((v) => keycode2key[v]).join("</kbd>+<kbd>")}</kbd>`;
    });
}

function r_mouse() {
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
}

if (store.get("录屏.提示.键盘.开启")) r_key();
if (store.get("录屏.提示.鼠标.开启")) r_mouse();

if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启")) uIOhook.start();

if (!store.get("录屏.提示.光标.开启")) document.getElementById("mouse_c").style.display = "none";

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

const { ipcRenderer } = require("electron") as typeof import("electron");
import { el } from "redom";

// 获取设置
let configPath = new URLSearchParams(location.search).get("config_path");
const Store = require("electron-store");
var store = new Store({
    cwd: configPath || "",
});

const recorderRectEl = document.getElementById("recorder_rect");
const recorderMouseEl = document.getElementById("mouse_c");

var recordInited = false;

initRecord();

function initRecord() {
    recordInited = true;

    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
        var { uIOhook, UiohookKey } = require("uiohook-napi") as typeof import("uiohook-napi");

    function rKey() {
        var keycode2key = {};

        for (let i in UiohookKey) {
            keycode2key[UiohookKey[i]] = i;
        }
        console.log(keycode2key);

        var keyO: number[] = [];

        const keysEl = document.getElementById("recorder_key");
        let lastKey = null as HTMLElement;

        uIOhook.on("keydown", (e) => {
            if (!keyO.includes(e.keycode)) keyO.push(e.keycode);
            if (!lastKey) {
                lastKey = el("div");
                keysEl.append(lastKey);
            }
            lastKey.append(el("kbd", keycode2key[e.keycode], { "data-k": e.keycode }));
            Array.from(keysEl.children)
                .slice(0, -5)
                .forEach((v) => v.remove());
        });
        uIOhook.on("keyup", (e) => {
            keyO = keyO.filter((i) => i != e.keycode);
            lastKey.querySelector(`[data-k="${e.keycode}"]`)?.classList?.add("key_hidden");
            if (keyO.length === 0) {
                lastKey = null;
            }
        });
    }

    function rMouse() {
        var m2m = { 1: 0, 3: 1, 2: 2 };
        var mouseEl = recorderMouseEl.querySelectorAll("div");

        uIOhook.on("mousedown", (e) => {
            mouseEl[m2m[e.button as number]].style.backgroundColor = "#00f";
        });
        uIOhook.on("mouseup", (e) => {
            mouseEl[m2m[e.button as number]].style.backgroundColor = "";
        });

        let time_out;
        uIOhook.on("wheel", (e) => {
            console.log(e.direction, e.rotation);
            let x = {
                3: { 1: "wheel_u", "-1": "wheel_d" },
                4: { 1: "wheel_l", "-1": "wheel_r" },
            };
            recorderMouseEl.className = x[e.direction][e.rotation];
            clearTimeout(time_out);
            time_out = setTimeout(() => {
                recorderMouseEl.className = "";
            }, 200);
        });
    }

    if (store.get("录屏.提示.键盘.开启")) rKey();
    if (store.get("录屏.提示.鼠标.开启")) rMouse();

    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启")) uIOhook.start();

    if (store.get("录屏.提示.光标.开启")) recorderMouseEl.style.display = "flex";

    var mouseStyle = document.createElement("style");
    mouseStyle.innerHTML = `.mouse{${store.get("录屏.提示.光标.样式").replaceAll(";", " !important;")}}`;
    document.body.appendChild(mouseStyle);

    ipcRenderer.on("record", async (_event, t, arg) => {
        switch (t) {
            case "mouse":
                recorderMouseEl.style.left = arg.x + "px";
                recorderMouseEl.style.top = arg.y + "px";
                break;
        }
    });
}

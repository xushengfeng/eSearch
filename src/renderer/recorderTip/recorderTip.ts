const { ipcRenderer } = require("electron") as typeof import("electron");
const { execSync } = require("child_process") as typeof import("child_process");
import { el } from "redom";
import { jsKeyCodeDisplay } from "../../../lib/key";
import { setting } from "../../ShareTypes";

// 获取设置
let configPath = new URLSearchParams(location.search).get("config_path");
const Store = require("electron-store");
var store = new Store({
    cwd: configPath || "",
});

const keysEl = document.getElementById("recorder_key");
const recorderMouseEl = document.getElementById("mouse_c");

initRecord();

window["x"] = jsKeyCodeDisplay;

function initRecord() {
    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
        var { uIOhook, UiohookKey } = require("uiohook-napi") as typeof import("uiohook-napi");

    function rKey() {
        const posi = store.get("录屏.提示.键盘.位置") as setting["录屏"]["提示"]["键盘"]["位置"];
        const px = posi.x === "+" ? "right" : "left";
        const py = posi.y === "+" ? "bottom" : "top";
        keysEl.parentElement.style[px] = posi.offsetX + "px";
        keysEl.parentElement.style[py] = posi.offsetY + "px";

        const keycode2key = {};

        for (let i in UiohookKey) {
            keycode2key[UiohookKey[i]] = i;
        }
        console.log(keycode2key);

        const map: { [k: string]: string } = {
            Ctrl: "Control",
            CtrlRight: "ControlRight",
        };

        for (var i = 0; i < 25; i++) {
            const k = String.fromCharCode(65 + i);
            map[k] = `Key${k}`;
        }

        function getKey(keycode: number) {
            let key = keycode2key[keycode] as string;

            let keyDisplay = jsKeyCodeDisplay(map[key] || key);

            let mainKey = keyDisplay.primary ?? key;
            let topKey = keyDisplay?.secondary ?? keyDisplay?.symble ?? "";
            if (keyDisplay.isNum) topKey = "";
            return { main: mainKey, top: topKey, numpad: keyDisplay.isNumpad, right: keyDisplay.isRight };
        }

        let keyO: number[] = [];

        let lastKey = null as HTMLElement;

        uIOhook.on("keydown", (e) => {
            if (!keyO.includes(e.keycode)) keyO.push(e.keycode);
            if (!lastKey) {
                lastKey = el("div");
                if (posi.x === "+") keysEl.append(lastKey);
                else keysEl.insertAdjacentElement("afterbegin", lastKey);
            }
            const key = getKey(e.keycode);
            if (["Ctrl", "Alt", "Shift", "Meta"].includes(key.main)) lastKey.setAttribute("data-modi", "true");
            const kbdEl = el("kbd", el("span", key.main, { class: "main_key" }), {
                "data-k": e.keycode,
            });
            console.log(key);

            if (key.top) kbdEl.append(el("span", key.top, { class: "top_key" }));
            else {
                kbdEl.querySelector("span").classList.remove("main_key");
                kbdEl.classList.add("only_key");
                if (key.main.match(/[A-Z]/))
                    if (lastKey.getAttribute("data-modi") != "true" && !isCapsLock()) {
                        kbdEl.querySelector("span").innerText = key.main.toLowerCase();
                    }
            }
            lastKey.append(kbdEl);
            if (key.numpad) kbdEl.classList.add("numpad_key");
            if (key.right) kbdEl.classList.add("right_key");
            const l = Array.from(keysEl.children);
            if (posi.x === "+") {
                l.slice(0, -10).forEach((v) => v.remove());
            } else {
                l.slice(10).forEach((v) => v.remove());
            }
        });
        uIOhook.on("keyup", (e) => {
            keyO = keyO.filter((i) => i != e.keycode);
            lastKey.querySelectorAll(`[data-k="${e.keycode}"]`)?.forEach((el: HTMLElement) => {
                el.classList.add("key_hidden");
            });
            if (keyO.length === 0) {
                let e = lastKey;
                setTimeout(() => {
                    e.style.opacity = "0";
                }, 4000);
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

function isCapsLock() {
    if (process.platform === "linux") {
        return execSync("xset -q | sed -n 's/^.*Caps Lock:\\s*\\(\\S*\\).*$/\\1/p'").toString().trim() === "on";
    }
    return true;
}

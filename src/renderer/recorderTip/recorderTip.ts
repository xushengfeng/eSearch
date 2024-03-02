const { ipcRenderer } = require("electron") as typeof import("electron");
import { el } from "redom";

// 获取设置
let configPath = new URLSearchParams(location.search).get("config_path");
const Store = require("electron-store");
var store = new Store({
    cwd: configPath || "",
});

const recorderMouseEl = document.getElementById("mouse_c");

initRecord();

function initRecord() {
    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
        var { uIOhook, UiohookKey } = require("uiohook-napi") as typeof import("uiohook-napi");

    function rKey() {
        const keycode2key = {};

        for (let i in UiohookKey) {
            keycode2key[UiohookKey[i]] = i;
        }
        console.log(keycode2key);

        const map: {
            [k: string]: {
                primary?: string;
                secondary?: string;
                symble?: string;
                isRight?: boolean;
                isNumpad?: boolean;
            };
        } = {
            Backspace: { symble: "⌫" },
            Tab: { symble: "⇥" },
            Enter: { symble: "⏎" },
            Shift: { symble: "⇧" },
            Ctrl: { symble: "⌃" },
            Alt: { symble: "⌥" },
            Meta: { symble: "田" },
            Esc: { symble: "⎋" },

            ArrowLeft: { primary: "←" },
            ArrowUp: { primary: "↑" },
            ArrowRight: { primary: "→" },
            ArrowDown: { primary: "↓" },

            Semicolon: { primary: ";", secondary: ":" },
            Equal: { primary: "=", secondary: "+" },
            Comma: { primary: ",", secondary: "<" },
            Minus: { primary: "-", secondary: "_" },
            Period: { primary: ".", secondary: ">" },
            Slash: { primary: "/", secondary: "?" },
            Backquote: { primary: "`", secondary: "~" },
            BracketLeft: { primary: "[", secondary: "{" },
            Backslash: { primary: "\\", secondary: "|" },
            BracketRight: { primary: "]", secondary: "}" },
            Quote: { primary: '"', secondary: "'" },

            1: { secondary: "!" },
            2: { secondary: "@" },
            3: { secondary: "#" },
            4: { secondary: "$" },
            5: { secondary: "%" },
            6: { secondary: "^" },
            7: { secondary: "&" },
            8: { secondary: "*" },
            9: { secondary: "(" },
            0: { secondary: ")" },

            Multiply: { primary: "*" },
            Add: { primary: "+" },
            Subtract: { primary: "-" },
            Decimal: { primary: "." },
            Divide: { primary: "/" },
        };

        for (let k of ["CtrlRight", "AltRight", "ShiftRight", "MetaRight"]) {
            const mainKey = k.replace("Right", "");
            map[k] = { ...map[mainKey], isRight: true, primary: mainKey };
        }
        const numPad = [
            "Numpad0",
            "Numpad1",
            "Numpad2",
            "Numpad3",
            "Numpad4",
            "Numpad5",
            "Numpad6",
            "Numpad7",
            "Numpad8",
            "Numpad9",
            "NumpadMultiply",
            "NumpadAdd",
            "NumpadSubtract",
            "NumpadDecimal",
            "NumpadDivide",
            "NumpadEnd",
            "NumpadArrowDown",
            "NumpadPageDown",
            "NumpadArrowLeft",
            "NumpadArrowRight",
            "NumpadHome",
            "NumpadArrowUp",
            "NumpadPageUp",
            "NumpadInsert",
            "NumpadDelete",
        ];

        for (let key of numPad) {
            const mainKey = key.replace("Numpad", "");
            map[key] = { primary: map[mainKey].primary ?? mainKey, isNumpad: true };
        }

        let keyO: number[] = [];

        const keysEl = document.getElementById("recorder_key");
        let lastKey = null as HTMLElement;

        uIOhook.on("keydown", (e) => {
            if (!keyO.includes(e.keycode)) keyO.push(e.keycode);
            if (!lastKey) {
                lastKey = el("div");
                keysEl.append(lastKey);
            }
            const key = keycode2key[e.keycode];
            const mainKey = map[key]?.primary ?? key;
            const topKey = map[key]?.secondary ?? map[key]?.symble ?? "";
            const kbdEl = el(
                "kbd",
                [el("span", mainKey, { class: "main_key" }), el("span", topKey, { class: "top_key" })],
                {
                    "data-k": e.keycode,
                }
            );
            lastKey.append(kbdEl);
            if (map[key]?.isNumpad) kbdEl.classList.add("numpad_key");
            if (map[key]?.isRight) kbdEl.classList.add("right_key");
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

const { ipcRenderer } = require("electron") as typeof import("electron");
const { execSync } = require("child_process") as typeof import("child_process");
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
            Meta: { symble: "⊞" },
            Escape: { primary: "Esc", symble: "⎋" },
            CapsLock: { symble: "⇪" },
            Space: { symble: "␣" },

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
            map[key] = { primary: map[mainKey]?.primary ?? mainKey, isNumpad: true };
        }

        const macMap: typeof map = {
            Ctrl: { primary: "Control" },
            Alt: { primary: "Option" },
            Meta: { primary: "Command", symble: "⌘" },
            Enter: { primary: "Return" },
        };

        if (process.platform === "darwin")
            for (let k in macMap) {
                Object.assign(map[k], macMap[k]);
            }

        function getKey(keycode: number) {
            let right = false;
            let numpad = false;

            let key = keycode2key[keycode] as string;
            if (["CtrlRight", "AltRight", "ShiftRight", "MetaRight"].includes(key)) {
                key = key.replace("Right", "");
                right = true;
            }

            if (numPad.includes(key)) {
                key = key.replace("Numpad", "");
                numpad = true;
            }

            let mainKey = map[key]?.primary ?? key;
            let topKey = map[key]?.secondary ?? map[key]?.symble ?? "";
            if (numpad) topKey = "";
            return { main: mainKey, top: topKey, numpad: numpad, right: right };
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
            Array.from(keysEl.children)
                .slice(0, -10)
                .forEach((v) => v.remove());
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

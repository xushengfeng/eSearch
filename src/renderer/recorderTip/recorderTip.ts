const { ipcRenderer } = require("electron") as typeof import("electron");
import { ele, txt, view } from "dkh-ui";
import { jsKeyCodeDisplay } from "../../../lib/key";

// 获取设置
import store from "../../../lib/store/renderStore";

const keysEl = document.getElementById("recorder_key");
const recorderMouseEl = document.getElementById("mouse_c");

initRecord();

function initRecord() {
    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
        // biome-ignore lint: 部分引入
        var { uIOhook, UiohookKey } =
            require("uiohook-napi") as typeof import("uiohook-napi");

    function rKey() {
        const posi = store.get("录屏.提示.键盘.位置");
        const px = posi.x === "+" ? "right" : "left";
        const py = posi.y === "+" ? "bottom" : "top";
        keysEl.parentElement.style[px] = `${posi.offsetX}px`;
        keysEl.parentElement.style[py] = `${posi.offsetY}px`;

        keysEl.style.fontSize = `${store.get("录屏.提示.键盘.大小") * 16}px`;

        const keycode2key = {};

        for (const i in UiohookKey) {
            keycode2key[UiohookKey[i]] = i;
        }
        console.log(keycode2key);

        const map: { [k: string]: string } = {
            Ctrl: "Control",
            CtrlRight: "ControlRight",
        };

        for (let i = 0; i < 25; i++) {
            const k = String.fromCharCode(65 + i);
            map[k] = `Key${k}`;
        }

        function getKey(keycode: number) {
            const key = keycode2key[keycode] as string;

            const keyDisplay = jsKeyCodeDisplay(map[key] || key);

            const mainKey = keyDisplay.primary ?? key;
            let topKey = keyDisplay?.secondary ?? keyDisplay?.symble ?? "";
            if (keyDisplay.isNum) topKey = "";
            return {
                main: mainKey,
                top: topKey,
                numpad: keyDisplay.isNumpad,
                right: keyDisplay.isRight,
            };
        }

        let keyO: number[] = [];

        let lastKey = null as ReturnType<typeof view>;

        uIOhook.on("keydown", (e) => {
            if (!keyO.includes(e.keycode)) keyO.push(e.keycode);
            if (!lastKey) {
                lastKey = view();
                if (posi.x === "+") keysEl.append(lastKey.el);
                else keysEl.insertAdjacentElement("afterbegin", lastKey.el);
            }
            const key = getKey(e.keycode);
            if (["Ctrl", "Alt", "Shift", "Meta"].includes(key.main))
                lastKey.data({ modi: "true" });
            const kbdEl = ele("kbd").add(
                txt(key.main)
                    .class("main_key")
                    .data({ k: e.keycode.toString() }),
            );
            console.log(key);

            if (key.top) kbdEl.add(txt(key.top).class("top_key"));
            else {
                kbdEl.el.querySelector("span").classList.remove("main_key");
                kbdEl.el.classList.add("only_key");
            }
            lastKey.add(kbdEl);
            if (key.numpad) kbdEl.el.classList.add("numpad_key");
            if (key.right) kbdEl.el.classList.add("right_key");
            const l = Array.from(keysEl.children);
            if (posi.x === "+") {
                for (const v of l.slice(0, -10)) v.remove();
            } else {
                for (const v of l.slice(10)) v.remove();
            }
        });
        uIOhook.on("keyup", (e) => {
            keyO = keyO.filter((i) => i !== e.keycode);
            for (const el of (lastKey.el
                .querySelectorAll(`[data-k="${e.keycode}"]`)
                ?.values() as Iterable<HTMLElement>) || []) {
                el.classList.add("key_hidden");
            }
            if (keyO.length === 0) {
                const e = lastKey;
                setTimeout(() => {
                    e.style({ opacity: "0" });
                }, 4000);
                lastKey = null;
            }
        });
    }

    function rMouse() {
        const m2m = { 1: 0, 3: 1, 2: 2 };
        const mouseEl = recorderMouseEl.querySelectorAll("div");

        uIOhook.on("mousedown", (e) => {
            mouseEl[m2m[e.button as number]].style.backgroundColor = "#00f";
        });
        uIOhook.on("mouseup", (e) => {
            mouseEl[m2m[e.button as number]].style.backgroundColor = "";
        });

        let time_out: NodeJS.Timeout;
        uIOhook.on("wheel", (e) => {
            console.log(e.direction, e.rotation);
            const x = {
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

    if (store.get("录屏.提示.键盘.开启") || store.get("录屏.提示.鼠标.开启"))
        uIOhook.start();

    if (store.get("录屏.提示.光标.开启"))
        recorderMouseEl.style.display = "flex";

    const mouseStyle = document.createElement("style");
    mouseStyle.innerHTML = `.mouse{${store.get("录屏.提示.光标.样式").replaceAll(";", " !important;")}}`;
    document.body.appendChild(mouseStyle);

    ipcRenderer.on("record", async (_event, t, arg) => {
        switch (t) {
            case "mouse":
                recorderMouseEl.style.left = `${arg.x}px`;
                recorderMouseEl.style.top = `${arg.y}px`;
                break;
        }
    });
}

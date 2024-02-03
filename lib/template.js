var mac_keys = {
    main: {
        Meta: "⌘",
        Shift: "⇧",
        Alt: "⌥",
        Control: "^",
    },
    other: {
        " ": "Space",
        ArrowUp: "Up",
        ArrowDown: "Down",
        ArrowLeft: "Left",
        ArrowRight: "Right",
        "`": "`",
        "¡": "1",
        "™": "2",
        "£": "3",
        "¢": "4",
        "∞": "5",
        "§": "6",
        "¶": "7",
        "•": "8",
        ª: "9",
        º: "0",
        "–": "-",
        "≠": "=",
        "`": "`",
        "⁄": "1",
        "€": "2",
        "‹": "3",
        "›": "4",
        ﬁ: "5",
        ﬂ: "6",
        "‡": "7",
        "°": "8",
        "·": "9",
        "‚": "0",
        "—": "-",
        "±": "=",
        œ: "q",
        "∑": "w",
        "´": "e",
        "®": "r",
        "†": "t",
        "¥": "y",
        "¨": "u",
        ˆ: "i",
        ø: "o",
        π: "p",
        "“": "[",
        "‘": "]",
        "«": "\\",
        Œ: "q",
        "„": "w",
        "´": "e",
        "‰": "r",
        ˇ: "t",
        Á: "y",
        "¨": "u",
        ˆ: "i",
        Ø: "o",
        "∏": "p",
        "”": "[",
        "’": "]",
        "»": "\\",
        å: "a",
        ß: "s",
        "∂": "d",
        ƒ: "f",
        "©": "g",
        "˙": "h",
        "∆": "j",
        "˚": "k",
        "¬": "l",
        "…": ";",
        æ: "'",
        Å: "a",
        Í: "s",
        Î: "d",
        Ï: "f",
        "˝": "g",
        Ó: "h",
        Ô: "j",
        "": "k",
        Ò: "l",
        Ú: ";",
        Æ: "'",
        Ω: "z",
        "≈": "x",
        ç: "c",
        "√": "v",
        "∫": "b",
        "˜": "n",
        µ: "m",
        "≤": ",",
        "≥": ".",
        "÷": "/",
        "¸": "z",
        "˛": "x",
        Ç: "c",
        "◊": "v",
        ı: "b",
        "˜": "n",
        Â: "m",
        "¯": ",",
        "˘": ".",
        "¿": "/",
    },
};
// 快捷键输入框
import delete_svg from "../src/renderer/assets/icons/delete.svg";
class hotkeys_input extends HTMLElement {
    is_mac = typeof process != "undefined" && process.platform == "darwin";

    div;

    constructor() {
        super();

        var main_key = "";

        this._name = this.getAttribute("name");
        this.div = document.createElement("div");
        this.div.id = "key_input";
        this.cvalue(this.getAttribute("value"));
        this.div.setAttribute("tabindex", 0);
        /**按下键增加，释放键减少，0为组合键全部释放 */
        var typing = 0;
        let key_list = [];
        this.div.onfocus = () => {
            this.div.onkeydown = (e) => {
                if (typing == 0) {
                    this.div.innerHTML = "";
                    main_key = "";
                    key_list = [];
                    this.ev(main_key);
                }
                typing++;

                var key = mac_keys.other[e.key] || e.key;
                if (key.match(/[a-z]/) != null && key.length == 1) key = key.toUpperCase();
                if (!key_list.includes(key)) key_list.push(key);
                main_key = key_list.join("+");
                this.cvalue(main_key);

                e.preventDefault(); // 屏蔽快捷键
            };
        };
        this.div.onblur = () => {
            if (typing != 0) {
                typing = 0;
                this.div.innerHTML = "";
                main_key = "";
            }
        };
        this.div.onkeyup = (e) => {
            e.preventDefault();
            let key = mac_keys.other[e.key] || e.key;
            if (key.match(/[a-z]/) != null && key.length == 1) key = key.toUpperCase();
            if (!key_list.includes(key)) {
                // 针对 PrintScreen 这样的只在keyup触发的按键
                key_list.push(key);
                main_key = key_list.join("+");
                this.cvalue(main_key);
            } else {
                typing--;
            }
            if (typing == 0) {
                this.ev(main_key);
            }
        };

        var button = document.createElement("button");
        button.id = "clear";
        let img = document.createElement("img");
        img.src = delete_svg;
        img.className = "icon";
        button.append(img);
        button.onclick = () => {
            this.div.innerHTML = "";
            main_key = "";
            key_list = [];
            this.ev(main_key);
        };

        if (this.innerHTML) this.innerHTML = "";
        this.append(this.div, button);
    }

    cvalue(v) {
        if (v) {
            var l = v.split("+");
            if (this.is_mac) {
                l = l.map((k) => {
                    return mac_keys.main[k] || k;
                });
            }
            this.div.innerHTML = `<kbd>${l.join(`</kbd>${this.is_mac ? "" : "+"}<kbd>`)}</kbd>`;
            this._value = v;
            this.setAttribute("value", v);
        }
    }

    ev(main_key) {
        this._value = main_key;
        var event = new Event("inputend");
        this.dispatchEvent(event);
    }

    get value() {
        return this._value || "";
    }
    get name() {
        return this._name;
    }
    set t(v) {
        this.div.style.borderBottom = `1px solid ${v ? "#0f0" : "#f00"}`;
        if (!v) {
            this.div.innerHTML = "";
            main_key = "";
        }
    }
    set value(v) {
        this.cvalue(v);
    }
}

window.customElements.define("hot-keys", hotkeys_input);

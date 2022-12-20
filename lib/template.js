/// <reference types="vite/client" />
// 单选框
import tcss from "../src/renderer/css/template.css";
import rcss from "../src/renderer/css/root.css";
class setselect extends HTMLElement {
    static get observedAttributes() {
        return ["value"];
    }

    constructor() {
        super();
    }

    connectedCallback() {
        var shadow = this.attachShadow({ mode: "open" });
        var items = this.querySelectorAll("div[value]");

        const linkElem = document.createElement("style");
        linkElem.innerHTML = tcss;
        shadow.appendChild(linkElem);

        items.forEach((item) => {
            var 选项 = item.cloneNode(true);
            选项.classList.add("选项");
            选项.onclick = () => {
                var 所有选项 = 选项.parentNode.childNodes;
                所有选项.forEach((选项) => {
                    选项.classList.remove("选中");
                });
                选项.classList.add("选中");
                this.setAttribute("value", item.getAttribute("value"));
                this._value = item.getAttribute("value");
            };

            选项.innerHTML = item.innerHTML;

            shadow.appendChild(选项);
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this._chvalue(newValue);
    }

    get value() {
        return this._value;
    }
    set value(v) {
        this.setAttribute("value", v);
    }

    _chvalue(value = undefined) {
        if (value != undefined) {
            this._value = value;
            var 所有选项 = this.shadowRoot.childNodes;
            所有选项.forEach((选项) => {
                选项.classList.remove("选中");
                if (选项.getAttribute("value") == value) {
                    选项.classList.add("选中");
                }
            });
        }
    }
}

window.customElements.define("set-select", setselect);

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

        var shadow = this.attachShadow({ mode: "open" });

        const linkElem = document.createElement("style");
        linkElem.innerHTML = tcss;
        shadow.appendChild(linkElem);
        const linkElem2 = document.createElement("style");
        linkElem2.innerHTML = rcss;
        shadow.appendChild(linkElem2);

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
        button.innerHTML = `<img class='icon' src='${delete_svg}'>`;
        button.onclick = () => {
            this.div.innerHTML = "";
            main_key = "";
            key_list = [];
            this.ev(main_key);
        };

        shadow.appendChild(this.div);
        shadow.appendChild(button);
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

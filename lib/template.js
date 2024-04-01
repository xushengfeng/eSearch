import { macKeyFomat, jsKey2ele, jsKeyCodeDisplay, ele2jsKeyCode } from "./key";

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

                const key = jsKey2ele(macKeyFomat(e.key));
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
            let key = jsKey2ele(macKeyFomat(e.key));
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
            l = l.map((k) => {
                const key = jsKeyCodeDisplay(ele2jsKeyCode(k));
                return this.is_mac ? key.symble ?? key.primary : key.primary;
            });
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

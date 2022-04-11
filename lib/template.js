// 单选框
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

        const linkElem = document.createElement("link");
        linkElem.setAttribute("rel", "stylesheet");
        linkElem.setAttribute("href", "css/template.css");
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

// 快捷键输入框
class hotkeys_input extends HTMLElement {
    constructor() {
        super();

        var main_key = "";

        var p = document.createElement("p");
        p.innerText = this._name = this.getAttribute("name");
        var div = document.createElement("div");
        div.id = "key_input";
        this.cvalue(this.getAttribute("value"));
        div.setAttribute("tabindex", 0);
        /**按下键增加，释放键减少，0为组合键全部释放 */
        var typing = 0;
        div.onfocus = () => {
            div.onkeydown = (e) => {
                if (typing == 0) {
                    div.innerHTML = "";
                    main_key = "";
                }
                typing++;

                var key = e.key;
                if (key.match(/[a-z]/) != null && key.length == 1) key = key.toUpperCase();
                div.innerHTML += `${div.innerHTML ? "+" : ""}<kbd>${key}</kbd>`;
                main_key += `${main_key ? "+" : ""}${key}`;

                e.preventDefault(); // 屏蔽快捷键
            };
        };
        div.onblur = () => {
            typing = 0;
        };
        div.onkeyup = () => {
            typing--;
            if (typing == 0) {
                this.ev(main_key);
            }
        };

        var button = document.createElement("button");
        button.id = "clear";
        button.textContent = "⌫";
        button.onclick = () => {
            div.innerHTML = "";
            main_key = "";
            this.ev(main_key);
        };

        this.appendChild(p);
        this.appendChild(div);
        this.appendChild(button);
    }

    cvalue(v) {
        if (v) this.querySelector("div").innerHTML = `<kbd>${v.replace(/\+/g, "</kbd>+<kbd>")}</kbd>`;
    }

    ev(main_key) {
        this._value = main_key;
        var event = new Event("inputend");
        this.dispatchEvent(event);
    }

    get value() {
        return this._value;
    }
    get name() {
        return this._name;
    }
    set t(v) {
        this.querySelector("#key_input").style.borderBottom = `1px solid ${v ? "#0f0" : "#f00"}`;
        if (!v) {
            this.querySelector("div").innerHTML = "";
            main_key = "";
        }
    }
    set value(v) {
        this.cvalue(v);
    }
}

window.customElements.define("hot-keys", hotkeys_input);

const Store = require("electron-store");
store = new Store();

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
        var items = this.querySelectorAll("div");

        const linkElem = document.createElement("link");
        linkElem.setAttribute("rel", "stylesheet");
        linkElem.setAttribute("href", "css/template.css");
        shadow.appendChild(linkElem);

        items.forEach((item) => {
            var 选项 = document.createElement("div");
            选项.classList = "选项";
            选项.onclick = () => {
                var 所有选项 = 选项.parentNode.childNodes;
                所有选项.forEach((选项) => {
                    选项.classList = "选项";
                });
                选项.classList = "选项 选中";
                this._value = item.innerText;
            };

            var 图片 = document.createElement("embed");
            图片.src = item.getAttribute("src");
            图片.classList = "图片";

            var 文字 = document.createElement("p");
            文字.innerText = item.innerText;
            文字.classList = "文字";

            if (item.getAttribute("src") != null) {
                选项.append(图片, 文字);
            } else {
                选项.append(文字);
            }

            shadow.appendChild(选项);
            // 选项.style.transition=getComputedStyle(
            //         document.documentElement
            //     ).getPropertyValue("--transition");
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
                选项.style.background = "";
                if (选项.innerText == value) {
                    选项.classList = "选项 选中";
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

        var p = document.createElement("p");
        p.innerText = this.getAttribute("name");
        var div = document.createElement("div");
        div.id = "key_input";
        if (this.getAttribute("value"))
            div.innerHTML = `<kbd>${this.getAttribute("value").replace(/\+/g, "</kbd>+<kbd>")}</kbd>`;
        div.setAttribute("tabindex", 0);
        var typing = false;
        div.onfocus = () => {
            div.onkeydown = (e) => {
                // 清空原先的键
                if (!typing) div.innerHTML = "";
                // 保证现在的输入不被清空
                typing = true;

                var key = e.key;
                if (key.match(/[a-z]/) != null && key.length == 1) key = key.toUpperCase();
                if (div.innerHTML == "") {
                    div.innerHTML = `<kbd>${key}</kbd>`;
                } else {
                    div.innerHTML += `+<kbd>${key}</kbd>`;
                }

                e.preventDefault(); // 屏蔽快捷键
            };
        };
        div.onkeyup = () => {
            typing = false;
        };
        var key;
        div.onblur = () => {
            typing = false;
            var name = this.getAttribute("name");
            var f = this.getAttribute("f");
            var tmp_key = this.querySelector("div").innerText;
            if (tmp_key != key) {
                key = tmp_key;
                ipcRenderer.send("快捷键", [name, key, f]);
                ipcRenderer.on("状态", (event, arg) => {
                    if (arg) {
                        this.style.background = "#0f0";
                    } else {
                        this.style.background = "#f00";
                    }
                });
                store.set(`key_${name}`, key);
            }
        };

        var button = document.createElement("button");
        button.id = "clear";
        button.textContent = "⌫";
        button.onclick = () => {
            div.innerHTML = "";
        };

        this.appendChild(p);
        this.appendChild(div);
        this.appendChild(button);
    }
}

window.customElements.define("hot-keys", hotkeys_input);

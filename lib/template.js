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
                选项.classList="选项 选中"
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
                    选项.classList="选项 选中"
                }
            });
        }
    }
}

window.customElements.define("set-select", setselect);

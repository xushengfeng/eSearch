class setselect extends HTMLElement {
    constructor() {
        super();
        var shadow = this.attachShadow({ mode: "open" });
        var items = this.querySelectorAll("div");

        this.value = "";

        const linkElem = document.createElement("link");
        linkElem.setAttribute("rel", "stylesheet");
        linkElem.setAttribute("href", "css/template.css");
        shadow.appendChild(linkElem);

        items.forEach((item) => {
            var 选项 = document.createElement("div");
            if (item.getAttribute("默认"))
                选项.style.background = getComputedStyle(document.documentElement).getPropertyValue("--hover-color");
                this.setAttribute('value',item.innerText)
            选项.onclick = () => {
                var 所有选项 = 选项.parentNode.childNodes;
                所有选项.forEach((选项) => {
                    选项.style.background = "";
                });
                选项.style.background = getComputedStyle(document.documentElement).getPropertyValue("--hover-color");
                this.setAttribute('value',item.innerText)
            };
            var 图片 = document.createElement("embed");
            图片.src = item.getAttribute("src");

            var 文字 = document.createElement("p");
            文字.innerText = item.innerText;
            文字.classList = "文字";

            if (item.getAttribute("src") != null) {
                选项.append(图片, 文字);
            } else {
                选项.append(文字);
            }

            shadow.appendChild(选项);
        });
    }
    static get observedAttributes() {
        return ["value"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        // name will always be "country" due to observedAttributes
        this.value = newValue;
    }

    get value() {
        return this.value;
    }

    set value(v) {
        this.setAttribute("value", v);
    }
}

window.customElements.define("set-select", setselect);



class settable extends HTMLElement {
    constructor() {
        super();
        var shadow = this.attachShadow({ mode: "open" });
        var items = this.querySelectorAll("div");

        this.value = "";

        const linkElem = document.createElement("link");
        linkElem.setAttribute("rel", "stylesheet");
        linkElem.setAttribute("href", "css/template.css");
        shadow.appendChild(linkElem);

        shadow.appendChild(选项);
    }
}

window.customElements.define("set-table", settable);

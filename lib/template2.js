// 拖动条
class range_b extends HTMLElement {
    static get observedAttributes() {
        return ["value"];
    }

    constructor() {
        super();
    }

    connectedCallback() {
        var templateElem = document.querySelector("#range-b");
        var content = templateElem.content.cloneNode(true);
        this.appendChild(content);

        var t = this.getAttribute("text") || "";

        var div = document.querySelector("div");

        var input = this.querySelector("input");
        input.min = this.getAttribute("min");
        input.max = this.getAttribute("max");
        input.step = this.getAttribute("step");
        input.style.height = div.style.height = this.style.height;
        input.style.width = div.style.width = this.style.width;
        var p = document.querySelector("div > p");

        if (input.max == "" || input.max == "null") input.max = 100;
        input.style.backgroundSize = (input.value / input.max) * 100 + "%";
        p.innerText = input.value + t;

        input.oninput = () => {
            if (input.max == "" || input.max == "null") input.max = 100;
            input.style.backgroundSize = (input.value / input.max) * 100 + "%";
            p.innerText = input.value + t;
        };
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
        }
    }
}

window.customElements.define("range-b", range_b);

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

        var div = this.querySelector("div");

        var input = this.querySelector("input");
        input.min = this.getAttribute("min");
        input.max = this.getAttribute("max");
        input.step = this.getAttribute("step");
        input.value = this.getAttribute("value");
        var p = this.querySelectorAll("div > p");

        if (input.max == "" || input.max == "null") input.max = 100;
        input.style.backgroundSize = (input.value / input.max) * 100 + "%";
        p[0].innerText = input.value;
        p[1].innerText = t;

        input.oninput = () => {
            if (input.max == "" || input.max == "null") input.max = 100;
            input.style.backgroundSize = (input.value / input.max) * 100 + "%";
            p[0].innerText = input.value;
            p[1].innerText = t;
            this._value = input.value;
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
            if (this.querySelector("input") != null && this.querySelectorAll("div > p")[0] != null) {
                this.c_value(value);
            }
        }
    }

    c_value(value) {
        var t = this.getAttribute("text") || "";
        var input = this.querySelector("input");
        input.max = this.getAttribute("max");
        var p = this.querySelectorAll("div > p");

        if (input.max == "" || input.max == "null") input.max = 100;
        input.style.backgroundSize = (value / input.max) * 100 + "%";
        p[0].innerText = value;
        p[1].innerText = t;
    }
}

window.customElements.define("range-b", range_b);

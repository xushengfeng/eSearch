// 拖动条
class range_b extends HTMLElement {
    static get observedAttributes() {
        return ["value"];
    }

    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = `
        <div>
            <input type="range" id="range">
            <div id="range_thumb"></div>
        </div>
        <div class="range_t">
            <p></p>
            <p></p>
        </div>`;

        if (!this.getAttribute("out")) {
            this.classList.add("in_range");
        } else {
            this.classList.add("out_range");
        }

        var t = this.getAttribute("text") || "";

        var input = this.querySelector("input");
        input.min = this.getAttribute("min") || 0;
        input.max = this.getAttribute("max") || 100;
        input.step = this.getAttribute("step");
        input.value = this.getAttribute("value");
        var thumb = this.querySelector("#range_thumb");
        var p = this.querySelectorAll("div > p");

        input.onmouseup = (e) => {
            if (e.button == 2 && this.getAttribute("value")) {
                this.c_value(this.getAttribute("value"));
                this.c_t(this.getAttribute("value"));
                this._value = this.getAttribute("value");
                this.dispatchEvent(new Event("input"));
            }
        };

        thumb.style.width = ((input.value - input.min) / (input.max - input.min)) * 100 + "%";
        p[0].innerText = input.value;
        p[1].innerText = t;

        const inputF = () => {
            thumb.style.width = ((input.value - input.min) / (input.max - input.min)) * 100 + "%";
            p[0].innerText = input.value;
            p[1].innerText = t;
            this._value = input.value;
        };
        input.oninput = inputF;

        p[0].contentEditable = true;
        p[0].style.outline = "none";
        p[0].onkeydown = (e) => {
            if (e.key == "Enter") e.preventDefault();
            if (e.key === "ArrowUp") {
                input.stepUp();
            }
            if (e.key === "ArrowDown") {
                input.stepDown();
            }
            inputF();
            this.dispatchEvent(new Event("input"));
        };
        p[0].oninput = (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (p[0].innerText === "") return;
            if (isNaN(p[0].innerText - 0)) return;
            if (p[0].innerText - 0 < input.min - 0 || p[0].innerText - 0 > input.max - 0) return;
            var n = p[0].innerText - 0;
            this.c_value(n);
            this._value = n;
            this.dispatchEvent(new Event("input"));
        };
        p[0].onblur = () => {
            if (p[0].innerText === "") {
                this.c_value(this.getAttribute("value"));
                this.c_t(this.getAttribute("value"));
                this._value = this.getAttribute("value");
                this.dispatchEvent(new Event("input"));
            }
        };
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this._chvalue(newValue);
    }

    get value() {
        return Number(this._value);
    }
    set value(v) {
        this.setAttribute("value", v);
    }

    _chvalue(value = undefined) {
        if (value != undefined) {
            this._value = value;
            if (this.querySelector("input") != null && this.querySelectorAll("div > p")[0] != null) {
                this.c_value(value);
                this.c_t(value);
            }
        }
    }

    c_value(value) {
        var input = this.querySelector("input");
        input.min = this.getAttribute("min") || 0;
        input.max = this.getAttribute("max") || 100;
        var thumb = this.querySelector("#range_thumb");
        thumb.style.width = ((value - input.min) / (input.max - input.min)) * 100 + "%";
    }
    c_t(value) {
        var t = this.getAttribute("text") || "";
        var p = this.querySelectorAll("div > p");
        p[0].innerText = value;
        p[1].innerText = t;
    }
}

window.customElements.define("range-b", range_b);


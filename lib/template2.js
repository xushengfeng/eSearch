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

        input.oninput = () => {
            thumb.style.width = ((input.value - input.min) / (input.max - input.min)) * 100 + "%";
            p[0].innerText = input.value;
            p[1].innerText = t;
            this._value = input.value;
        };

        p[0].contentEditable = true;
        p[0].style.outline = "none";
        p[0].onkeydown = (e) => {
            if (e.key == "Enter") e.preventDefault();
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

// 按钮
class lock_b extends HTMLElement {
    static get observedAttributes() {
        return ["checked"];
    }

    constructor() {
        super();
    }

    connectedCallback() {
        var box = document.createElement("input");
        box.type = "checkbox";
        box.oninput = () => {
            this._chvalue(box.checked);
        };
        this.appendChild(box);
        this.setAttribute("checked", box.checked);
    }

    get checked() {
        return this.querySelector("input").checked;
    }
    set checked(v) {
        this.querySelector("input").checked = v;
        this._chvalue(v);
    }

    _chvalue(value = undefined) {
        if (value) {
            this.style.backgroundColor = "var(--hover-color)";
        } else {
            this.style.backgroundColor = "";
        }
    }
}

window.customElements.define("lock-b", lock_b);

// 时间选择
class time_i extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this._value = Number(this.getAttribute("value")) || 0;
        this._min = Number(this.getAttribute("min")) || 0;
        this._max = Number(this.getAttribute("max")) || 0;
        var i = document.createElement("span");
        this.appendChild(i);
        i.innerHTML = `<span contenteditable="true"></span>:<span contenteditable="true"></span>:<span contenteditable="true"></span>.<span contenteditable="true"></span>`;
        var 加 = document.createElement("span"),
            减 = document.createElement("span");
        this.appendChild(加);
        this.appendChild(减);
        加.innerText = "+";
        减.innerText = "-";
        var [h, m, s, ss] = i.querySelectorAll("span");
        var dx = 1;
        var focus_el = ss;

        h.onfocus = () => {
            focus_el = h;
        };
        m.onfocus = () => {
            focus_el = m;
        };
        s.onfocus = () => {
            focus_el = s;
        };
        ss.onfocus = () => {
            focus_el = ss;
        };

        h.oninput = () => {
            r(h, "0", Infinity);
        };
        m.oninput = () => {
            r(m, "00", 60);
        };
        s.oninput = () => {
            r(s, "00", 60);
        };
        ss.oninput = () => {
            r(ss, "000", 1000);
        };
        /**
         *
         * @param {HTMLSpanElement} el
         * @param {string} dv
         * @param {number} max
         */
        var r = (el, dv, max) => {
            if (Number(el.innerText) === NaN) {
                el.innerText = "";
            } else {
                let tf = false;
                switch (el) {
                    case ss:
                        tf = 0 <= this.n(ss) && this.n(ss) < max;
                        break;
                    case s:
                        tf = 0 <= this.n(s) && this.n(s) < max;
                        break;
                    case m:
                        tf = 0 <= this.n(m) && this.n(m) < max;
                        break;
                    case h:
                        tf = 0 <= this.n(h) && this.n(h) < max;
                        break;
                }
                if (tf) {
                    this.sum_value();
                } else {
                    el.innerText = dv;
                }
            }
        };

        加.onclick = () => {
            let d_v = this._value;
            d_v += dxx();
            if (d_v <= this._max) {
                this.set_value(d_v);
            }
        };
        减.onclick = () => {
            let d_v = this._value;
            d_v -= dxx();
            if (d_v >= this._min) {
                this.set_value(d_v);
            }
        };

        function dxx() {
            let dx = 1;
            switch (focus_el) {
                case ss:
                    dx = 1;
                    break;
                case s:
                    dx = 1000;
                    break;
                case m:
                    dx = 60000;
                    break;
                case h:
                    dx = 3600000;
                    break;
                default:
                    dx = 1;
            }
            return dx;
        }
    }

    /** @param {HTMLSpanElement} el*/
    n(el) {
        return Number(el.innerText);
    }

    set_value(v) {
        this._value = v;
        let tn = v % 1000;
        let sn = Math.trunc(v / 1000);
        let mn = Math.trunc(sn / 60);
        let hn = Math.trunc(mn / 60);
        var [h, m, s, ss] = this.querySelector("span").querySelectorAll("span");
        h.innerText = hn;
        m.innerText = mn - 60 * hn;
        s.innerText = String(sn - 60 * mn).padStart(2, 0);
        ss.innerText = String(tn).padStart(3, 0);
    }

    sum_value() {
        var [h, m, s, ss] = this.querySelector("span").querySelectorAll("span");
        var [hn, mn, sn, ssn] = [h, m, s, ss].map((v) => this.n(v));
        this._value = hn * 3600000 + mn * 60000 + sn * 1000 + ssn;
    }

    get value() {
        return this._value;
    }
    set value(v) {
        this.set_value(Number(v));
        this.setAttribute("value", v);
    }
    get max() {
        return this._max;
    }
    set max(x) {
        let v = Number(x) || 0;
        this._max = v;
        this.setAttribute("max", v);
    }
    get min() {
        this._min;
    }
    set min(x) {
        let v = Number(x) || 0;
        this._max = v;
        this.setAttribute("min", v);
    }
}

window.customElements.define("time-i", time_i);

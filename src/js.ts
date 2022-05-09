var editor = document.getElementById("text");
/**
 * 写入编辑器
 * @param {string} value 传入text
 */
function editor_push(value: string) {
    let pg = value.split(/[\n\r]/);
    for (let i of pg) {
        let word_l = i.split("");
        let div = document.createElement("div");
        for (let j of word_l) {
            let span = document.createElement("span");
            span.innerText = j;
            div.append(span);
        }
        if (word_l.length == 0) {
            div.innerHTML = "<br>";
        }
        editor.append(div);
    }
}
editor_push("");
/**
 * 获取编辑器文字
 * @returns 文字
 */
function editor_get() {
    var t = "";
    for (let i of editor.querySelectorAll("div")) {
        if (i.innerText == "\n" || t == "") {
            t += i.innerText;
        } else {
            t += "\n" + i.innerText;
        }
    }
    return t;
}
/**记录间隔位置，从0开始 */
type _Selection = [{ start: { pg: number; of: number }; end: { pg: number; of: number } }?];
var editor_selection: _Selection = [];

function editor_cursor() {
    editor.addEventListener("mousedown", (e) => {
        var el = <HTMLElement>e.target;
        var n_s = { start: { pg: NaN, of: NaN }, end: { pg: NaN, of: NaN } };
        if (el.tagName == "SPAN") {
            var w = el;
            if (e.offsetX <= w.offsetWidth + w.offsetLeft) {
                n_s.start.of = get_index(w.parentElement, w);
            } else {
                n_s.start.of = get_index(w.parentElement, w) + 1;
            }
            n_s.start.pg = get_index(editor, w.parentElement);
        } else if (el.tagName == "DIV") {
            n_s.start.of = el.innerText == "\n" ? 0 : el.innerText.length;
            n_s.start.pg = get_index(editor, el);
        }
        editor_selection[0] = n_s;
    });
    editor.addEventListener("mouseup", (e) => {
        var el = <HTMLElement>e.target;
        var n_s = editor_selection[0];
        if (el.tagName == "SPAN") {
            var w = el;
            if (e.offsetX <= w.offsetWidth + w.offsetLeft) {
                n_s.end.of = get_index(w.parentElement, w);
            } else {
                n_s.end.of = get_index(w.parentElement, w) + 1;
            }
            n_s.end.pg = get_index(editor, w.parentElement);
        } else if (el.tagName == "DIV") {
            n_s.end.of = el.innerText == "\n" ? 0 : el.innerText.length;
            n_s.end.pg = get_index(editor, el);
        }
        cursor.pg = n_s.end.pg;
        cursor.of = n_s.end.of;
        editor_i(cursor.pg, cursor.of);
    });
}
editor_cursor();
/**
 * 获取段落元素
 * @param p 段落数，从0开始算
 * @returns 元素，通过元素获取属性
 */
function get_pg(p: number) {
    return <HTMLElement>editor.querySelector(`div:nth-child(${p + 1})`);
}
/**
 * 获取段落最大索引
 * @returns 索引值
 */
function get_pg_max() {
    var i = editor.querySelectorAll(`div`).length;
    return i - 1;
}
/**
 * 获取字符
 * @param p 段落数，从0开始算
 * @param i 字符索引
 * @returns 元素，通过元素获取属性
 */
function get_w(p: number, i: number) {
    var el = null;
    if (i == 0) {
        el = editor.querySelector(`div:nth-child(${p + 1})`);
    } else {
        el = editor.querySelector(`div:nth-child(${p + 1})`).querySelector(`span:nth-child(${i + 1})`);
    }
    return <HTMLElement>el;
}
/**
 * 获取字符索引
 * @param p 段落数，从0开始算
 * @param i 字符间隔索引 0a1b2c3
 * @returns 横向坐标
 */
function get_w_index(p: number, i: number) {
    var n = 0;
    // 由于i是间隔数，为了不必要的判断，定位元素右边，0号间隔单独算
    if (i == 0) {
        n = (<HTMLElement>editor.querySelector(`div:nth-child(${p + 1})`)).offsetLeft;
    } else {
        var el = <HTMLElement>editor.querySelector(`div:nth-child(${p + 1})`).querySelector(`span:nth-child(${i})`);
        if (!el) {
            return null;
        } else {
            n = el.offsetLeft + el.offsetWidth;
        }
    }
    return n;
}
/**
 * 获取段落最大词数（最大间隔索引）
 * @param p 段落数，从0开始算
 * @returns 词数
 */
function get_w_max(p: number) {
    var el = <HTMLElement>editor.querySelector(`div:nth-child(${p + 1})`);
    if (el.innerText == "\n") {
        return 0;
    } else {
        return el.innerText.length;
    }
}
/**
 * 定位子元素
 * @param {HTMLElement} parent_element 父元素
 * @param {HTMLElement} element 子元素
 * @returns {number} 位置，从0算起
 */
function get_index(parent_element: HTMLElement, element: HTMLElement): number {
    for (let i = 0; i < parent_element.children.length; i++) {
        if (parent_element.children[i] === element) return i;
    }
}
var cursor = { pg: NaN, of: NaN };
/**
 * 定位光标(左边)
 * @param {number} p 段落(from 0)
 * @param {number} i 词(from 0)
 */
function editor_i(p: number, i: number) {
    var top = get_pg(p).offsetTop;
    var left = get_w_index(p, i) || get_w_index(p, get_w_max(p));
    document.getElementById("cursor").style.left = left + "px";
    document.getElementById("cursor").style.top = top + "px";
}
editor_i(0, 0);

document.addEventListener("keyup", (e) => {
    e.preventDefault();
    switch (e.key) {
        case "ArrowUp":
            if (cursor.pg != 0) cursor.pg--;
            break;
        case "ArrowDown":
            if (cursor.pg != get_pg_max()) cursor.pg++;
            break;
        case "ArrowLeft":
            if (cursor.of == 0) {
                if (cursor.pg != 0) {
                    cursor.pg--;
                    cursor.of = get_w_max(cursor.pg);
                }
            } else {
                cursor.of--;
            }
            break;
        case "ArrowRight":
            if (cursor.of == get_w_max(cursor.pg)) {
                if (cursor.pg != get_pg_max()) {
                    cursor.pg++;
                    cursor.of = 0;
                }
            } else {
                cursor.of++;
            }
            break;
    }
    editor_i(cursor.pg, cursor.of);
});

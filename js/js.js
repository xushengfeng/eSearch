var editor = document.getElementById("text");
/**
 * 写入编辑器
 * @param {string} value 传入text
 */
function editor_push(value) {
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
        }
        else {
            t += "\n" + i.innerText;
        }
    }
    return t;
}
var editor_selection = [];
function editor_cursor() {
    editor.addEventListener("mousedown", (e) => {
        var el = e.target;
        var n_s = { start: { pg: NaN, of: NaN }, end: { pg: NaN, of: NaN } };
        if (el.tagName == "SPAN") {
            var w = el;
            if (e.offsetX <= w.offsetWidth + w.offsetLeft) {
                n_s.start.of = get_index(w.parentElement, w);
            }
            else {
                n_s.start.of = get_index(w.parentElement, w) + 1;
            }
            n_s.start.pg = get_index(editor, w.parentElement);
        }
        else if (el.tagName == "DIV") {
            n_s.start.of = el.innerText == "\n" ? 0 : el.innerText.length;
            n_s.start.pg = get_index(editor, el);
        }
        editor_selection[0] = n_s;
    });
    editor.addEventListener("mouseup", (e) => {
        var el = e.target;
        var n_s = editor_selection[0];
        if (el.tagName == "SPAN") {
            var w = el;
            if (e.offsetX <= w.offsetWidth + w.offsetLeft) {
                n_s.end.of = get_index(w.parentElement, w);
            }
            else {
                n_s.end.of = get_index(w.parentElement, w) + 1;
            }
            n_s.end.pg = get_index(editor, w.parentElement);
        }
        else if (el.tagName == "DIV") {
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
function get_pg(p) {
    return editor.querySelector(`div:nth-child(${p + 1})`);
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
function get_w(p, i) {
    var el = null;
    if (i == 0) {
        el = editor.querySelector(`div:nth-child(${p + 1})`);
    }
    else {
        el = editor.querySelector(`div:nth-child(${p + 1})`).querySelector(`span:nth-child(${i + 1})`);
    }
    return el;
}
/**
 * 获取字符索引
 * @param p 段落数，从0开始算
 * @param i 字符间隔索引 0a1b2c3
 * @returns 横向坐标
 */
function get_w_index(p, i) {
    var n = 0;
    // 由于i是间隔数，为了不必要的判断，定位元素右边，0号间隔单独算
    if (i == 0) {
        n = editor.querySelector(`div:nth-child(${p + 1})`).offsetLeft;
    }
    else {
        var el = editor.querySelector(`div:nth-child(${p + 1})`).querySelector(`span:nth-child(${i})`);
        if (!el) {
            return null;
        }
        else {
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
function get_w_max(p) {
    var el = editor.querySelector(`div:nth-child(${p + 1})`);
    if (el.innerText == "\n") {
        return 0;
    }
    else {
        return el.innerText.length;
    }
}
/**
 * 定位子元素
 * @param {HTMLElement} parent_element 父元素
 * @param {HTMLElement} element 子元素
 * @returns {number} 位置，从0算起
 */
function get_index(parent_element, element) {
    for (let i = 0; i < parent_element.children.length; i++) {
        if (parent_element.children[i] === element)
            return i;
    }
}
var cursor = { pg: 0, of: 0 };
var cursor_real = { pg: 0, of: 0 };
/**
 * 定位光标(左边)
 * @param {number} p 段落(from 0)
 * @param {number} i 词(from 0)
 */
function editor_i(p, i) {
    cursor_real = { pg: p, of: i };
    if (!get_w_index(p, i))
        cursor_real.of = get_w_max(p); /* 移动到更短行，定位到末尾 */
    var top = get_pg(p).offsetTop;
    var left = get_w_index(p, i) || get_w_index(p, get_w_max(p));
    document.getElementById("cursor").style.left = left + "px";
    document.getElementById("cursor").style.top = top + "px";
}
editor_i(cursor.pg, cursor.of);
document.addEventListener("keydown", (e) => {
    e.preventDefault();
});
document.addEventListener("keyup", (e) => {
    switch (e.key) {
        case "ArrowUp":
            if (cursor.pg != 0)
                cursor.pg--;
            break;
        case "ArrowDown":
            if (cursor.pg != get_pg_max())
                cursor.pg++;
            break;
        case "ArrowLeft":
            cursor = cursor_real; /* 左右移动后，不记录横向最大 */
            if (cursor.of == 0) {
                if (cursor.pg != 0) {
                    cursor.pg--;
                    cursor.of = get_w_max(cursor.pg);
                }
            }
            else {
                cursor.of--;
            }
            break;
        case "ArrowRight":
            cursor = cursor_real;
            if (cursor.of == get_w_max(cursor.pg)) {
                if (cursor.pg != get_pg_max()) {
                    cursor.pg++;
                    cursor.of = 0;
                }
            }
            else {
                cursor.of++;
            }
            break;
        case "Home":
            cursor.of = 0;
            break;
        case "End":
            cursor.of = get_w_max(cursor.pg);
            break;
    }
    editor_i(cursor.pg, cursor.of);
});

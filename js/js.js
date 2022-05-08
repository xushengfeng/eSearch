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
        if (el.tagName == "SPAN") {
            var w = el;
            var n_s = { start: { pg: NaN, of: NaN }, end: { pg: NaN, of: NaN } };
            if (e.offsetX <= w.offsetWidth) {
                n_s.start.of = get_index(w.parentElement, w);
            }
            else {
                n_s.start.of = get_index(w.parentElement, w) + 1;
            }
            n_s.start.pg = get_index(editor, w.parentElement);
            editor_selection[0] = n_s;
        }
    });
    editor.addEventListener("mouseup", (e) => {
        var el = e.target;
        if (el.tagName == "SPAN") {
            var w = el;
            var n_s = editor_selection[0];
            if (e.offsetX <= w.offsetWidth) {
                n_s.end.of = get_index(w.parentElement, w);
            }
            else {
                n_s.end.of = get_index(w.parentElement, w) + 1;
            }
            n_s.end.pg = get_index(editor, w.parentElement);
            cursor.pg = n_s.end.pg;
            cursor.of = n_s.end.of;
            editor_i(cursor.pg, cursor.of);
        }
    });
}
editor_cursor();
function get_pg(p) {
    return editor.querySelector(`div:nth-child(${p + 1})`);
}
function get_w(i) {
    return editor.querySelector(`span:nth-child(${i + 1})`);
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
var cursor = { pg: NaN, of: NaN };
/**
 * 定位光标(左边)
 * @param {number} p 段落(from 0)
 * @param {number} i 词(from 0)
 */
function editor_i(p, i) {
    var top = get_pg(p).offsetTop;
    var left = get_w(i).offsetLeft;
    document.getElementById("cursor").style.left = left + "px";
    document.getElementById("cursor").style.top = top + "px";
}
document.addEventListener("keyup", (e) => {
    e.preventDefault();
    switch (e.key) {
        case "ArrowUp":
            cursor.pg--;
            break;
        case "ArrowDown":
            cursor.pg++;
            break;
        case "ArrowLeft":
            if (cursor.of == 0) {
                cursor.pg--;
                cursor.of = get_pg(cursor.pg).innerText.length;
            }
            else {
                cursor.pg--;
            }
            break;
        case "ArrowRight":
            if ((cursor.of = get_pg(cursor.pg).innerText.length - 1)) {
                cursor.pg++;
                cursor.of = 0;
            }
            else {
                cursor.of++;
            }
            break;
    }
    editor_i(cursor.pg, cursor.of);
});

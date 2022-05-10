var editor = document.getElementById("text");
/**
 * 写入编辑器
 * @param value 传入text
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
function format_selection(s) {
    var tmp = { start: { pg: NaN, of: NaN }, end: { pg: NaN, of: NaN } };
    if (s.end.pg == s.start.pg) {
        tmp.start.pg = tmp.end.pg = s.end.pg;
        tmp.start.of = Math.min(s.start.of, s.end.of);
        tmp.end.of = Math.max(s.start.of, s.end.of);
    }
    else if (s.end.pg < s.start.pg) {
        [tmp.start, tmp.end] = [s.end, s.start];
    }
    else {
        tmp = s;
    }
    return tmp;
}
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
        document.getElementById("selection").innerHTML = "";
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
        rander_selection(format_selection(n_s));
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
 * 获取字符元素
 * @param p 段落数，从0开始算
 * @param i 字符索引
 * @returns 元素，通过元素获取属性
 */
function get_w(p, i) {
    var el = editor.querySelector(`div:nth-child(${p + 1})`).querySelector(`span:nth-child(${i})`);
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
 * @param parent_element 父元素
 * @param element 子元素
 * @returns 位置，从0算起
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
 * @param p 段落(from 0)
 * @param i 词(from 0)
 */
function editor_i(p, i) {
    cursor_real = { pg: p, of: i };
    if (!get_w_index(p, i))
        cursor_real.of = get_w_max(p); /* 移动到更短行，定位到末尾 */
    var top = get_pg(p).offsetTop;
    var left = get_w_index(p, i) || get_w_index(p, get_w_max(p));
    document.getElementById("cursor").style.left = left + "px";
    document.getElementById("cursor").style.top = top + 8 + "px";
}
editor_i(cursor.pg, cursor.of);
/**
 * 渲染选区
 * @param s 选区
 */
function rander_selection(s) {
    if (s.start.pg == s.end.pg) {
        draw_line_selection(s.start.pg, s.start.of, s.end.of, false);
    }
    else {
        for (let i = s.start.pg; i <= s.end.pg; i++) {
            if (i == s.start.pg) {
                draw_line_selection(i, s.start.of, get_w_max(i), true);
            }
            else if (i == s.end.pg) {
                draw_line_selection(i, 0, s.end.of, s.end.of == 0);
            }
            else {
                draw_line_selection(i, 0, get_w_max(i), true);
            }
        }
    }
    function draw_line_selection(pg, s_of, e_of, br) {
        var div = document.createElement("div");
        div.className = "selection";
        var s_left = s_of == 0 ? 0 : get_w(pg, s_of).offsetLeft + get_w(pg, s_of).offsetWidth, e_left = e_of == 0 ? 0 : get_w(pg, e_of).offsetLeft + get_w(pg, e_of).offsetWidth;
        div.style.left = s_left + "px";
        div.style.width = e_left - s_left + (br ? 1 : 0) + "px";
        div.style.top = get_pg(pg).offsetTop + "px";
        document.getElementById("selection").append(div);
    }
}
/**
 * 获取选区文字
 * @param s 选区
 * @returns 文字（反转义）
 */
function get_selection(s) {
    var text = "";
    if (s.start.pg == s.end.pg) {
        text = get_s(s.start.pg, s.start.of, s.end.of);
    }
    else {
        for (let i = s.start.pg; i <= s.end.pg; i++) {
            if (i == s.start.pg) {
                text += get_s(i, s.start.of, get_w_max(i)) || "\n";
            }
            else if (i == s.end.pg) {
                text += "\n" + get_s(i, 0, s.end.of);
            }
            else {
                text += "\n" + get_s(i, 0, get_w_max(i));
            }
        }
    }
    return text;
}
/**
 * 截取的文字
 * @param n 段落索引
 * @param s 开始间隔索引
 * @param e 末尾间隔索引
 * @returns 文字（反转义）
 */
function get_s(n, s, e) {
    var r = get_pg(n).innerText;
    r = r.slice(s, e);
    return r;
}
/**
 * 替换选区文字
 * @param s 选区
 * @param text 要替换成的文字
 */
function replace_selection(s, text) {
    var t = "";
    // 拼接替换后的文字
    t = get_s(s.start.pg, 0, s.start.of) + text + get_s(s.end.pg, s.end.of, get_w_max(s.end.pg));
    // 删除原来的段落
    for (let i = s.start.pg; i <= s.end.pg; i++) {
        get_pg(i).remove();
    }
    // 倒叙添加
    let pg = t.split(/[\n\r]/);
    for (let i = pg.length - 1; i >= 0; i--) {
        let word_l = pg[i].split("");
        let div = document.createElement("div");
        for (let j of word_l) {
            let span = document.createElement("span");
            span.innerText = j;
            div.append(span);
        }
        if (word_l.length == 0) {
            div.innerHTML = "<br>";
        }
        if (s.start.pg == 0) {
            editor.prepend(div);
        }
        else {
            get_pg(s.start.pg - 1).after(div);
        }
    }
}
document.getElementById("cursor").focus();
document.getElementById("cursor").oninput = () => {
    var input_t = document.getElementById("cursor").innerText;
    document.getElementById("cursor").innerText = "";
    var input_t_l = input_t.split("");
    if (cursor_real.of != 0) {
        for (let i = input_t_l.length - 1; i >= 0; i--) {
            const t = input_t_l[i];
            var span = document.createElement("span");
            span.innerHTML = t;
            editor
                .querySelector(`div:nth-child(${cursor_real.pg + 1})`)
                .querySelector(`span:nth-child(${cursor_real.of})`)
                .after(span);
        }
    }
    else {
        editor.querySelector(`div:nth-child(${cursor_real.pg + 1})`).innerHTML = `<span>${input_t_l.join("</span><span>")}</span>`;
    }
    cursor.of += input_t_l.length;
    editor_i(cursor.pg, cursor.of);
};
document.addEventListener("keydown", (e) => {
    var l = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Backspace", "Delete"];
    if (l.includes(e.key))
        e.preventDefault();
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
        case "Backspace":
            cursor = cursor_real; /* 左右移动后，不记录横向最大 */
            if (cursor.of == 0) {
                if (cursor.pg != 0) {
                    cursor.pg--;
                    cursor.of = get_w_max(cursor.pg);
                    if (get_pg(cursor.pg).innerText == "\n") {
                        get_pg(cursor.pg).innerHTML = get_pg(cursor.pg + 1).innerHTML;
                    }
                    else {
                        get_pg(cursor.pg).innerHTML += get_pg(cursor.pg + 1).innerHTML;
                    }
                    get_pg(cursor.pg + 1).remove();
                }
            }
            else {
                get_w(cursor.pg, cursor.of).remove();
                cursor.of--;
            }
            break;
        case "Delete":
            cursor = cursor_real;
            if (cursor.of == get_w_max(cursor.pg)) {
                if (cursor.pg != get_pg_max()) {
                    if (get_pg(cursor.pg).innerText == "\n") {
                        get_pg(cursor.pg).innerHTML = get_pg(cursor.pg + 1).innerHTML;
                    }
                    else if (get_pg(cursor.pg + 1).innerText != "\n") {
                        get_pg(cursor.pg).innerHTML += get_pg(cursor.pg + 1).innerHTML;
                    }
                    get_pg(cursor.pg + 1).remove();
                }
            }
            else {
                get_w(cursor.pg, cursor.of + 1).remove();
            }
            break;
    }
    editor_i(cursor.pg, cursor.of);
});

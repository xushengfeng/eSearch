var editor = document.getElementById("text");
/**
 * 写入编辑器
 * @param value 传入text
 */
function editor_push(value) {
    editor.innerHTML = "";
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
    editor_i(get_pg_max(), get_w_max(get_pg_max()));
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
class selection {
    constructor(s) {
        this.start = s.start;
        this.end = s.end;
    }
    /**
     * 渲染选区
     * @param this 选区
     */
    rander() {
        var s = format_selection(this);
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
     * @param this 选区
     * @returns 文字（反转义）
     */
    get() {
        var s = format_selection(this);
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
     * 替换选区文字
     * @param this 选区
     * @param text 要替换成的文字
     */
    replace(text) {
        var s = format_selection(this);
        var t = "";
        // 拼接替换后的文字
        t = get_s(s.start.pg, 0, s.start.of) + text + get_s(s.end.pg, s.end.of, get_w_max(s.end.pg));
        // 删除原来的段落
        var t_l = [];
        for (let i = s.start.pg; i <= s.end.pg; i++) {
            t_l.push(get_pg(i));
        }
        for (let i of t_l) {
            i.remove();
        }
        // 倒叙添加
        let pg = t.split(/[\n\r]/);
        for (let i = pg.length - 1; i >= 0; i--) {
            let word_l = pg[i].split("");
            let div = document.createElement("div");
            for (let j of word_l) {
                let span = document.createElement("span");
                if (j == "\t")
                    span.className = "tab";
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
        editor_selections[0].start = s.start;
        editor_selections[0].end = s.start;
        document.getElementById("selection").innerHTML = "";
        editor_i(s.start.pg, s.start.of);
    }
}
var editor_selection = new selection({ start: { pg: 0, of: 0 }, end: { pg: 0, of: 0 } });
var editor_selections = [editor_selection];
function format_selection(s) {
    var tmp = new selection({ start: { pg: NaN, of: NaN }, end: { pg: NaN, of: NaN } });
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
    var down = false;
    editor.addEventListener("mousedown", (e) => {
        down = true;
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
            n_s.start.of = el.innerText == "\n" ? 0 : el.querySelectorAll("span").length;
            n_s.start.pg = get_index(editor, el);
        }
        if (!e.shiftKey)
            [editor_selections[0].start, editor_selections[0].end] = [n_s.start, n_s.end];
        document.getElementById("selection").innerHTML = "";
    });
    editor.addEventListener("mousemove", (e) => {
        if (!down)
            return;
        var el = e.target;
        var n_s = editor_selections[0];
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
            n_s.end.of = el.innerText == "\n" ? 0 : el.querySelectorAll("span").length;
            n_s.end.pg = get_index(editor, el);
        }
        document.getElementById("selection").innerHTML = "";
        n_s.rander();
        cursor.pg = n_s.end.pg;
        cursor.of = n_s.end.of;
        editor_i(cursor.pg, cursor.of);
    });
    editor.addEventListener("mouseup", (e) => {
        down = false;
        var el = e.target;
        var n_s = editor_selections[0];
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
            n_s.end.of = el.innerText == "\n" ? 0 : el.querySelectorAll("span").length;
            n_s.end.pg = get_index(editor, el);
        }
        n_s.rander();
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
        var el = editor.querySelector(`div:nth-child(${p + 1}) > span:nth-child(${i})`);
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
        return el.querySelectorAll("span").length;
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
var cursor = { pg: get_pg_max(), of: get_w_max(get_pg_max()) };
var cursor_real = { pg: get_pg_max(), of: get_w_max(get_pg_max()) };
/**
 * 定位光标(左边)
 * @param p 段落(from 0)
 * @param i 词(from 0)
 */
function editor_i(p, i) {
    cursor_real = { pg: p, of: i };
    if (get_w_index(p, i) === null)
        cursor_real.of = get_w_max(p); /* 移动到更短行，定位到末尾 */
    var top = get_pg(p).offsetTop;
    var left = get_w_index(p, i) === null ? get_w_index(p, get_w_max(p)) : get_w_index(p, i);
    document.getElementById("cursor").style.left = left + "px";
    document.getElementById("cursor").style.top = top + 8 + "px";
    document.getElementById("cursor").focus();
    editor_change();
}
editor_i(cursor.pg, cursor.of);
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
class editing_operation {
    delete() {
        editor_selections[0].replace("");
    }
    copy() {
        var t = editor_selections[0].get();
        navigator.clipboard.writeText(t);
    }
    cut() {
        this.copy();
        this.delete();
    }
    paste() {
        navigator.clipboard.readText().then((t) => {
            editor_selections[0].replace(t);
        });
    }
    select_all() {
        var s = new selection({ start: { pg: 0, of: 0 }, end: { pg: get_pg_max(), of: get_w_max(get_pg_max()) } });
        s.rander();
        editor_selections[0] = s;
    }
    delete_enter() {
        var t = editor_selections[0].get();
        var 自动搜索中文占比 = 0.3;
        var x = t.match(/[\u4e00-\u9fa5]/g)?.length >= t.length * 自动搜索中文占比 ? "" : " ";
        t = t.replace(/(?<=[^。？！…….\?!])[\r\n]/g, x);
        editor_selections[0].replace(t);
    }
}
var edit = new editing_operation();
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
document.getElementById("cursor").onpaste = (e) => {
    e.preventDefault();
};
document.addEventListener("keydown", (e) => {
    var l = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Backspace", "Delete", "Enter", "Tab"];
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
            if (editor_selections[0].get() == "") {
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
                    if (cursor.of == 1) {
                        get_pg(cursor.pg).innerText = "\n";
                    }
                    else {
                        get_w(cursor.pg, cursor.of).remove();
                    }
                    cursor.of--;
                }
                var s = new selection({ start: cursor, end: cursor });
                editor_selections[0] = s;
            }
            else {
                edit.delete();
            }
            break;
        case "Delete":
            cursor = cursor_real;
            if (editor_selections[0].get() == "") {
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
                var s = new selection({ start: cursor, end: cursor });
                editor_selections[0] = s;
            }
            else {
                edit.delete();
            }
            break;
        case "Enter":
            if (editor_selections[0].get() == "") {
                var div = document.createElement("div");
                if (cursor.of == get_w_max(cursor.pg)) {
                    div.innerHTML = "<br>";
                    get_pg(cursor.pg).after(div);
                }
                else if (cursor.of == 0) {
                    div.innerHTML = "<br>";
                    get_pg(cursor.pg).before(div);
                }
                else {
                    div.innerHTML = s_to_span(get_s(cursor.pg, cursor.of, get_w_max(cursor.pg)));
                    get_pg(cursor.pg).innerHTML = s_to_span(get_s(cursor.pg, 0, cursor.of));
                    function s_to_span(t) {
                        return `<span>${t.split("").join("</span><span>")}</span>`;
                    }
                    get_pg(cursor.pg).after(div);
                }
                cursor.pg++;
                cursor.of = 0;
                var s = new selection({ start: cursor, end: cursor });
                editor_selections[0] = s;
            }
            else {
                edit.delete();
            }
            break;
        case "Tab":
            var span = document.createElement("span");
            span.className = "tab";
            span.innerHTML = "\t";
            if (editor_selections[0].get() == "") {
                if (cursor.of == 0) {
                    if (get_w(cursor.pg, 1)) {
                        get_w(cursor.pg, 1).before(span);
                    }
                    else {
                        get_pg(cursor.pg).innerHTML = "";
                        get_pg(cursor.pg).append(span);
                    }
                }
                else {
                    get_w(cursor.pg, cursor.of).after(span);
                }
                cursor.of++;
            }
            else {
                editor_selection.replace(span.innerText);
            }
            var s = new selection({ start: cursor, end: cursor });
            editor_selections[0] = s;
            break;
    }
    editor_i(cursor.pg, cursor.of);
});
function editor_change() {
    change_text_bottom();
    line_num();
}
/**
 * 底部增高
 */
function change_text_bottom() {
    var d = 8;
    if (get_pg_max() == 0) {
        d = 16;
    }
    document.getElementById("text_bottom").style.height = `calc(100% - 1.5rem - ${d}px)`;
}
document.getElementById("text_bottom").onclick = () => {
    cursor.pg = get_pg_max();
    cursor.of = get_w_max(get_pg_max());
    editor_i(cursor.pg, cursor.of);
};
/**
 * 行号
 */
function line_num() {
    document.getElementById("line_num").innerHTML = "";
    for (let i = 0; i <= get_pg_max(); i++) {
        var item = document.createElement("div");
        item.style.height = get_pg(i).offsetHeight + "px";
        item.innerText = (i + 1).toString();
        document.getElementById("line_num").append(item);
    }
}
document.getElementById("line_num").onclick = (e) => {
    var el = e.target;
    if (el == document.getElementById("line_num"))
        return;
    var l_i = Number(el.innerText) - 1;
    var s = new selection({ start: { pg: l_i, of: 0 }, end: { pg: l_i, of: get_w_max(l_i) } });
    editor_selections[0] = s;
    document.getElementById("selection").innerHTML = "";
    s.rander();
    cursor.pg = l_i;
    cursor.of = get_w_max(l_i);
    editor_i(cursor.pg, cursor.of);
};
document.getElementById("main_text").onscroll = () => {
    document.getElementById("line_num").style.top = `-${document.getElementById("main_text").scrollTop}px`;
};
/************************************浏览器转换 */
if (typeof global == "undefined") {
    class Store {
        get(value) {
            var o = {};
            return o[value];
        }
    }
    var store = new Store();
}
/************************************主要 */
var window_name = "", t = "";
var 自动搜索 = store.get("自动搜索"), 自动打开链接 = store.get("自动打开链接"), 自动搜索中文占比 = store.get("自动搜索中文占比");
/************************************UI */
var 浏览器打开 = store.get("浏览器中打开");
if (浏览器打开)
    document.getElementById("browser").className = "hover_b2";
document.getElementById("browser").onclick = () => {
    if (浏览器打开) {
        document.getElementById("browser").className = "";
        浏览器打开 = false;
    }
    else {
        document.getElementById("browser").className = "hover_b2";
        浏览器打开 = true;
    }
};
/************************************搜索 */
/**
 * 判断是否为链接
 * @param url 链接
 * @param s 严格模式
 * @returns 是否为链接
 */
function is_link(url, s) {
    if (s) {
        var regex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+(:[0-9]+)?|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/g;
        if (url.match(regex) != null) {
            return true;
        }
        else {
            return false;
        }
    }
    else {
        // 有.就行
        if (url.match(/\./g) != null && !url.match(/[\n\r]/g)) {
            return true;
        }
        else {
            return false;
        }
    }
}
/**
 * 展示文字
 * @param t 展示的文字
 */
function show_t(t) {
    t = t.replace(/[\r\n]$/, "");
    editor_push(t);
    // 严格模式
    if (is_link(t, true)) {
        if (自动打开链接)
            open_link("url", t);
    }
    else {
        var language = t.match(/[\u4e00-\u9fa5]/g)?.length >= t.length * 自动搜索中文占比 ? "本地语言" : "外语";
        if (自动搜索 && t.match(/[\r\n]/) == null && t != "") {
            if (language == "本地语言") {
                open_link("search");
            }
            else {
                open_link("translate");
            }
        }
    }
    edit.select_all();
}
/**
 * 打开浏览界面
 * @param id 模式
 * @param link 链接
 */
function open_link(id, link) {
    if (id == "url") {
        link = link.replace(/[(^\s)(\s$)]/g, "");
        if (link.match(/\/\//g) == null) {
            link = "https://" + link;
        }
        var url = link;
    }
    else {
        var s = editor_selection.get() || document.getElementById("text").innerText; // 要么全部，要么选中
        var url = document.querySelector(`#${id}_s`).value.replace("%s", encodeURIComponent(s));
    }
    if (typeof global != "undefined") {
        if (浏览器打开) {
            shell.openExternal(url);
        }
        else {
            ipcRenderer.send("open_url", window_name, url);
        }
    }
    else {
        window.open(url);
    }
}
/************************************引入 */
const { ipcRenderer, shell } = require("electron");
const hotkeys = require("hotkeys-js");
const fs = require("fs");
const os = require("os");
ipcRenderer.on("text", (event, name, list) => {
    window_name = name;
    t = list[0];
    show_t(t);
});

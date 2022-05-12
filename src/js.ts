var in_browser = typeof global == "undefined";

/**撤销 */
// 定义撤销栈
var undo_stack = [""];
// 定义位置
var undo_stack_i = 0;
/**
 * 添加到撤销栈
 * @returns none
 */
function stack_add() {
    if (undo_stack[undo_stack_i] == editor_get()) return;
    // 撤回到中途编辑，把撤回的这一片与编辑的内容一起放到末尾
    if (undo_stack_i != undo_stack.length - 1) undo_stack.push(undo_stack[undo_stack_i]);
    undo_stack.push(editor_get());
    undo_stack_i = undo_stack.length - 1;
}
function undo() {
    if (undo_stack_i > 0) {
        undo_stack_i--;
        editor_push(undo_stack[undo_stack_i]);
        if (find_show) {
            find_area.innerText = undo_stack[undo_stack_i];
            exit_find();
            find();
        }
    }
}
function redo() {
    if (undo_stack_i < undo_stack.length - 1) {
        undo_stack_i++;
        editor_push(undo_stack[undo_stack_i]);
        if (find_show) {
            find_area.innerText = undo_stack[undo_stack_i];
            exit_find();
            find();
        }
    }
}

var editor = document.getElementById("text");

/**
 * 文字包装span
 * @param t 单个文字
 * @returns 包装好的span
 */
function word_to_span(t: string) {
    let span = document.createElement("span");
    span.className = "w";
    if (t == "\t") span.className = "tab";
    if (t == " " || t == " " || t == " ") {
        span.innerHTML = t.replace(" ", "&nbsp;").replace(" ", "&emsp;").replace(" ", "&ensp");
    } else {
        span.innerText = t;
    }
    return span;
}
/**
 * 写入编辑器
 * @param value 传入text
 */
function editor_push(value: string) {
    editor.innerHTML = "";
    let pg = value.split(/[\n\r]/);
    for (let i of pg) {
        let word_l = i.split("");
        let div = document.createElement("div");
        div.className = "p";
        for (let j of word_l) {
            let span = word_to_span(j);
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
            t += i.innerText.replace(/\n/g, "");
        } else {
            t += "\n" + i.innerText.replace(/\n/g, "");
        }
    }
    return t;
}

class selection {
    start: { pg: number; of: number };
    end: { pg: number; of: number };
    constructor(s: { start: { pg: number; of: number }; end: { pg: number; of: number } }) {
        this.start = s.start;
        this.end = s.end;
    }
    /**
     * 渲染选区
     * @param this 选区
     */
    rander(this: selection) {
        var s = format_selection(this);
        var t = "";
        if (s.start.pg == s.end.pg) {
            t += draw_line_selection(s.start.pg, s.start.of, s.end.of, false);
        } else {
            for (let i = s.start.pg; i <= s.end.pg; i++) {
                if (i == s.start.pg) {
                    t += draw_line_selection(i, s.start.of, get_w_max(i), true);
                } else if (i == s.end.pg) {
                    t += draw_line_selection(i, 0, s.end.of, s.end.of == 0);
                } else {
                    t += draw_line_selection(i, 0, get_w_max(i), true);
                }
            }
        }
        function draw_line_selection(pg: number, s_of: number, e_of: number, br: boolean) {
            var div = document.createElement("div");
            div.className = "selection";
            var s_left = s_of == 0 ? 0 : get_w(pg, s_of).offsetLeft + get_w(pg, s_of).offsetWidth,
                e_left = e_of == 0 ? 0 : get_w(pg, e_of).offsetLeft + get_w(pg, e_of).offsetWidth;
            div.style.left = s_left + "px";
            div.style.width = e_left - s_left + (br ? 1 : 0) + "px";
            div.style.top = get_pg(pg).offsetTop + "px";
            return div.outerHTML;
        }
        document.getElementById("selection").innerHTML = t;
    }
    /**
     * 获取选区文字
     * @param this 选区
     * @returns 文字（反转义）
     */
    get(this: selection) {
        var s = format_selection(this);
        var text = "";
        if (s.start.pg == s.end.pg) {
            text = get_s(s.start.pg, s.start.of, s.end.of);
        } else {
            for (let i = s.start.pg; i <= s.end.pg; i++) {
                if (i == s.start.pg) {
                    text += get_s(i, s.start.of, get_w_max(i)) || "\n";
                } else if (i == s.end.pg) {
                    text += "\n" + get_s(i, 0, s.end.of);
                } else {
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
    replace(this: selection, text: string) {
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
            div.className = "p";
            for (let j of word_l) {
                let span = word_to_span(j);
                div.append(span);
            }
            if (word_l.length == 0) {
                div.innerHTML = "<br>";
            }
            if (s.start.pg == 0) {
                editor.prepend(div);
            } else {
                get_pg(s.start.pg - 1).after(div);
            }
        }

        editor_selections[0].start = s.start;
        editor_selections[0].end = s.start;

        document.getElementById("selection").innerHTML = "";
        editor_i(s.start.pg, s.start.of);
    }
}

/**记录间隔位置，从0开始 */
type selection_list = [selection?];
var editor_selection = new selection({ start: { pg: 0, of: 0 }, end: { pg: 0, of: 0 } });
var editor_selections: selection_list = [editor_selection];

function format_selection(s: selection) {
    var tmp = new selection({ start: { pg: NaN, of: NaN }, end: { pg: NaN, of: NaN } });
    if (s.end.pg == s.start.pg) {
        tmp.start.pg = tmp.end.pg = s.end.pg;
        tmp.start.of = Math.min(s.start.of, s.end.of);
        tmp.end.of = Math.max(s.start.of, s.end.of);
    } else if (s.end.pg < s.start.pg) {
        [tmp.start, tmp.end] = [s.end, s.start];
    } else {
        tmp = s;
    }
    return tmp;
}

function editor_cursor() {
    var down = false;
    document.addEventListener("mousedown", (e) => {
        var el = <HTMLElement>e.target;
        var n_s = { start: { pg: NaN, of: NaN }, end: { pg: NaN, of: NaN } };
        if (el.className.split(" ").includes("w")) {
            var w = el;
            if (e.offsetX <= w.offsetWidth / 2) {
                n_s.start.of = get_index(w.parentElement, w);
            } else {
                n_s.start.of = get_index(w.parentElement, w) + 1;
            }
            n_s.start.pg = get_index(editor, w.parentElement);
            down = true;
        } else if (el.className == "p") {
            n_s.start.of = el.innerText == "\n" ? 0 : el.querySelectorAll("span").length;
            n_s.start.pg = get_index(editor, el);
            down = true;
        }
        if (!e.shiftKey) [editor_selections[0].start, editor_selections[0].end] = [n_s.start, n_s.end];

        document.getElementById("edit_b").style.pointerEvents = "none";
    });
    document.addEventListener("mousemove", (e) => {
        if (!down) return;
        var el = <HTMLElement>e.target;
        var n_s = editor_selections[0];
        if (el.className.split(" ").includes("w")) {
            var w = el;
            if (e.offsetX <= w.offsetWidth / 2) {
                n_s.end.of = get_index(w.parentElement, w);
            } else {
                n_s.end.of = get_index(w.parentElement, w) + 1;
            }
            n_s.end.pg = get_index(editor, w.parentElement);
        } else if (el.className == "p") {
            n_s.end.of = el.innerText == "\n" ? 0 : el.querySelectorAll("span").length;
            n_s.end.pg = get_index(editor, el);
        }
        // document.getElementById("selection").innerHTML = "";
        n_s.rander();
        cursor.pg = n_s.end.pg;
        cursor.of = n_s.end.of;
        editor_i(cursor.pg, cursor.of);
    });
    document.addEventListener("mouseup", (e) => {
        if (!down) return;
        down = false;
        var el = <HTMLElement>e.target;
        var n_s = editor_selections[0];
        if (el.className.split(" ").includes("w")) {
            var w = el;
            if (e.offsetX <= w.offsetWidth / 2) {
                n_s.end.of = get_index(w.parentElement, w);
            } else {
                n_s.end.of = get_index(w.parentElement, w) + 1;
            }
            n_s.end.pg = get_index(editor, w.parentElement);
        } else if (el.className == "p") {
            n_s.end.of = el.innerText == "\n" ? 0 : el.querySelectorAll("span").length;
            n_s.end.pg = get_index(editor, el);
        }
        n_s.rander();
        cursor.pg = n_s.end.pg;
        cursor.of = n_s.end.of;
        editor_i(cursor.pg, cursor.of);

        var end_el = get_w(cursor.pg, cursor.of);
        show_edit_bar(
            end_el.offsetLeft + 8,
            end_el.offsetTop + end_el.offsetHeight + 8,
            el.offsetHeight,
            e.button == 2
        );

        document.getElementById("edit_b").style.pointerEvents = "";
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
 * 获取字符元素
 * @param p 段落数，从0开始算
 * @param i 字符索引
 * @returns 元素，通过元素获取属性
 */
function get_w(p: number, i: number) {
    var el = editor.querySelector(`div:nth-child(${p + 1})`).querySelector(`span:nth-child(${i})`);
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
        var el = <HTMLElement>editor.querySelector(`div:nth-child(${p + 1}) > span:nth-child(${i})`);
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
        return el.querySelectorAll("span").length;
    }
}
/**
 * 定位子元素
 * @param parent_element 父元素
 * @param element 子元素
 * @returns 位置，从0算起
 */
function get_index(parent_element: HTMLElement, element: HTMLElement): number {
    for (let i = 0; i < parent_element.children.length; i++) {
        if (parent_element.children[i] === element) return i;
    }
}
var cursor = { pg: get_pg_max(), of: get_w_max(get_pg_max()) };
var cursor_real = { pg: get_pg_max(), of: get_w_max(get_pg_max()) };
/**
 * 定位光标(左边)
 * @param p 段落(from 0)
 * @param i 词(from 0)
 */
function editor_i(p: number, i: number) {
    cursor_real = { pg: p, of: i };
    if (get_w_index(p, i) === null) cursor_real.of = get_w_max(p); /* 移动到更短行，定位到末尾 */
    var top = get_w(p, i)?.offsetTop || get_pg(p).offsetTop;
    var left = get_w_index(p, i) === null ? get_w_index(p, get_w_max(p)) : get_w_index(p, i);
    document.getElementById("cursor").style.animation = "none";
    setTimeout(() => {
        document.getElementById("cursor").style.animation = "";
    }, 100);
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
function get_s(n: number, s: number, e: number) {
    var r = get_pg(n).innerText.replace(/\n/g, "");
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
        var x = t.match(/[\u4e00-\u9fa5]/g)?.length >= t.length * 自动搜索中文占比 ? "" : " ";
        t = t.replace(/(?<=[^。？！…….\?!])[\r\n]/g, x);
        editor_selections[0].replace(t);
    }
}
var edit = new editing_operation();

document.getElementById("cursor").focus();
// 中文等合成器输入法输入适配
var composition = false;
document.getElementById("cursor").addEventListener("compositionstart", (e) => {
    composition = true;
    if (cursor_real.of != 0) {
        var span = document.createElement("span");
        span.id = "composition";
        get_w(cursor_real.pg, cursor_real.of).after(span);
    } else {
        get_pg(cursor_real.pg).innerHTML = `<span id="composition"></span>`;
    }
    cursor.of++;
    editor_i(cursor.pg, cursor.of);
});
document.getElementById("cursor").addEventListener("compositionupdate", (e) => {
    document.getElementById("composition").innerText = e.data;
    editor_i(cursor.pg, cursor.of);
});
document.getElementById("cursor").addEventListener("compositionend", (e) => {
    composition = false;
    document.getElementById("composition").remove();
    cursor.of--;
    cursor_real.of--;
    editor_add_text(e.data);
    editor_i(cursor.pg, cursor.of);
});
document.getElementById("cursor").oninput = () => {
    if (composition) return;
    var input_t = document.getElementById("cursor").innerText;
    editor_add_text(input_t);
};
function editor_add_text(input_t: string) {
    document.getElementById("cursor").innerText = "";
    if (editor_selections[0].get() == "") {
        var input_t_l = input_t.split("");
        if (cursor_real.of != 0) {
            for (let i = input_t_l.length - 1; i >= 0; i--) {
                const t = input_t_l[i];
                var span = word_to_span(t);
                if (insert) {
                    if (get_w(cursor_real.pg, cursor_real.of + 1)) get_w(cursor_real.pg, cursor_real.of + 1).remove();
                }
                get_w(cursor_real.pg, cursor_real.of).after(span);
            }
        } else {
            get_pg(cursor_real.pg).innerHTML =
                `<span class="w">${input_t_l.join(`</span><span class="w">`)}</span>` +
                (get_pg(cursor_real.pg).innerHTML == "<br>" ? "" : get_pg(cursor_real.pg).innerHTML);
        }
        cursor.of += input_t_l.length;
        editor_i(cursor.pg, cursor.of);
    } else {
        editor_selections[0].replace(input_t);
    }
}

var editor_focus = false;
document.getElementById("cursor").onfocus = () => {
    editor_focus = true;
};
document.getElementById("cursor").onblur = () => {
    editor_focus = false;
};

document.addEventListener("keydown", (e) => {
    var l = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "Backspace",
        "Delete",
        "Enter",
        "Tab",
        "Insert",
    ];
    if (!l.includes(e.key) || !editor_focus) return;
    e.preventDefault();
    switch (e.key) {
        case "ArrowUp":
            if (cursor.pg != 0) cursor.pg--;
            break;
        case "ArrowDown":
            if (cursor.pg != get_pg_max()) cursor.pg++;
            break;
        case "ArrowLeft":
            cursor = cursor_real; /* 左右移动后，不记录横向最大 */
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
            cursor = cursor_real;
            if (cursor.of == get_w_max(cursor.pg)) {
                if (cursor.pg != get_pg_max()) {
                    cursor.pg++;
                    cursor.of = 0;
                }
            } else {
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
                        } else {
                            get_pg(cursor.pg).innerHTML += get_pg(cursor.pg + 1).innerHTML;
                        }
                        get_pg(cursor.pg + 1).remove();
                    }
                } else {
                    if (cursor.of == 1) {
                        get_pg(cursor.pg).innerText = "\n";
                    } else {
                        get_w(cursor.pg, cursor.of).remove();
                    }
                    cursor.of--;
                }
                var s = new selection({ start: cursor, end: cursor });
                editor_selections[0] = s;
            } else {
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
                        } else if (get_pg(cursor.pg + 1).innerText != "\n") {
                            get_pg(cursor.pg).innerHTML += get_pg(cursor.pg + 1).innerHTML;
                        }
                        get_pg(cursor.pg + 1).remove();
                    }
                } else {
                    get_w(cursor.pg, cursor.of + 1).remove();
                }
                var s = new selection({ start: cursor, end: cursor });
                editor_selections[0] = s;
            } else {
                edit.delete();
            }
            break;
        case "Enter":
            if (editor_selections[0].get() == "") {
                var div = document.createElement("div");
                div.className = "p";
                if (cursor.of == get_w_max(cursor.pg)) {
                    div.innerHTML = "<br>";
                    get_pg(cursor.pg).after(div);
                } else if (cursor.of == 0) {
                    div.innerHTML = "<br>";
                    get_pg(cursor.pg).before(div);
                } else {
                    div.innerHTML = s_to_span(get_s(cursor.pg, cursor.of, get_w_max(cursor.pg)));
                    get_pg(cursor.pg).innerHTML = s_to_span(get_s(cursor.pg, 0, cursor.of));
                    function s_to_span(t: string) {
                        return `<span>${t.split("").join("</span><span>")}</span>`;
                    }
                    get_pg(cursor.pg).after(div);
                }
                cursor.pg++;
                cursor.of = 0;
                var s = new selection({ start: cursor, end: cursor });
                editor_selections[0] = s;
            } else {
                edit.delete();
            }
            break;
        case "Tab":
            var span = document.createElement("span");
            span.classList.add("tab", "w");
            span.innerHTML = "\t";
            if (editor_selections[0].get() == "") {
                if (cursor.of == 0) {
                    if (get_w(cursor.pg, 1)) {
                        get_w(cursor.pg, 1).before(span);
                    } else {
                        get_pg(cursor.pg).innerHTML = "";
                        get_pg(cursor.pg).append(span);
                    }
                } else {
                    get_w(cursor.pg, cursor.of).after(span);
                }
                cursor.of++;
            } else {
                editor_selections[0].replace(span.innerText);
            }
            var s = new selection({ start: cursor, end: cursor });
            editor_selections[0] = s;
            break;
        case "Insert":
            insert = !insert;
            if (insert) {
                document.getElementById("cursor").classList.add("cursor_insert");
            } else {
                document.getElementById("cursor").classList.remove("cursor_insert");
            }
            break;
    }
    editor_i(cursor.pg, cursor.of);
});

/**
 * 每次更改光标触发
 */
function editor_change() {
    change_text_bottom();
    line_num();
    stack_add();
    if (find_show) {
        exit_find();
        find();
    }
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
    var el = <HTMLElement>e.target;
    if (el == document.getElementById("line_num")) return;
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

// 插入文字
var insert = false;

/************************************浏览器转换 */
var Store;
if (in_browser) {
    Store = class Store {
        constructor(x?: Object) {}
        get(value: string) {
            var o = {
                自动打开链接: false,
                自动搜索中文占比: 0.2,
                浏览器中打开: false,
                搜索引擎: [
                    ["Google", "https://www.google.com/search?q=%s"],
                    ["百度", "https://www.baidu.com/s?wd=%s"],
                    ["必应", "https://cn.bing.com/search?q=%s"],
                    ["Yandex", "https://yandex.com/search/?text=%s"],
                ],
                翻译引擎: [
                    ["Google", "https://translate.google.cn/?op=translate&text=%s"],
                    ["Deepl", "https://www.deepl.com/translator#any/any/%s"],
                    ["金山词霸", "http://www.iciba.com/word?w=%s"],
                    ["百度", "https://fanyi.baidu.com/#auto/auto/%s"],
                    ["腾讯", "https://fanyi.qq.com/?text=%s"],
                ],
                引擎: {
                    记住: false,
                    默认搜索引擎: "百度",
                    默认翻译引擎: "Google",
                },
                字体: {
                    主要字体: "",
                    等宽字体: "",
                    记住: false,
                    大小: 16,
                },
                编辑器: {
                    自动换行: true,
                    拼写检查: false,
                    行号: true,
                },
                历史记录设置: {
                    保留历史记录: true,
                    自动清除历史记录: false,
                    d: 14,
                    h: 0,
                },
            };

            return eval(`o.${value}`);
        }
        set(k, v) {}
        delete(k) {}
    };
    var store = new Store();
    history_store = new Store();
} else {
    Store = require("electron-store");
    var store = new Store();
}

/************************************主要 */

var window_name = "",
    t = "";
var 自动搜索 = store.get("自动搜索"),
    自动打开链接 = store.get("自动打开链接"),
    自动搜索中文占比 = store.get("自动搜索中文占比");

/************************************UI */

var 浏览器打开 = store.get("浏览器中打开");
if (浏览器打开) document.getElementById("browser").className = "hover_b2";

document.getElementById("browser").onclick = () => {
    if (浏览器打开) {
        document.getElementById("browser").className = "";
        浏览器打开 = false;
    } else {
        document.getElementById("browser").className = "hover_b2";
        浏览器打开 = true;
    }
};

/**字体大小 */
var 默认字体大小 = store.get("字体.大小");
document.getElementById("text_out").style.fontSize =
    (store.get("字体.记住") ? store.get("字体.记住") : 默认字体大小) + "px";

document.onwheel = (e) => {
    if (e.ctrlKey) {
        var d = e.deltaY / Math.abs(e.deltaY);
        var size = Number(document.getElementById("text_out").style.fontSize.replace("px", ""));
        set_font_size(size - d);
    }
};
function set_font_size(font_size) {
    document.getElementById("text_out").style.fontSize = font_size + "px";
    if (store.get("字体.记住")) store.set("字体.记住", font_size);
    setTimeout(() => {
        editor_i(cursor.pg, cursor.of);
    }, 400);
}

/**编辑栏 */
var edit_bar_s = false;
function show_edit_bar(x: number, y: number, h: number, right: boolean) {
    // 简易判断链接并显示按钮
    if (is_link(editor_selections[0].get(), false)) {
        document.getElementById("link_bar").style.width = "30px";
    } else {
        setTimeout(() => {
            document.getElementById("link_bar").style.width = "0";
        }, 400);
    }
    // 排除没选中
    if (editor_selections[0].get() != "" || right) {
        if (edit_bar_s) {
            document.getElementById("edit_b").style.transition = "var(--transition)";
        } else {
            document.getElementById("edit_b").style.transition = "opacity var(--transition)";
        }
        document.getElementById("edit_b").className = "edit_s";
        var x = x < 0 ? 0 : x;
        if (document.getElementById("edit_b").offsetWidth + x > window.innerWidth)
            x = window.innerWidth - document.getElementById("edit_b").offsetWidth;
        var y = y < 0 ? 0 : y;
        document.getElementById("edit_b").style.left = `${x}px`;
        document.getElementById("edit_b").style.top = `${y}px`;
        edit_bar_s = true;
    } else {
        document.getElementById("edit_b").className = "edit_h";
        edit_bar_s = false;
    }
}

document.getElementById("edit_b").onmousedown = (e) => {
    e.preventDefault();
    switch ((<HTMLElement>e.target).id) {
        case "link_bar":
            var url = document.getSelection().toString();
            open_link("url", url);
            break;
        case "search_bar":
            open_link("search");
            break;
        case "translate_bar":
            open_link("translate");
            break;
        case "selectAll_bar":
            edit.select_all();
            break;
        case "cut_bar":
            edit.cut();
            break;
        case "copy_bar":
            edit.copy();
            break;
        case "paste_bar":
            edit.paste();
            break;
        case "delete_enter_bar":
            edit.delete_enter();
            break;
    }
};

if (in_browser) {
    document.body.oncontextmenu = (e) => {
        e.preventDefault();
    };
}
var is_wrap = !store.get("编辑器.自动换行");
wrap();
function wrap() {
    is_wrap = !is_wrap;
    if (is_wrap) {
        document.documentElement.style.setProperty("--wrap", "nowrap");
    } else {
        document.documentElement.style.setProperty("--wrap", "wrap");
    }

    editor_i(cursor.pg, cursor.of);
}

var is_check = !store.get("编辑器.拼写检查");
spellcheck();
function spellcheck() {
    is_check = !is_check;
    document.getElementById("text").spellcheck = is_check;
}

/**
 * 查找与替换
 */

var find_input = <HTMLInputElement>document.getElementById("find_input");
var replace_input = <HTMLInputElement>document.getElementById("replace_input");
var find_t = <HTMLElement>document.querySelector(".find_t > span");

var find_area = document.getElementById("find_area");

// 查找ui
var find_show = false;
function show_find() {
    find_show = !find_show;
    if (find_show) {
        document.getElementById("top").style.marginTop = "48px";
        document.getElementById("find").style.transform = "translateY(0)";
        document.getElementById("find").style.pointerEvents = "auto";
        find_input.value = editor_selections[0].get();
        find_input.select();
        find_input.focus();
        if (editor_selections[0].get() != "") find();
    } else {
        document.getElementById("top").style.marginTop = "";
        document.getElementById("find").style.transform = "translateY(-120%)";
        document.getElementById("find").style.pointerEvents = "none";
    }
}

document.getElementById("find_b_close").onclick = () => {
    show_find();
    exit_find();
};

// 正则
var find_regex = false;
document.getElementById("find_b_regex").onclick = () => {
    find_regex = !find_regex;
    if (find_regex) {
        document.getElementById("find_b_regex").style.backgroundColor = "var(--hover-color)";
    } else {
        document.getElementById("find_b_regex").style.backgroundColor = "";
    }
    find();
    find_input.focus();
};

var tmp_text: string;
document.getElementById("find_input").oninput = () => {
    // 清除样式后查找
    exit_find();
    find();
};
// 判断是找文字还是正则
function string_or_regex(text: string) {
    var o_text = null;
    if (find_regex) {
        try {
            o_text = eval("/" + text + "/g");
            document.getElementById("find_input").style.outline = "none";
        } catch (error) {
            document.getElementById("find_input").style.outline = "red  solid 1px";
        }
    } else {
        text = text.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        o_text = new RegExp(text, "g"); // 自动转义，找文字
    }
    return o_text;
}
// 查找并突出
function find() {
    var text = find_input.value;
    text = string_or_regex(text);
    if (!tmp_text) tmp_text = editor_get();
    // 拆分并转义
    try {
        var match_l = tmp_text.match(text).map((m: string) => html_to_text(m));
        var text_l = tmp_text.split(text).map((m: string) => html_to_text(m));
        var t_l = [];
        // 交替插入
        for (i in text_l) {
            t_l.push(text_l[i]);
            if (match_l[i]) t_l.push(`<span class="find_h">${match_l[i]}</span>`);
        }
        document.getElementById("find_area").innerHTML = t_l
            .join("")
            .replace(/[\r\n]/g, "<br>")
            .replace(/&nbsp;/g, " ");
    } catch (error) {}
    find_l_n_i = -1;
    find_l_n("↓");
    if (find_input.value == "") {
        document.getElementById("find_area").innerText = tmp_text;
        exit_find();
    }
}

// 清除样式
function exit_find() {
    find_area.innerText = find_area.innerText;
    tmp_text = null;
    find_t.innerText = "";
}
// 跳转
var find_l_n_i = 0;
function find_l_n(a: "↑" | "↓") {
    var l = document.querySelectorAll(".find_h");
    if (l.length == 0) {
        find_t.innerText = `无结果`;
        return;
    }
    if (l[find_l_n_i]) l[find_l_n_i].classList.remove("find_h_h");
    if (a == "↑") {
        if (find_l_n_i > 0) {
            find_l_n_i--;
        } else {
            find_l_n_i = l.length - 1;
        }
    } else if (a == "↓") {
        if (find_l_n_i < l.length - 1) {
            find_l_n_i++;
        } else {
            find_l_n_i = 0;
        }
    }
    l[find_l_n_i].classList.add("find_h_h");
    find_t.innerText = `${find_l_n_i + 1}/${l.length}`;
    document.getElementById("text_out").scrollTop = (<HTMLElement>l[find_l_n_i]).offsetTop - 48 - 16;
}
document.getElementById("find_b_last").onclick = () => {
    find_l_n("↑");
};
document.getElementById("find_b_next").onclick = () => {
    find_l_n("↓");
};
document.getElementById("find_input").onkeydown = (e) => {
    if (e.key == "Enter") {
        if (document.querySelector(".find_h_h")) {
            find_l_n("↓");
        } else {
            find();
        }
    }
};

// 全部替换
document.getElementById("find_b_replace_all").onclick = () => {
    var text = find_input.value;
    text = string_or_regex(text);
    var t = tmp_text.replace(text, replace_input.value);
    editor_push(t);
    find_area.innerText = t;
    exit_find();

    stack_add();
};
// 替换选中
document.getElementById("find_b_replace").onclick = find_replace;
function find_replace() {
    var text = find_input.value;
    text = string_or_regex(text);
    var el = <HTMLElement>document.querySelector(".find_h_h");
    if (!el) {
        exit_find();
        find();
        return;
    }
    var tttt = el.innerText.replace(text, replace_input.value);
    el.before(document.createTextNode(tttt));
    el.remove();
    editor_push(find_area.innerText);
    find_l_n_i = find_l_n_i - 1;
    find_l_n("↓");
    tmp_text = find_area.innerText;

    stack_add();
}
document.getElementById("replace_input").onkeydown = (e) => {
    if (e.key == "Enter") {
        find_replace();
    }
};

/************************************搜索 */

/**
 * 判断是否为链接
 * @param url 链接
 * @param s 严格模式
 * @returns 是否为链接
 */
function is_link(url: string, s: boolean) {
    if (s) {
        var regex =
            /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+(:[0-9]+)?|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/g;
        if (url.match(regex) != null) {
            return true;
        } else {
            return false;
        }
    } else {
        // 有.就行
        if (url.match(/\./g) != null && !url.match(/[\n\r]/g)) {
            return true;
        } else {
            return false;
        }
    }
}
/**
 * 展示文字
 * @param t 展示的文字
 */
function show_t(t: string) {
    t = t.replace(/[\r\n]$/, "");
    editor_push(t);
    // 严格模式
    if (is_link(t, true)) {
        if (自动打开链接) open_link("url", t);
    } else {
        var language = t.match(/[\u4e00-\u9fa5]/g)?.length >= t.length * 自动搜索中文占比 ? "本地语言" : "外语";
        if (自动搜索 && t.match(/[\r\n]/) == null && t != "") {
            if (language == "本地语言") {
                open_link("search");
            } else {
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
function open_link(id: "url" | "search" | "translate", link?: string) {
    if (id == "url") {
        link = link.replace(/[(^\s)(\s$)]/g, "");
        if (link.match(/\/\//g) == null) {
            link = "https://" + link;
        }
        var url = link;
    } else {
        var s = editor_selections[0].get() || editor_get(); // 要么全部，要么选中
        var url = (<HTMLSelectElement>document.querySelector(`#${id}_s`)).value.replace("%s", encodeURIComponent(s));
    }
    if (typeof global != "undefined") {
        if (浏览器打开) {
            shell.openExternal(url);
        } else {
            ipcRenderer.send("open_url", window_name, url);
        }
    } else {
        window.open(url);
    }
}

var 搜索引擎_list = store.get("搜索引擎"),
    翻译引擎_list = store.get("翻译引擎"),
    引擎 = store.get("引擎");
/**搜索翻译按钮 */
document.getElementById("search_b").onclick = () => {
    open_link("search");
};
document.getElementById("translate_b").onclick = () => {
    open_link("translate");
};
/**改变选项后搜索 */
document.getElementById("search_s").oninput = () => {
    open_link("search");
    if (引擎.记住)
        store.set("引擎.记住", [
            (<HTMLSelectElement>document.getElementById("search_s")).selectedOptions[0].innerText,
            store.get("引擎.记住")[1],
        ]);
};
document.getElementById("translate_s").oninput = () => {
    open_link("translate");
    if (引擎.记住)
        store.set("引擎.记住", [
            store.get("引擎.记住")[0],
            (<HTMLSelectElement>document.getElementById("translate_s")).selectedOptions[0].innerText,
        ]);
};
/**展示搜索引擎选项 */
var search_c = "";
for (let i in 搜索引擎_list) {
    search_c += `<option ${
        引擎.记住
            ? 引擎.记住[0] == 搜索引擎_list[i][0]
                ? "selected"
                : ""
            : 引擎.默认搜索引擎 == 搜索引擎_list[i][0]
            ? "selected"
            : ""
    } value="${搜索引擎_list[i][1]}">${搜索引擎_list[i][0]}</option>`;
}
document.querySelector("#search_s").innerHTML = search_c;
/**展示翻译引擎选项 */
var translate_c = "";
for (let i in 翻译引擎_list) {
    translate_c += `<option ${
        引擎.记住
            ? 引擎.记住[1] == 翻译引擎_list[i][0]
                ? "selected"
                : ""
            : 引擎.默认翻译引擎 == 翻译引擎_list[i][0]
            ? "selected"
            : ""
    } value="${翻译引擎_list[i][1]}">${翻译引擎_list[i][0]}</option>`;
}
document.querySelector("#translate_s").innerHTML = translate_c;

/************************************历史记录 */
// 历史记录

if (!in_browser) {
    var history_store = new Store({ name: "history" });
}

var history_list = history_store.get("历史记录") || {};
var 历史记录设置 = store.get("历史记录设置");
if (历史记录设置.保留历史记录 && 历史记录设置.自动清除历史记录) {
    var now_time = new Date().getTime();
    var d_time = Math.round(历史记录设置.d * 86400 + 历史记录设置.h * 3600) * 1000;
    for (var i of Object.keys(history_list)) {
        if (now_time - Number(i) > d_time) {
            history_store.delete(`历史记录.${i}`);
        }
    }
}

function push_history() {
    var t = editor_get();
    var i = new Date().getTime();
    var s = { text: t };
    if (t != "" && 历史记录设置.保留历史记录) {
        history_store.set(`历史记录.${i}`, s);
        history_list[i] = s;
    }
    render_history();
}
// 历史记录界面
var history_showed = false;
document.getElementById("history_b").onclick = show_history;
// html转义
function html_to_text(html: string) {
    return html.replace(
        /[<>& \'\"]/g,
        (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;", " ": "&nbsp;" }[c])
    );
}

function show_history() {
    if (history_showed) {
        document.getElementById("history").className = "";
        history_showed = false;
        document.getElementById("history_list").style.top = "100%";
    } else {
        document.getElementById("history").className = "hover_b2";
        history_showed = true;

        document.getElementById("history_list").style.top = "0%";

        render_history();
    }
}
function render_history() {
    var n = {};
    for (let i of Object.keys(history_list).sort()) {
        n[i] = history_list[i];
    }
    history_list = n;
    n = null;
    // 迁移历史记录
    if (store.get("历史记录")) {
        document.querySelector("#history_list").innerHTML = `<div id = "old_his_to_new">迁移旧历史</div>`;
        document.getElementById("old_his_to_new").onclick = old_his_to_new;
    }
    if (Object.keys(history_list).length == 0) document.querySelector("#history_list").innerHTML = "暂无历史记录";
    for (let i in history_list) {
        var t = html_to_text(history_list[i].text).split(/[\r\n]/g);
        var div = document.createElement("div");
        div.id = i;
        var f = require("./lib/time_format");
        div.innerHTML = `<div class="history_title"><span>${f(
            store.get("时间格式"),
            new Date(Number(i) - 0)
        )}</span><button><img src="./assets/icons/close.svg" class="icon"></button></div><div class="history_text">${
            t.splice(0, 3).join("<br>") + (t.length > 3 ? "..." : "")
        }</div>`;
        document.querySelector("#history_list").prepend(div);
    }

    // 打开某项历史
    document.querySelectorAll("#history_list > div > .history_text").forEach((e) => {
        e.addEventListener("click", () => {
            editor_push(history_list[e.parentElement.id].text);
            show_history();
        });
    });
    // 删除某项历史
    // TODO多选
    document.querySelectorAll("#history_list > div > .history_title > button").forEach((e) => {
        e.addEventListener("click", () => {
            history_store.delete(`历史记录.${e.parentElement.parentElement.id}`);
            e.parentElement.parentElement.style.display = "none";
        });
    });
}
if (t == "") render_history();

function old_his_to_new() {
    for (let i of store.get("历史记录")) {
        history_store.set(`历史记录.${i.time}`, { text: i.text });
        history_list[i.time] = { text: i.text };
    }
    store.delete("历史记录");
    render_history();
}

/************************************引入 */
const { ipcRenderer, shell } = require("electron");
const fs = require("fs");
const os = require("os");

ipcRenderer.on("text", (event, name: string, list: [string]) => {
    window_name = name;

    t = list[0];
    show_t(t);
});
var 模糊 = store.get("全局.模糊");
if (模糊 != 0) {
    document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
} else {
    document.documentElement.style.setProperty("--blur", `none`);
}

document.documentElement.style.setProperty("--alpha", store.get("全局.不透明度"));

var 字体 = store.get("字体");
document.documentElement.style.setProperty("--main-font", 字体.主要字体);
document.documentElement.style.setProperty("--monospace", 字体.等宽字体);

var edit_on_other_type = null;
var file_watcher = null;
const path = require("path");
var tmp_text_path = path.join(os.tmpdir(), `/eSearch/eSearch_${new Date().getTime()}.txt`);
var editing_on_other = false;
function edit_on_other() {
    editing_on_other = !editing_on_other;
    if (editing_on_other) {
        var data = Buffer.from(editor_get());
        fs.writeFile(tmp_text_path, data, () => {
            if (edit_on_other_type == "o") {
                shell.openPath(tmp_text_path);
            } else if (edit_on_other_type == "c") {
                var open_with = require("./lib/open_with");
                open_with(tmp_text_path);
            }
            file_watcher = fs.watch(tmp_text_path, () => {
                fs.readFile(tmp_text_path, "utf8", (e, data) => {
                    if (e) console.log(e);
                    editor_push(data);
                });
            });
            document.getElementById("text").style.pointerEvents = "none";
            document.getElementById("text_out").style.cursor = "auto";
            document.getElementById("text_out").title = "正在外部编辑中，双击退出";
            document.addEventListener("dblclick", () => {
                editing_on_other = true;
                edit_on_other();
            });
        });
        data = null;
    } else {
        try {
            document.getElementById("text").style.pointerEvents = "";
            document.getElementById("text_out").style.cursor = "text";
            document.getElementById("text_out").title = "";
            document.removeEventListener("dblclick", () => {
                editing_on_other = true;
                edit_on_other();
            });
            file_watcher.close();
            fs.unlink(tmp_text_path, () => {});
        } catch {}
    }
}

ipcRenderer.on("edit", (event, arg) => {
    switch (arg) {
        case "save":
            push_history();
            break;
        case "undo":
            undo();
            break;
        case "redo":
            redo();
            break;
        case "copy":
            edit.copy();
            break;
        case "cut":
            edit.cut();
            break;
        case "paste":
            edit.paste();
            break;
        case "delete":
            edit.delete();
            break;
        case "select_all":
            edit.select_all();
            break;
        case "delete_enter":
            edit.delete_enter();
            break;
        case "show_find":
            show_find();
            break;
        case "show_history":
            show_history();
            break;
        case "edit_on_other":
            edit_on_other_type = "o";
            edit_on_other();
            break;
        case "choose_editer":
            edit_on_other_type = "c";
            edit_on_other();
            break;
        case "wrap":
            wrap();
            break;
        case "spellcheck":
            spellcheck();
            break;
        case "link":
            var url = editor_selections[0].get();
            open_link("url", url);
            break;
        case "search":
            open_link("search");
            break;
        case "translate":
            open_link("translate");
            break;
    }
});

// ctrl滚轮控制字体大小

const hotkeys = require("hotkeys-js");
hotkeys.filter = () => {
    return true;
};
hotkeys("ctrl+0", () => {
    set_font_size(默认字体大小);
});
hotkeys("ctrl+c", () => {
    edit.copy();
});
hotkeys("ctrl+x", () => {
    edit.cut();
});
hotkeys("ctrl+v", () => {
    edit.paste();
});

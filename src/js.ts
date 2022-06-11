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
var splitter;
if (!in_browser) {
    const GraphemeSplitter = require("grapheme-splitter");
    splitter = new GraphemeSplitter();
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
    if (t == " ") span.className = "space";
    span.innerText = t;
    return span;
}
/**
 * 文字包装span文字
 * @param t 单个文字
 * @returns 包装好的span文字
 */
function word_to_span_string(t: string) {
    let span: string;
    if (t == "\t") {
        span = `<span class="tab">${t}</span>`;
    } else if (t == " ") {
        span = `<span class="space">${t}</span>`;
    } else {
        span = `<span class="w">${t}</span>`;
    }
    return span;
}
/**
 * 文字包装span文字
 * @param t 单个文字
 * @returns 包装好的span文字
 */
function word_to_span_string_split(t: string) {
    let o = in_browser ? t.split("") : <string[]>splitter.GraphemeSplitter.splitGraphemes(t);
    o = o.map((t) => word_to_span_string(t));
    return o.join("");
}
/**
 * 写入编辑器
 * @param value 传入text
 */
function editor_push(value: string) {
    editor.innerHTML = "";
    var t = "";
    let pg = value.split(/[\n\r]/);
    for (let i of pg) {
        let word_l = in_browser ? i.split("") : splitter.splitGraphemes(i);
        let div = `<div class="p">`;
        let spans = "";
        for (let j of word_l) {
            spans += word_to_span_string(j);
        }
        div += spans;
        div += "</div>";
        t += div;
    }
    editor.innerHTML = t;
    editor_i(get_pg_max(), get_w_max(get_pg_max()));
    editor_change();

    if (editing_on_other) {
        editing_on_other = false;
        editor_change();
        editing_on_other = true;
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
        if (i.innerText == "") {
            t += "\n";
        } else {
            t += "\n" + i.textContent.replace(/\n/g, "");
        }
    }
    return t.replace(/\n/, "");
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
    render(this: selection, not_add?: boolean) {
        if (!not_add) add_line();
        var s = format_selection(this);
        var t = "";
        if (s.start.pg == s.end.pg) {
            t += draw_pg_selection(s.start.pg, s.start.of, s.end.of, false);
        } else {
            for (let i = s.start.pg; i <= s.end.pg; i++) {
                if (i == s.start.pg) {
                    t += draw_pg_selection(i, s.start.of, get_w_max(i), true);
                } else if (i == s.end.pg) {
                    t += draw_pg_selection(i, 0, s.end.of, s.end.of == 0);
                } else {
                    t += draw_pg_selection(i, 0, get_w_max(i), true);
                }
            }
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
        var end_s = { pg: NaN, of: NaN };
        // 拼接替换后的文字
        t = get_s(s.start.pg, 0, s.start.of) + text + "\ue000" + get_s(s.end.pg, s.end.of, get_w_max(s.end.pg));
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
            let word_l = in_browser ? pg[i].split("") : splitter.splitGraphemes(pg[i]);
            let div = document.createElement("div");
            div.className = "p";
            for (let j in word_l) {
                if (word_l[j] == "\ue000") {
                    end_s.pg = s.start.pg + i;
                    end_s.of = Number(j);
                } else {
                    let span = word_to_span_string(word_l[j]);
                    div.innerHTML += span;
                }
            }
            if (s.start.pg == 0) {
                editor.prepend(div);
            } else {
                get_pg(s.start.pg - 1).after(div);
            }
        }

        s.start = end_s;
        cursor = s.start;
        editor_selections[0].start = s.start;
        editor_selections[0].end = s.start;

        document.getElementById("selection").innerHTML = "";
        editor_i(s.start.pg, s.start.of);

        hide_edit_bar();

        editor_change();
    }
}
/**
 * 绘制段落内选区
 * @param pg 段落数
 * @param s_of 开头间隔索引
 * @param e_of 末尾间隔索引
 * @param br 是否绘制换行
 * @returns html文字
 */
function draw_pg_selection(pg: number, s_of: number, e_of: number, br: boolean) {
    let t = "";
    let br_w = 2; /* 换行宽度 */
    for (let i of pg_to_line[pg]) {
        let l_i = line[i];
        if (s_of == 0 && e_of == 0 && br) {
            t += draw_div(i, 0, br_w);
        }
        if (!(s_of <= l_i.max.i && l_i.min.i < e_of)) continue;
        if (l_i.min.i <= s_of && s_of <= l_i.max.i) {
            var s_left = s_of == l_i.min.i ? 0 : get_w(pg, s_of).offsetLeft + get_w(pg, s_of).offsetWidth;
        } else {
            var s_left = 0;
        }
        if (l_i.min.i <= e_of && e_of <= l_i.max.i) {
            var e_left = e_of == l_i.min.i ? 0 : get_w(pg, e_of).offsetLeft + get_w(pg, e_of).offsetWidth;
        } else {
            var e_left = l_i.max.r;
            if (br && e_of == l_i.max.i + 1) e_left += br_w;
        }
        t += draw_div(i, s_left, e_left);
    }
    function draw_div(i: number, s_left: number, e_left: number) {
        let div = `<div class="selection" style="left: ${s_left}px; width: ${e_left - s_left}px; top: ${i}px;"></div>`;
        return div;
    }
    return t;
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

type t_line = { [top: number]: { min: { i: number; l: 0 }; max: { i: number; r: number }; pg: number } };
type t_pg_to_line = { [pg: number]: Array<number> };

var line: t_line = {};
var pg_to_line: t_pg_to_line = {};
function push_p_l(i: number, v: number) {
    if (!pg_to_line[i]) pg_to_line[i] = [];
    if (!pg_to_line[i].includes(v)) pg_to_line[i].push(v);
}

var line_height = 24;
function add_line() {
    var h = 0;
    pg_to_line = {};
    line = {};
    var pg_l = editor.querySelectorAll("div");
    let i = 0;
    // 以最长的tab计算，算出尽可能小的分段数且不包含多个换行
    let d_k = Math.floor(editor.offsetWidth / ((line_height / 1.5) * (store?.get("编辑器.tab") || 2)));
    for (let pg of pg_l) {
        let r = 0;
        if (pg.lastElementChild) {
            r = (<HTMLElement>pg.lastElementChild).offsetLeft + (<HTMLElement>pg.lastElementChild).offsetWidth;
        }
        if (pg.offsetHeight == line_height) {
            line[pg.offsetTop] = { min: { i: 0, l: 0 }, max: { i: pg.children.length - 1, r }, pg: i };
            push_p_l(i, pg.offsetTop);
        } else {
            // 多行
            var w_l = pg.querySelectorAll("span");
            let k_l = [];
            // 分段
            for (let k = 0; k <= w_l.length + d_k; k += d_k) {
                if (k >= w_l.length) {
                    k_l.push(w_l.length - 1);
                    break;
                }
                k_l.push(k);
            }
            for (let k of k_l) {
                if (w_l[k].offsetTop != h) {
                    let k_min = k - d_k;
                    if (k_min < 0) k_min = 0;
                    // 细分
                    for (let j = k_min; j <= k_min + d_k; j++) {
                        let w = w_l[j];
                        if (w_l[j + 1]) {
                            var n_w = w_l[j + 1];
                            if (n_w.offsetTop != h) {
                                /* 新行，w最大,n_w最小 */
                                h = n_w.offsetTop;
                                let w_top = w.offsetTop;
                                push_p_l(i, w_top);
                                line[h] = { min: { i: j, l: 0 }, max: { i: 0, r: 0 }, pg: i };
                                // 上一行
                                if (!line[w_top]) line[w_top] = { min: { i: 0, l: 0 }, max: { i: NaN, r: NaN }, pg: i };
                                line[w_top].max = { i: j, r: w.offsetLeft + w.offsetWidth };
                            }
                        } else {
                            // 此段最后一行
                            let m = { i: j, r: w.offsetLeft + w.offsetWidth };
                            // 上一行
                            if (!line[w.offsetTop]) line[w.offsetTop] = { min: { i: 0, l: 0 }, max: m, pg: i };
                            line[w.offsetTop].max = m;
                            push_p_l(i, w.offsetTop);
                        }
                    }
                }
            }
            let w = w_l[w_l.length - 1];
            let m = { i: w_l.length - 1, r: w.offsetLeft + w.offsetWidth };
            line[w.offsetTop].max = m;
            push_p_l(i, w.offsetTop);
        }
        i++;
    }
}
add_line();

var down = false;
var click_time = 0;
var click_d_time = 500;
var click_i = 0;
var move_s = false;
var in_selection = false;
var move_first_start = false;
var move_s_t = "";
var tmp_s = { start: { pg: NaN, of: NaN }, end: {} };
document.getElementById("top").addEventListener("mousedown", (e) => {
    var el = <HTMLElement>e.target;
    var n_s = { start: { pg: NaN, of: NaN }, end: { pg: NaN, of: NaN } };
    add_line();
    if (el.tagName == "SPAN") {
        var w = el;
        if (e.offsetX <= w.offsetWidth / 2) {
            n_s.start.of = get_index(w.parentElement, w);
        } else {
            n_s.start.of = get_index(w.parentElement, w) + 1;
        }
        n_s.start.pg = get_index(editor, w.parentElement);
        down = true;
    } else {
        n_s.start = posi(e);
        down = true;
    }
    cursor.pg = n_s.start.pg;
    cursor.of = n_s.start.of;
    editor_i(cursor.pg, cursor.of);

    var t_s = format_selection(editor_selections[0]);
    if (
        (t_s.end.pg - t_s.start.pg >= 2 && t_s.start.pg <= cursor.pg && cursor.pg <= t_s.end.pg) /* >=3 */ ||
        (t_s.start.pg - t_s.end.pg == 0 &&
            t_s.start.pg == cursor.pg &&
            t_s.start.of < cursor.of &&
            cursor.of < t_s.end.of) /* 1 */ ||
        (t_s.end.pg - t_s.start.pg == 1 &&
            ((t_s.start.pg == cursor.pg && t_s.start.of < cursor.of) ||
                (t_s.end.pg == cursor.pg && cursor.of < t_s.end.of))) /* 2 */
    ) {
        in_selection = true;
    }

    if (!e.shiftKey) [tmp_s.start, tmp_s.end] = [n_s.start, n_s.end];

    document.getElementById("edit_b").style.pointerEvents = "none";
});
document.addEventListener("mousemove", (e) => {
    mousemove(e);
});
function mousemove(e: MouseEvent) {
    if (!down) return;
    move_s = true;
    var el = <HTMLElement>e.target;
    var n_s = new selection({ start: tmp_s.start, end: { of: NaN, pg: NaN } });
    if (el.tagName == "SPAN") {
        var w = el;
        if (e.offsetX <= w.offsetWidth / 2) {
            n_s.end.of = get_index(w.parentElement, w);
        } else {
            n_s.end.of = get_index(w.parentElement, w) + 1;
        }
        n_s.end.pg = get_index(editor, w.parentElement);
    } else {
        n_s.end = posi(e);
    }
    if (!in_selection) {
        editor_selections[0] = n_s;
        n_s.render(true);
    } else {
        if (!move_first_start) {
            // 虚线光标
            document.getElementById("cursor").style.background = "url(./assets/icons/cursor.svg) center";
            document.getElementById("cursor").style.backgroundSize = "cover";
            move_s_t = editor_selections[0].get();
            editor_selections[0].replace("");
            move_first_start = true;
        }
    }
    cursor.pg = n_s.end.pg;
    cursor.of = n_s.end.of;
    editor_i(cursor.pg, cursor.of);
}
document.addEventListener("mouseup", (e) => {
    mouseup(e);
});
function mouseup(e: MouseEvent) {
    if (new Date().getTime() - click_time > click_d_time) {
        click_time = new Date().getTime();
        click_i = 1;
    } else {
        click_i++;
    }
    if (click_i == 3) {
        let t = new selection({ start: { of: 0, pg: cursor.pg }, end: { of: get_w_max(cursor.pg), pg: cursor.pg } });
        t.render();
        editor_selections[0] = t;
        down = false;
        cursor.of = get_w_max(cursor.pg);
        editor_i(cursor.pg, cursor.of);
        return;
    }
    if (!down) return;
    down = false;
    var el = <HTMLElement>e.target;
    if (!move_first_start) editor_selections[0].start = tmp_s.start;
    var n_s = new selection({ start: editor_selections[0].start, end: { of: NaN, pg: NaN } });
    if (el.tagName == "SPAN") {
        var w = el;
        if (e.offsetX <= w.offsetWidth / 2) {
            n_s.end.of = get_index(w.parentElement, w);
        } else {
            n_s.end.of = get_index(w.parentElement, w) + 1;
        }
        n_s.end.pg = get_index(editor, w.parentElement);
    } else {
        n_s.end = posi(e);
    }
    if (!(move_first_start || in_selection)) {
        editor_selections[0] = n_s;
        n_s.render();
        cursor.pg = n_s.end.pg;
        cursor.of = n_s.end.of;
        let p = editor_i(cursor.pg, cursor.of);
        show_edit_bar(p.left, p.top + line_height, line_height, e.button == 2);
    } else {
        let t_s = new selection({ start: cursor, end: cursor });
        t_s.replace(move_s_t);
        move_s_t = "";
        in_selection = false;
        move_first_start = false;
        document.getElementById("cursor").style.background = "";
        document.getElementById("cursor").style.backgroundSize = "";
        hide_edit_bar();
    }
    move_s = false;

    document.getElementById("edit_b").style.pointerEvents = "";

    add_selection_linux();
}

function posi(e: MouseEvent) {
    var dy =
        -document.getElementById("main_text").scrollTop + editor.offsetTop + document.getElementById("top").offsetTop;
    var y = e.pageY - dy;
    var dx =
        -document.getElementById("main_text").scrollLeft +
        document.getElementById("main_text").offsetLeft +
        document.getElementById("top").offsetLeft;
    var x = e.pageX - dx;

    var l = Object.keys(line).map((x) => Number(x));

    var pg_line = 0,
        of = 0;
    if (y < 0) {
        pg_line = 0;
        of = 0;
    } else if (y >= l[l.length - 1] + line_height) {
        pg_line = l.length - 1;
        if (line[l[pg_line]].max.r == 0) {
            // line空和一个字的i都为0
            of = 0;
        } else {
            of = line[l[pg_line]].max.i + 1;
        }
    } else {
        for (i in l) {
            if (l[i] <= y && y < l[i] + line_height) {
                pg_line = Number(i);
                if (x < line[l[i]].min.l) {
                    if (pg_line != 0) {
                        pg_line--;
                        if (line[l[Number(i) - 1]].max.r == 0) {
                            of = 0;
                        } else {
                            of = line[l[Number(i) - 1]].max.i + 1;
                        }
                    }
                }
                if (x >= line[l[i]].max.r - 1) {
                    /* -1防止虚无的跳跃 */
                    if (line[l[i]].max.r == 0) {
                        // line空和一个字的i都为0
                        of = 0;
                    } else {
                        of = line[l[i]].max.i + 1;
                    }
                }
            }
        }
    }
    return { pg: line[pg_line * Math.round(line_height)].pg, of };
}

document.addEventListener("dragover", function (e) {
    e.preventDefault();
    down = true;
    editor.contentEditable = "true";
    move_s = true;
    mousemove(e);
});
document.addEventListener("drop", (e) => {
    e.preventDefault();
    editor.contentEditable = "false";
    move_s_t = e.dataTransfer.getData("text/plain");
    mouseup(e);
});
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
    if (el.innerText == "") {
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
function editor_i(p: number, i: number, select?: boolean) {
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

    if (select) {
        editor_selections[0].end = { pg: p, of: i };
        editor_selections[0].render();

        show_edit_bar(left, top + 8 + line_height, NaN, false);
    }

    // 确保光标在视线内
    let h = document.getElementById("text_out").offsetHeight + document.getElementById("main_text").scrollTop;
    if (h < top + 8 + line_height) {
        document.getElementById("main_text").scrollTop =
            top + 8 - document.getElementById("text_out").offsetHeight + line_height;
    }
    if (top + 8 < document.getElementById("main_text").scrollTop) {
        document.getElementById("main_text").scrollTop = top + 8;
    }

    return { left, top: top + 8 };
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
    var r = get_pg(n).textContent.replace(/\n/g, "");
    r = r.slice(s, e);
    return r;
}

class editing_operation {
    delete() {
        editor_selections[0].replace("");
        hide_edit_bar();
    }
    copy() {
        var t = editor_selections[0].get();
        if (in_browser) {
            navigator.clipboard.writeText(t);
        } else {
            clipboard.writeText(t);
        }
    }
    cut() {
        this.copy();
        this.delete();
    }
    paste() {
        if (in_browser) {
            navigator.clipboard.readText().then((t) => {
                editor_selections[0].replace(t);
            });
        } else {
            console.log(1);

            let t = clipboard.readText();
            editor_selections[0].replace(t);
        }
    }
    select_all() {
        var s = new selection({ start: { pg: 0, of: 0 }, end: { pg: get_pg_max(), of: get_w_max(get_pg_max()) } });
        s.render();
        editor_selections[0] = s;

        let p = editor_i(cursor.pg, cursor.of);
        show_edit_bar(p.left, p.top + line_height, NaN, false);
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
    input_t = input_t.replace(" ", " ");
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
            if (get_pg(cursor_real.pg).innerHTML == "") {
                get_pg(cursor_real.pg).innerHTML = "";
                for (let i of input_t_l) {
                    get_pg(cursor_real.pg).append(word_to_span(i));
                }
            } else {
                for (let i = input_t_l.length - 1; i >= 0; i--) {
                    const t = input_t_l[i];
                    var span = word_to_span(t);
                    get_pg(cursor_real.pg).prepend(span);
                }
            }
        }
        cursor.of += input_t_l.length;
        editor_i(cursor.pg, cursor.of);
    } else {
        editor_selections[0].replace(input_t);
    }
    editor_change();
}
document.getElementById("cursor").onpaste = (e) => {
    e.preventDefault();
};

var editor_focus = true;
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
                        if (get_pg(cursor.pg).innerText == "") {
                            get_pg(cursor.pg).innerHTML = get_pg(cursor.pg + 1).innerHTML;
                        } else {
                            get_pg(cursor.pg).innerHTML += get_pg(cursor.pg + 1).innerHTML;
                        }
                        get_pg(cursor.pg + 1).remove();
                    }
                } else {
                    if (cursor.of == 1) {
                        get_pg(cursor.pg).innerText = "";
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
            editor_change();
            break;
        case "Delete":
            cursor = cursor_real;
            if (editor_selections[0].get() == "") {
                if (cursor.of == get_w_max(cursor.pg)) {
                    if (cursor.pg != get_pg_max()) {
                        if (get_pg(cursor.pg).innerText == "") {
                            get_pg(cursor.pg).innerHTML = get_pg(cursor.pg + 1).innerHTML;
                        } else if (get_pg(cursor.pg + 1).innerText != "") {
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
            editor_change();
            break;
        case "Enter":
            var s = new selection({ start: cursor, end: cursor });
            editor_selections[0] = s;
            editor_selections[0].replace("\n");
            break;
        case "Tab":
            var span = document.createElement("span");
            span.className = "tab";
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
                editor_selections[0].replace(span.textContent);
            }
            var s = new selection({ start: cursor, end: cursor });
            editor_selections[0] = s;
            editor_change();
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
    editor_i(cursor.pg, cursor.of, e.shiftKey);
    if (!e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        editor_selections[0].start = editor_selections[0].end = tmp_s.start = { ...cursor };
        editor_selections[0].render();
        hide_edit_bar();
    }
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
    if (editing_on_other) write_edit_on_other();
}

/**
 * 底部增高
 */
function change_text_bottom() {
    var d = 8;
    if (get_pg_max() == 0) {
        d = 16;
    }
    document.getElementById("text_bottom").style.height = `calc(100% - 1.5em - ${d}px)`;
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
    let t = "";
    for (let i = 0; i <= get_pg_max(); i++) {
        t += `<div style="height:${get_pg(i).offsetHeight}px">${(i + 1).toString()}</div>`;
    }
    document.getElementById("line_num").innerHTML = t;
}
line_num();

document.getElementById("line_num").onmousedown = (e) => {
    e.stopPropagation();
    var el = <HTMLElement>e.target;
    if (el == document.getElementById("line_num")) return;
    var l_i = Number(el.innerText) - 1;

    var s = new selection({ start: { pg: l_i, of: 0 }, end: { pg: l_i, of: get_w_max(l_i) } });
    editor_selections[0] = s;
    document.getElementById("selection").innerHTML = "";
    s.render();

    cursor.pg = l_i;
    cursor.of = get_w_max(l_i);
    editor_i(cursor.pg, cursor.of);
};
document.getElementById("line_num").onmouseup = (e) => {
    document.getElementById("cursor").focus();
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
                    tab: 2,
                    光标动画: 0.05,
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
    main_text = "";
var 自动搜索 = store.get("自动搜索"),
    自动打开链接 = store.get("自动打开链接"),
    自动搜索中文占比 = store.get("自动搜索中文占比");

/************************************UI */

var 浏览器打开 = store.get("浏览器中打开");

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
function set_font_size(font_size: number) {
    document.getElementById("text_out").style.fontSize = font_size + "px";
    line_height = font_size * 1.5;
    if (store.get("字体.记住")) store.set("字体.记住", font_size);
    setTimeout(() => {
        editor_i(cursor.pg, cursor.of);
        editor_selections[0].render();
    }, 400);
}

/**tab */
document.documentElement.style.setProperty("--tab", `${store.get("编辑器.tab")}em`);

/**光标动画 */
document.documentElement.style.setProperty("--cursor-a", `${store.get("编辑器.光标动画")}s`);

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

function hide_edit_bar() {
    edit_bar_s = true;
    show_edit_bar(0, 0, 0, false);
}

document.getElementById("edit_b").onmousedown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    switch ((<HTMLElement>e.target).id) {
        case "link_bar":
            let url = editor_selections[0].get();
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
        document.documentElement.style.setProperty("--wrap", "normal");
    } else {
        document.documentElement.style.setProperty("--wrap", "nowrap");
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
        var match_l = tmp_text.match(text);
        var text_l = tmp_text.split(text);
        var t_l = [];
        // 交替插入
        for (i in text_l) {
            if (text_l[i]) t_l.push(word_to_span_string_split(text_l[i]));
            if (match_l[i]) t_l.push(`<span class="find_h">${word_to_span_string_split(match_l[i])}</span>`);
        }
        document.getElementById("find_area").innerHTML = t_l
            .join("")
            .replace(/[\r\n]/g, "<br>")
            .replace(/&nbsp;/g, " ");
    } catch (error) {}
    find_l_n_i = -1;
    find_l_n("↓");
    if (find_input.value == "") {
        exit_find();
    }
}

// 清除样式
function exit_find() {
    find_area.innerHTML = "";
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
        // 有.或://就行
        if ((url.match(/\./g) != null || url.match(/:\/\//g) != null) && !url.match(/[\n\r]/g)) {
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
if (main_text == "") render_history();

function old_his_to_new() {
    for (let i of store.get("历史记录")) {
        history_store.set(`历史记录.${i.time}`, { text: i.text });
        history_list[i.time] = { text: i.text };
    }
    store.delete("历史记录");
    render_history();
}

/************************************引入 */
const { ipcRenderer, shell, clipboard } = require("electron");
const fs = require("fs");
const os = require("os");

ipcRenderer.on("init", (event, name: number) => {});

ipcRenderer.on("text", (event, name: string, list: [string]) => {
    window_name = name;

    main_text = list[0];
    show_t(main_text);
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
                    let cu = cursor;
                    editor_push(data);
                    if (cu.pg > get_pg_max()) cu.pg = get_pg_max();
                    if (cu.of > get_w_max(cu.pg)) cu.of = get_w_max(cu.pg);
                    cursor = cu;
                    editor_i(cursor.pg, cursor.of);
                });
            });
            document.getElementById("text_out").title = "正在外部编辑中，双击退出";
            document.addEventListener("dblclick", () => {
                editing_on_other = true;
                edit_on_other();
            });
        });
        data = null;
    } else {
        try {
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

function write_edit_on_other() {
    let data = Buffer.from(editor_get());
    fs.writeFile(tmp_text_path, data, () => {});
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

function add_selection_linux() {
    if (!in_browser) {
        if (
            editor_selections &&
            editor_selections[0].get() != "" &&
            editor_selections[0].get() != clipboard.readText("selection")
        ) {
            clipboard.writeText(editor_selections[0].get(), "selection");
        }
    }
}

const { t, lan } = require("./lib/translate/translate");
lan(store.get("语言.语言"));
document.title = t(document.title);

/************************************浏览器 */

document.body.className = "fill_t";

var li_list = [];

ipcRenderer.on("url", (event, _pid: number, id: number, arg: string, arg1: any) => {
    if (arg == "new") {
        new_tab(id, arg1);
    }
    if (arg == "title") {
        title(id, arg1);
    }
    if (arg == "icon") {
        icon(id, arg1);
    }
    if (arg == "url") {
        url(id, arg1);
    }
    if (arg == "load") {
        load(id, arg1);
    }
    document.getElementById("tabs").classList.add("tabs_show");
});

ipcRenderer.on("html", (e, h: string) => {
    document.getElementById("tabs").innerHTML = h;
    document
        .getElementById("tabs")
        .querySelectorAll("li")
        .forEach((li) => {
            绑定li(li);
            li_list.push(li);
        });
    document.getElementById("buttons").onclick = (e) => {
        main_event(e);
    };
    if (document.getElementById("tabs").querySelector("li")) document.getElementById("tabs").classList.add("tabs_show");
});

function 绑定li(li: HTMLLIElement) {
    let id = Number(li.id.replace("id", ""));
    li.onmouseup = (e) => {
        if (e.button == 0) {
            focus_tab(li);
        } else {
            close_tab(li, id);
        }
    };
    let button = li.querySelector("button");
    button.onclick = (e) => {
        e.stopPropagation();
        close_tab(li, id);
    };
}

function new_tab(id: number, url: string) {
    let li = <HTMLLIElement>document.getElementById("tab").cloneNode(true);
    li_list.push(li);
    li.style.display = "flex";
    li.setAttribute("data-url", url);
    document.getElementById("tabs").appendChild(li);
    li.id = "id" + id;
    绑定li(li);
    focus_tab(li);

    if (store.get("浏览器.标签页.小")) {
        li.classList.add("tab_small");
    }
    if (store.get("浏览器.标签页.灰度")) {
        li.classList.add("tab_gray");
    }
}

function close_tab(li: HTMLElement, id: number) {
    ipcRenderer.send("tab_view", id, "close");
    var l = document.querySelectorAll("li");
    for (let i in l) {
        if (l[i] === li && document.querySelector(".tab_focus") === li) {
            // 模板排除
            if (Number(i) == l.length - 2) {
                focus_tab(l[l.length - 3]);
            } else {
                focus_tab(l[i + 1]);
            }
        }
    }
    document.getElementById("tabs").removeChild(li);
    if (document.getElementById("tabs").querySelectorAll("li").length == 0) {
        document.getElementById("tabs").classList.remove("tabs_show");
    }
}

function focus_tab(li: HTMLElement) {
    var l = document.querySelectorAll("li");
    for (let i of l) {
        if (i === li) {
            i.classList.add("tab_focus");
        } else {
            i.classList.remove("tab_focus");
        }
    }
    for (let j in li_list) {
        if (li_list[j] === li) {
            li_list.splice(Number(j), 1);
            li_list.push(li);
        }
    }

    if (li) {
        ipcRenderer.send("tab_view", li.id.replace("id", ""), "top");
        document.title = `eSearch - ${li.querySelector("span").title}`;
        document.body.classList.add("fill_t_s");
    } else {
        document.body.classList.remove("fill_t_s");
        document.title = t("eSearch - 主页面");
    }
}

function title(id: number, arg: string) {
    document.querySelector(`#id${id} > span`).innerHTML =
        document.getElementById(`id${id}`).querySelector(`span`).title =
        document.getElementById(`id${id}`).querySelector(`img`).title =
            arg;
    if (document.getElementById(`id${id}`).className.split(" ").includes("tab_focus"))
        document.title = `eSearch - ${arg}`;
}

function icon(id: number, arg: Array<string>) {
    document.getElementById(`id${id}`).setAttribute("data-icon", arg[0]);
    document.getElementById(`id${id}`).querySelector(`img`).src = arg[0];
}

function url(id: number, url: string) {
    document.querySelector(`#id${id}`).setAttribute("data-url", url);
}

function load(id: number, loading: boolean) {
    if (loading) {
        document.querySelector(`#id${id} > img`).classList.add("loading");
        document.getElementById(`id${id}`).querySelector(`img`).src = `./assets/icons/reload.svg`;
        document.getElementById("reload").style.display = "none";
        document.getElementById("stop").style.display = "block";
    } else {
        document.querySelector(`#id${id} > img`).classList.remove("loading");
        if (document.getElementById(`id${id}`).getAttribute("data-icon"))
            document.getElementById(`id${id}`).querySelector(`img`).src = document
                .getElementById(`id${id}`)
                .getAttribute("data-icon");
        document.getElementById("reload").style.display = "block";
        document.getElementById("stop").style.display = "none";
    }
}

document.getElementById("buttons").onclick = (e) => {
    main_event(e);
};
function main_event(e: MouseEvent | any) {
    var id = li_list[li_list.length - 1].id.replace("id", "");
    let el = <HTMLElement>e.target;
    if (el.id == "browser") {
        open_in_browser();
    } else if (el.id == "add_history") {
        history_store.set(`历史记录.${new Date().getTime()}`, {
            text: document.querySelector(".tab_focus").getAttribute("data-url"),
        });
    } else {
        if (el.id) ipcRenderer.send("tab_view", id, el.id);
        if (el.id == "home") {
            document.querySelector(".tab_focus").classList.remove("tab_focus");
            document.body.classList.remove("fill_t_s");
            document.title = t("eSearch - 主页面");
        }
    }
}

function open_in_browser() {
    var url = document.querySelector(".tab_focus").getAttribute("data-url");
    shell.openExternal(url);
    if (store.get("浏览器.标签页.自动关闭")) {
        var id = Number(document.querySelector(".tab_focus").id.replace("id", ""));
        close_tab(document.querySelector(".tab_focus"), id);
    }
}

ipcRenderer.on("view_events", (event, arg) => {
    var e = { target: { id: arg } };
    main_event(e);
});

document.getElementById("tabs").onwheel = (e) => {
    e.preventDefault();
    var i = e.deltaX + e.deltaY + e.deltaZ >= 0 ? 1 : -1;
    document.getElementById("tabs").scrollLeft += i * Math.sqrt(e.deltaX ** 2 + e.deltaY ** 2 + e.deltaZ ** 2);
};

window.onbeforeunload = () => {
    document.querySelector(".tab_focus").classList.remove("tab_focus");
    let html = document.getElementById("tabs").innerHTML;
    ipcRenderer.send("tab_view", null, "save_html", html);
};

/// <reference types="vite/client" />
var in_browser = typeof global == "undefined";

import close_svg from "../assets/icons/close.svg";
import reload_svg from "../assets/icons/reload.svg";

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
    if (undo_stack[undo_stack_i] == editor.get()) return;
    // 撤回到中途编辑，把撤回的这一片与编辑的内容一起放到末尾
    if (undo_stack_i != undo_stack.length - 1) undo_stack.push(undo_stack[undo_stack_i]);
    undo_stack.push(editor.get());
    undo_stack_i = undo_stack.length - 1;
}
function undo() {
    if (undo_stack_i > 0) {
        undo_stack_i--;
        editor.push(undo_stack[undo_stack_i]);
        if (find_show) {
            exit_find();
            find_();
        }
    }
}
function redo() {
    if (undo_stack_i < undo_stack.length - 1) {
        undo_stack_i++;
        editor.push(undo_stack[undo_stack_i]);
        if (find_show) {
            exit_find();
            find_();
        }
    }
}
var splitter;
if (!in_browser) {
    const GraphemeSplitter = require("grapheme-splitter");
    splitter = new GraphemeSplitter();
}

class xeditor {
    text: HTMLTextAreaElement;
    selection_el: HTMLElement;
    find_el: HTMLElement;
    position_el: HTMLElement;
    selections: selections;
    cursors: cursors;
    find: find;
    constructor(el: HTMLElement) {
        el.classList.add("text");
        this.text = document.createElement("textarea");
        this.selection_el = document.createElement("div");
        this.find_el = document.createElement("div");
        this.position_el = document.createElement("div");
        el.append(this.position_el, this.find_el, this.selection_el, this.text);

        this.selections = new selections(this);
        this.cursors = new cursors(this);
        this.find = new find(this);

        this.text.oninput = () => {
            this.selection_el.innerText = this.text.value;
            this.text.style.height = this.selection_el.offsetHeight + "px";
            this.text.style.paddingBottom = el.offsetHeight - line_height + "px";
        };

        this.text.addEventListener("keydown", (e) => {
            var l = ["Tab", "Insert"];
            if (!l.includes(e.key)) return;
            e.preventDefault();
            switch (e.key) {
                case "Tab":
                    this.text.setRangeText("\t");
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
        });

        let pointer_start_from_this = false;

        this.text.addEventListener("pointerdown", (e) => {
            pointer_start_from_this = true;
            if (e.altKey) {
            } else {
                this.selections.clear_all();
            }
        });

        document.addEventListener("pointerup", (e) => {
            if (pointer_start_from_this) {
                if (e.altKey) {
                    this.selections.add({ start: this.text.selectionStart, end: this.text.selectionEnd });
                } else {
                    this.selections.clear_all();
                    this.selections.add({ start: this.text.selectionStart, end: this.text.selectionEnd });
                }
                pointer_start_from_this = false;
                this.text.dispatchEvent(new CustomEvent("select2", { detail: { button: e.button } }));
            }
        });

        this.text.addEventListener("copy", (e) => {
            e.clipboardData.setData("text/plain", editor.selections.get());
            e.preventDefault();
        });

        this.text.addEventListener("cut", (e) => {
            e.clipboardData.setData("text/plain", editor.selections.get());
            editor.selections.replace("");
            e.preventDefault();
        });

        this.text.addEventListener("paste", (e) => {
            let textl = e.clipboardData.getData("text/plain").split("\n");
            if (editor.selections.l.length == textl.length) {
                for (let i in editor.selections.l) {
                    editor.selections.replace(textl[i], editor.selections.l[i]);
                }
            } else {
                editor.selections.replace(textl.join("\n"));
            }
        });
    }

    /**
     * 写入编辑器
     * @param value 传入text
     */
    push(value: string) {
        this.text.value = value;
        this.text.style.height = this.selection_el.offsetHeight + "px";
        this.text.style.paddingBottom = this.text.parentElement.offsetHeight - line_height + "px";
        this.render();
        editor_change();

        if (editing_on_other) {
            editing_on_other = false;
            editor_change();
            editing_on_other = true;
        }
    }

    /**
     * 获取编辑器文字
     * @returns 文字
     */
    get(range?: selection) {
        let t = this.text.value;
        if (range) {
            t = t.slice(range.start, range.end);
        }
        return t;
    }

    render() {
        this.selection_el.innerText = this.text.value;
    }

    l() {
        return this.text.value.split("\n");
    }

    w_max(p: number) {
        return this.l()[p].length; // TODO
    }

    delete() {
        editor.selections.replace("");
        hide_edit_bar();
    }
    copy() {
        var t = editor.selections.get();
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
                editor.selections.replace(t);
            });
        } else {
            console.log(1);

            let t = clipboard.readText();
            editor.selections.replace(t);
        }
    }
    select_all() {
        this.selections.clear_all();
        this.selections.add({
            start: 0,
            end: editor.get().length,
        });
        let r = this.selections.rect(this.selections.l[0])[0];
        show_edit_bar(r.x, r.top + line_height, NaN, false);
    }
    delete_enter() {
        for (let s1 of editor.selections.l) {
            const s = editor.selections.ns2s(s1.start, s1.end);
            var t = editor.selections.get(s1);
            let ot = "";
            let start = format_selection2(s).start;
            let end = { pg: start.pg, of: start.of };
            for (let i = 0; i < t.length; i++) {
                if (t[i] == "\n") {
                    // 换行
                    if (t?.[i - 1]?.match(/[。？！…….\?!]/)) {
                        // 结尾
                        ot += t[i];
                        end.of = 0;
                        end.pg += 1;
                    } else {
                        if (t?.[i - 1]?.match(/[\u4e00-\u9fa5]/) && t?.[i + 1]?.match(/[\u4e00-\u9fa5]/)) {
                            // 上一行末与此行首为中文字符
                            ot += "";
                        } else {
                            ot += " ";
                            end.of += 1;
                        }
                    }
                } else {
                    // 正常行内字符
                    ot += t[i];
                    end.of += 1;
                }
            }
            editor.selections.replace(ot);
            s.start = start;
            s.end = end;
            editor.selections.render();
        }
    }
}

type selection2 = { start: { pg: number; of: number }; end: { pg: number; of: number } };
type selection = { start: number; end: number };

type cursor = { pg: number; of: number };

class selections {
    editor: xeditor;
    constructor(editor: xeditor) {
        this.editor = editor;
    }

    l: selection[] = [];

    add(new_s: selection) {
        new_s = format_selection(new_s);
        let new_l = [new_s];
        for (let s of this.l) {
            if (s.start <= new_s.start && new_s.end <= s.end) {
                // 新选区是选区的子集
                new_s.start = s.start;
                new_s.end = s.end;
            } else if (new_s.start <= s.start && s.start <= new_s.end) {
                // 选区起始端在新选区内，选区末端一定在新选区外
                new_s.end = s.end;
            } else if (new_s.start <= s.end && s.end <= new_s.end) {
                // 选区末端在新选区内，选区起始端一定在新选区外
                new_s.start = s.start;
            } else if (new_s.start <= s.start && s.end <= new_s.end) {
                // 选区是新选区的子集
            } else {
                // 交集为∅
                new_l.push(s);
            }
        }
        this.l = new_l;
        this.render();
        console.log(this.l);
    }

    clear_all() {
        this.l = [];
        this.render();
    }

    s2ns(s: selection2) {
        s = format_selection2(s);
        let l = editor.l();
        let start = 0;
        for (let i = 0; i < s.start.pg; i++) {
            start += l[i].length + 1;
        }
        start += s.start.of;
        let end = 0;
        for (let i = 0; i < s.end.pg; i++) {
            end += l[i].length + 1;
        }
        end += s.end.of;
        return { start: Math.min(start, end), end: Math.max(start, end) } as selection;
    }

    ns2s(start: number, end: number) {
        let s = { pg: NaN, of: NaN },
            e = { pg: NaN, of: NaN };
        let n = 0;
        const l = editor.l();
        for (let i = 0; i < l.length; i++) {
            // length+1 因为换行\n也算一个字符
            if (n <= start && start < n + l[i].length + 1) {
                s.pg = i;
                s.of = start - n;
            }
            if (n <= end && end < n + l[i].length + 1) {
                e.pg = i;
                e.of = end - n;
            }
            n += l[i].length + 1;
        }
        return { start: s, end: e };
    }

    get(s?: selection) {
        let l = [];
        if (s) {
            l.push(editor.get(s));
        } else {
            for (let s of this.l) {
                l.push(editor.get(s));
            }
        }
        return l.join("\n");
    }

    replace(text: string, s?: selection) {
        if (s) {
            editor.text.setSelectionRange(s.start, s.end);
            editor.text.setRangeText(text);
            s.end = s.start + text.length;
        } else {
            for (let s of this.l) {
                editor.text.setSelectionRange(s.start, s.end);
                editor.text.setRangeText(text);
                s.end = s.start + text.length;
            }
        }
        editor.render();
    }

    render() {
        this.editor.selection_el.innerHTML = "";
        let text = this.editor.text.value;
        let ranges: selection[] = this.l;
        ranges = ranges.sort((a, b) => a.start - b.start);
        for (let i = 0; i < ranges.length; i++) {
            let span = document.createElement("span");
            span.classList.add("selection");
            span.innerText = text.slice(ranges[i].start, ranges[i].end);
            let after = "";
            if (i == ranges.length - 1) after = text.slice(ranges[i].end, text.length);
            let before_el = document.createElement("span");
            before_el.innerText = text.slice(ranges?.[i - 1]?.end || 0, ranges[i].start);
            let after_el = document.createElement("span");
            after_el.innerText = after;
            this.editor.selection_el.append(before_el, span, after_el);
        }
    }

    rect(s: selection) {
        let text_nodes: Node[] = [];
        editor.position_el.innerText = editor.text.value;
        [...editor.position_el.childNodes].forEach((n) => {
            if (n.nodeName === "#text") text_nodes.push(n);
        });
        let ps = this.ns2s(s.start, s.end);
        let range = new Range();
        let rect_l = [];
        range.setStart(text_nodes[ps.start.pg], ps.start.of);
        range.setEnd(text_nodes[ps.end.pg], ps.end.of);
        document.getSelection().removeAllRanges();
        document.getSelection().addRange(range);
        rect_l.push(document.getSelection().getRangeAt(0).getBoundingClientRect());
        range.selectNode(text_nodes[ps.start.pg]);
        document.getSelection().removeAllRanges();
        document.getSelection().addRange(range);
        rect_l.push(document.getSelection().getRangeAt(0).getBoundingClientRect());
        range.selectNode(text_nodes[ps.end.pg]);
        document.getSelection().removeAllRanges();
        document.getSelection().addRange(range);
        rect_l.push(document.getSelection().getRangeAt(0).getBoundingClientRect());
        return rect_l;
    }
}
class cursors {
    editor: xeditor;
    constructor(editor: xeditor) {
        this.editor = editor;
    }

    l: cursor[] = [];

    c2nc(c: cursor) {
        let l = editor.l();
        let n = 0;
        for (let i = 0; i < c.pg; i++) {
            n += l[i].length;
        }
        n += c.of;
        return n;
    }

    add(c: cursor) {
        this.l.push(c);
    }

    set(c: cursor) {
        let n = this.c2nc(c);
        editor.text.setSelectionRange(n, n);
    }

    input() {
        for (let c of this.l) {
        }
    }
}

class find {
    editor: xeditor;
    constructor(editor: xeditor) {
        this.editor = editor;
    }

    matchx(stext: string, regex: boolean) {
        let text: string | RegExp = null;
        // 判断是找文字还是正则
        if (regex) {
            try {
                text = eval("/" + stext + "/g");
                document.getElementById("find_input").style.outline = "none";
            } catch (error) {
                document.getElementById("find_input").style.outline = "red  solid 1px";
            }
        } else {
            stext = stext.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            text = new RegExp(stext, "g"); // 自动转义，找文字
        }
        return text;
    }

    find(text: string | RegExp) {
        if (!tmp_text) tmp_text = editor.get();
        // 拆分
        let match_l = tmp_text.match(text);
        let text_l = tmp_text.split(text);
        let t_l: selection[] = [];
        let n = 0;
        // 交替插入
        for (i in text_l) {
            if (text_l[i]) n += text_l[i].length;
            if (match_l[i]) {
                t_l.push({ start: n, end: n + match_l[i].length });
                n += match_l[i].length;
            }
        }
        return t_l;
    }

    render(s: selection[]) {
        this.editor.find_el.innerHTML = "";
        let text = this.editor.text.value;
        let ranges = s.sort((a, b) => a.start - b.start);
        for (let i = 0; i < ranges.length; i++) {
            let span = document.createElement("span");
            span.classList.add("find_h");
            span.innerText = text.slice(ranges[i].start, ranges[i].end);
            let after = "";
            if (i == ranges.length - 1) after = text.slice(ranges[i].end, text.length);
            let before_el = document.createElement("span");
            before_el.innerText = text.slice(ranges?.[i - 1]?.end || 0, ranges[i].start);
            let after_el = document.createElement("span");
            after_el.innerText = after;
            this.editor.find_el.append(before_el, span, after_el);
        }
    }

    replace(s: selection, match: string | RegExp, text: string) {
        editor.selections.clear_all();
        editor.selections.add(s);
        let mtext = editor.get(s).replace(match, text);
        editor.selections.replace(mtext, editor.selections.l[0]);
    }
}

const editor = new xeditor(document.getElementById("text"));

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
    let o = in_browser ? t.split("") : <string[]>splitter.splitGraphemes(t);
    o = o.map((t) => word_to_span_string(t));
    return o.join("");
}

editor.push("");

function format_selection(s: selection) {
    return { start: Math.min(s.start, s.end), end: Math.max(s.start, s.end) } as selection;
}
function format_selection2(s: selection2) {
    var tmp: selection2 = { start: { pg: NaN, of: NaN }, end: { pg: NaN, of: NaN } };
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

var line_height = 24;

var cursor = { pg: 0, of: 0 };

editor.cursors.set(cursor);

/**
 * 每次更改光标触发
 */
function editor_change() {
    line_num();
    stack_add();
    if (find_show) {
        exit_find();
        find_();
        if (!in_browser) count_words();
    }
    if (editing_on_other) write_edit_on_other();
}

/**
 * 行号
 */
function line_num() {
    document.getElementById("line_num").innerHTML = "";
    let t = "";
    for (let i = 0; i <= editor.l().length; i++) {
        // t += `<div style="height:${get_pg(i).offsetHeight}px">${(i + 1).toString()}</div>`;
    }
    document.getElementById("line_num").innerHTML = t;
}
line_num();

document.getElementById("line_num").onmousedown = (e) => {
    e.stopPropagation();
    var el = <HTMLElement>e.target;
    if (el == document.getElementById("line_num")) return;
    var l_i = Number(el.innerText) - 1;

    var s = { start: { pg: l_i, of: 0 }, end: { pg: l_i, of: editor.w_max(l_i) } };
    editor.selections.clear_all();
    editor.selections.add(editor.selections.s2ns(s));
    editor.selections.render();

    cursor.pg = l_i;
    cursor.of = editor.w_max(l_i);
    editor.cursors.set(cursor);
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
                    ["Google", "https://translate.google.com.hk/?op=translate&text=%s"],
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
        editor.cursors.set(cursor);
        editor.selections.render();
        line_num();
    }, 400);
}

/**编辑栏 */
var edit_bar_s = false;
function show_edit_bar(x: number, y: number, h: number, right: boolean) {
    // 简易判断链接并显示按钮
    if (is_link(editor.selections.get(), false)) {
        document.getElementById("link_bar").style.width = "30px";
    } else {
        setTimeout(() => {
            document.getElementById("link_bar").style.width = "0";
        }, 400);
    }
    // 排除没选中
    if (editor.selections.get() != "" || right) {
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

editor.text.addEventListener("select2", (e: CustomEvent) => {
    let r = document.getSelection().getRangeAt(0).getBoundingClientRect();
    if (e.detail.button == 2) {
        show_edit_bar(r.x, r.y + line_height, 0, true);
    } else {
        if (editor.selections.get() == "") {
            hide_edit_bar();
        } else {
            show_edit_bar(r.x, r.y + line_height, 0, false);
        }
    }
});

document.getElementById("edit_b").onmousedown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    switch ((<HTMLElement>e.target).id) {
        case "link_bar":
            let url = editor.selections.get();
            open_link("url", url);
            break;
        case "search_bar":
            open_link("search");
            break;
        case "translate_bar":
            open_link("translate");
            break;
        case "selectAll_bar":
            editor.select_all();
            break;
        case "cut_bar":
            editor.cut();
            break;
        case "copy_bar":
            editor.copy();
            break;
        case "paste_bar":
            editor.paste();
            break;
        case "delete_enter_bar":
            editor.delete_enter();
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

    editor.cursors.set(cursor);
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

// 查找ui
var find_show = false;
function show_find() {
    find_show = !find_show;
    if (find_show) {
        document.getElementById("top").style.marginTop = "48px";
        document.getElementById("find").style.transform = "translateY(0)";
        document.getElementById("find").style.pointerEvents = "auto";
        find_input.value = editor.selections.get();
        find_input.select();
        find_input.focus();
        if (editor.selections.get() != "") find_();
        if (!in_browser) count_words();
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
    find_();
    find_input.focus();
};

var tmp_text: string;
document.getElementById("find_input").oninput = () => {
    // 清除样式后查找
    exit_find();
    find_();
};
// 查找并突出
function find_() {
    let match = editor.find.matchx(find_input.value, find_regex);
    let find_l = editor.find.find(match);
    editor.find.render(find_l);
    find_l_n_i = -1;
    find_l_n("↓");
    if (find_input.value == "") {
        exit_find();
    }
}

// 清除样式
function exit_find() {
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
            find_();
        }
    }
};

// 全部替换
document.getElementById("find_b_replace_all").onclick = () => {
    let m = editor.find.matchx(find_input.value, find_regex);
    let l = editor.find.find(m);
    for (let s of l) {
        editor.find.replace(s, m, replace_input.value);
    }
    exit_find();

    stack_add();
};
// 替换选中
document.getElementById("find_b_replace").onclick = find_replace;
function find_replace() {
    let m = editor.find.matchx(find_input.value, find_regex);
    let l = editor.find.find(m);
    let now_s = editor.selections.l[0];
    for (let s of l) {
        if (now_s.start <= s.start && s.end <= now_s.end) {
            editor.find.replace(s, m, replace_input.value);
            break;
        }
    }
    find_l_n_i = find_l_n_i - 1;
    find_l_n("↓");

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
    editor.push(t);
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

    editor.select_all();
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
        var s = editor.selections.get() || editor.get(); // 要么全部，要么选中
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
    var t = editor.get();
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
import time_format from "../../../lib/time_format";
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
        div.innerHTML = `<div class="history_title"><span>${time_format(
            store.get("时间格式"),
            new Date(Number(i) - 0)
        )}</span><button><img src="${close_svg}" class="icon"></button></div><div class="history_text">${
            t.splice(0, 3).join("<br>") + (t.length > 3 ? "..." : "")
        }</div>`;
        document.querySelector("#history_list").prepend(div);
    }

    // 打开某项历史
    document.querySelectorAll("#history_list > div > .history_text").forEach((e) => {
        e.addEventListener("click", () => {
            editor.push(history_list[e.parentElement.id].text);
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

ipcRenderer.on("text", (event, name: string, list: Array<string>) => {
    window_name = name;

    if (list.length == 1) {
        main_text = list[0];
        show_t(main_text);
    }

    if (list.length == 3 && list[0] == "image") {
        editor.push(t("图片上传中……请等候"));
        search_img(list[1], list[2] as any, (err: Error, url: string) => {
            if (url) {
                open_link("url", url);
                if (浏览器打开) {
                    ipcRenderer.send("main_win", "close");
                }
                ipcRenderer.send("main_win", "image_search", true);
            }
            if (err) editor.push(t("上传错误，请打开开发者工具查看详细错误"));
        });
    }

    if (list.length == 3 && list[0] == "ocr") {
        editor.push(t("图片识别中……请等候"));
        ocr(list[1], list[2] as any, (err: Error, text: string) => {
            if (text) {
                editor.push(text);
                editor.select_all();
                ipcRenderer.send("main_win", "ocr", "ok");
            }
            if (err) {
                editor.push(t("识别错误，请打开开发者工具查看详细错误"));
                ipcRenderer.send("main_win", "ocr", t("ocr识别错误"));
            }
        });
    }
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

document.documentElement.style.setProperty("--icon-color", store.get("全局.图标颜色")[1]);

var edit_on_other_type = null;
var file_watcher = null;
const path = require("path");
var tmp_text_path = path.join(os.tmpdir(), `/eSearch/eSearch_${new Date().getTime()}.txt`);
var editing_on_other = false;
import open_with from "../../../lib/open_with";
function edit_on_other() {
    editing_on_other = !editing_on_other;
    if (editing_on_other) {
        var data = Buffer.from(editor.get());
        fs.writeFile(tmp_text_path, data, () => {
            if (edit_on_other_type == "o") {
                shell.openPath(tmp_text_path);
            } else if (edit_on_other_type == "c") {
                open_with(tmp_text_path);
            }
            file_watcher = fs.watch(tmp_text_path, () => {
                fs.readFile(tmp_text_path, "utf8", (e, data) => {
                    if (e) console.log(e);
                    let cu = cursor;
                    editor.push(data);
                    if (cu.pg > editor.l().length) cu.pg = editor.l().length;
                    if (cu.of > editor.w_max(cu.pg)) cu.of = editor.w_max(cu.pg);
                    cursor = cu;
                    editor.cursors.set(cursor);
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
    let data = Buffer.from(editor.get());
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
            editor.copy();
            break;
        case "cut":
            editor.cut();
            break;
        case "paste":
            editor.paste();
            break;
        case "delete":
            editor.delete();
            break;
        case "select_all":
            editor.select_all();
            break;
        case "delete_enter":
            editor.delete_enter();
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
            var url = editor.selections.get();
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

import { t, lan } from "../../../lib/translate/translate";
lan(store.get("语言.语言"));
document.title = t(document.title);

/**
 * 统计字数
 */
function count_words() {
    let text = editor.get();
    let p = text.trim().match(/\n+/g)?.length + 1 || 1;
    text = text.replace(/[\n\r]/g, "");
    let c = splitter.splitGraphemes(text).length;
    let c_space = c - text.match(/\s/g)?.length || 0;
    let cjk_rg = /[\u2E80-\uFE4F]/g;
    let cjk = text.match(cjk_rg)?.length || 0;
    text = text.replace(cjk_rg, "").replace(/['";:,.?¿\-!¡，。？！、……：“‘【《》】’”]+/g, " ");
    let n_cjk = text.match(/\S+/g)?.length || 0;
    document.getElementById("count").innerText = `${cjk + n_cjk} ${t("字")}`;
    document.getElementById("count").title = `${t("段落")} ${p}\n${t("字符")} ${c}\n${t("非空格字符")} ${c_space}\n${t(
        "汉字"
    )} ${cjk}\n${t("非汉字词")} ${n_cjk}`;
}

/************************************失焦关闭 */

window.onblur = () => {
    if (store.get("关闭窗口.失焦.主页面")) ipcRenderer.send("main_win", "close");
};

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
        document.getElementById(`id${id}`).querySelector(`img`).src = reload_svg;
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

/************************************以图搜图 */

function search_img(img: string, type: "baidu" | "yandex" | "google", callback: Function) {
    switch (type) {
        case "baidu":
            baidu(img, (err, url) => {
                return callback(err, url);
            });
            break;
        case "yandex":
            yandex(img, (err, url) => {
                return callback(err, url);
            });
            break;
        case "google":
            google(img, (err, url) => {
                return callback(err, url);
            });
    }
}

/**
 * @param url
 * @param options
 * @param cb 回调
 */
function post(url: string, options: RequestInit, cb: Function) {
    fetch(url, Object.assign(options, { method: "POST" }))
        .then((r) => {
            console.log(r);
            return r.json();
        })
        .then((r) => {
            console.log(r);
            return cb(null, r);
        })
        .catch((e) => {
            console.error(e);
            return cb(e, null);
        });
}

function baidu(image, callback) {
    var data = new URLSearchParams({ from: "pc", image }).toString();
    post(
        "https://graph.baidu.com/upload",
        { headers: { "content-type": "application/x-www-form-urlencoded" }, body: data },
        (err, result) => {
            if (err) return callback(err, null);
            if (result.msg != "Success") return callback(new Error(JSON.stringify(err)), null);
            console.log(result.data.url);
            return callback(null, result.data.url);
        }
    );
}

function yandex(image, callback) {
    var b = Buffer.from(image, "base64");
    var url =
        "https://yandex.com/images-apphost/image-download?cbird=111&images_avatars_size=preview&images_avatars_namespace=images-cbir";
    post(url, { body: b }, (err, result) => {
        if (err) return callback(err, null);
        console.log(result);
        var img_url = result.url;
        if (img_url) {
            var b_url = `https://yandex.com/images/search?family=yes&rpt=imageview&url=${encodeURIComponent(img_url)}`;
            callback(null, b_url);
        } else {
            callback(new Error(result), null);
        }
    });
}

function google(image, callback) {
    var form = new FormData();
    let bstr = window.atob(image);
    let n = bstr.length;
    let u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    form.append("encoded_image", new Blob([u8arr], { type: "image/png" }), "eSearch.png");
    form.append("image_content", "");
    var url = "https://www.google.com/searchbyimage/upload";
    fetch(url, {
        method: "POST",
        body: form,
    })
        .then((r) => {
            return callback(null, r.url);
        })
        .catch((err) => {
            if (err) return callback(err, null);
        });
}

/************************************OCR */

function ocr(img: string, type: string | "baidu" | "youdao", callback: Function) {
    if (type == "baidu" || type == "youdao") {
        online_ocr(type, img, (err, r) => {
            return callback(err, r);
        });
    } else {
        local_ocr(type, img, (err, r) => {
            return callback(err, r);
        });
    }
}
import lo from "../../../ocr/local_ocr";
/**
 * 离线OCR
 * @param {String} arg 图片base64
 * @param {Function} callback 回调
 */
async function local_ocr(type: string, arg: string, callback: Function) {
    let l: [string, string, string, string, any];
    for (let i of store.get("离线OCR")) if (i[0] == type) l = i;
    let ocr_path = path.isAbsolute(l[1]) ? "" : path.join(__dirname, "../../ocr/ppocr"); // 默认模型路径
    let detp = path.join(ocr_path, l[1]),
        recp = path.join(ocr_path, l[2]),
        字典 = path.join(ocr_path, l[3]);
    console.log(ocr_path);
    await lo.init({
        det_path: detp,
        rec_path: recp,
        dic_path: 字典,
        ...l[4],
        node: true,
    });
    let img = document.createElement("img");
    img.src = "data:image/png;base64," + arg;
    img.onload = async () => {
        let canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        lo.ocr(canvas.getContext("2d").getImageData(0, 0, img.width, img.height))
            .then((l) => {
                console.log(l);
                let t = "";
                for (let i of l) {
                    t += i.text + "\n";
                }
                callback(null, t);
            })
            .catch((e) => {
                callback(e, null);
            });
    };
}

/**
 * 在线OCR
 * @param {String} type 服务提供者
 * @param {String} arg 图片base64
 * @param {Function} callback 回调
 */
function online_ocr(type: string, arg: string, callback: Function) {
    var client_id = store.get(`在线OCR.${type}.id`),
        client_secret = store.get(`在线OCR.${type}.secret`);
    if (!client_id || !client_secret) return callback("未填写 API Key 或 Secret Key", null);
    switch (type) {
        case "baidu":
            baidu_ocr();
            break;
        case "youdao":
            youdao_ocr();
            break;
    }

    function baidu_ocr() {
        fetch(
            `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`,
            { method: "GET" }
        )
            .then((t) => t.json())
            .then((result) => {
                var access_token = result.access_token;
                console.log(access_token);
                if (!access_token) return callback(JSON.stringify(result), null);
                fetch(`${store.get(`在线OCR.${type}.url`)}?access_token=${access_token}`, {
                    method: "POST",
                    headers: {
                        "content-type": "application/x-www-form-urlencoded",
                    },
                    body: new URLSearchParams({ image: arg, paragraph: "true" }).toString(),
                })
                    .then((v) => v.json())
                    .then((result) => {
                        baidu_format(result);
                    });
            });

        function baidu_format(result) {
            if (result.error_msg || result.error_code) return callback(JSON.stringify(result), null);

            var output_l = [];
            if (!result.paragraphs_result) {
                for (i of result.words_result) {
                    output_l.push((<any>i).words);
                }
            } else {
                for (i in result.paragraphs_result) {
                    output_l[i] = "";
                    for (let ii in result.paragraphs_result[i]["words_result_idx"]) {
                        output_l[i] += result.words_result[result.paragraphs_result[i]["words_result_idx"][ii]].words;
                    }
                }
            }
            let output = output_l.join("\n");
            console.log(output);
            return callback(null, output);
        }
    }

    function youdao_ocr() {
        const crypto = require("crypto");
        let input = arg.length >= 20 ? arg.slice(0, 10) + arg.length + arg.slice(-10) : arg;
        let curtime = String(Math.round(new Date().getTime() / 1000));
        let salt = crypto.randomUUID();
        let sign = crypto
            .createHash("sha256")
            .update(client_id + input + salt + curtime + client_secret)
            .digest("hex");
        let data = {
            img: arg,
            langType: "auto",
            detectType: "10012",
            imageType: "1",
            appKey: client_id,
            docType: "json",
            signType: "v3",
            salt,
            sign,
            curtime,
        };

        fetch("https://openapi.youdao.com/ocrapi", {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(data).toString(),
        })
            .then((v) => v.json())
            .then((result) => {
                youdao_format(result);
            })
            .catch((e) => {
                return callback(e, null);
            });
        function youdao_format(result) {
            if (result.errorCode != "0") return callback(new Error(JSON.stringify(result)), null);
            var text_l = [];
            for (i of result.Result.regions) {
                var t = "";
                for (let j of (<any>i).lines) {
                    t += j.text;
                }
                text_l.push(t);
            }
            let text = text_l.join("\n");
            console.log(text);
            return callback(null, text);
        }
    }
}
// online_ocr();

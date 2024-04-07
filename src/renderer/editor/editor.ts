/// <reference types="vite/client" />

var Store = require("electron-store");
var configPath = new URLSearchParams(location.search).get("config_path");
var store = new Store({
    cwd: configPath || "",
});
import { MainWinType } from "../../ShareTypes";

import closeSvg from "../assets/icons/close.svg";
import reloadSvg from "../assets/icons/reload.svg";

/**撤销 */
// 定义撤销栈
var undoStack = [""];
// 定义位置
var undoStackI = 0;
/**
 * 添加到撤销栈
 * @returns none
 */
function stackAdd() {
    if (undoStack[undoStackI] == editor.get()) return;
    // 撤回到中途编辑，把撤回的这一片与编辑的内容一起放到末尾
    if (undoStackI != undoStack.length - 1) undoStack.push(undoStack[undoStackI]);
    undoStack.push(editor.get());
    undoStackI = undoStack.length - 1;
}
function undo() {
    if (undoStackI > 0) {
        undoStackI--;
        editor.push(undoStack[undoStackI]);
        if (findShow) {
            exitFind();
            find_();
        }
    }
}
function redo() {
    if (undoStackI < undoStack.length - 1) {
        undoStackI++;
        editor.push(undoStack[undoStackI]);
        if (findShow) {
            exitFind();
            find_();
        }
    }
}

class xeditor {
    rendererEl: HTMLElement;
    text: HTMLTextAreaElement;
    findEl: HTMLElement;
    positionEl: HTMLElement;
    selections: selections;
    find: find;
    constructor(el: HTMLElement) {
        this.rendererEl = el;
        el.classList.add("text");
        this.text = document.createElement("textarea");
        this.findEl = document.createElement("div");
        this.positionEl = document.createElement("div");
        el.append(this.positionEl, this.findEl, this.text);

        this.selections = new selections(this);
        this.find = new find(this);

        this.text.oninput = () => {
            this.text.style.paddingBottom = el.offsetHeight - lineHeight + "px";
            editorChange();
        };

        this.text.addEventListener("keydown", (e) => {
            var l = ["Tab", "Insert"];
            if (!l.includes(e.key)) return;
            e.preventDefault();
            switch (e.key) {
                case "Tab":
                    this.text.setRangeText("\t");
                    this.text.selectionStart = this.text.selectionEnd = this.text.selectionStart + 1;
                    editorChange();
                    break;
            }
        });

        let pointerStartFromThis = false;

        this.text.addEventListener("pointerdown", () => {
            pointerStartFromThis = true;
        });

        document.addEventListener("pointerup", (e) => {
            if (pointerStartFromThis) {
                pointerStartFromThis = false;
                setTimeout(() => {
                    this.text.dispatchEvent(
                        new CustomEvent("select2", { detail: { button: e.button, d: this.text.selectionDirection } })
                    );
                }, 10);
            }
        });
    }

    /**
     * 写入编辑器
     * @param value 传入text
     */
    push(value: string) {
        this.text.value = value;
        this.text.style.paddingBottom = this.text.parentElement.offsetHeight - lineHeight + "px";
        editorChange();

        if (editingOnOther) {
            editingOnOther = false;
            editorChange();
            editingOnOther = true;
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

    l() {
        return this.text.value.split("\n");
    }

    wMax(p: number) {
        return this.l()[p].length;
    }

    delete() {
        editor.selections.replace("");
        hideEditBar();
    }
    copy() {
        var t = editor.selections.get();
        clipboard.writeText(t);
    }
    cut() {
        this.copy();
        this.delete();
    }
    paste() {
        let t = clipboard.readText();
        editor.selections.replace(t);
    }
    selectAll() {
        this.selections.clearAll();
        this.selections.add({
            start: 0,
            end: editor.get().length,
        });
        let r = this.selections.rect(this.selections.getS())[0];
        showEditBar(r.x, r.top + lineHeight, NaN, false);
    }
    deleteEnter() {
        const s = editor.selections.getS();
        var t = editor.selections.get(s);
        let ot = "";
        for (let i = 0; i < t.length; i++) {
            if (t[i] == "\n") {
                // 换行
                if (t?.[i - 1]?.match(/[。？！…….\?!]/)) {
                    // 结尾
                    ot += t[i];
                } else {
                    if (t?.[i - 1]?.match(/[\u4e00-\u9fa5]/) && t?.[i + 1]?.match(/[\u4e00-\u9fa5]/)) {
                        // 上一行末与此行首为中文字符
                        ot += "";
                    } else {
                        ot += " ";
                    }
                }
            } else {
                // 正常行内字符
                ot += t[i];
            }
        }
        editor.selections.replace(ot);

        lineNum();
    }
}

type selection2 = { start: { pg: number; of: number }; end: { pg: number; of: number } };
type selection = { start: number; end: number };

class selections {
    editor: xeditor;
    constructor(editor: xeditor) {
        this.editor = editor;
    }

    add(new_s: selection) {
        editor.text.setSelectionRange(new_s.start, new_s.end);
    }

    getS() {
        return { start: editor.text.selectionStart, end: editor.text.selectionEnd };
    }

    clearAll() {
        editor.text.setSelectionRange(0, 0);
    }

    s2ns(s: selection2) {
        s = formatSelection2(s);
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
        l.push(editor.get(s || this.getS()));
        return l.join("\n");
    }

    replace(text: string, s?: selection) {
        if (!s) s = this.getS();
        editor.text.setSelectionRange(s.start, s.end);
        editor.text.setRangeText(text);
        s.end = s.start + text.length;
    }

    rect(s: selection) {
        let textNodes: HTMLElement[] = [];
        let l = editor.text.value.split("\n");
        editor.positionEl.innerText = "";
        for (let text of l) {
            let div = document.createElement("div");
            div.innerText = text;
            div.style.minHeight = lineHeight + "px";
            textNodes.push(div);
            editor.positionEl.append(div);
        }
        let ps = this.ns2s(s.start, s.end);
        let range = new Range();
        let rectL: DOMRect[] = [];
        setR(textNodes[ps.start.pg], ps.start.of, textNodes[ps.end.pg], ps.end.of);
        setR(textNodes[ps.start.pg], ps.start.of, textNodes[ps.start.pg], ps.start.of);
        setR(textNodes[ps.end.pg], ps.end.of, textNodes[ps.end.pg], ps.end.of);
        function setR(start: HTMLElement, so: number, end: HTMLElement, eo: number) {
            range.setStart(start.firstChild || start, so);
            range.setEnd(end.firstChild || end, eo);
            document.getSelection().removeAllRanges();
            document.getSelection().addRange(range);
            rectL.push(document.getSelection().getRangeAt(0).getBoundingClientRect());
        }
        this.editor.text.setSelectionRange(s.start, s.end);
        this.editor.text.focus();
        return rectL as [DOMRect, DOMRect, DOMRect];
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
        if (!tmpText) tmpText = editor.get();
        // 拆分
        let matchL = tmpText.match(text);
        let textL = tmpText.split(text);
        let tL: selection[] = [];
        let n = 0;
        // 交替插入
        for (i in textL) {
            if (textL[i]) n += textL[i].length;
            if (matchL[i]) {
                tL.push({ start: n, end: n + matchL[i].length });
                n += matchL[i].length;
            }
        }
        return tL;
    }

    render(s: selection[]) {
        this.editor.findEl.innerHTML = "";
        let text = this.editor.text.value;
        let ranges = s.sort((a, b) => a.start - b.start);
        for (let i = 0; i < ranges.length; i++) {
            let span = document.createElement("span");
            span.innerText = text.slice(ranges[i].start, ranges[i].end);
            if (span.innerText) span.classList.add("find_h");
            let after = "";
            if (i == ranges.length - 1) after = text.slice(ranges[i].end, text.length);
            let beforeEl = document.createElement("span");
            beforeEl.innerText = text.slice(ranges?.[i - 1]?.end || 0, ranges[i].start);
            let afterEl = document.createElement("span");
            afterEl.innerText = after;
            this.editor.findEl.append(beforeEl, span, afterEl);
        }
    }

    replace(s: selection, match: string | RegExp, text: string) {
        editor.selections.clearAll();
        editor.selections.add(s);
        let mtext = editor.get(s).replace(match, text);
        editor.selections.replace(mtext, editor.selections.getS());
    }
}

const editor = new xeditor(document.getElementById("text"));

editor.push("");

function formatSelection2(s: selection2) {
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

var lineHeight = 24;

/**
 * 每次更改光标触发
 */
function editorChange() {
    lineNum();
    stackAdd();
    if (findShow) {
        exitFind();
        find_();
        countWords();
    }
    if (editingOnOther) writeEditOnOther();
}

/**
 * 行号
 */
function lineNum() {
    document.getElementById("line_num").innerHTML = "";
    let l = editor.text.value.split("\n");
    editor.positionEl.innerText = "";
    let t = "";
    let ly = document.getElementById("line_num").getBoundingClientRect().y;
    for (let i in l) {
        const text = l[i];
        let div = document.createElement("div");
        div.innerText = text;
        div.style.minHeight = lineHeight + "px";
        editor.positionEl.append(div);
        let rect = div.getBoundingClientRect();
        t += `<div style="top:${rect.y - ly}px">${Number(i) + 1}</div>`;
    }
    document.getElementById("line_num").innerHTML = t;
    document.getElementById("line_num").style.width = String(l.length).length / 2 + "em";
}
lineNum();

document.getElementById("line_num").onmousedown = (e) => {
    e.stopPropagation();
    var el = <HTMLElement>e.target;
    if (el == document.getElementById("line_num")) return;
    var lI = Number(el.innerText) - 1;

    var s = { start: { pg: lI, of: 0 }, end: { pg: lI, of: editor.wMax(lI) } };
    editor.selections.clearAll();
    editor.selections.add(editor.selections.s2ns(s));
};
document.getElementById("line_num").onmouseup = (_e) => {
    let s = editor.selections.getS();
    editor.text.setSelectionRange(s.start, s.end);
    editor.text.focus();
};
document.getElementById("text").onscroll = () => {
    document.getElementById("line_num").style.top = `-${document.getElementById("text").scrollTop}px`;
};

/************************************主要 */

var windowName = "",
    mainText = "";
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
        setFontSize(size - d);
    }
};
function setFontSize(font_size: number) {
    document.getElementById("text_out").style.fontSize = font_size + "px";
    lineHeight = font_size * 1.5;
    if (store.get("字体.记住")) store.set("字体.记住", font_size);
    setTimeout(() => {
        lineNum();
    }, 400);
}

const barLink = document.getElementById("link_bar");
const barExcel = document.getElementById("excel_bar");
const barMdTable = document.getElementById("md_table_bar");

/**编辑栏 */
var editBarS = false;
function showEditBar(x: number, y: number, _h: number, right: boolean) {
    const get = editor.selections.get();
    // 简易判断链接并显示按钮
    if (isLink(get, false)) {
        barLink.style.width = "30px";
    } else {
        barLink.style.width = "0";
    }
    if (get.split("\n").every((i) => i.includes("\t"))) {
        barExcel.style.width = "30px";
        barMdTable.style.width = "30px";
    } else {
        barExcel.style.width = "0";
        barMdTable.style.width = "0";
    }

    // 排除没选中
    if (get != "" || right) {
        if (editBarS) {
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
        editBarS = true;
    } else {
        document.getElementById("edit_b").className = "edit_h";
        editBarS = false;
    }
}

function hideEditBar() {
    editBarS = true;
    showEditBar(0, 0, 0, false);
}

editor.text.addEventListener("select2", (e: CustomEvent) => {
    let dir = e.detail.d as HTMLTextAreaElement["selectionDirection"];
    let rect = editor.selections.rect(editor.selections.getS());
    let r: DOMRect;
    if (dir == "backward") {
        r = rect[1];
    } else {
        r = rect[2];
    }
    let d = editor.rendererEl.getBoundingClientRect();
    let x = r.x - d.x;
    let y = r.y - d.y;
    if (e.detail.button == 2) {
        showEditBar(x, y + lineHeight, 0, true);
    } else {
        if (editor.selections.get() == "") {
            hideEditBar();
        } else {
            showEditBar(x, y + lineHeight, 0, false);
        }
    }
});

document.getElementById("edit_b").onmousedown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    switch ((<HTMLElement>e.target).id) {
        case "excel_bar":
            let text = editor.selections.get();
            let t: string[] = [];
            text.split("\n").forEach((v) => {
                let l = v
                    .split("\t")
                    .map((i) => `"${i}"`)
                    .join(",");
                t.push(l);
            });
            // 下载csv
            let blob = new Blob([t.join("\n")], { type: "text/csv" });
            let a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "eSearch.csv";
            a.click();
            break;
        case "md_table_bar":
            let table = editor.selections.get();
            let table2: string[] = [];
            table.split("\n").forEach((v, i) => {
                let l = `|${v.replaceAll("\t", "|")}|`;
                table2.push(l);
                if (i === 0) {
                    const i = v.match(/\t/g).length + 1;
                    let s = "|";
                    for (let n = 0; n < i; n++) {
                        s += "---|";
                    }
                    table2.push(s);
                }
            });
            clipboard.writeText(table2.join("\n"));
            break;
        case "link_bar":
            let url = editor.selections.get();
            openLink("url", url);
            break;
        case "search_bar":
            openLink("search");
            break;
        case "translate_bar":
            openLink("translate");
            break;
        case "selectAll_bar":
            editor.selectAll();
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
            editor.deleteEnter();
            break;
    }
};

var isWrap = !store.get("编辑器.自动换行");
wrap();
function wrap() {
    isWrap = !isWrap;
    if (isWrap) {
        document.documentElement.style.setProperty("--wrap", "pre-wrap");
        document.querySelectorAll(".text > *").forEach((el: HTMLElement) => {
            el.style.width = "100%";
        });
    } else {
        document.documentElement.style.setProperty("--wrap", "nowrap");
        document.querySelectorAll(".text > *").forEach((el: HTMLElement) => {
            el.style.width = "";
        });
    }
    editor.text.style.paddingBottom = editor.text.parentElement.offsetHeight - lineHeight + "px";
    lineNum();
}

var isCheck = !store.get("编辑器.拼写检查");
spellcheck();
function spellcheck() {
    isCheck = !isCheck;
    document.getElementById("text").spellcheck = isCheck;
}

/**
 * 查找与替换
 */

var findInput = <HTMLInputElement>document.getElementById("find_input");
var replaceInput = <HTMLInputElement>document.getElementById("replace_input");
var findT = <HTMLElement>document.querySelector(".find_t > span");

// 查找ui
var findShow = false;
function showFind() {
    findShow = !findShow;
    if (findShow) {
        document.getElementById("top").style.marginTop = "48px";
        document.getElementById("find").style.transform = "translateY(0)";
        document.getElementById("find").style.pointerEvents = "auto";
        findInput.value = editor.selections.get();
        findInput.select();
        findInput.focus();
        if (editor.selections.get() != "") find_();
        countWords();
    } else {
        document.getElementById("top").style.marginTop = "";
        document.getElementById("find").style.transform = "translateY(-120%)";
        document.getElementById("find").style.pointerEvents = "none";
    }
}

document.getElementById("find_b_close").onclick = () => {
    showFind();
    exitFind();
};

// 正则
var findRegex = false;
document.getElementById("find_b_regex").onclick = () => {
    findRegex = !findRegex;
    if (findRegex) {
        document.getElementById("find_b_regex").style.backgroundColor = "var(--hover-color)";
    } else {
        document.getElementById("find_b_regex").style.backgroundColor = "";
    }
    find_();
    findInput.focus();
};

var tmpText: string;
document.getElementById("find_input").oninput = () => {
    // 清除样式后查找
    exitFind();
    find_();
};
// 查找并突出
function find_() {
    let match = editor.find.matchx(findInput.value, findRegex);
    let find_l = editor.find.find(match);
    editor.find.render(find_l);
    findLNI = -1;
    findLN("↓");
    if (findInput.value == "") {
        exitFind();
    }
}

// 清除样式
function exitFind() {
    tmpText = null;
    findT.innerText = "";
    editor.find.render([]);
}
// 跳转
var findLNI = 0;
function findLN(a: "↑" | "↓") {
    var l = document.querySelectorAll(".find_h");
    if (l.length == 0) {
        findT.innerText = `无结果`;
        return;
    }
    if (l[findLNI]) l[findLNI].classList.remove("find_h_h");
    if (a == "↑") {
        if (findLNI > 0) {
            findLNI--;
        } else {
            findLNI = l.length - 1;
        }
    } else if (a == "↓") {
        if (findLNI < l.length - 1) {
            findLNI++;
        } else {
            findLNI = 0;
        }
    }
    l[findLNI].classList.add("find_h_h");
    findT.innerText = `${findLNI + 1}/${l.length}`;
    document.getElementById("text_out").scrollTop = (<HTMLElement>l[findLNI]).offsetTop - 48 - 16;
}
document.getElementById("find_b_last").onclick = () => {
    findLN("↑");
};
document.getElementById("find_b_next").onclick = () => {
    findLN("↓");
};
document.getElementById("find_input").onkeydown = (e) => {
    if (e.key == "Enter") {
        if (document.querySelector(".find_h_h")) {
            findLN("↓");
        } else {
            find_();
        }
    }
};

// 全部替换
document.getElementById("find_b_replace_all").onclick = () => {
    let m = editor.find.matchx(findInput.value, findRegex);
    if (!editor.selections.get()) editor.selectAll();
    editor.selections.replace(editor.selections.get().replaceAll(m, replaceInput.value));
    exitFind();

    stackAdd();
};
// 替换选中
document.getElementById("find_b_replace").onclick = findReplace;
function findReplace() {
    let m = editor.find.matchx(findInput.value, findRegex);
    let l = editor.find.find(m);
    let s = l[findLNI];
    editor.find.replace(s, m, replaceInput.value);
    findLNI = findLNI - 1;
    let ti = findLNI;
    find_();
    findLNI = ti;
    findLN("↓");

    stackAdd();
}
document.getElementById("replace_input").onkeydown = (e) => {
    if (e.key == "Enter") {
        findReplace();
    }
};

/************************************搜索 */

let mainType: "auto" | "search" | "translate" = store.get("主页面.模式");

/**
 * 判断是否为链接
 * @param url 链接
 * @param s 严格模式
 * @returns 是否为链接
 */
function isLink(url: string, s: boolean) {
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
function showT(t: string) {
    t = t.replace(/[\r\n]$/, "");
    editor.push(t);
    if (mainType === "auto" || t === "") {
        // 严格模式
        if (isLink(t, true)) {
            if (自动打开链接) openLink("url", t);
        } else {
            var language = t.match(/[\u4e00-\u9fa5]/g)?.length >= t.length * 自动搜索中文占比 ? "本地语言" : "外语";
            if (自动搜索 && t.match(/[\r\n]/) == null && t != "") {
                if (language == "本地语言") {
                    openLink("search");
                } else {
                    openLink("translate");
                }
            }
        }
    } else if (mainType === "search") {
        openLink("search");
    } else if (mainType === "translate") {
        openLink("translate");
    }
    editor.selectAll();
}

/**
 * 打开浏览界面
 * @param id 模式
 * @param link 链接
 */
function openLink(id: "url" | "search" | "translate", link?: string) {
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
            ipcRenderer.send("open_url", windowName, url);
        }
    } else {
        window.open(url);
    }
}

var 搜索引擎List = store.get("搜索引擎"),
    翻译引擎List = store.get("翻译引擎"),
    引擎 = store.get("引擎");
/**搜索翻译按钮 */
document.getElementById("search_b").onclick = () => {
    openLink("search");
};
document.getElementById("translate_b").onclick = () => {
    openLink("translate");
};
/**改变选项后搜索 */
document.getElementById("search_s").oninput = () => {
    openLink("search");
    if (引擎.记住)
        store.set("引擎.记住", [
            (<HTMLSelectElement>document.getElementById("search_s")).selectedOptions[0].innerText,
            store.get("引擎.记住")[1],
        ]);
};
document.getElementById("translate_s").oninput = () => {
    openLink("translate");
    if (引擎.记住)
        store.set("引擎.记住", [
            store.get("引擎.记住")[0],
            (<HTMLSelectElement>document.getElementById("translate_s")).selectedOptions[0].innerText,
        ]);
};
/**展示搜索引擎选项 */
var searchC = "";
for (let i in 搜索引擎List) {
    searchC += `<option ${
        引擎.记住
            ? 引擎.记住[0] == 搜索引擎List[i][0]
                ? "selected"
                : ""
            : 引擎.默认搜索引擎 == 搜索引擎List[i][0]
            ? "selected"
            : ""
    } value="${搜索引擎List[i][1]}">${搜索引擎List[i][0]}</option>`;
}
document.querySelector("#search_s").innerHTML = searchC;
/**展示翻译引擎选项 */
var translateC = "";
for (let i in 翻译引擎List) {
    translateC += `<option ${
        引擎.记住
            ? 引擎.记住[1] == 翻译引擎List[i][0]
                ? "selected"
                : ""
            : 引擎.默认翻译引擎 == 翻译引擎List[i][0]
            ? "selected"
            : ""
    } value="${翻译引擎List[i][1]}">${翻译引擎List[i][0]}</option>`;
}
document.querySelector("#translate_s").innerHTML = translateC;

/************************************历史记录 */
// 历史记录

var historyStore = new Store({ name: "history" });

var historyList = historyStore.get("历史记录") || {};
var 历史记录设置 = store.get("历史记录设置");
if (历史记录设置.保留历史记录 && 历史记录设置.自动清除历史记录) {
    var nowTime = new Date().getTime();
    var dTime = Math.round(历史记录设置.d * 86400 + 历史记录设置.h * 3600) * 1000;
    for (var i of Object.keys(historyList)) {
        if (nowTime - Number(i) > dTime) {
            historyStore.delete(`历史记录.${i}`);
        }
    }
}

function pushHistory() {
    var t = editor.get();
    var i = new Date().getTime();
    var s = { text: t };
    if (t != "" && 历史记录设置.保留历史记录) {
        historyStore.set(`历史记录.${i}`, s);
        historyList[i] = s;
    }
    renderHistory();
}
// 历史记录界面
var historyShowed = false;
document.getElementById("history_b").onclick = showHistory;
// html转义
function htmlToText(html: string) {
    return html.replace(
        /[<>& \'\"]/g,
        (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;", " ": "&nbsp;" }[c])
    );
}

function showHistory() {
    if (historyShowed) {
        document.getElementById("history").className = "";
        historyShowed = false;
        document.getElementById("history_list").style.top = "100%";
    } else {
        document.getElementById("history").className = "hover_b2";
        historyShowed = true;

        document.getElementById("history_list").style.top = "0%";

        renderHistory();
    }
}
import time_format from "../../../lib/time_format";
function renderHistory() {
    var n = {};
    for (let i of Object.keys(historyList).sort()) {
        n[i] = historyList[i];
    }
    historyList = n;
    n = null;
    // 迁移历史记录
    if (store.get("历史记录")) {
        document.querySelector("#history_list").innerHTML = `<div id = "old_his_to_new">迁移旧历史</div>`;
        document.getElementById("old_his_to_new").onclick = oldHisToNew;
    }
    if (Object.keys(historyList).length == 0) document.querySelector("#history_list").innerHTML = "暂无历史记录";
    for (let i in historyList) {
        var t = htmlToText(historyList[i].text).split(/[\r\n]/g);
        var div = document.createElement("div");
        div.id = i;
        div.innerHTML = `<div class="history_title"><span>${time_format(
            store.get("时间格式"),
            new Date(Number(i) - 0)
        )}</span><button><img src="${closeSvg}" class="icon"></button></div><div class="history_text">${
            t.splice(0, 3).join("<br>") + (t.length > 3 ? "..." : "")
        }</div>`;
        document.querySelector("#history_list").prepend(div);
    }

    // 打开某项历史
    document.querySelectorAll("#history_list > div > .history_text").forEach((e) => {
        e.addEventListener("click", () => {
            editor.push(historyList[e.parentElement.id].text);
            showHistory();
        });
    });
    // 删除某项历史
    // TODO多选
    document.querySelectorAll("#history_list > div > .history_title > button").forEach((e) => {
        e.addEventListener("click", () => {
            historyStore.delete(`历史记录.${e.parentElement.parentElement.id}`);
            e.parentElement.parentElement.style.display = "none";
        });
    });
}
if (mainText == "") renderHistory();

function oldHisToNew() {
    for (let i of store.get("历史记录")) {
        historyStore.set(`历史记录.${i.time}`, { text: i.text });
        historyList[i.time] = { text: i.text };
    }
    store.delete("历史记录");
    renderHistory();
}

/************************************引入 */
const { ipcRenderer, shell, clipboard } = require("electron") as typeof import("electron");
const fs = require("fs") as typeof import("fs");
const os = require("os") as typeof import("os");

ipcRenderer.on("init", (_event, _name: number) => {});

ipcRenderer.on("text", (_event, name: string, list: MainWinType) => {
    windowName = name;

    if (list.type === "text") {
        mainText = list.content;
        showT(mainText);
    }

    if (list.type === "image") {
        editor.push(t("图片上传中……请等候"));
        searchImg(list.content, list.arg0 as any, (err: Error, url: string) => {
            if (url) {
                openLink("url", url);
                if (浏览器打开) {
                    ipcRenderer.send("main_win", "close");
                }
            }
            if (err) editor.push(t("上传错误，请打开开发者工具查看详细错误"));
        });
    }

    if (list.type === "ocr") {
        editor.push(t("图片识别中……请等候"));
        ocr(list.content, list.arg0 as any, (err: Error, r: { raw: ocrResult; text: string }) => {
            const text = r?.text;
            if (text) {
                console.log(text);

                editor.push(text);
                editor.selectAll();

                if (mainType === "search") {
                    openLink("search");
                } else if (mainType === "translate") {
                    openLink("translate");
                }

                addOcrText(r.raw, 0);
                return;
            } else {
                console.error(err);

                editor.push(t("识别错误") + "\n" + err + "\n" + t("请打开开发者工具（Ctrl+Shift+I）查看详细错误"));
            }
        });
    }

    if (list.type === "qr") {
        editor.push(t("QR码识别中……请等候"));
        import("qr-scanner-wechat").then(async (qr) => {
            let img = new Image();
            img.src = list.content;
            const result = await qr.scan(img);
            const text = result.text;
            showT(text || "");
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
if (store.get("全局.图标颜色")[3])
    document.documentElement.style.setProperty("--icon-color1", store.get("全局.图标颜色")[3]);

var editOnOtherType = null;
var fileWatcher = null;
const path = require("path") as typeof import("path");
var tmpTextPath = path.join(os.tmpdir(), `/eSearch/eSearch_${new Date().getTime()}.txt`);
var editingOnOther = false;
import openWith from "../../../lib/open_with";
function editOnOther() {
    editingOnOther = !editingOnOther;
    if (editingOnOther) {
        var data = Buffer.from(editor.get());
        fs.writeFile(tmpTextPath, data, () => {
            if (editOnOtherType == "o") {
                shell.openPath(tmpTextPath);
            } else if (editOnOtherType == "c") {
                openWith(tmpTextPath);
            }
            fileWatcher = fs.watch(tmpTextPath, () => {
                fs.readFile(tmpTextPath, "utf8", (e, data) => {
                    if (e) console.log(e);
                    editor.push(data);
                });
            });
            document.getElementById("text_out").title = "正在外部编辑中，双击退出";
            document.addEventListener("dblclick", () => {
                editingOnOther = true;
                editOnOther();
            });
        });
        data = null;
    } else {
        try {
            document.getElementById("text_out").title = "";
            document.removeEventListener("dblclick", () => {
                editingOnOther = true;
                editOnOther();
            });
            fileWatcher.close();
            fs.unlink(tmpTextPath, () => {});
        } catch {}
    }
}

function writeEditOnOther() {
    let data = Buffer.from(editor.get());
    fs.writeFile(tmpTextPath, data, () => {});
}

ipcRenderer.on("edit", (_event, arg) => {
    switch (arg) {
        case "save":
            pushHistory();
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
            editor.selectAll();
            break;
        case "delete_enter":
            editor.deleteEnter();
            break;
        case "show_find":
            showFind();
            break;
        case "show_history":
            showHistory();
            break;
        case "edit_on_other":
            editOnOtherType = "o";
            editOnOther();
            break;
        case "choose_editer":
            editOnOtherType = "c";
            editOnOther();
            break;
        case "wrap":
            wrap();
            break;
        case "spellcheck":
            spellcheck();
            break;
        case "link":
            var url = editor.selections.get();
            openLink("url", url);
            break;
        case "search":
            openLink("search");
            break;
        case "translate":
            openLink("translate");
            break;
    }
});

// ctrl滚轮控制字体大小

const hotkeys = require("hotkeys-js");
hotkeys.filter = () => {
    return true;
};
hotkeys("ctrl+0", () => {
    setFontSize(默认字体大小);
});

import { t, lan } from "../../../lib/translate/translate";
lan(store.get("语言.语言"));
document.title = t(document.title);

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });

/**
 * 统计字数
 */
function countWords() {
    let text = editor.get();
    let p = text.trim().match(/\n+/g)?.length + 1 || 1;
    text = text.replace(/[\n\r]/g, "");
    let c = [...segmenter.segment(text)].length;
    let cSpace = c - text.match(/\s/g)?.length || 0;
    let cjkRg = /[\u2E80-\uFE4F]/g;
    let cjk = text.match(cjkRg)?.length || 0;
    text = text.replace(cjkRg, "").replace(/['";:,.?¿\-!¡，。？！、……：“‘【《》】’”]+/g, " ");
    let nCjk = text.match(/\S+/g)?.length || 0;
    document.getElementById("count").innerText = `${cjk + nCjk} ${t("字")}`;
    document.getElementById("count").title = `${t("段落")} ${p}\n${t("字符")} ${c}\n${t("非空格字符")} ${cSpace}\n${t(
        "汉字"
    )} ${cjk}\n${t("非汉字词")} ${nCjk}`;
}

/************************************失焦关闭 */

window.onblur = () => {
    if (store.get("关闭窗口.失焦.主页面")) ipcRenderer.send("main_win", "close");
};

/************************************浏览器 */

document.body.className = "fill_t";

var liList = [];

ipcRenderer.on("url", (_event, id: number, arg: string, arg1: any) => {
    if (arg == "new") {
        newTab(id, arg1);
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

ipcRenderer.on("html", (_e, h: string) => {
    document.getElementById("tabs").innerHTML = h;
    document
        .getElementById("tabs")
        .querySelectorAll("li")
        .forEach((li) => {
            绑定li(li);
            liList.push(li);
        });
    document.getElementById("buttons").onclick = (e) => {
        mainEvent(e);
    };
    if (document.getElementById("tabs").querySelector("li")) document.getElementById("tabs").classList.add("tabs_show");
});

function 绑定li(li: HTMLLIElement) {
    let id = Number(li.id.replace("id", ""));
    li.onmouseup = (e) => {
        if (e.button == 0) {
            focusTab(li);
        } else {
            closeTab(li, id);
        }
    };
    let button = li.querySelector("button");
    button.onclick = (e) => {
        e.stopPropagation();
        closeTab(li, id);
    };
}

function newTab(id: number, url: string) {
    let li = <HTMLLIElement>document.getElementById("tab").cloneNode(true);
    liList.push(li);
    li.style.display = "flex";
    li.setAttribute("data-url", url);
    document.getElementById("tabs").appendChild(li);
    li.id = "id" + id;
    绑定li(li);
    focusTab(li);

    if (store.get("浏览器.标签页.小")) {
        li.classList.add("tab_small");
    }
    if (store.get("浏览器.标签页.灰度")) {
        li.classList.add("tab_gray");
    }
}

function closeTab(li: HTMLElement, id: number) {
    ipcRenderer.send("tab_view", id, "close");
    var l = document.querySelectorAll("li");
    for (let i in l) {
        if (l[i] === li && document.querySelector(".tab_focus") === li) {
            // 模板排除
            if (Number(i) == l.length - 2) {
                focusTab(l[l.length - 3]);
            } else {
                focusTab(l[i + 1]);
            }
        }
    }
    document.getElementById("tabs").removeChild(li);
    if (document.getElementById("tabs").querySelectorAll("li").length == 0) {
        document.getElementById("tabs").classList.remove("tabs_show");
    }
}

function focusTab(li: HTMLElement) {
    var l = document.querySelectorAll("li");
    for (let i of l) {
        if (i === li) {
            i.classList.add("tab_focus");
        } else {
            i.classList.remove("tab_focus");
        }
    }
    for (let j in liList) {
        if (liList[j] === li) {
            liList.splice(Number(j), 1);
            liList.push(li);
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
        document.getElementById(`id${id}`).querySelector(`img`).src = reloadSvg;
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
    mainEvent(e);
};
function mainEvent(e: MouseEvent | any) {
    var id = liList.at(-1).id.replace("id", "");
    let el = <HTMLElement>e.target;
    if (el.id == "browser") {
        openInBrowser();
    } else if (el.id == "add_history") {
        historyStore.set(`历史记录.${new Date().getTime()}`, {
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

function openInBrowser() {
    var url = document.querySelector(".tab_focus").getAttribute("data-url");
    shell.openExternal(url);
    if (store.get("浏览器.标签页.自动关闭")) {
        var id = Number(document.querySelector(".tab_focus").id.replace("id", ""));
        closeTab(document.querySelector(".tab_focus"), id);
    }
}

ipcRenderer.on("view_events", (_event, arg) => {
    var e = { target: { id: arg } };
    mainEvent(e);
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

function searchImg(img: string, type: "baidu" | "yandex" | "google", callback: Function) {
    img = img.replace(/^data:image\/\w+;base64,/, "");
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
function post(url: string, options: RequestInit, cb: (err: Error, result: any) => {}) {
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

function baidu(image: string, callback: (err: Error, url: string) => {}) {
    let form = new FormData();
    let bstr = window.atob(image);
    let n = bstr.length;
    let u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    form.append("image", new Blob([u8arr], { type: "image/png" }), "eSearch.png");
    form.append("from", "pc");
    post("https://graph.baidu.com/upload", { body: form }, (err, result) => {
        if (err) return callback(err, null);
        if (result.msg != "Success") return callback(new Error(JSON.stringify(err)), null);
        console.log(result.data.url);
        return callback(null, result.data.url);
    });
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

function ocr(
    img: string,
    type: string | "baidu" | "youdao",
    callback: (error: any, r: { raw: ocrResult; text: string }) => void
) {
    addOcrPhoto(img);
    if (type == "baidu" || type == "youdao") {
        onlineOcr(type, img, (err, r) => {
            return callback(err, r);
        });
    } else {
        localOcr(type, img, (err, r) => {
            return callback(err, r);
        });
    }
}

/**
 * 离线OCR
 * @param {String} arg 图片base64
 * @param {Function} callback 回调
 */
async function localOcr(
    type: string,
    arg: string,
    callback: (error: Error, result: { raw: ocrResult; text: string }) => void
) {
    try {
        let l: [string, string, string, string, any];
        for (let i of store.get("离线OCR")) if (i[0] == type) l = i;
        function ocrPath(p: string) {
            return path.join(path.isAbsolute(p) ? "" : path.join(__dirname, "../../ocr/ppocr"), p);
        }
        let detp = ocrPath(l[1]),
            recp = ocrPath(l[2]),
            字典 = ocrPath(l[3]);
        console.log(detp, recp, 字典);
        const lo = require("esearch-ocr") as typeof import("esearch-ocr");
        const ort = require("onnxruntime-node");
        await lo.init({
            detPath: detp,
            recPath: recp,
            dic: fs.readFileSync(字典).toString(),
            ...l[4],
            node: true,
            detShape: [640, 640],
            ort,
        });
        let img = document.createElement("img");
        img.src = arg;
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
                    let ll = [];
                    for (let i of l) {
                        ll.push({ box: i.box, text: i.text });
                    }
                    callback(null, { raw: ll, text: t });
                })
                .catch((e) => {
                    callback(e, null);
                });
        };
    } catch (error) {
        callback(error, null);
    }
}

/**
 * 在线OCR
 * @param {String} type 服务提供者
 * @param {String} arg 图片base64
 * @param {Function} callback 回调
 */
function onlineOcr(
    type: string,
    arg: string,
    callback: (error: string, result: { raw: ocrResult; text: string }) => void
) {
    arg = arg.replace("data:image/png;base64,", "");

    var clientId = store.get(`在线OCR.${type}.id`),
        clientSecret = store.get(`在线OCR.${type}.secret`);
    if (!clientId || !clientSecret) return callback("未填写 API Key 或 Secret Key", null);
    switch (type) {
        case "baidu":
            baiduOcr();
            break;
        case "youdao":
            youdaoOcr();
            break;
    }

    function baiduOcr() {
        if (!store.get("在线OCR.baidu.token") || store.get("在线OCR.baidu.time") < new Date().getTime())
            fetch(
                `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
                { method: "GET" }
            )
                .then((t) => t.json())
                .then((result) => {
                    const access_token = result?.access_token;
                    console.log(access_token);
                    if (!access_token) {
                        if (result.error) {
                            if (result["error_description"] === "unknown client id") {
                                return callback("API Key 错误", null);
                            }
                            if (result["error_description"] === "Client authentication failed")
                                return callback("Secret Key 错误", null);
                        }
                        return callback(JSON.stringify(result), null);
                    }
                    store.set("在线OCR.baidu.token", access_token);
                    store.set("在线OCR.baidu.time", new Date().getTime() + result.expires_in * 1000);
                    ocrGet(access_token);
                });
        else {
            ocrGet(store.get("在线OCR.baidu.token"));
        }

        function ocrGet(token: string) {
            fetch(`${store.get(`在线OCR.${type}.url`)}?access_token=${token}`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({ image: arg, paragraph: "true", cell_contents: "true" }).toString(),
            })
                .then((v) => v.json())
                .then((result) => {
                    baiduFormat(result);
                });
        }

        function baiduFormat(result) {
            if (result.error_msg || result.error_code) return callback(JSON.stringify(result), null);

            if (result.tables_result) {
                let tables: string[] = [];
                for (let i of result.tables_result) {
                    let m: string[][] = [];
                    for (let c of i.body) {
                        if (!m[c.row_start]) m[c.row_start] = [];
                        m[c.row_start][c.col_start] = c.words;
                    }
                    let body = m.map((row) => row.map((i) => i.replaceAll("\n", "")).join("\t")).join("\n");
                    let r = [i.header.words, body, i.footer.words];
                    tables.push(r.flat().join("\n"));
                }
                return callback(null, { raw: [], text: tables.join("\n") });
            }

            var outputL = [];
            if (!result.paragraphs_result) {
                for (i of result.words_result) {
                    outputL.push((<any>i).words);
                }
            } else {
                for (i in result.paragraphs_result) {
                    outputL[i] = "";
                    for (let ii in result.paragraphs_result[i]["words_result_idx"]) {
                        outputL[i] += result.words_result[result.paragraphs_result[i]["words_result_idx"][ii]].words;
                    }
                }
            }
            let output = outputL.join("\n");
            console.log(output);
            let r: ocrResult = [];
            if (result.words_result[0]?.location)
                for (i of result.words_result) {
                    let l = (<any>i).location as { top: number; left: number; width: number; height: number };
                    r.push({
                        box: [
                            [l.left, l.top],
                            [l.left + l.width, l.top],
                            [l.left + l.width, l.top + l.height],
                            [l.left, l.top + l.height],
                        ],
                        text: (<any>i).words,
                    });
                }

            return callback(null, { raw: r, text: output });
        }
    }

    function youdaoOcr() {
        const crypto = require("crypto") as typeof import("crypto");
        let input = arg.length >= 20 ? arg.slice(0, 10) + arg.length + arg.slice(-10) : arg;
        let curtime = String(Math.round(new Date().getTime() / 1000));
        let salt = crypto.randomUUID();
        let sign = crypto
            .createHash("sha256")
            .update(clientId + input + salt + curtime + clientSecret)
            .digest("hex");
        let data = {
            img: arg,
            langType: "auto",
            detectType: "10012",
            imageType: "1",
            appKey: clientId,
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
            if (result.errorCode != "0") return callback(JSON.stringify(result), null);
            let r: ocrResult = [];
            var textL = [];
            for (i of result.Result.regions) {
                var t = "";
                for (let j of (<any>i).lines) {
                    let p = j.boundingBox as string;
                    let pl = p.split(",").map((x) => Number(x));
                    r.push({
                        box: [
                            [pl[0], pl[1]],
                            [pl[2], pl[3]],
                            [pl[4], pl[5]],
                            [pl[6], pl[7]],
                        ],
                        text: j.text,
                    });
                    t += j.text;
                }
                textL.push(t);
            }
            let text = textL.join("\n");
            console.log(text);
            return callback(null, { raw: r, text });
        }
    }
}
// online_ocr();

const imageB = document.getElementById("image_b");
const dropEl = document.getElementById("drop");
const imgsEl = document.getElementById("img_view");
const uploadPel = document.getElementById("file_input");
const uploadEl = document.getElementById("upload") as HTMLInputElement;
const runEl = document.getElementById("run");
const ocr引擎 = <HTMLSelectElement>document.getElementById("ocr引擎");

imageB.onclick = () => {
    document.body.classList.toggle("image_main");
};

dropEl.ondragover = (e) => {
    e.preventDefault();
};
dropEl.ondrop = (e) => {
    e.preventDefault();
    putDatatransfer(e.dataTransfer);
};
dropEl.onpaste = (e) => {
    e.preventDefault();
    putDatatransfer(e.clipboardData);
};
uploadPel.onclick = () => {
    uploadEl.click();
};
uploadEl.onchange = () => {
    let files = uploadEl.files;
    for (let f of files) {
        let type = f.type.split("/")[0];
        if (type != "image") continue;
        let reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => {
            let el = createImg(reader.result as string);
            imgsEl.append(el);
        };
    }
};
runEl.classList.add("no_run");
runEl.onclick = () => {
    runOcr();
};
document.getElementById("close").onclick = () => {
    output = [];
    imgsEl.innerHTML = "";
};

for (let i of store.get("离线OCR")) {
    let o = document.createElement("option");
    o.innerText = `${i[0]}`;
    o.value = `${i[0]}`;
    ocr引擎.append(o);
}
ocr引擎.insertAdjacentHTML("beforeend", `<option value="baidu">百度</option><option value="youdao">有道</option>`);
ocr引擎.value = store.get("OCR.记住") || store.get("OCR.类型");
document.getElementById("ocr引擎").oninput = () => {
    if (store.get("OCR.记住")) store.set("OCR.记住", ocr引擎.value);
};

/** 拖放数据处理 */
function putDatatransfer(data: DataTransfer) {
    if (data.files.length != 0) {
        for (let f of data.files) {
            let type = f.type.split("/")[0];
            if (type != "image") continue;
            let reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => {
                let el = createImg(reader.result as string);
                imgsEl.append(el);
            };
        }
    } else {
    }
}

function createImg(src: string) {
    let div = document.createElement("div");
    div.classList.add("img_el");
    let image = document.createElement("img");
    image.src = src;
    image.onload = () => {
        image.setAttribute("data-w", String(image.width));
        image.setAttribute("data-h", String(image.height));
    };
    div.append(image);
    return div;
}

function runOcr() {
    output = [];
    imgsEl.querySelectorAll(":scope > div > div").forEach((el: HTMLElement) => {
        el.innerHTML = "";
    });
    let type = ocr引擎.value;
    let imgList = imgsEl.querySelectorAll(":scope > div > img");
    imgList.forEach((el: HTMLImageElement, i) => {
        if (type == "baidu" || type == "youdao") {
            onlineOcr(type, el.src, (_err, r) => {
                addOcrText(r.raw, i);
                addOcrToEditor(r.text, i);
            });
        } else {
            localOcr(type, el.src, (_err, r) => {
                addOcrText(r.raw, i);
                addOcrToEditor(r.text, i);
            });
        }
    });
    function addOcrToEditor(text: string, i: number) {
        output[i] = text;
        if (output.length === imgList.length) {
            editor.push(output.join("\n"));
        }
    }
}

type ocrResult = {
    text: string;
    box: /** lt,rt,rb,lb */ number[][];
}[];

function addOcrText(r: ocrResult, i: number) {
    let img = imgsEl.querySelectorAll("img")[i];
    let canvas = document.createElement("canvas");
    let w = img.naturalWidth,
        h = img.naturalHeight;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0);

    let div = document.createElement("div");
    for (let i of r) {
        if (!i.text) continue;
        let x0 = i.box[0][0];
        let y0 = i.box[0][1];
        let x1 = i.box[2][0];
        let y1 = i.box[2][1];
        let xel = document.createElement("p");
        xel.style.left = `${(x0 / w) * 100}%`;
        xel.style.top = `${(y0 / h) * 100}%`;
        xel.style.width = `${((x1 - x0) / w) * 100}%`;
        xel.style.height = `${((y1 - y0) / h) * 100}%`;
        div.append(xel);
        xel.innerText = i.text;
    }
    img.parentElement.append(div);

    addOcrSelect(div);
}

function addOcrPhoto(base: string) {
    let el = createImg(base);
    imgsEl.append(el);
}

let output = [];
console.log(output);

let ocrTextNodes: Map<HTMLDivElement, Node[]> = new Map();
function addOcrSelect(div: HTMLDivElement) {
    let allTextNodes: Node[] = [];
    const treeWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    let currentNode = treeWalker.nextNode();
    while (currentNode) {
        allTextNodes.push(currentNode);
        currentNode = treeWalker.nextNode();
    }
    console.log(allTextNodes);
    ocrTextNodes.set(div, allTextNodes);
}
document.addEventListener("selectionchange", () => {
    let range = document.getSelection().getRangeAt(0);
    console.log(range);
    let div = (
        range.commonAncestorContainer.nodeName === "DIV"
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement.parentElement
    ) as HTMLDivElement;
    let allTextNodes = ocrTextNodes.get(div);
    if (!allTextNodes) return;
    let startNode = range.startContainer;
    let endNode = range.endContainer;
    let rStartOffset = range.startOffset;
    let rEndOffset = range.endOffset;
    if (endNode.nodeName === "P") {
        let lastText = endNode.previousSibling.childNodes[0];
        endNode = lastText;
        rEndOffset = lastText.textContent?.length;
    }
    let start = 0;
    let end = 0;
    let startOk = false;
    let endOk = false;
    let sourceText = "";
    allTextNodes.forEach((node) => {
        if (startNode === node) {
            start += rStartOffset;
            startOk = true;
        } else {
            if (!startOk) start += node.textContent.length;
        }
        if (endNode === node) {
            end += rEndOffset;
            endOk = true;
        } else {
            if (!endOk) end += node.textContent.length;
        }
        sourceText += node.textContent;
    });
    if (start > end) [start, end] = [end, start];
    console.log(start, end);

    let diff = dmp.diff_main(sourceText, editor.get());
    console.log(diff);
    let source: number[] = [0];
    let map: number[] = [0];
    if (diff.at(-1)[0] === 1) diff.push([0, ""]);
    let p0 = 0,
        p1 = 0;
    for (let i = 0; i < diff.length; i++) {
        let d = diff[i];
        let dn = diff[i + 1];
        if (d[0] === -1 && dn && dn[0] === 1) {
            p0 += d[1].length;
            p1 += dn[1].length;
            source.push(p0);
            map.push(p1);
            i++;
            continue;
        } else {
            if (d[0] === 0) {
                p0 += d[1].length;
                p1 += d[1].length;
                source.push(p0);
                map.push(p1);
            } else if (d[0] === 1) {
                p1 += d[1].length;
                source.push(p0);
                map.push(p1);
            } else if (d[0] === -1) {
                p0 += d[1].length;
                source.push(p0);
                map.push(p1);
            }
        }
    }
    map.push(editor.get().length);
    console.log(source, map);
    let editorStart = 0,
        editorEnd = 0;
    for (let i = 0; i < source.length; i++) {
        if (source[i] <= start && start <= source[i + 1]) {
            editorStart = Math.min(map[i] + (start - source[i]), map[i + 1]);
        }
        if (source[i] <= end && end <= source[i + 1]) {
            editorEnd = Math.min(map[i] + (end - source[i]), map[i + 1]);
        }
    }
    editor.selections.clearAll();
    editor.selections.add({ start: editorStart, end: editorEnd });
});

import diff_match_patch from "diff-match-patch";
var dmp = new diff_match_patch();

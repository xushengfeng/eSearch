/// <reference types="vite/client" />

import store from "../../../lib/store/renderStore";
import type { MainWinType, setting } from "../../ShareTypes";
import { tLog } from "xtimelog";
import { view, txt, ele, button, image, p } from "dkh-ui";
import initStyle from "../root/root";
import hotkeys from "hotkeys-js";
import time_format from "../../../lib/time_format";
import openWith from "../../../lib/open_with";
import { t, lan } from "../../../lib/translate/translate";
import diff_match_patch from "diff-match-patch";
const { ipcRenderer, shell, clipboard } =
    require("electron") as typeof import("electron");
const fs = require("node:fs") as typeof import("fs");
const os = require("node:os") as typeof import("os");
const path = require("node:path") as typeof import("path");

const tmpTextPath = path.join(
    os.tmpdir(),
    `/eSearch/eSearch_${new Date().getTime()}.txt`,
);

import closeSvg from "../assets/icons/close.svg";
import reloadSvg from "../assets/icons/reload.svg";

/**撤销 */
// 定义撤销栈
const undoStack = [""];
// 定义位置
let undoStackI = 0;

let lineHeight = 24;

let windowName = "";
let mainText = "";
const 自动搜索 = store.get("自动搜索");
const 自动打开链接 = store.get("自动打开链接");
const 自动搜索中文占比 = store.get("自动搜索中文占比");

let editBarS = false;
let isWrap = !store.get("编辑器.自动换行");
let isCheck = !store.get("编辑器.拼写检查");
let findShow = false;
let findRegex = false;

let tmpText: string;

let findLNI = 0;

let historyList: { [key: string]: { text: string } } = {};

let historyShowed = false;

let editOnOtherType = null;
let fileWatcher = null;

let editingOnOther = false;

let alwaysOnTop = false;

let blurToClose = store.get("主页面.失焦关闭");

let concise = store.get("主页面.简洁模式");

let lo: import("esearch-ocr").initType;

let output = [];

const 浏览器打开 = store.get("浏览器中打开");

const 默认字体大小 = store.get("字体.大小");

const editBEl = document.getElementById("edit_b");

const barLink = document.getElementById("link_bar");
const barExcel = document.getElementById("excel_bar");
const barMdTable = document.getElementById("md_table_bar");

const editTools: setting["编辑器"]["工具"] = store.get("编辑器.工具") || [];

const hotkeyMap: { [key in keyof setting["主页面快捷键"]]: () => void } = {
    搜索: () => edit("search"),
    翻译: () => edit("translate"),
    打开链接: () => edit("link"),
    删除换行: () => edit("delete_enter"),
    图片区: () => imageB.click(),
    关闭: closeWindow,
};

const editToolsF: { [name: string]: () => void } = {};

const findInput = <HTMLInputElement>document.getElementById("find_input");
const replaceInput = <HTMLInputElement>document.getElementById("replace_input");
const findT = <HTMLElement>document.querySelector(".find_t > span");

const mainType: "auto" | "search" | "translate" = store.get("主页面.模式");

const 搜索引擎List = store.get("引擎.搜索") as setting["引擎"]["搜索"];
const 翻译引擎List = store.get("引擎.翻译") as setting["引擎"]["翻译"];
const 引擎 = store.get("引擎") as setting["引擎"];

const searchSelect = document.getElementById("search_s") as HTMLSelectElement;
const translateSelect = document.getElementById(
    "translate_s",
) as HTMLSelectElement;

const 历史记录设置 = store.get("历史记录设置");

const historyListEl = document.getElementById("history_list");

const task = new tLog("e");

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });

const alwaysOnTopEl = document.getElementById("top_b");
const blurToCloseEl = document.getElementById("ding_b");
const conciseEl = document.getElementById("concise_b");

const mainEl = document.querySelector(".main") as HTMLElement;

const body = document.querySelector(".fill_t");
const liList = [];

const imageB = document.getElementById("image_b");
const dropEl = document.getElementById("drop");
const imgsEl = document.getElementById("img_view");
const uploadPel = document.getElementById("file_input");
const uploadEl = document.getElementById("upload") as HTMLInputElement;
const runEl = document.getElementById("run");
const ocr引擎 = <HTMLSelectElement>document.getElementById("ocr引擎");

const imageShow = "image_main";

const ocrTextNodes: Map<HTMLDivElement, Node[]> = new Map();

const dmp = new diff_match_patch();

/**
 * 添加到撤销栈
 * @returns none
 */
function stackAdd() {
    if (undoStack[undoStackI] === editor.get()) return;
    // 撤回到中途编辑，把撤回的这一片与编辑的内容一起放到末尾
    if (undoStackI !== undoStack.length - 1)
        undoStack.push(undoStack[undoStackI]);
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
            editorChange();
        };

        this.text.addEventListener("keydown", (e) => {
            const l = ["Tab", "Insert"];
            if (!l.includes(e.key)) return;
            e.preventDefault();
            switch (e.key) {
                case "Tab":
                    this.text.setRangeText("\t");
                    this.text.selectionStart = this.text.selectionEnd =
                        this.text.selectionStart + 1;
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
                        new CustomEvent("select2", {
                            detail: {
                                button: e.button,
                                d: this.text.selectionDirection,
                            },
                        }),
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
        const t = editor.selections.get();
        clipboard.writeText(t);
    }
    cut() {
        this.copy();
        this.delete();
    }
    paste() {
        const t = clipboard.readText();
        editor.selections.replace(t);
    }
    selectAll() {
        this.selections.clearAll();
        this.selections.add({
            start: 0,
            end: editor.get().length,
        });
        const r = this.selections.rect(this.selections.getS())[0];
        showEditBar(r.x, r.top + lineHeight, false);
    }
    deleteEnter() {
        const s = editor.selections.getS();
        const t = editor.selections.get(s);
        let ot = "";
        for (let i = 0; i < t.length; i++) {
            if (t[i] === "\n") {
                // 换行
                if (t?.[i - 1]?.match(/[。？！……”】》）).?!";；]/)) {
                    // 结尾
                    ot += t[i];
                } else {
                    if (
                        t?.[i - 1]?.match(/[\u4e00-\u9fa5]/) &&
                        t?.[i + 1]?.match(/[\u4e00-\u9fa5]/)
                    ) {
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

type selection2 = {
    start: { pg: number; of: number };
    end: { pg: number; of: number };
};
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
        return {
            start: editor.text.selectionStart,
            end: editor.text.selectionEnd,
        };
    }

    clearAll() {
        editor.text.setSelectionRange(0, 0);
    }

    s2ns(rs: selection2) {
        const s = formatSelection2(rs);
        const l = editor.l();
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
        return {
            start: Math.min(start, end),
            end: Math.max(start, end),
        } as selection;
    }

    ns2s(start: number, end: number) {
        const s = { pg: Number.NaN, of: Number.NaN };
        const e = { pg: Number.NaN, of: Number.NaN };
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
        const l = [];
        l.push(editor.get(s || this.getS()));
        return l.join("\n");
    }

    replace(text: string, s: selection = this.getS()) {
        editor.text.setSelectionRange(s.start, s.end);
        editor.text.setRangeText(text);
        s.end = s.start + text.length;
    }

    rect(s: selection) {
        const textNodes: HTMLElement[] = [];
        const l = editor.text.value.split("\n");
        editor.positionEl.innerText = "";
        for (const text of l) {
            const div = document.createElement("div");
            div.innerText = text;
            div.style.minHeight = `${lineHeight}px`;
            textNodes.push(div);
            editor.positionEl.append(div);
        }
        const ps = this.ns2s(s.start, s.end);
        const range = new Range();
        const rectL: DOMRect[] = [];
        setR(
            textNodes[ps.start.pg],
            ps.start.of,
            textNodes[ps.end.pg],
            ps.end.of,
        );
        setR(
            textNodes[ps.start.pg],
            ps.start.of,
            textNodes[ps.start.pg],
            ps.start.of,
        );
        setR(textNodes[ps.end.pg], ps.end.of, textNodes[ps.end.pg], ps.end.of);
        function setR(
            start: HTMLElement,
            so: number,
            end: HTMLElement,
            eo: number,
        ) {
            range.setStart(start.firstChild || start, so);
            range.setEnd(end.firstChild || end, eo);
            document.getSelection().removeAllRanges();
            document.getSelection().addRange(range);
            rectL.push(
                document.getSelection().getRangeAt(0).getBoundingClientRect(),
            );
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
                // biome-ignore lint: regex解析
                text = eval(`/${stext}/g`);
                document.getElementById("find_input").style.outline = "none";
            } catch (error) {
                document.getElementById("find_input").style.outline =
                    "red  solid 1px";
            }
        } else {
            const sstext = stext.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            text = new RegExp(sstext, "g"); // 自动转义，找文字
        }
        return text;
    }

    find(text: string | RegExp) {
        if (!tmpText) tmpText = editor.get();
        // 拆分
        const matchL = tmpText.match(text);
        const textL = tmpText.split(text);
        const tL: selection[] = [];
        let n = 0;
        // 交替插入
        for (const i in textL) {
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
        const text = this.editor.text.value;
        const ranges = s.sort((a, b) => a.start - b.start);
        for (let i = 0; i < ranges.length; i++) {
            const span = document.createElement("span");
            span.innerText = text.slice(ranges[i].start, ranges[i].end);
            if (span.innerText) span.classList.add("find_h");
            let after = "";
            if (i === ranges.length - 1)
                after = text.slice(ranges[i].end, text.length);
            const beforeEl = document.createElement("span");
            beforeEl.innerText = text.slice(
                ranges?.[i - 1]?.end || 0,
                ranges[i].start,
            );
            const afterEl = document.createElement("span");
            afterEl.innerText = after;
            this.editor.findEl.append(beforeEl, span, afterEl);
        }
    }

    replace(s: selection, match: string | RegExp, text: string) {
        editor.selections.clearAll();
        editor.selections.add(s);
        const mtext = editor.get(s).replace(match, text);
        editor.selections.replace(mtext, editor.selections.getS());
    }
}

const editor = new xeditor(document.getElementById("text"));

editor.push("");

function formatSelection2(s: selection2) {
    let tmp: selection2 = {
        start: { pg: Number.NaN, of: Number.NaN },
        end: { pg: Number.NaN, of: Number.NaN },
    };
    if (s.end.pg === s.start.pg) {
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

/**
 * 每次更改光标触发
 */
function editorChange() {
    lineNum();
    stackAdd();
    setTextAreaHeight();
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
    const l = editor.text.value.split("\n");
    editor.positionEl.innerText = "";
    let t = "";
    const ly = document.getElementById("line_num").getBoundingClientRect().y;
    for (const i in l) {
        const text = l[i];
        const div = document.createElement("div");
        div.innerText = text;
        div.style.minHeight = `${lineHeight}px`;
        editor.positionEl.append(div);
        const rect = div.getBoundingClientRect();
        t += `<div style="top:${rect.y - ly}px">${Number(i) + 1}</div>`;
    }
    document.getElementById("line_num").innerHTML = t;
    document.getElementById("line_num").style.width =
        `${String(l.length).length}ch`;
}
lineNum();

document.getElementById("line_num").onmousedown = (e) => {
    e.stopPropagation();
    const el = <HTMLElement>e.target;
    if (el === document.getElementById("line_num")) return;
    const lI = Number(el.innerText) - 1;

    const s = {
        start: { pg: lI, of: 0 },
        end: { pg: lI, of: editor.wMax(lI) },
    };
    editor.selections.clearAll();
    editor.selections.add(editor.selections.s2ns(s));
};
document.getElementById("line_num").onmouseup = (_e) => {
    const s = editor.selections.getS();
    editor.text.setSelectionRange(s.start, s.end);
    editor.text.focus();
};
document.getElementById("text").parentElement.onscroll = () => {
    document.getElementById("line_num").style.top =
        `-${document.getElementById("text").parentElement.scrollTop}px`;
};

/************************************主要 */

/************************************UI */

function setButtonHover(el: HTMLElement, b: boolean) {
    if (b) el.classList.add("hover_b");
    else el.classList.remove("hover_b");
}

/**字体大小 */
document.getElementById("text_out").style.fontSize = `${
    store.get("字体.记住") ? store.get("字体.记住") : 默认字体大小
}px`;

document.onwheel = (e) => {
    if (e.ctrlKey) {
        const d = e.deltaY / Math.abs(e.deltaY);
        const size = Number(
            document
                .getElementById("text_out")
                .style.fontSize.replace("px", ""),
        );
        setFontSize(size - d);
    }
};
function setFontSize(font_size: number) {
    document.getElementById("text_out").style.fontSize = `${font_size}px`;
    lineHeight = font_size * 1.5;
    if (store.get("字体.记住")) store.set("字体.记住", font_size);
    setTimeout(() => {
        lineNum();
        setTextAreaHeight();
    }, 400);
}

function setTextAreaHeight() {
    editor.text.parentElement.style.height = `calc(${editor.positionEl.offsetHeight}px + 100% - 1em)`;
}

/**编辑栏 */
function showEditBar(x: number, y: number, right: boolean) {
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
    if (get !== "" || right) {
        if (editBarS) {
            editBEl.style.transition = "var(--transition)";
        } else {
            editBEl.style.transition = "opacity var(--transition)";
        }
        editBEl.className = "edit_s";
        let nx = x < 0 ? 0 : x;
        const pleft = editBEl.parentElement.getBoundingClientRect().left + 16;
        if (editBEl.offsetWidth + pleft + nx > window.innerWidth)
            nx = window.innerWidth - editBEl.offsetWidth - pleft;
        const ny = y < 0 ? 0 : y;
        editBEl.style.left = `${nx}px`;
        editBEl.style.top = `${ny}px`;
        editBarS = true;
    } else {
        editBEl.className = "edit_h";
        editBarS = false;
    }
}

function hideEditBar() {
    editBarS = true;
    showEditBar(0, 0, false);
}

editor.text.addEventListener("select2", (e: CustomEvent) => {
    const dir = e.detail.d as HTMLTextAreaElement["selectionDirection"];
    const rect = editor.selections.rect(editor.selections.getS());
    let r: DOMRect;
    if (dir === "backward") {
        r = rect[1];
    } else {
        r = rect[2];
    }
    const d = editor.rendererEl.getBoundingClientRect();
    const x = r.x - d.x;
    const y = r.y - d.y;
    if (e.detail.button === 2) {
        showEditBar(x, y + lineHeight, true);
    } else {
        if (editor.selections.get() === "") {
            hideEditBar();
        } else {
            showEditBar(x, y + lineHeight, false);
        }
    }
});

hotkeys.filter = () => {
    return true;
};

hotkeys("ctrl+a", () => {
    editor.selectAll();
});

for (const i in hotkeyMap) {
    const key = store.get(`主页面快捷键.${i}`);
    if (key) {
        hotkeys(key, hotkeyMap[i]);
    }
}

for (const i of editTools) {
    const iel = view().add(txt(i.name));
    const f = () => {
        const s = editor.selections.getS();
        let t = editor.selections.get(s);

        for (const regex of i.regex) {
            const r = new RegExp(regex.r, "g");
            t = t.replace(r, regex.p);
        }

        editor.selections.replace(t, s);
    };
    editToolsF[i.name] = f;
    hotkeys(i.key, f);
    editBEl.append(iel.el);
}

editBEl.onmousedown = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const el = <HTMLElement>e.target;
    const tool = editTools.find((i) => i.name === el.getAttribute("data-name"));
    if (tool) {
        editToolsF[tool.name]();
    } else {
        const id = el.id.replace("_bar", "");
        edit(id);
    }
};

wrap();
function wrap() {
    isWrap = !isWrap;
    if (isWrap) {
        document.documentElement.style.setProperty("--wrap", "pre-wrap");
    }
    for (const el of document
        .querySelectorAll(".text > *")
        .values() as Iterable<HTMLElement>) {
        el.style.width = isWrap ? "100%" : "";
    }
    setTextAreaHeight();
    lineNum();
}

spellcheck();
function spellcheck() {
    isCheck = !isCheck;
    document.getElementById("text").spellcheck = isCheck;
}

/**
 * 查找与替换
 */

// 查找ui
function showFind() {
    findShow = !findShow;
    if (findShow) {
        document.getElementById("top").style.marginTop = "48px";
        document.getElementById("find").style.transform = "translateY(0)";
        document.getElementById("find").style.pointerEvents = "auto";
        findInput.value = editor.selections.get();
        findInput.select();
        findInput.focus();
        if (editor.selections.get() !== "") find_();
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
document.getElementById("find_b_regex").onclick = () => {
    findRegex = !findRegex;
    if (findRegex) {
        document.getElementById("find_b_regex").style.backgroundColor =
            "var(--hover-color)";
    } else {
        document.getElementById("find_b_regex").style.backgroundColor = "";
    }
    find_();
    findInput.focus();
};

document.getElementById("find_input").oninput = () => {
    // 清除样式后查找
    exitFind();
    find_();
};
// 查找并突出
function find_() {
    const match = editor.find.matchx(findInput.value, findRegex);
    const find_l = editor.find.find(match);
    editor.find.render(find_l);
    findLNI = -1;
    findLN("↓");
    if (findInput.value === "") {
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
function findLN(a: "↑" | "↓") {
    const l = document.querySelectorAll(".find_h");
    if (l.length === 0) {
        findT.innerText = "无结果";
        return;
    }
    if (l[findLNI]) l[findLNI].classList.remove("find_h_h");
    if (a === "↑") {
        if (findLNI > 0) {
            findLNI--;
        } else {
            findLNI = l.length - 1;
        }
    } else if (a === "↓") {
        if (findLNI < l.length - 1) {
            findLNI++;
        } else {
            findLNI = 0;
        }
    }
    l[findLNI].classList.add("find_h_h");
    findT.innerText = `${findLNI + 1}/${l.length}`;
    document.getElementById("text_out").scrollTop =
        (<HTMLElement>l[findLNI]).offsetTop - 48 - 16;
}
document.getElementById("find_b_last").onclick = () => {
    findLN("↑");
};
document.getElementById("find_b_next").onclick = () => {
    findLN("↓");
};
document.getElementById("find_input").onkeydown = (e) => {
    if (e.key === "Enter") {
        if (document.querySelector(".find_h_h")) {
            findLN("↓");
        } else {
            find_();
        }
    }
};

// 全部替换
document.getElementById("find_b_replace_all").onclick = () => {
    const m = editor.find.matchx(findInput.value, findRegex);
    if (!editor.selections.get()) editor.selectAll();
    editor.selections.replace(
        editor.selections.get().replaceAll(m, replaceInput.value),
    );
    exitFind();

    stackAdd();
};
// 替换选中
document.getElementById("find_b_replace").onclick = findReplace;
function findReplace() {
    const m = editor.find.matchx(findInput.value, findRegex);
    const l = editor.find.find(m);
    const s = l[findLNI];
    editor.find.replace(s, m, replaceInput.value);
    findLNI = findLNI - 1;
    const ti = findLNI;
    find_();
    findLNI = ti;
    findLN("↓");

    stackAdd();
}
document.getElementById("replace_input").onkeydown = (e) => {
    if (e.key === "Enter") {
        findReplace();
    }
};

/************************************搜索 */

/**
 * 判断是否为链接
 * @param url 链接
 * @param s 严格模式
 * @returns 是否为链接
 */
function isLink(url: string, s: boolean) {
    if (s) {
        const regex =
            /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+(:[0-9]+)?|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/g;
        if (url.match(regex) != null) {
            return true;
        }
        return false;
    }
    // 有.或://就行
    if (
        (url.match(/\./g) != null || url.match(/:\/\//g) != null) &&
        !url.match(/[\n\r]/g)
    ) {
        return true;
    }
    return false;
}
/**
 * 展示文字
 * @param t 展示的文字
 */
function showT(st: string) {
    const t = st.replace(/[\r\n]$/, "");
    editor.push(t);
    if (mainType === "auto" || t === "") {
        // 严格模式
        if (isLink(t, true)) {
            if (自动打开链接) openLink("url", t);
        } else {
            const language =
                t.match(/[\u4e00-\u9fa5]/g)?.length >=
                t.length * 自动搜索中文占比
                    ? "本地语言"
                    : "外语";
            if (自动搜索 && t.match(/[\r\n]/) == null && t !== "") {
                if (language === "本地语言") {
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
function openLink(id: "url" | "search" | "translate", slink?: string) {
    let url = "";
    if (id === "url") {
        let link = slink.replace(/[(^\s)(\s$)]/g, "");
        if (link.match(/\/\//g) == null) {
            link = `https://${link}`;
        }
        url = link;
    } else {
        const s = editor.selections.get() || editor.get(); // 要么全部，要么选中
        url = (<HTMLSelectElement>(
            document.querySelector(`#${id}_s`)
        )).value.replace("%s", encodeURIComponent(s));
    }
    if (typeof global !== "undefined") {
        if (浏览器打开) {
            shell.openExternal(url);
        } else {
            ipcRenderer.send("open_url", windowName, url);
        }
    } else {
        window.open(url);
    }
}

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
    store.set("引擎.记忆.搜索", searchSelect.selectedOptions[0].innerText);
};
document.getElementById("translate_s").oninput = () => {
    openLink("translate");
    store.set("引擎.记忆.翻译", translateSelect.selectedOptions[0].innerText);
};
/**展示搜索引擎选项 */
for (const e of 搜索引擎List) {
    const selected = 引擎.记忆.搜索 === e.name;
    const op = ele("option").add(txt(e.name)).attr({ value: e.url, selected });
    searchSelect.append(op.el);
}
/**展示翻译引擎选项 */
for (const e of 翻译引擎List) {
    const selected = 引擎.记忆.翻译 === e.name;
    const op = ele("option").add(txt(e.name)).attr({ value: e.url, selected });
    translateSelect.append(op.el);
}

/************************************历史记录 */
// 历史记录

// var historyStore = new Store({ name: "history" });
// todo

if (历史记录设置.保留历史记录 && 历史记录设置.自动清除历史记录) {
    const nowTime = new Date().getTime();
    const dTime =
        Math.round(历史记录设置.d * 86400 + 历史记录设置.h * 3600) * 1000;
    for (const i of Object.keys(historyList)) {
        if (nowTime - Number(i) > dTime) {
            // historyStore.delete(`历史记录.${i}`);
        }
    }
}

function pushHistory() {
    const t = editor.get();
    const i = new Date().getTime();
    const s = { text: t };
    if (t !== "" && 历史记录设置.保留历史记录) {
        // historyStore.set(`历史记录.${i}`, s);
        historyList[i] = s;
    }
    renderHistory();
}
// 历史记录界面
document.getElementById("history_b").onclick = showHistory;

function showHistory() {
    if (historyShowed) {
        historyShowed = false;
        historyListEl.style.top = "100%";
    } else {
        historyShowed = true;

        historyListEl.style.top = "0%";

        renderHistory();
    }
    setButtonHover(document.getElementById("history_b"), historyShowed);
}
function renderHistory() {
    let n = {};
    for (const i of Object.keys(historyList).sort()) {
        n[i] = historyList[i];
    }
    historyList = n;
    n = null;
    if (Object.keys(historyList).length === 0)
        historyListEl.innerText = t("暂无历史记录");
    for (const i in historyList) {
        const t = historyList[i].text.split(/[\r\n]/g);
        const div = view().attr({ id: i });
        const text = t.splice(0, 3).join("\n") + (t.length > 3 ? "..." : "");
        const textEl = view().class("history_text").add(txt(text));
        div.add([
            view()
                .class("history_title")
                .add([
                    txt(
                        time_format(
                            store.get("时间格式"),
                            new Date(Number(i) - 0),
                        ),
                    ),
                    button(image(closeSvg, "icon").class("icon")),
                ]),
            textEl,
        ]);
        historyListEl.prepend(div.el);
    }

    // 打开某项历史
    for (const e of document
        .querySelectorAll("#history_list > div > .history_text")
        .values()) {
        e.addEventListener("click", () => {
            editor.push(historyList[e.parentElement.id].text);
            showHistory();
        });
    }
    // 删除某项历史
    // TODO多选
    for (const e of document
        .querySelectorAll("#history_list > div > .history_title > button")
        .values()) {
        e.addEventListener("click", () => {
            // historyStore.delete(`历史记录.${e.parentElement.parentElement.id}`);
            e.parentElement.parentElement.style.display = "none";
        });
    }
}
if (mainText === "") renderHistory();

/************************************引入 */

ipcRenderer.on("init", (_event, _name: number) => {});

ipcRenderer.on("text", (_event, name: string, list: MainWinType) => {
    windowName = name;

    task.l("窗口创建", list.time);

    if (list.type === "text") {
        mainText = list.content;
        showT(mainText);
    }

    if (list.type === "image") {
        editor.push(t("图片上传中……请等候"));
        searchImg(list.content, list.arg0, (err: Error, url: string) => {
            if (url) {
                editor.push("");
                openLink("url", url);
                if (浏览器打开) {
                    closeWindow();
                }
            }
            if (err) editor.push(t("上传错误，请打开开发者工具查看详细错误"));
        });
    }

    if (list.type === "ocr") {
        editor.push(t("文字识别中……请等候"));
        ocr(
            list.content,
            list.arg0,
            (err: Error, r: { raw: ocrResult; text: string }) => {
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

                    const maxLinePhotoShow = store.get("主页面.显示图片区");
                    if (
                        maxLinePhotoShow &&
                        text.split("\n").length >= maxLinePhotoShow
                    ) {
                        if (!body.classList.contains(imageShow)) {
                            imageB.click();
                        }
                    }
                    return;
                }
                console.error(err);

                editor.push(
                    `${t("识别错误")}\n${err}\n${t("请打开开发者工具（Ctrl+Shift+I）查看详细错误")}`,
                );

                mainEvent("home");
            },
        );
    }

    if (list.type === "qr") {
        editor.push(t("QR码识别中……请等候"));
        import("qr-scanner-wechat").then(async (qr) => {
            const img = new Image();
            img.src = list.content;
            const result = await qr.scan(img);
            const text = result.text;
            showT(text || "");
        });
    }
});

initStyle(store);

function editOnOther() {
    editingOnOther = !editingOnOther;
    if (editingOnOther) {
        let data = Buffer.from(editor.get());
        fs.writeFile(tmpTextPath, data, () => {
            if (editOnOtherType === "o") {
                shell.openPath(tmpTextPath);
            } else if (editOnOtherType === "c") {
                openWith(tmpTextPath);
            }
            fileWatcher = fs.watch(tmpTextPath, () => {
                fs.readFile(tmpTextPath, "utf8", (e, data) => {
                    if (e) console.log(e);
                    editor.push(data);
                });
            });
            document.getElementById("text_out").title =
                "正在外部编辑中，双击退出";
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
    const data = Buffer.from(editor.get());
    fs.writeFile(tmpTextPath, data, () => {});
}

async function edit(arg: string) {
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
        case "excel": {
            const text = editor.selections.get();
            const t: string[] = [];
            for (const v of text.split("\n")) {
                const l = v
                    .split("\t")
                    .map((i) => `"${i}"`)
                    .join(",");
                t.push(l);
            }
            // 下载csv
            const blob = new Blob([t.join("\n")], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "eSearch.csv";
            a.click();
            break;
        }
        case "md_table": {
            const table = editor.selections.get();
            const table2: string[] = [];
            table.split("\n").forEach((v, i) => {
                const l = `|${v.replaceAll("\t", "|")}|`;
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
        }
        case "link": {
            const url = editor.selections.get();
            openLink("url", url);
            break;
        }
        case "search":
            openLink("search");
            break;
        case "translate":
            openLink("translate");
            break;
    }
}

ipcRenderer.on("edit", (_event, arg) => {
    edit(arg);
});

// ctrl滚轮控制字体大小

hotkeys("ctrl+0", () => {
    setFontSize(默认字体大小);
});

lan(store.get("语言.语言"));
document.title = t(document.title);

/**
 * 统计字数
 */
function countWords() {
    let text = editor.get();
    const p = text.trim().match(/\n+/g)?.length + 1 || 1;
    text = text.replace(/[\n\r]/g, "");
    const c = [...segmenter.segment(text)].length;
    const cSpace = c - text.match(/\s/g)?.length || 0;
    const cjkRg = /[\u2E80-\uFE4F]/g;
    const cjk = text.match(cjkRg)?.length || 0;
    text = text
        .replace(cjkRg, "")
        .replace(/['";:,.?¿\-!¡，。？！、……：“‘【《》】’”]+/g, " ");
    const nCjk = text.match(/\S+/g)?.length || 0;
    document.getElementById("count").innerText = `${cjk + nCjk} ${t("字")}`;
    document.getElementById("count").title =
        `${t("段落")} ${p}\n${t("字符")} ${c}\n${t("非空格字符")} ${cSpace}\n${t(
            "汉字",
        )} ${cjk}\n${t("非汉字词")} ${nCjk}`;
}

/************************************失焦关闭 */

function closeWindow() {
    ipcRenderer.send("main_win", "close");
}

window.onblur = () => {
    if (blurToClose && !alwaysOnTop) closeWindow();
};

alwaysOnTopEl.onclick = () => {
    alwaysOnTop = !alwaysOnTop;
    setButtonHover(alwaysOnTopEl, alwaysOnTop);
    ipcRenderer.send("main_win", "top", alwaysOnTop);
};

setButtonHover(blurToCloseEl, !blurToClose);
blurToCloseEl.onclick = () => {
    blurToClose = !blurToClose;
    store.set("主页面.失焦关闭", blurToClose);
    setButtonHover(blurToCloseEl, !blurToClose);
};

mainEl.style.transition = "0s";
setConciseMode(concise);
mainEl.style.transition = "";
setButtonHover(conciseEl, concise);
conciseEl.onclick = () => {
    concise = !concise;
    store.set("主页面.简洁模式", concise);
    setButtonHover(conciseEl, concise);
    setConciseMode(concise);
};

function setConciseMode(m: boolean) {
    if (m) {
        mainEl.style.gridTemplateRows = "auto 0";
        mainEl.style.gap = "0";
    } else {
        mainEl.style.gridTemplateRows = "";
        mainEl.style.gap = "";
    }
    const bSize = { top: 0, bottom: 48 };
    if (m) {
        bSize.top =
            // @ts-ignore
            window.navigator.windowControlsOverlay.getTitlebarAreaRect().height;
        bSize.bottom = 0;
    }
    ipcRenderer.send("tab_view", null, "size", bSize);
}

if (!store.get("主页面.高级窗口按钮")) {
    document.body.querySelector("nav").style.height = "0";
    document.body.querySelector("div").style.height = "100%";
    document.body.querySelector("div").style.top = "0";
}

/************************************浏览器 */

body.className = "fill_t";

// biome-ignore lint: 不搞体操了
ipcRenderer.on("url", (_event, id: number, arg: string, arg1: any) => {
    if (arg === "new") {
        newTab(id, arg1);
    }
    if (arg === "title") {
        title(id, arg1);
    }
    if (arg === "icon") {
        icon(id, arg1);
    }
    if (arg === "url") {
        url(id, arg1);
    }
    if (arg === "load") {
        load(id, arg1);
    }
    document.getElementById("tabs").classList.add("tabs_show");
});

ipcRenderer.on("html", (_e, h: string) => {
    document.getElementById("tabs").innerHTML = h;
    for (const li of document
        .getElementById("tabs")
        .querySelectorAll("li")
        .values()) {
        绑定li(li);
        liList.push(li);
    }
    document.getElementById("buttons").onclick = (e) => {
        mainEvent((e.target as HTMLElement).id);
    };
    if (document.getElementById("tabs").querySelector("li"))
        document.getElementById("tabs").classList.add("tabs_show");
});

function 绑定li(li: HTMLLIElement) {
    const id = Number(li.id.replace("id", ""));
    li.onmouseup = (e) => {
        if (e.button === 0) {
            focusTab(li);
        } else {
            closeTab(li, id);
        }
    };
    const button = li.querySelector("button");
    button.onclick = (e) => {
        e.stopPropagation();
        closeTab(li, id);
    };
}

function newTab(id: number, url: string) {
    const li = <HTMLLIElement>document.getElementById("tab").cloneNode(true);
    liList.push(li);
    li.style.display = "flex";
    li.setAttribute("data-url", url);
    document.getElementById("tabs").appendChild(li);
    li.id = `id${id}`;
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
    const l = document.querySelectorAll("li");
    for (const i in l) {
        if (l[i] === li && document.querySelector(".tab_focus") === li) {
            // 模板排除
            if (Number(i) === l.length - 2) {
                focusTab(l[l.length - 3]);
            } else {
                focusTab(l[i + 1]);
            }
        }
    }
    document.getElementById("tabs").removeChild(li);
    if (isTabsEmpty()) {
        document.getElementById("tabs").classList.remove("tabs_show");
    }
}

function isTabsEmpty() {
    return document.getElementById("tabs").querySelectorAll("li").length === 0;
}

function focusTab(li: HTMLElement) {
    const l = document.querySelectorAll("li");
    for (const i of l) {
        if (i === li) {
            i.classList.add("tab_focus");
        } else {
            i.classList.remove("tab_focus");
        }
    }
    for (const j in liList) {
        if (liList[j] === li) {
            liList.splice(Number(j), 1);
            liList.push(li);
        }
    }

    if (li) {
        ipcRenderer.send("tab_view", li.id.replace("id", ""), "top");
        document.title = `eSearch - ${li.querySelector("span").title}`;
        body.classList.add("fill_t_s");
    } else {
        body.classList.remove("fill_t_s");
        document.title = t("eSearch - 主页面");
    }
}

function title(id: number, arg: string) {
    document.querySelector(`#id${id} > span`).innerHTML =
        document.getElementById(`id${id}`).querySelector("span").title =
        document.getElementById(`id${id}`).querySelector("img").title =
            arg;
    if (
        document
            .getElementById(`id${id}`)
            .className.split(" ")
            .includes("tab_focus")
    )
        document.title = `eSearch - ${arg}`;
}

function icon(id: number, arg: Array<string>) {
    document.getElementById(`id${id}`).setAttribute("data-icon", arg[0]);
    document.getElementById(`id${id}`).querySelector("img").src = arg[0];
}

function url(id: number, url: string) {
    document.querySelector(`#id${id}`).setAttribute("data-url", url);
}

function load(id: number, loading: boolean) {
    if (loading) {
        document.querySelector(`#id${id} > img`).classList.add("loading");
        document.getElementById(`id${id}`).querySelector("img").src = reloadSvg;
        document.getElementById("reload").style.display = "none";
        document.getElementById("stop").style.display = "block";
    } else {
        document.querySelector(`#id${id} > img`).classList.remove("loading");
        if (document.getElementById(`id${id}`).getAttribute("data-icon"))
            document.getElementById(`id${id}`).querySelector("img").src =
                document.getElementById(`id${id}`).getAttribute("data-icon");
        document.getElementById("reload").style.display = "block";
        document.getElementById("stop").style.display = "none";
    }
}

document.getElementById("buttons").onclick = (e) => {
    mainEvent((e.target as HTMLElement).id);
};
function mainEvent(eid: string) {
    if (!eid) return;
    if (eid === "browser") {
        openInBrowser();
    } else if (eid === "add_history") {
        // historyStore.set(`历史记录.${new Date().getTime()}`, {
        //     text: document.querySelector(".tab_focus").getAttribute("data-url"),
        // });
    } else if (eid === "home") {
        document.querySelector(".tab_focus").classList.remove("tab_focus");
        body.classList.remove("fill_t_s");
        document.title = t("eSearch - 主页面");
    } else {
        const id = liList.at(-1).id.replace("id", "");
        ipcRenderer.send("tab_view", id, eid);
    }
}

function openInBrowser() {
    const url = document.querySelector(".tab_focus").getAttribute("data-url");
    shell.openExternal(url);
    if (store.get("浏览器.标签页.自动关闭")) {
        const id = Number(
            document.querySelector(".tab_focus").id.replace("id", ""),
        );
        closeTab(document.querySelector(".tab_focus"), id);
        if (isTabsEmpty() && editor.get().trim() === "") closeWindow();
    }
}

ipcRenderer.on("view_events", (_event, arg) => {
    mainEvent(arg);
});

document.getElementById("tabs").onwheel = (e) => {
    e.preventDefault();
    const i = e.deltaX + e.deltaY + e.deltaZ >= 0 ? 1 : -1;
    document.getElementById("tabs").scrollLeft +=
        i * Math.sqrt(e.deltaX ** 2 + e.deltaY ** 2 + e.deltaZ ** 2);
};

window.onbeforeunload = () => {
    document.querySelector(".tab_focus").classList.remove("tab_focus");
    const html = document.getElementById("tabs").innerHTML;
    ipcRenderer.send("tab_view", null, "save_html", html);
};

/************************************以图搜图 */

function searchImg(
    simg: string,
    type: "baidu" | "yandex" | "google" | (string & {}),
    callback: (err: Error, url: string) => void,
) {
    const img = simg.replace(/^data:image\/\w+;base64,/, "");
    switch (type) {
        case "baidu":
            baidu(img, (err, url) => {
                callback(err, url);
            });
            break;
        case "yandex":
            yandex(img, (err, url) => {
                callback(err, url);
            });
            break;
        case "google":
            google(img, (err, url) => {
                callback(err, url);
            });
    }
}

/**
 * @param url
 * @param options
 * @param cb 回调
 */
function post(
    url: string,
    options: RequestInit,
    cb: (err: Error, result) => void,
) {
    fetch(url, Object.assign(options, { method: "POST" }))
        .then((r) => {
            console.log(r);
            return r.json();
        })
        .then((r) => {
            console.log(r);
            cb(null, r);
        })
        .catch((e) => {
            console.error(e);
            cb(e, null);
        });
}

function baidu(image: string, callback: (err: Error, url: string) => void) {
    const form = new FormData();
    const bstr = window.atob(image);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    form.append(
        "image",
        new Blob([u8arr], { type: "image/png" }),
        "eSearch.png",
    );
    form.append("from", "pc");
    post("https://graph.baidu.com/upload", { body: form }, (err, result) => {
        if (err) {
            callback(err, null);
            return;
        }
        if (result.msg !== "Success") {
            callback(new Error(JSON.stringify(err)), null);
            return;
        }
        console.log(result.data.url);
        callback(null, result.data.url);
    });
}

function yandex(image, callback) {
    const b = Buffer.from(image, "base64");
    const url =
        "https://yandex.com/images-apphost/image-download?cbird=111&images_avatars_size=preview&images_avatars_namespace=images-cbir";
    post(url, { body: b }, (err, result) => {
        if (err) return callback(err, null);
        console.log(result);
        const img_url = result.url;
        if (img_url) {
            const b_url = `https://yandex.com/images/search?family=yes&rpt=imageview&url=${encodeURIComponent(
                img_url,
            )}`;
            callback(null, b_url);
        } else {
            callback(new Error(result), null);
        }
    });
}

function google(image, callback) {
    const form = new FormData();
    const bstr = window.atob(image);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    form.append(
        "encoded_image",
        new Blob([u8arr], { type: "image/png" }),
        "eSearch.png",
    );
    form.append("image_content", "");
    const url = `https://lens.google.com/v3/upload?hl=zh-CN&re=df&st=${new Date().getTime()}&vpw=1041&vph=779`;
    fetch(url, {
        method: "POST",
        body: form,
    })
        .then(async (r) => {
            const text = await r.text();
            const tmp = path.join(os.tmpdir(), "eSearch", "google.html");
            fs.writeFileSync(tmp, text);
            callback(null, `file://${tmp}`);
        })
        .catch((err) => {
            if (err) callback(err, null);
        });
}

/************************************OCR */

function ocr(
    img: string,
    type: (string & {}) | "baidu" | "youdao",
    callback: (error: Error, r: { raw: ocrResult; text: string }) => void,
) {
    addOcrPhoto(img);
    if (type === "baidu" || type === "youdao") {
        onlineOcr(type, img, (err, r) => {
            callback(new Error(err), r);
        });
    } else {
        localOcr(type, img, (err, r) => {
            callback(err, r);
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
    callback: (error: Error, result: { raw: ocrResult; text: string }) => void,
) {
    try {
        task.l("ocr_load");
        let l: [string, string, string, string];
        for (const i of store.get("离线OCR")) if (i[0] === type) l = i;
        function ocrPath(p: string) {
            return path.join(
                path.isAbsolute(p)
                    ? ""
                    : path.join(__dirname, "../../ocr/ppocr"),
                p,
            );
        }
        const detp = ocrPath(l[1]);
        const recp = ocrPath(l[2]);
        const 字典 = ocrPath(l[3]);
        console.log(detp, recp, 字典);
        if (!lo) {
            const localOCR =
                require("esearch-ocr") as typeof import("esearch-ocr");
            const ort = require("onnxruntime-node");
            const provider = store.get("AI.运行后端") || "cpu";
            lo = await localOCR.init({
                detPath: detp,
                recPath: recp,
                dic: fs.readFileSync(字典).toString(),
                detShape: [640, 640],
                ort,
                ortOption: { executionProviders: [{ name: provider }] },
            });
        }
        task.l("img_load");
        const img = document.createElement("img");
        img.src = arg;
        img.onload = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d").drawImage(img, 0, 0);
            task.l("ocr_s");
            lo.ocr(
                canvas
                    .getContext("2d")
                    .getImageData(0, 0, img.width, img.height),
            )
                .then((l) => {
                    console.log(l);
                    let t = "";
                    for (const i of l) {
                        t += `${i.text}\n`;
                    }
                    const ll = [];
                    for (const i of l) {
                        ll.push({ box: i.box, text: i.text });
                    }
                    callback(null, { raw: ll, text: t });
                    task.l("ocr_e");
                    task.clear();
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
 * @param {String} sarg 图片base64
 * @param {Function} callback 回调
 */
function onlineOcr(
    type: string,
    sarg: string,
    callback: (error: string, result: { raw: ocrResult; text: string }) => void,
) {
    const arg = sarg.replace("data:image/png;base64,", "");

    const clientId = store.get(`在线OCR.${type}.id`);
    const clientSecret = store.get(`在线OCR.${type}.secret`);
    if (!clientId || !clientSecret)
        return callback("未填写 API Key 或 Secret Key", null);
    switch (type) {
        case "baidu":
            baiduOcr();
            break;
        case "youdao":
            youdaoOcr();
            break;
    }

    function baiduOcr() {
        if (
            !store.get("在线OCR.baidu.token") ||
            store.get("在线OCR.baidu.time") < new Date().getTime()
        )
            fetch(
                `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
                { method: "GET" },
            )
                .then((t) => t.json())
                .then((result) => {
                    const access_token = result?.access_token;
                    console.log(access_token);
                    if (!access_token) {
                        if (result.error) {
                            if (
                                result.error_description === "unknown client id"
                            ) {
                                return callback("API Key 错误", null);
                            }
                            if (
                                result.error_description ===
                                "Client authentication failed"
                            )
                                return callback("Secret Key 错误", null);
                        }
                        return callback(JSON.stringify(result), null);
                    }
                    store.set("在线OCR.baidu.token", access_token);
                    store.set(
                        "在线OCR.baidu.time",
                        new Date().getTime() + result.expires_in * 1000,
                    );
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
                body: new URLSearchParams({
                    image: arg,
                    paragraph: "true",
                    cell_contents: "true",
                }).toString(),
            })
                .then((v) => v.json())
                .then((result) => {
                    baiduFormat(result);
                });
        }

        function baiduFormat(result) {
            if (result.error_msg || result.error_code)
                return callback(JSON.stringify(result), null);

            if (result.tables_result) {
                const tables: string[] = [];
                for (const i of result.tables_result) {
                    const m: string[][] = [];
                    for (const c of i.body) {
                        if (!m[c.row_start]) m[c.row_start] = [];
                        m[c.row_start][c.col_start] = c.words;
                    }
                    const body = m
                        .map((row) =>
                            row.map((i) => i.replaceAll("\n", "")).join("\t"),
                        )
                        .join("\n");
                    const r = [i.header.words, body, i.footer.words];
                    tables.push(r.flat().join("\n"));
                }
                return callback(null, { raw: [], text: tables.join("\n") });
            }

            const outputL = [];
            if (!result.paragraphs_result) {
                for (const i of result.words_result) {
                    outputL.push(i.words);
                }
            } else {
                for (const i in result.paragraphs_result) {
                    outputL[i] = "";
                    for (const ii in result.paragraphs_result[i]
                        .words_result_idx) {
                        outputL[i] +=
                            result.words_result[
                                result.paragraphs_result[i].words_result_idx[ii]
                            ].words;
                    }
                }
            }
            const output = outputL.join("\n");
            console.log(output);
            const r: ocrResult = [];
            if (result.words_result[0]?.location)
                for (const i of result.words_result) {
                    const l = i.location as {
                        top: number;
                        left: number;
                        width: number;
                        height: number;
                    };
                    r.push({
                        box: [
                            [l.left, l.top],
                            [l.left + l.width, l.top],
                            [l.left + l.width, l.top + l.height],
                            [l.left, l.top + l.height],
                        ],
                        text: i.words,
                    });
                }

            return callback(null, { raw: r, text: output });
        }
    }

    function youdaoOcr() {
        const crypto = require("node:crypto") as typeof import("crypto");
        const input =
            arg.length >= 20
                ? arg.slice(0, 10) + arg.length + arg.slice(-10)
                : arg;
        const curtime = String(Math.round(new Date().getTime() / 1000));
        const salt = crypto.randomUUID();
        const sign = crypto
            .createHash("sha256")
            .update(clientId + input + salt + curtime + clientSecret)
            .digest("hex");
        const data = {
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
            if (result.errorCode !== "0")
                return callback(JSON.stringify(result), null);
            const r: ocrResult = [];
            const textL = [];
            for (const i of result.Result.regions) {
                let t = "";
                for (const j of i.lines) {
                    const p = j.boundingBox as string;
                    const pl = p.split(",").map((x) => Number(x));
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
            const text = textL.join("\n");
            console.log(text);
            return callback(null, { raw: r, text });
        }
    }
}
// online_ocr();

imageB.onclick = () => {
    body.classList.toggle(imageShow);
    setButtonHover(imageB, body.classList.contains(imageShow));
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
    const files = uploadEl.files;
    for (const f of files) {
        const type = f.type.split("/")[0];
        if (type !== "image") continue;
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => {
            const el = createImg(reader.result as string);
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

for (const i of store.get("离线OCR")) {
    const o = document.createElement("option");
    o.innerText = `${i[0]}`;
    o.value = `${i[0]}`;
    ocr引擎.append(o);
}
ocr引擎.insertAdjacentHTML(
    "beforeend",
    `<option value="baidu">百度</option><option value="youdao">有道</option>`,
);
ocr引擎.value = store.get("OCR.记住") || store.get("OCR.类型");
document.getElementById("ocr引擎").oninput = () => {
    if (store.get("OCR.记住")) store.set("OCR.记住", ocr引擎.value);
};

/** 拖放数据处理 */
function putDatatransfer(data: DataTransfer) {
    if (data.files.length !== 0) {
        for (const f of data.files) {
            const type = f.type.split("/")[0];
            if (type !== "image") continue;
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => {
                const el = createImg(reader.result as string);
                imgsEl.append(el);
            };
        }
    } else {
    }
}

function createImg(src: string) {
    const div = document.createElement("div");
    div.classList.add("img_el");
    const image = document.createElement("img");
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
    for (const el of imgsEl
        .querySelectorAll(":scope > div > div")
        .values() as Iterable<HTMLDivElement>) {
        el.innerText = "";
    }
    const type = ocr引擎.value;
    const imgList = imgsEl.querySelectorAll(":scope > div > img");
    imgList.forEach((el: HTMLImageElement, i) => {
        if (type === "baidu" || type === "youdao") {
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
    const img = imgsEl.querySelectorAll("img")[i];
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const div = document.createElement("div");
    img.parentElement.append(div);
    for (const i of r) {
        if (!i.text) continue;
        const x0 = i.box[0][0];
        const y0 = i.box[0][1];
        const x1 = i.box[2][0];
        const y1 = i.box[2][1];
        const xel = p(i.text).style({
            left: `${(x0 / w) * 100}%`,
            top: `${(y0 / h) * 100}%`,
            width: `${((x1 - x0) / w) * 100}%`,
            height: `${((y1 - y0) / h) * 100}%`,
        });
        div.append(xel.el);
        const nc = txt(i.text).style({
            "white-space": "nowrap",
            "font-size": "16px",
        });
        xel.add(nc);
        const size = nc.el.getBoundingClientRect();
        xel.data({
            w: `${size.width}`,
            h: `${size.height}`,
        });
        xel.style({ "text-align": "justify", "text-align-last": "justify" });
        nc.el.remove();
    }

    setOcrFontSize();

    addOcrSelect(div);
}

function setOcrFontSize() {
    for (const el of imgsEl.querySelectorAll("p").values()) {
        const w = Number(el.getAttribute("data-w"));
        const elSize = el.getBoundingClientRect();
        let fontSize = 16;
        fontSize = 16 * (elSize.width / w);
        el.style.lineHeight = el.style.fontSize = `${fontSize}px`;
    }
}

window.onresize = () => {
    setOcrFontSize();
    lineNum();
};

function addOcrPhoto(base: string) {
    imgsEl.innerHTML = "";
    const el = createImg(base);
    imgsEl.append(el);
}

console.log(output);

function addOcrSelect(div: HTMLDivElement) {
    const allTextNodes: Node[] = [];
    const treeWalker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    let currentNode = treeWalker.nextNode();
    while (currentNode) {
        allTextNodes.push(currentNode);
        currentNode = treeWalker.nextNode();
    }
    console.log(allTextNodes);
    ocrTextNodes.set(div, allTextNodes);
}

let imageS = false;
imgsEl.onpointerdown = () => {
    imageS = true;
};
imgsEl.onpointerup = () => {
    imageS = false;
    const s = getImgSelect();
    if (!s) return;
    editor.find.render([]);
    editor.selections.clearAll();
    editor.selections.add(s);
    editor.text.focus();
};
imgsEl.onpointermove = () => {
    if (!imageS) return;
    const s = getImgSelect();
    editor.find.render([s]);
};

function getImgSelect() {
    const range = document.getSelection().getRangeAt(0);
    console.log(range);
    const div = (
        range.commonAncestorContainer.nodeName === "DIV"
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement.parentElement
    ) as HTMLDivElement;
    const allTextNodes = ocrTextNodes.get(div);
    if (!allTextNodes) return null;
    const startNode = range.startContainer;
    let endNode = range.endContainer;
    const rStartOffset = range.startOffset;
    let rEndOffset = range.endOffset;
    if (endNode.nodeName === "P") {
        const lastText = endNode.previousSibling.childNodes[0];
        endNode = lastText;
        rEndOffset = lastText.textContent?.length;
    }
    let start = 0;
    let end = 0;
    let startOk = false;
    let endOk = false;
    let sourceText = "";
    for (const node of allTextNodes) {
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
    }
    if (start > end) [start, end] = [end, start];
    console.log(start, end);
    if (start === end) return null;

    const diff = dmp.diff_main(sourceText, editor.get());
    console.log(diff);
    const source: number[] = [0];
    const map: number[] = [0];
    if (diff.at(-1)[0] === 1) diff.push([0, ""]);
    let p0 = 0;
    let p1 = 0;
    for (let i = 0; i < diff.length; i++) {
        const d = diff[i];
        const dn = diff[i + 1];
        if (d[0] === -1 && dn && dn[0] === 1) {
            p0 += d[1].length;
            p1 += dn[1].length;
            source.push(p0);
            map.push(p1);
            i++;
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
    let editorStart = 0;
    let editorEnd = 0;
    for (let i = 0; i < source.length; i++) {
        if (source[i] <= start && start <= source[i + 1]) {
            editorStart = Math.min(map[i] + (start - source[i]), map[i + 1]);
        }
        if (source[i] <= end && end <= source[i + 1]) {
            editorEnd = Math.min(map[i] + (end - source[i]), map[i + 1]);
        }
    }
    return { start: editorStart, end: editorEnd };
}

/// <reference types="vite/client" />

import store from "../../../lib/store/renderStore";
import type { setting } from "../../ShareTypes";
import { tLog } from "xtimelog";
import {
    view,
    txt,
    ele,
    button,
    image,
    p,
    noI18n,
    input,
    select,
    type ElType,
    dynamicSelect,
} from "dkh-ui";
import { initStyle, setTitle, getImgUrl } from "../root/root";
import hotkeys from "hotkeys-js";
import time_format from "../../../lib/time_format";
import openWith from "../../../lib/open_with";
import { t } from "../../../lib/translate/translate";
import diff_match_patch from "diff-match-patch";
// biome-ignore format:
const { shell, clipboard } = require("electron") as typeof import("electron");
const fs = require("node:fs") as typeof import("fs");
const os = require("node:os") as typeof import("os");
const path = require("node:path") as typeof import("path");
import type { FSWatcher } from "node:fs";
import xhistory from "../lib/history";

initStyle(store);

type TabItem = {
    el: ElType<HTMLElement>;
    url: string;
    title: string;
    icon: string;
    setTitle: (t: string) => void;
    setIcon: (i?: string) => void;
};

const tmpTextPath = path.join(
    os.tmpdir(),
    `/eSearch/eSearch_${Date.now()}.txt`,
);

import closeSvg from "../assets/icons/close.svg";
import reloadSvg from "../assets/icons/reload.svg";
import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import type { IconType } from "../../iconTypes";

/**撤销 */
const undoStack = new xhistory<string>([], "", {
    diff: (last, now) => {
        const diff = dmp.diff_main(last, now);
        if (diff.length === 1 && diff[0][0] === 0) return null;
        return diff;
    },
    apply: (data, diff) => {
        const patch = dmp.patch_make(diff);
        return dmp.patch_apply(patch, data)[0];
    },
});

let lineHeight = 24;

let windowName = 0;
let mainText = "";
const 自动搜索 = store.get("自动搜索");
const 自动打开链接 = store.get("自动打开链接");
const 自动搜索中文占比 = store.get("自动搜索中文占比");

let editBarS = false;
let isWrap = !store.get("编辑器.自动换行");
let isCheck = !store.get("编辑器.拼写检查");
let findShow = false;
let findRegex = false;

let tmpText: string | null;

let findLNI = 0;

const historyPath = path.join(
    renderSendSync("userDataPath", []),
    "history.json",
);
let historyList: { [key: string]: { text: string } } = {};
try {
    historyList =
        JSON.parse(fs.readFileSync(historyPath).toString() || "{}").历史记录 ||
        {};
} catch (error) {}

let historyShowed = false;

let editOnOtherType: "o" | "c" | null = null;
let fileWatcher: FSWatcher | null = null;

let editingOnOther = false;

let alwaysOnTop = false;

let blurToClose = store.get("主页面.失焦关闭");

let concise = store.get("主页面.简洁模式");

let lo: import("esearch-ocr").initType;

let output: string[] = [];

const 浏览器打开 = store.get("浏览器中打开");

const 默认字体大小 = store.get("字体.大小");

const tabs = new Map<number, TabItem>();

let focusTabI = 0;

function iconBEl(src: IconType, title: string) {
    return button(image(getImgUrl(`${src}.svg`), "icon").class("icon")).attr({
        title: title,
    });
}

const nav = ele("nav");
const navTop = iconBEl("toptop", "窗口置顶")
    .attr({ id: "top_b" })
    .on("click", () => {
        alwaysOnTop = !alwaysOnTop;
        setButtonHover(navTop, alwaysOnTop);
        renderSend("windowTop", [alwaysOnTop]);
    });
const navDing = iconBEl("ding", "不自动关闭")
    .attr({ id: "ding_b" })
    .on("click", () => {
        blurToClose = !blurToClose;
        store.set("主页面.失焦关闭", blurToClose);
        setButtonHover(navDing, !blurToClose);
    });
const navConcise = iconBEl("concise", "简洁模式")
    .attr({ id: "concise_b" })
    .on("click", () => {
        concise = !concise;
        store.set("主页面.简洁模式", concise);
        setButtonHover(navConcise, concise);
        setConciseMode(concise);
    });
nav.add([navTop, navDing, navConcise]).addInto();

const outMainEl = view().class("fill_t").addInto();

// find ui
const findEl = view()
    .attr({ id: "find" })
    .class("small-size")
    .class("x-like")
    .addInto(outMainEl);
const findCount = view().attr({ id: "count" }).addInto(findEl);

const findButtons = view().class("find_buttons").class("group").addInto(findEl);
iconBEl("up", "上一个匹配")
    .attr({ id: "find_b_last" })
    .addInto(findButtons)
    .on("click", () => {
        findLN("↑");
    });
iconBEl("down", "下一个匹配")
    .attr({
        id: "find_b_next",
    })
    .addInto(findButtons)
    .on("click", () => {
        findLN("↓");
    });
iconBEl("close", "关闭")
    .attr({ id: "find_b_close" })
    .addInto(findButtons)
    .on("click", showFind);

const findInputPel = view().class("find_f").class("group").addInto(findEl);
const findInputEl = input()
    .attr({
        id: "find_input",
        title: "查找",
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: false,
    })
    .addInto(findInputPel);
const findRegexEl = iconBEl("regex", "正则匹配")
    .attr({ id: "find_b_regex" })
    .addInto(findInputPel);

const findReplacePel = view().class("find_s").class("group").addInto(findEl);
const findReplaceEl = input()
    .attr({
        id: "replace_input",
        title: "替换",
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: false,
    })
    .addInto(findReplacePel);
const findReplaceB = iconBEl("replace", "替换")
    .attr({ id: "find_b_replace" })
    .addInto(findReplacePel);
const findReplaceAll = iconBEl("replace_all", "全部替换")
    .attr({ id: "find_b_replace_all" })
    .addInto(findReplacePel);

const findResultEl = txt()
    .addInto(view().class("find_t").addInto(findEl))
    .bindSet((v: [number, number], el) => {
        if (v) {
            el.innerText = `${v[0]} / ${v[1]}`;
        } else {
            el.innerText = "";
        }
    });

// main ui
const mainSectionEl = view().attr({ id: "edit" }).addInto(outMainEl);

// image ui
const ocrImagePel = view().attr({ id: "image" }).addInto(mainSectionEl);

const ocrImageInput = view().attr({ id: "img_input" }).addInto(ocrImagePel);
const ocrImageFile = input("file")
    .attr({ id: "upload", multiple: true })
    .addInto(ocrImageInput);
const ocrImageFileDrop = view()
    .attr({ id: "drop" })
    .class("group")
    .addInto(ocrImageInput)
    .on("dragover", (e) => {
        e.preventDefault();
    })
    .on("drop", (e) => {
        e.preventDefault();
        putDatatransfer(e.dataTransfer);
    })
    .on("paste", (e) => {
        e.preventDefault();
        putDatatransfer(e.clipboardData);
    });
const ocrImageFileDropFileInput = view()
    .attr({ id: "file_input" })
    .add(image(getImgUrl("add.svg"), "upload").class("icon"))
    .addInto(ocrImageFileDrop);
ocrImageFileDrop.add(txt(t("拖拽或粘贴图像到此处")));

const ocrImageTextOutput = view()
    .attr({ id: "text_output" })
    .addInto(ocrImagePel);
const ocrImageEngine = dynamicSelect();
ocrImageEngine.el.attr({ id: "ocr引擎" }).addInto(ocrImageTextOutput);
const ocrImageRun = iconBEl("ocr", "运行OCR")
    .attr({ id: "run" })
    .addInto(ocrImageTextOutput);
const ocrImageClose = iconBEl("close", "清空图片")
    .attr({ id: "close" })
    .addInto(ocrImageTextOutput);

const ocrImageView = view().attr({ id: "img_view" }).addInto(ocrImagePel);

// editor ui
const editorOutEl = view()
    .attr({ id: "top" })
    .addInto(view().class("main").addInto(mainSectionEl));

// text editor ui
const textOut = view()
    .attr({ id: "text_out" })
    .class("x-like")
    .addInto(editorOutEl);

const textLineNum = view().attr({ id: "line_num" }).addInto(textOut);
const mainTextEl = view().attr({ id: "main_text" }).addInto(textOut);
const textEditor = view().attr({ id: "text" }).addInto(mainTextEl);
const editB = view()
    .attr({ id: "edit_b" })
    .class("edit_h")
    .class("bar")
    .addInto(mainTextEl);

const barExcelB = iconBEl("excel", "保存Excel").attr({
    id: "excel_bar",
});
const barMdTableB = iconBEl("md", "复制为md表格").attr({
    id: "md_table_bar",
});
const barLinB = iconBEl("link", "打开链接").attr({ id: "link_bar" });
const barSearchB = iconBEl("search", "搜索").attr({ id: "search_bar" });
const barTranslateB = iconBEl("translate", "翻译").attr({
    id: "translate_bar",
});
const barSelectAllB = iconBEl("select_all", "全选").attr({
    id: "select_all_bar",
});
const barCutB = iconBEl("cut", "剪切").attr({ id: "cut_bar" });
const barCopyB = iconBEl("copy", "复制").attr({ id: "copy_bar" });
const barPasteB = iconBEl("paste", "粘贴").attr({ id: "paste_bar" });
const barDeleteEnterB = iconBEl("delete_enter", "自动删除换行").attr({
    id: "delete_enter_bar",
});
editB.add([
    barExcelB,
    barMdTableB,
    barLinB,
    barSearchB,
    barTranslateB,
    barSelectAllB,
    barCutB,
    barCopyB,
    barPasteB,
    barDeleteEnterB,
]);

// history ui
const historyDialog = ele("dialog").addInto();
const historyEl = view().attr({ id: "history_list" }).addInto(historyDialog);

// buttoms ui
const bottomEl = view().attr({ id: "bottoms" }).addInto(outMainEl);

const browserTabs = view().attr({ id: "tabs" });
const browserTabBs = view()
    .attr({ id: "buttons" })
    .class("group")
    .addInto(browserTabs);
const browserTabHome = iconBEl("main", "回到编辑器").attr({ id: "home" });
const browserTabBack = iconBEl("left", "后退").attr({ id: "back" });
const browserTabForward = iconBEl("right", "前进").attr({ id: "forward" });
const browserTabReload = iconBEl("reload", "刷新").attr({ id: "reload" });
const browserTabStop = iconBEl("close", "停止").attr({ id: "stop" });
const browserTabBrowser = iconBEl("browser", "在浏览器中打开").attr({
    id: "browser",
});
const browserTabAddHistory = iconBEl("add_history", "添加到历史记录").attr({
    id: "add_history",
});
browserTabBs.add([
    browserTabHome,
    browserTabBack,
    browserTabForward,
    browserTabReload,
    browserTabStop,
    browserTabBrowser,
    browserTabAddHistory,
]);

const showImageB = iconBEl("img", "图片").attr({ id: "image_b" });
const showHistoryB = iconBEl("history", "历史记录")
    .attr({
        id: "history_b",
    })
    .on("click", showHistory);

const searchB = iconBEl("search", "搜索").attr({ id: "search_b" });
const searchSelectEl = select([]).attr({
    id: "search_s",
    title: "选择搜索引擎",
});

const translateB = iconBEl("translate", "翻译").attr({
    id: "translate_b",
});
const translateSelectEl = select([]).attr({
    id: "translate_s",
    title: "选择翻译引擎",
});

bottomEl.add([
    browserTabs,
    showImageB,
    showHistoryB,
    view().add([searchB, searchSelectEl]).attr({ id: "search" }).class("group"),
    view()
        .add([translateB, translateSelectEl])
        .attr({ id: "translate" })
        .class("group"),
]);

function tabLi() {
    const li = ele("li").class("b_tab");
    const icon = image(getImgUrl("record.svg"), "icon").class("loading");
    const title = txt().attr({ id: "title" });
    const close = iconBEl("close", "关闭");
    li.add([icon, title, close]);
    return { li, icon, title, close };
}

const editTools = store.get("编辑器.工具") || [];

const hotkeyMap: { [key in keyof setting["主页面快捷键"]]: () => void } = {
    搜索: () => edit("search"),
    翻译: () => edit("translate"),
    打开链接: () => edit("link"),
    删除换行: () => edit("delete_enter"),
    图片区: () => showImageB.el.click(),
    关闭: closeWindow,
};

const editToolsF: { [name: string]: () => void } = {};

const 搜索引擎List = store.get("引擎.搜索");
const 翻译引擎List = store.get("引擎.翻译");
const 引擎 = store.get("引擎");

const 历史记录设置 = store.get("历史记录设置");

const task = new tLog("e");

const language = store.get("语言.语言");
const chartSeg = new Intl.Segmenter(language, { granularity: "grapheme" });
const wordSeg = new Intl.Segmenter(language, { granularity: "word" });

let liList: number[] = [];

const imageShow = "image_main";

const ocrTextNodes: Map<HTMLDivElement, Node[]> = new Map();

const dmp = new diff_match_patch();

/**
 * 添加到撤销栈
 * @returns none
 */
function stackAdd() {
    undoStack.setData(editor.get());
    undoStack.apply();
}
function undo() {
    undoStack.undo();
    editor.push(undoStack.getData());
    if (findShow) {
        exitFind();
        find_();
    }
}
function redo() {
    editor.push(undoStack.getData());
    if (findShow) {
        exitFind();
        find_();
    }
}

class xeditor {
    rendererEl: ElType<HTMLElement>;
    text: HTMLTextAreaElement;
    findEl: ElType<HTMLElement>;
    positionEl: ElType<HTMLElement>;
    selections: selections;
    find: find;
    constructor(el: ElType<HTMLElement>) {
        this.rendererEl = el;
        el.class("text");
        this.text = ele("textarea").el;
        this.findEl = view();
        this.positionEl = view();
        el.add([this.positionEl, this.findEl, this.text]);

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
        lineNum();
        setTextAreaHeight();
        if (findShow) {
            showFind();
            exitFind();
        }

        if (editingOnOther) {
            editingOnOther = false;
            writeEditOnOther();
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
        return editor.get(s || this.getS());
    }

    replace(text: string, s: selection = this.getS()) {
        editor.text.setSelectionRange(s.start, s.end);
        editor.text.setRangeText(text);
        s.end = s.start + text.length;
    }

    rect(s: selection) {
        const textNodes: HTMLElement[] = [];
        const l = editor.text.value.split("\n");
        editor.positionEl.clear();
        for (const text of l) {
            const div = view()
                .add(text)
                .style({
                    minHeight: `${lineHeight}px`,
                });
            textNodes.push(div.el);
            editor.positionEl.add(div);
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
            const dSel = document.getSelection();
            if (!dSel) return;
            dSel.removeAllRanges();
            dSel.addRange(range);
            rectL.push(dSel.getRangeAt(0).getBoundingClientRect());
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
        let text: string | RegExp | null = null;
        // 判断是找文字还是正则
        if (regex) {
            try {
                text = new RegExp(stext, "g");
                findInputEl.el.style.outline = "";
            } catch (error) {
                findInputEl.el.style.outline = "red solid 1px";
            }
        } else {
            const sstext = stext.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            text = new RegExp(sstext, "gi"); // 自动转义，找文字
        }
        return text;
    }

    find(text: string | RegExp | null) {
        if (!text) return [];
        if (!tmpText) tmpText = editor.get();
        // 拆分
        const matchL = tmpText.match(text) || [];
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
        this.editor.findEl.clear();
        const text = this.editor.text.value;
        const ranges = s.sort((a, b) => a.start - b.start);
        for (let i = 0; i < ranges.length; i++) {
            const span = txt(text.slice(ranges[i].start, ranges[i].end));
            if (span.el.innerText) span.class("find_h");
            let after = "";
            if (i === ranges.length - 1)
                after = text.slice(ranges[i].end, text.length);
            const beforeEl = txt(
                text.slice(ranges?.[i - 1]?.end || 0, ranges[i].start),
            );
            const afterEl = txt(after);
            this.editor.findEl.add([beforeEl, span, afterEl]);
        }
    }

    replace(s: selection, match: string | RegExp, text: string) {
        editor.selections.clearAll();
        editor.selections.add(s);
        const mtext = editor.get(s).replace(match, text);
        editor.selections.replace(mtext, editor.selections.getS());
    }
}

const editor = new xeditor(textEditor);

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
    textLineNum.clear();
    const l = editor.text.value.split("\n");
    editor.positionEl.clear();
    let t = "";
    const ly = textLineNum.el.getBoundingClientRect().y;
    for (const i in l) {
        const text = l[i];
        const div = view().add(text);
        div.el.style.minHeight = `${lineHeight}px`;
        editor.positionEl.add(div);
        const rect = div.el.getBoundingClientRect();
        t += `<div style="top:${rect.y - ly}px">${Number(i) + 1}</div>`;
    }
    textLineNum.el.innerHTML = t;
    textLineNum.el.style.width = `${String(l.length).length}ch`;
}
lineNum();

textLineNum.el.onmousedown = (e) => {
    e.stopPropagation();
    const el = <HTMLElement>e.target;
    if (el === textLineNum.el) return;
    const lI = Number(el.innerText) - 1;

    const s = {
        start: { pg: lI, of: 0 },
        end: { pg: lI, of: editor.wMax(lI) },
    };
    editor.selections.clearAll();
    editor.selections.add(editor.selections.s2ns(s));
};
textLineNum.el.onmouseup = (_e) => {
    const s = editor.selections.getS();
    editor.text.setSelectionRange(s.start, s.end);
    editor.text.focus();
};
mainTextEl.on("scroll", () => {
    textLineNum.el.style.top = `-${mainTextEl.el.scrollTop}px`;
});

/************************************主要 */

/************************************UI */

function setButtonHover(el: ElType<HTMLElement>, b: boolean) {
    if (b) el.el.classList.add("hover_b");
    else el.el.classList.remove("hover_b");
}

/**字体大小 */
textOut.el.style.fontSize = `${默认字体大小}px`;

document.onwheel = (e) => {
    if (e.ctrlKey) {
        const d = e.deltaY / Math.abs(e.deltaY);
        const size = Number(textOut.el.style.fontSize.replace("px", ""));
        setFontSize(size - d);
    }
};
function setFontSize(font_size: number) {
    textOut.el.style.fontSize = `${font_size}px`;
    lineHeight = font_size * 1.5;
    setTimeout(() => {
        lineNum();
        setTextAreaHeight();
    }, 400);
}

function setTextAreaHeight() {
    editor.rendererEl.el.style.height = `calc(${editor.positionEl.el.offsetHeight}px + 100% - 1em)`;
}

/**编辑栏 */
function showEditBar(x: number, y: number, right: boolean) {
    const get = editor.selections.get();
    // 简易判断链接并显示按钮
    if (isLink(get, false)) {
        barLinB.el.style.width = "30px";
    } else {
        barLinB.el.style.width = "0";
    }
    if (get.split("\n").every((i) => i.includes("\t"))) {
        barExcelB.el.style.width = "30px";
        barMdTableB.el.style.width = "30px";
    } else {
        barExcelB.el.style.width = "0";
        barMdTableB.el.style.width = "0";
    }

    // 排除没选中
    if (get !== "" || right) {
        if (editBarS) {
            editB.el.style.transition = "var(--transition)";
        } else {
            editB.el.style.transition = "opacity var(--transition)";
        }
        editB.el.className = "edit_s bar";
        let nx = x < 0 ? 0 : x;
        const pleft = mainTextEl.el.getBoundingClientRect().left + 16;
        if (editB.el.offsetWidth + pleft + nx > window.innerWidth)
            nx = window.innerWidth - editB.el.offsetWidth - pleft;
        const ny = y < 0 ? 0 : y;
        editB.style({ left: `${nx}px`, top: `${ny}px` });
        editBarS = true;
    } else {
        editB.el.className = "edit_h";
        editBarS = false;
    }
}

function hideEditBar() {
    editBarS = true;
    showEditBar(0, 0, false);
}

// @ts-ignore
editor.text.addEventListener("select2", (e: CustomEvent) => {
    const dir = e.detail.d as HTMLTextAreaElement["selectionDirection"];
    const rect = editor.selections.rect(editor.selections.getS());
    let r: DOMRect;
    if (dir === "backward") {
        r = rect[1];
    } else {
        r = rect[2];
    }
    const d = editor.rendererEl.el.getBoundingClientRect();
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

    setImgSelect();
});

hotkeys.filter = () => {
    return true;
};

hotkeys("ctrl+a", () => {
    editor.selectAll();
});

for (const i in hotkeyMap) {
    // @ts-ignore
    const key = store.get(`主页面快捷键.${i}`) as string;
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
    editB.add(iel);
}

editB.el.onmousedown = async (e) => {
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
    textEditor.el.spellcheck = isCheck;
}

/**
 * 查找与替换
 */

// 查找ui
function showFind() {
    findShow = !findShow;
    if (findShow) {
        mainSectionEl.el.style.marginTop = "60px";
        findEl.el.style.transform = "translateY(0)";
        findEl.el.style.pointerEvents = "auto";
        findInputEl.sv(editor.selections.get());
        findInputEl.el.select();
        findInputEl.el.focus();
        if (editor.selections.get() !== "") find_();
        countWords();
    } else {
        mainSectionEl.el.style.marginTop = "";
        findEl.el.style.transform = "translateY(-120%)";
        findEl.el.style.pointerEvents = "none";
        exitFind();
        editor.text.focus();
    }
}

// 正则
findRegexEl.el.onclick = () => {
    findRegex = !findRegex;
    if (findRegex) {
        findRegexEl.el.style.backgroundColor = "var(--hover-color)";
    } else {
        findRegexEl.el.style.backgroundColor = "";
    }
    find_();
    findInputEl.el.focus();
};

findInputEl.el.oninput = () => {
    // 清除样式后查找
    exitFind();
    find_();
};
// 查找并突出
function find_() {
    const match = editor.find.matchx(findInputEl.gv, findRegex);
    const find_l = editor.find.find(match);
    editor.find.render(find_l);
    findLNI = -1;
    findLN("↓");
    if (findInputEl.gv === "") {
        exitFind();
    }
}

// 清除样式
function exitFind() {
    tmpText = null;
    findResultEl.sv();
    editor.find.render([]);
}
// 跳转
function findLN(a: "↑" | "↓") {
    const l = document.querySelectorAll(".find_h");
    if (l.length === 0) {
        findResultEl.sv([0, 0]);
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
    findResultEl.sv([findLNI + 1, l.length]);
    textOut.el.scrollTop = (<HTMLElement>l[findLNI]).offsetTop - 48 - 16;
}
findInputEl.el.onkeydown = (e) => {
    if (e.key === "Enter") {
        if (document.querySelector(".find_h_h")) {
            findLN("↓");
        } else {
            find_();
        }
    }
};

// 全部替换
findReplaceAll.el.onclick = () => {
    const m = editor.find.matchx(findInputEl.gv, findRegex);
    if (!m) return;
    if (!editor.selections.get()) editor.selectAll();
    editor.selections.replace(
        editor.selections.get().replaceAll(m, findReplaceEl.gv),
    );
    exitFind();

    stackAdd();
};
// 替换选中
findReplaceB.el.onclick = findReplace;
function findReplace() {
    const m = editor.find.matchx(findInputEl.gv, findRegex);
    if (!m) return;
    const l = editor.find.find(m);
    const s = l[findLNI];
    editor.find.replace(s, m, findReplaceEl.gv);
    findLNI = findLNI - 1;
    const ti = findLNI;
    find_();
    findLNI = ti;
    findLN("↓");

    stackAdd();
}
findReplaceEl.el.onkeydown = (e) => {
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
function showT(st: string, m: setting["主页面"]["模式"]) {
    const t = st.replace(/[\r\n]$/, "");
    editor.push(t);
    const openOuterBrowser = 浏览器打开;
    if (m === "auto" || t === "") {
        // 严格模式
        if (isLink(t, true)) {
            if (自动打开链接) openLink("url", t);
        } else {
            const language =
                (t.match(/[\u4e00-\u9fa5]/g)?.length ?? 0) >=
                t.length * 自动搜索中文占比
                    ? "本地语言"
                    : "外语";
            if (自动搜索 && t.match(/[\r\n]/) == null && t !== "") {
                if (language === "本地语言") {
                    openLink("search", "", openOuterBrowser);
                } else {
                    openLink("translate", "", openOuterBrowser);
                }
            }
        }
    } else if (m === "search") {
        openLink("search", "", openOuterBrowser);
    } else if (m === "translate") {
        openLink("translate", "", openOuterBrowser);
    }
    editor.selectAll();
}

function openLink(
    id: "url" | "search" | "translate",
    slink?: string,
    outerBrowser?: boolean,
) {
    let url = "";
    if (id === "url" && slink) {
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

    if (outerBrowser) {
        shell.openExternal(url);
    } else {
        renderSend("open_this_browser", [windowName, url]);
    }
}

/**搜索翻译按钮 */
searchB.el.onclick = () => {
    openLink("search");
};
translateB.el.onclick = () => {
    openLink("translate");
};
/**改变选项后搜索 */
searchSelectEl.el.oninput = () => {
    openLink("search");
    store.set("引擎.记忆.搜索", searchSelectEl.el.selectedOptions[0].innerText);
};
translateSelectEl.el.oninput = () => {
    openLink("translate");
    store.set(
        "引擎.记忆.翻译",
        translateSelectEl.el.selectedOptions[0].innerText,
    );
};
/**展示搜索引擎选项 */
for (const e of 搜索引擎List) {
    const selected = 引擎.记忆.搜索 === e.name;
    const op = ele("option")
        .add(noI18n(e.name))
        .attr({ value: e.url, selected });
    searchSelectEl.add(op.el);
}
/**展示翻译引擎选项 */
for (const e of 翻译引擎List) {
    const selected = 引擎.记忆.翻译 === e.name;
    const op = ele("option")
        .add(e.url.startsWith("translate") ? t(e.name) : noI18n(e.name))
        .attr({ value: e.url, selected });
    translateSelectEl.add(op.el);
}

/************************************历史记录 */
// 历史记录

if (历史记录设置.保留历史记录 && 历史记录设置.自动清除历史记录) {
    const nowTime = Date.now();
    const dTime = Math.round(历史记录设置.d * 86400) * 1000;
    for (const i of Object.keys(historyList)) {
        if (nowTime - Number(i) > dTime) {
            delete historyList[i];
            storeHistory();
        }
    }
}

function pushHistory() {
    const t = editor.get();
    const i = Date.now();
    const s = { text: t };
    if (t !== "" && 历史记录设置.保留历史记录) {
        historyList[i] = s;
        storeHistory();
    }
    renderHistory();
}
// 历史记录界面

function showHistory() {
    if (historyShowed) {
        historyShowed = false;
        historyDialog.el.close();
    } else {
        historyShowed = true;

        historyDialog.el.showModal();

        renderHistory();
    }
    setButtonHover(showHistoryB, historyShowed);
}
function renderHistory() {
    if (Object.keys(historyList).length === 0)
        historyEl.el.innerText = t("暂无历史记录");
    else historyEl.clear();
    for (const i in historyList) {
        const t = historyList[i].text.split(/[\r\n]/g);
        const div = view().attr({ id: i });
        const text = t.splice(0, 3).join("\n") + (t.length > 3 ? "..." : "");
        const textEl = view()
            .class("history_text")
            .add(txt(text, true))
            .on("click", () => {
                editor.push(historyList[i].text);
                showHistory();
            });
        div.add([
            view()
                .class("history_title")
                .add([
                    txt(
                        time_format(
                            store.get("时间格式"),
                            new Date(Number(i) - 0),
                        ),
                        true,
                    ),
                    button(image(closeSvg, "icon").class("icon")).on(
                        "click",
                        () => {
                            delete historyList[i];
                            storeHistory();
                            div.remove();
                        },
                    ),
                ]),
            textEl,
        ]);
        historyEl.el.prepend(div.el);
    }
}
if (mainText === "") renderHistory();

function storeHistory() {
    fs.writeFile(
        historyPath,
        JSON.stringify({ 历史记录: historyList }),
        () => {},
    );
}

/************************************引入 */

renderOn("editorInit", ([name, list]) => {
    windowName = name;

    task.l("窗口创建", list.time);

    const mainType = list.mode || store.get("主页面.模式") || "auto";

    if (list.type === "text") {
        mainText = list.content;
        showT(mainText, mainType);
    }

    if (list.type === "image" && list.arg0) {
        editor.push(`${t("图片上传中……")} ${t("请等候")}`);
        searchImg(list.content, list.arg0, (err, url) => {
            if (url) {
                editor.push("");
                openLink("url", url, 浏览器打开);
                if (浏览器打开) {
                    // 主页面作为临时上传图片的工具，应自动关闭，不管有没有设置自动关闭标签
                    closeWindow();
                }
            }
            if (err)
                editor.push(
                    `${t("上传错误")}\n${t("请打开开发者工具（Ctrl+Shift+I）查看详细错误")}`,
                );
        });
    }

    if (list.type === "ocr" && list.arg0) {
        editor.push(`${t("文字识别中……")} ${t("请等候")}`);
        ocr(list.content, list.arg0, (err, r) => {
            const text = r?.text;
            if (text) {
                console.log(text);

                editor.push(r.raw.map((i) => i.text).join("\n"));
                stackAdd();

                editor.push(text);
                stackAdd();

                editor.selectAll();

                if (mainType === "search") {
                    openLink("search");
                } else if (mainType === "translate") {
                    openLink("translate");
                }

                ocrTextNodes.clear();
                addOcrText(r.raw, 0);

                const maxLinePhotoShow = store.get("主页面.显示图片区");
                if (maxLinePhotoShow && r.raw.length >= maxLinePhotoShow) {
                    if (!mainSectionEl.el.classList.contains(imageShow)) {
                        showImageB.el.click();
                    }
                }

                if (store.get("主页面.自动复制OCR")) {
                    clipboard.writeText(text);
                }
                return;
            }
            console.error(err);

            editor.push(
                `${t("识别错误")}\n${err}\n${t("请打开开发者工具（Ctrl+Shift+I）查看详细错误")}`,
            );

            mainEvent("home");
        });
    }

    if (list.type === "qr") {
        editor.push(`${t("二维码识别中……")} ${t("请等候")}`);
        import("qr-scanner-wechat").then(async (qr) => {
            const img = new Image();
            img.src = list.content;
            const result = await qr.scan(img);
            const text = result.text;
            showT(text || "", mainType);
        });
    }
});

function editOnOther() {
    editingOnOther = !editingOnOther;
    if (editingOnOther) {
        const data = Buffer.from(editor.get());
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
            textOut.attr({ title: "正在外部编辑中，双击退出" });
            document.addEventListener("dblclick", () => {
                editingOnOther = true;
                editOnOther();
            });
        });
    } else {
        try {
            textOut.attr({ title: "" });
            document.removeEventListener("dblclick", () => {
                editingOnOther = true;
                editOnOther();
            });
            fileWatcher?.close();
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
                    const i = (v.match(/\t/g)?.length ?? 0) + 1;
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

renderOn("editorEvent", ([arg]) => edit(arg));

// ctrl滚轮控制字体大小

hotkeys("ctrl+0", () => {
    setFontSize(默认字体大小);
});

setTitle(t("主页面"));

/**
 * 统计字数
 */
function countWords() {
    const text = editor.get();
    const p = (text.trim().match(/\n+/g)?.length ?? 0) + 1;
    const chart = Array.from(chartSeg.segment(text));
    const words = Array.from(wordSeg.segment(text));

    findCount
        .clear()
        .add(`${chart.filter((i) => i.isWordLike).length} ${t("字")}`)
        .attr({
            title: `${t("段落")} ${p}\n${t("字符")} ${chart.length}\n${t("非空格字符")} ${chart.filter((i) => !i.segment.match(/\s/)).length}\n${t("词")} ${words.filter((i) => i.isWordLike).length}`,
        });
}

/************************************失焦关闭 */

function closeWindow() {
    renderSend("windowClose", []);
}

window.onblur = () => {
    if (blurToClose && !alwaysOnTop) closeWindow();
};

setButtonHover(navDing, !blurToClose);

editorOutEl.el.style.transition = "0s";
setConciseMode(concise);
editorOutEl.el.style.transition = "";
setButtonHover(navConcise, concise);

function setConciseMode(m: boolean) {
    if (m) {
        bottomEl.el.style.height = "0";
        outMainEl.el.style.gap = "0";
    } else {
        bottomEl.el.style.height = "";
        outMainEl.el.style.gap = "";
    }
    const bSize = {
        top:
            // @ts-ignore
            window.navigator?.windowControlsOverlay.getTitlebarAreaRect()
                .height || 0,
        bottom: 48,
    };
    if (m) {
        bSize.bottom = 0;
    }
    renderSend("tabViewSize", [bSize]);
}

if (!store.get("主页面.高级窗口按钮")) {
    nav.style({ height: 0 });
    outMainEl.style({ height: "100%", top: 0 });
}

/************************************浏览器 */

outMainEl.el.className = "fill_t";

renderOn("browserNew", ([id, url]) => {
    newTab(id, url);
    browserTabs.el.classList.add("tabs_show");
});
renderOn("browserTitle", ([id, t]) => {
    title(id, t);
    browserTabs.el.classList.add("tabs_show");
});
renderOn("browserIcon", ([id, i]) => {
    icon(id, i);
    browserTabs.el.classList.add("tabs_show");
});
renderOn("browserUrl", ([id, u]) => {
    url(id, u);
    browserTabs.el.classList.add("tabs_show");
});
renderOn("browserLoad", ([id, l]) => {
    load(id, l);
    browserTabs.el.classList.add("tabs_show");
});

function newTab(id: number, url: string) {
    const r = tabLi();
    const li = r.li.el;
    liList.push(id);
    tabs.set(id, {
        el: r.li,
        icon: "",
        title: "",
        url,
        setIcon: (i) => {
            if (i === undefined) {
                r.icon.el.src = reloadSvg;
                r.icon.el.classList.add("loading");
            } else {
                (tabs.get(id) as TabItem).icon = i;
                r.icon.el.src = i;
                r.icon.el.classList.remove("loading");
            }
        },
        setTitle: (t) => {
            r.title.el.innerText = t;
            r.icon.el.title = t;
        },
    });
    li.style.display = "flex";
    browserTabs.add(li);
    focusTab(id);

    r.li.on("mouseup", (e) => {
        if (e.button === 0) {
            focusTab(id);
        } else {
            closeTab(id);
        }
    });
    r.close.on("click", (e) => {
        e.stopPropagation();
        closeTab(id);
    });

    if (store.get("浏览器.标签页.小")) {
        li.classList.add("tab_small");
    }
    if (store.get("浏览器.标签页.灰度")) {
        li.classList.add("tab_gray");
    }
}

function getTab(id: number): TabItem {
    const t = tabs.get(id);
    if (!t) {
        console.log("not tab", id);
        return {
            el: view(),
            icon: "",
            url: "",
            title: "",
            setIcon: () => {},
            setTitle: () => {},
        };
    }
    return t;
}

function closeTab(id: number) {
    renderSend("tabView", [id, "close"]);
    focusTab(liList.at(liList.findIndex((i) => i === id) + 1) || 0);
    liList = liList.filter((i) => i !== id);
    tabs.get(id)?.el.remove();
    tabs.delete(id);

    if (isTabsEmpty()) {
        browserTabs.el.classList.remove("tabs_show");
    }
}

function isTabsEmpty() {
    return browserTabs.el.querySelectorAll("li").length === 0;
}

function focusTab(id: number | 0) {
    focusTabI = id;
    for (const [eid, el] of tabs) {
        if (eid === id) {
            el.el.el.classList.add("tab_focus");
        } else {
            el.el.el.classList.remove("tab_focus");
        }
    }
    liList = liList.filter((i) => i !== id);
    liList.push(id);

    if (id) {
        renderSend("tabView", [id, "top"]);
        setTitle(getTab(id).title);
        outMainEl.el.classList.add("fill_t_s");
    } else {
        outMainEl.el.classList.remove("fill_t_s");
        setTitle(t("主页面"));
    }
}

function title(id: number, arg: string) {
    getTab(id).setTitle(arg);
    if (id === focusTabI) setTitle(arg);
}

function icon(id: number, arg: string) {
    getTab(id).setIcon(arg);
}

function url(id: number, url: string) {
    getTab(id).url = url;
}

function load(id: number, loading: boolean) {
    if (loading) {
        getTab(id).setIcon();
        browserTabReload.el.style.display = "none";
        browserTabStop.el.style.display = "block";
    } else {
        getTab(id).setIcon(getTab(id).icon);
        browserTabReload.el.style.display = "block";
        browserTabStop.el.style.display = "none";
    }
}

browserTabBs.el.onclick = (e) => {
    mainEvent((e.target as HTMLElement).id);
};
function mainEvent(eid: string) {
    if (!eid) return;
    if (focusTabI === 0) return;
    if (eid === "browser") {
        openInBrowser();
    } else if (eid === "add_history") {
        historyList[Date.now()] = {
            text: getTab(focusTabI).url,
        };
        storeHistory();
    } else {
        const id = focusTabI;
        // @ts-ignore
        renderSend("tabView", [id, eid]); // todo
        if (eid === "home") {
            focusTab(0);
            outMainEl.el.classList.remove("fill_t_s");
            setTitle(t("主页面"));
        }
    }
}

function openInBrowser() {
    const url = getTab(focusTabI).url;
    shell.openExternal(url);
    if (store.get("浏览器.标签页.自动关闭")) {
        closeTab(focusTabI);
        if (isTabsEmpty() && editor.get().trim() === "") closeWindow();
    }
}

renderOn("viewEvent", ([type]) => {
    mainEvent(type);
});

browserTabs.el.onwheel = (e) => {
    e.preventDefault();
    const i = e.deltaX + e.deltaY + e.deltaZ >= 0 ? 1 : -1;
    browserTabs.el.scrollLeft +=
        i * Math.sqrt(e.deltaX ** 2 + e.deltaY ** 2 + e.deltaZ ** 2);
};

/************************************以图搜图 */

function searchImg(
    simg: string,
    type: "baidu" | "yandex" | "google" | (string & {}),
    callback: (err: Error | null, url: string | null) => void,
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
    cb: (err: Error | null, result) => void,
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

function baidu(
    image: string,
    callback: (err: Error | null, url: string | null) => void,
) {
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

function yandex(
    image: string,
    callback: (err: Error | null, url: string | null) => void,
) {
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
    const url = `https://lens.google.com/v3/upload?hl=zh-CN&re=df&st=${Date.now()}&vpw=1041&vph=779`;
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
    callback: (
        error: Error | null,
        result: { raw: ocrResult; text: string } | null,
    ) => void,
) {
    addOcrPhoto(img);
    if (type === "baidu" || type === "youdao") {
        onlineOcr(type, img, (err, r) => {
            callback(err, r);
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
    callback: (
        error: Error | null,
        result: { raw: ocrResult; text: string } | null,
    ) => void,
) {
    try {
        task.l("ocr_load");
        const l = store.get("离线OCR").find((i) => i[0] === type);
        if (!l) return callback(new Error("未找到OCR模型"), null);
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
            // biome-ignore format:
            const localOCR = require("esearch-ocr") as typeof import("esearch-ocr");
            const ort = require("onnxruntime-node");
            const provider = store.get("AI.运行后端") || "cpu";
            lo = await localOCR.init({
                detPath: detp,
                recPath: recp,
                dic: fs.readFileSync(字典).toString(),
                detRatio: 0.75,
                ort,
                ortOption: { executionProviders: [{ name: provider }] },
                onProgress: (type, a, n) => {
                    if (type === "det") {
                        ocrProgress([
                            { name: t("检测"), num: n / a },
                            { name: t("识别"), num: 0 },
                        ]);
                    }
                    if (type === "rec") {
                        ocrProgress([
                            { name: t("检测"), num: 1 },
                            { name: t("识别"), num: n / a },
                        ]);
                    }
                },
            });
        }
        task.l("img_load");
        const img = image(arg, "ocr image");
        img.el.onload = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.el.width;
            canvas.height = img.el.height;
            const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
            ctx.drawImage(img.el, 0, 0);
            task.l("ocr_s");
            lo.ocr(ctx.getImageData(0, 0, img.el.width, img.el.height))
                .then((l) => {
                    console.log(l);
                    let t = "";
                    if (store.get("OCR.识别段落")) {
                        for (const i of l.parragraphs) {
                            t += `${i.text}\n`;
                        }
                    } else {
                        for (const i of l.columns.flatMap((i) => i.src)) {
                            t += `${i.text}\n`;
                        }
                    }
                    const ll = l.columns
                        .flatMap((i) => i.src)
                        .map((i) => ({ box: i.box, text: i.text }));
                    callback(null, { raw: ll, text: t });
                    task.l("ocr_e");
                    task.clear();
                })
                .catch((e) => {
                    callback(e, null);
                });
        };
    } catch (error) {
        callback(error as Error, null);
    }
}

function ocrProgress(x: { name: string; num: number }[]) {
    editor.text.style.fontFamily = "monospace";
    const text: string[] = [];
    const nameLenght = Math.max(...x.map((i) => i.name.length));
    const w = 20;
    for (const i of x) {
        let t = "";
        t += i.name.padEnd(nameLenght + 1);
        t += "#".repeat(Math.floor(w * i.num)).padEnd(w, "-");
        t += ` ${(i.num * 100).toFixed(0)}%`;
        text.push(t);
    }
    editor.push(text.join("\n"));
    if (x.every((i) => i.num === 1)) editor.text.style.fontFamily = "";
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
    callback: (
        error: Error | null,
        result: { raw: ocrResult; text: string } | null,
    ) => void,
) {
    const arg = sarg.replace("data:image/png;base64,", "");

    // @ts-ignore
    const clientId = store.get(`在线OCR.${type}.id`) as string;
    // @ts-ignore
    const clientSecret = store.get(`在线OCR.${type}.secret`) as string;
    if (!clientId || !clientSecret)
        return callback(new Error("未填写 API Key 或 Secret Key"), null);
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
            store.get("在线OCR.baidu.time") < Date.now()
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
                                return callback(
                                    new Error("API Key 错误"),
                                    null,
                                );
                            }
                            if (
                                result.error_description ===
                                "Client authentication failed"
                            )
                                return callback(
                                    new Error("Secret Key 错误"),
                                    null,
                                );
                        }
                        return callback(
                            new Error(JSON.stringify(result)),
                            null,
                        );
                    }
                    store.set("在线OCR.baidu.token", access_token);
                    store.set(
                        "在线OCR.baidu.time",
                        Date.now() + result.expires_in * 1000,
                    );
                    ocrGet(access_token);
                });
        else {
            ocrGet(store.get("在线OCR.baidu.token"));
        }

        function ocrGet(token: string) {
            // @ts-ignore
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
                return callback(new Error(JSON.stringify(result)), null);

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

            const outputL: string[] = [];
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
        const curtime = String(Math.round(Date.now() / 1000));
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
                return callback(new Error(JSON.stringify(result)), null);
            const r: ocrResult = [];
            const textL: string[] = [];
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

showImageB.el.onclick = () => {
    mainSectionEl.el.classList.toggle(imageShow);
    setButtonHover(showImageB, mainSectionEl.el.classList.contains(imageShow));
};

ocrImageFileDropFileInput.el.onclick = () => {
    ocrImageFile.el.click();
};
ocrImageFile.el.onchange = () => {
    const files = ocrImageFile.el.files;
    for (const f of files ?? []) {
        const type = f.type.split("/")[0];
        if (type !== "image") continue;
        const reader = new FileReader();
        reader.readAsDataURL(f);
        reader.onload = () => {
            const el = createImg(reader.result as string);
            ocrImageView.add(el);
        };
    }
};
ocrImageRun.el.classList.add("no_run");
ocrImageRun.el.onclick = () => {
    runOcr();
};
ocrImageClose.el.onclick = () => {
    output = [];
    ocrImageView.clear();
};

ocrImageEngine.setList([
    ...store.get("离线OCR").map((i) => ({ value: i[0], text: i[0] })),
    { value: "baidu", text: "百度" },
    { value: "youdao", text: "有道" },
]);

ocrImageEngine.el.sv(store.get("OCR.类型"));
ocrImageEngine.el.on("input", () => {
    store.set("OCR.类型", ocrImageEngine.el.gv);
});

/** 拖放数据处理 */
function putDatatransfer(data: DataTransfer | null) {
    if (data && data.files.length !== 0) {
        for (const f of data.files) {
            const type = f.type.split("/")[0];
            if (type !== "image") continue;
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => {
                const el = createImg(reader.result as string);
                ocrImageView.add(el);
            };
        }
    }
}

function createImg(src: string) {
    const div = view().class("img_el");
    const img = image(src, "").on("load", () => {
        img.data({
            w: String(img.el.width),
            h: String(img.el.height),
        });
    });
    div.add(img);
    return div;
}

function runOcr() {
    output = [];
    for (const el of ocrImageView.queryAll(":scope > div > div")) {
        el.clear();
    }
    const type = ocrImageEngine.el.gv;
    const imgList = ocrImageView.queryAll(":scope > div > img");
    ocrTextNodes.clear();
    imgList.forEach((el, i) => {
        if (type === "baidu" || type === "youdao") {
            onlineOcr(type, el.el.src, (_err, r) => {
                if (r) {
                    addOcrText(r.raw, i);
                    addOcrToEditor(r.text, i);
                }
            });
        } else {
            localOcr(type, el.el.src, (_err, r) => {
                if (r) {
                    addOcrText(r.raw, i);
                    addOcrToEditor(r.text, i);
                }
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
    const img = ocrImageView.queryAll("img")[i].el;
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const div = view();
    img.parentElement?.append(div.el);
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
        div.add(xel);
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

    addOcrSelect(div.el);
}

function setOcrFontSize() {
    for (const el of ocrImageView.queryAll("p")) {
        const w = Number(el.el.getAttribute("data-w"));
        const elSize = el.el.getBoundingClientRect();
        let fontSize = 16;
        fontSize = 16 * (elSize.width / w);
        el.style({
            lineHeight: `${fontSize}px`,
            fontSize: `${fontSize}px`,
        });
    }
}

window.onresize = () => {
    setOcrFontSize();
    lineNum();
};

function addOcrPhoto(base: string) {
    ocrImageView.clear();
    const el = createImg(base);
    ocrImageView.add(el);
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
ocrImageView.el.onpointerdown = () => {
    imageS = true;
    CSS.highlights.clear();
};
ocrImageView.el.onpointerup = () => {
    imageS = false;
    const s = getImgSelect();
    if (!s) return;
    editor.find.render([]);
    editor.selections.clearAll();
    editor.selections.add(s);
    editor.text.focus();
};
ocrImageView.el.onpointermove = () => {
    if (!imageS) return;
    const s = getImgSelect();
    if (s) editor.find.render([s]);
};

function getImgSelect() {
    const range = document.getSelection()?.getRangeAt(0);
    if (!range) return null;
    console.log(range);
    const div = (
        range.commonAncestorContainer.nodeName === "DIV"
            ? range.commonAncestorContainer
            : // @ts-ignore
              range.commonAncestorContainer.parentElement.parentElement
    ) as HTMLDivElement;
    const allTextNodes = ocrTextNodes.get(div);
    if (!allTextNodes) return null;
    const startNode = range.startContainer;
    let endNode = range.endContainer;
    const rStartOffset = range.startOffset;
    let rEndOffset = range.endOffset;
    if (endNode.nodeName === "P") {
        // @ts-ignore
        const lastText = endNode.previousSibling.childNodes[0];
        endNode = lastText;
        // @ts-ignore
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
            if (!startOk) start += node.textContent?.length ?? 0;
        }
        if (endNode === node) {
            end += rEndOffset;
            endOk = true;
        } else {
            if (!endOk) end += node.textContent?.length ?? 0;
        }
        sourceText += node.textContent;
    }
    if (start > end) [start, end] = [end, start];
    console.log(start, end);
    if (start === end) return null;

    return getDiff(sourceText, editor.get(), start, end);
}

function getDiff(text0: string, text1: string, start: number, end: number) {
    const diff = dmp.diff_main(text0, text1);
    console.log(diff);
    const source: number[] = [0];
    const map: number[] = [0];
    if (diff.at(-1)?.[0] === 1) diff.push([0, ""]);
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
type rangeN = {
    node: Node | null;
    offset: number;
};

function editorS2ImgS(s: selection) {
    let sourceText = "";
    let startN: rangeN = { node: null, offset: 0 };
    let endN: rangeN = { node: null, offset: 0 };
    for (const allTextNodes of ocrTextNodes.values()) {
        for (const node of allTextNodes) {
            sourceText = `${sourceText + node.textContent}`;
        }
    }
    const { start, end } = getDiff(editor.get(), sourceText, s.start, s.end);
    sourceText = "";
    for (const allTextNodes of ocrTextNodes.values()) {
        for (const node of allTextNodes) {
            const i = sourceText.length;

            if (i <= start && start < i + (node.textContent?.length ?? 0)) {
                startN = {
                    node,
                    offset: start - i,
                };
            }
            if (i <= end && end < i + (node.textContent?.length ?? 0)) {
                endN = {
                    node,
                    offset: end - i,
                };
                return { start: startN, end: endN };
            }
            sourceText = `${sourceText + node.textContent}`;
        }
    }
    return { start: startN, end: endN };
}

function setImgSelect() {
    if (ocrTextNodes.size === 0) return;
    const sss = editorS2ImgS(editor.selections.getS());
    console.log(sss);

    if (!sss.start.node || !sss.end.node) {
        CSS.highlights.clear();
        return;
    }

    const range = new Range();
    range.setStart(sss.start.node, sss.start.offset);
    range.setEnd(sss.end.node, sss.end.offset);

    const myCustomHighlight = new Highlight(range);

    CSS.highlights.clear();

    CSS.highlights.set("img-highlight", myCustomHighlight);
}

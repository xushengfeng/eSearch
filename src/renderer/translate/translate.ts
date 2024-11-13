import xtranslator from "xtranslator";
import { getImgUrl, initStyle } from "../root/root";
const fs = require("node:fs") as typeof import("fs");

import store from "../../../lib/store/renderStore";

import {
    button,
    ele,
    frame,
    image,
    p,
    pureStyle,
    spacer,
    txt,
    view,
} from "dkh-ui";

pureStyle();

initStyle(store);

// @auto-path:../assets/icons/$.svg
function iconButton(img: string) {
    return button(
        image(getImgUrl(`${img}.svg`), "icon")
            .class("icon")
            .style({ width: "100%", height: "100%" }),
    ).style({
        position: "relative",
    });
}

const input = ele("textarea").style({
    width: "100%",
    padding: "8px",
    resize: "vertical",
    // @ts-ignore
    "field-sizing": "content",
    "min-height": "4lh",
});
const lans = view("x");
const lansFrom = ele("select").on("change", () => {
    translate(input.el.value);
});
const lansTo = ele("select").on("change", () => {
    translate(input.el.value);
});

const results = view("y").style({
    gap: "16px",
    padding: "8px",
    overflow: "auto",
});

lans.add([lansFrom, lansTo]);

input.addInto();
lans.addInto();
results.addInto();

const inputText = decodeURIComponent(
    new URLSearchParams(location.search).get("text") || "",
);

const fyq = store.get("翻译.翻译器");
const fanyiqi = new Map(
    fyq.map((f) => {
        const e = xtranslator.es[f.type]();
        // @ts-ignore
        e.setKeys(f.keys);
        return [f.id, e];
    }),
);

const showCang = store.get("翻译.收藏");

function translate(_text: string) {
    results.el.innerHTML = "";
    const text = _text.trim();
    if (!text) return;
    for (const i of fyq) {
        const copy = iconButton("copy").style({
            width: "24px",
            height: "24px",
        });
        const save = iconButton("star").style({
            width: "24px",
            height: "24px",
            display:
                showCang.fetch.length && showCang.文件.length
                    ? "block"
                    : "none",
        });
        const reTry = iconButton("reload")
            .style({
                width: "24px",
                height: "24px",
            })
            .on("click", () => {
                f();
            });
        const checkEl = iconButton("replace").style({
            width: "24px",
            height: "24px",
            display: lansFrom.el.value === "zh-xxx" ? "" : "none", // todo === 母语
        });
        const e = frame(`result${i.id}`, {
            _: view().style({ width: "100%" }),
            title: {
                _: view("x").style({ "align-items": "center" }),
                _spacer: spacer(),
                name: txt(i.name).style({ "margin-right": "4px" }),
                copy,
                save,
                reTry,
                checkEl,
            },
            content: p(""),
        });
        results.add(e.el);
        const c = e.els.content;
        const f = () =>
            fanyiqi
                .get(i.id)
                // @ts-ignore
                .run(text, lansFrom.el.value, lansTo.el.value)
                .then((_ttext: string) => {
                    const ttext = _ttext.trim();
                    c.el.innerText = ttext;
                    copy.on("click", () => {
                        navigator.clipboard.writeText(ttext);
                    });
                    save.on("click", () => {
                        saveW({
                            from: lansFrom.el.value,
                            to: lansTo.el.value,
                            fromT: text,
                            toT: ttext,
                            engine: i.name,
                        });
                    });
                    checkEl.on("click", async () => {
                        // @ts-ignore
                        const t = await fanyiqi.get(i.id).run(
                            text,
                            lansTo.el.value,
                            "zh", // todo 识别后的语言，因为有可能是自动
                        );
                        c.el.innerText += `\n${t}`;
                    });
                })
                .catch((err) => {
                    console.error(err);
                    c.el.innerText = "翻译失败，请重试";
                });
        f();
    }
}

type saveData = {
    from: string;
    to: string;
    fromT: string;
    toT: string;
    engine: string;
};

function saveW(obj: saveData) {
    saveFile(obj);
    saveFetch(obj);
}

function saveTemplate(t: string, obj: saveData) {
    return t
        .replaceAll("${from}", obj.from)
        .replaceAll("${to}", obj.to)
        .replaceAll("${fromT}", obj.fromT)
        .replaceAll("${toT}", obj.toT)
        .replaceAll("${engine}", obj.engine);
}

function saveFile(obj: saveData) {
    const filesx = showCang.文件;
    for (const i of filesx) {
        fs.appendFile(i.path, `\n${saveTemplate(i.template, obj)}`, () => {});
    }
}

function saveFetch(obj: saveData) {
    const webx = showCang.fetch;
    for (const i of webx) {
        fetch(saveTemplate(i.url, obj), {
            method: i.method,
            body: saveTemplate(i.body, obj),
            headers: i.headers,
        });
    }
}

function getLansName(l: string[]) {
    const mainLan = store.get("语言.语言");
    const trans = new Intl.DisplayNames(mainLan, { type: "language" });
    const lansName = l.map((i) => ({
        text: i === "auto" ? "自动" : trans.of(i),
        lan: i,
    }));
    return lansName.toSorted((a, b) => a.text.localeCompare(b.text, mainLan));
}

const e = xtranslator.e[fyq[0].type];
if (e) {
    // todo 所有翻译器支持的集合
    // todo 常用排序在前
    lansFrom.add(
        getLansName(e.lan).map((v) =>
            ele("option").add(txt(v.text)).attr({ value: v.lan }),
        ),
        10,
    );
    lansTo.add(
        getLansName(e.targetLan).map((v) =>
            ele("option").add(txt(v.text)).attr({ value: v.lan }),
        ),
        10,
    );
}

input.el.value = inputText;
if (inputText) {
    translate(inputText);
}

let composing = false;
input
    .on("compositionstart", () => {
        composing = true;
    })
    .on("compositionend", () => {
        composing = false;
    });

let lastTrans: NodeJS.Timeout;

input.on("input", () => {
    if (composing) return;
    if (lastTrans) clearTimeout(lastTrans);
    lastTrans = setTimeout(() => {
        translate(input.el.value);
    }, 2000);
});

import type { setting } from "../../ShareTypes";

import xtranslator from "xtranslator";
import initStyle from "../root/root";

import store from "../../../lib/store/renderStore";

import { button, ele, frame, image, p, pureStyle, txt, view } from "dkh-ui";

pureStyle();

initStyle(store);

import copy_svg from "../assets/icons/copy.svg";

function iconButton(img: string) {
    return button(image(img, "icon").class("icon").style({ width: "100%", height: "100%" })).style({
        position: "relative",
    });
}

const input = ele("textarea").style({ width: "100%", padding: "8px", resize: "vertical" });
const lans = view("x");
const lansFrom = ele("select").on("change", () => {
    translate(input.el.value);
});
const lansTo = ele("select").on("change", () => {
    translate(input.el.value);
});

const results = view("y").style({ gap: "8px", margin: "8px" });

lans.add([lansFrom, lansTo]);

document.body.append(input.el, lans.el, results.el);

const inputText = decodeURIComponent(new URLSearchParams(location.search).get("text"));

const fyq = store.get("翻译.翻译器") as setting["翻译"]["翻译器"];

function translate(text: string) {
    results.el.innerHTML = "";
    if (!text.trim()) return;
    for (const i of fyq) {
        const copy = iconButton(copy_svg).style({ width: "24px", height: "24px" });
        const e = frame(`result${i.id}`, {
            _: view().style({ width: "100%" }),
            title: { _: view("x").style({ "align-items": "center" }), name: txt(i.name), copy },
            content: p(""),
        });
        results.add(e.el);
        const c = e.els.content;
        translateI(text, i).then((text) => {
            c.el.innerText = text;
            copy.on("click", () => {
                navigator.clipboard.writeText(text);
            });
        });
    }
}

function translateI(text: string, i: setting["翻译"]["翻译器"][0]) {
    xtranslator.e[i.type].setKeys(i.keys);
    return xtranslator.e[i.type].run(text, lansFrom.el.value, lansTo.el.value);
}

const e = xtranslator.e[fyq[0].type];
if (e) {
    const mainLan = store.get("语言.语言");
    lansFrom.add(
        e.getLanT({ text: mainLan, sort: "text" }).map((v) => ele("option").add(txt(v.text)).attr({ value: v.lan })),
        10
    );
    lansTo.add(
        e
            .getTargetLanT({ text: mainLan, sort: "text" })
            .map((v) => ele("option").add(txt(v.text)).attr({ value: v.lan })),
        10
    );
}

input.el.value = inputText;
if (inputText) {
    translate(inputText);
}

let composing = false;
input.on("compositionstart", () => (composing = true)).on("compositionend", () => (composing = false));

let lastTrans: NodeJS.Timeout;

input.on("input", () => {
    if (composing) return;
    if (lastTrans) clearTimeout(lastTrans);
    lastTrans = setTimeout(() => {
        translate(input.el.value);
    }, 2000);
});

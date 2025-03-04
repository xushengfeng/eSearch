export { t, tLan, lan, getLans, getLanName };
import { matchFitLan } from "xtranslator";
const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");
const rootDirL = __dirname.split(path.sep);
const outDir = rootDirL.lastIndexOf("out");
const rootDir = path.join(
    rootDirL.slice(0, outDir).join(path.sep),
    "./lib/translate",
);

const ignore = require(path.join(rootDir, "./ignore.json")) as string[];

let language = "";

/**
 * 获取可用语言
 * @param {string} lan 语言
 * @returns 仅限支持的语言
 */
function parseLan(lan: string) {
    const lans = getLans();
    return matchFitLan(lan, lans) ?? "zh-HANS";
}

/**
 * 切换语言
 * @param {string} lan 语言
 */
function lan(lan: string | undefined) {
    language = parseLan(lan ?? "");
    if (language !== "zh-HANS") {
        l = require(path.join(rootDir, `./${language}.json`));
    }
}

/**
 * 翻译
 * @param {string} text 原文字
 * @returns 翻译后的文字
 */
function t(text: string) {
    if (!language) return text;
    if (language === "zh-HANS") return text;
    return autoSt(text, l);
}
function st(_text: string, map: typeof l) {
    if (!_text.trim()) return null;
    if (ignore.includes(_text)) return null;
    const text = _text.trim();
    const id = source[text];
    if (!id) {
        console.log(`%c"${text}":"",`, "color:#f00;background:#fdd");
        return null;
    }
    const t = map[id];
    if (!t) {
        console.log(
            `%c${id}%c: ${text}`,
            "color:bluecolor:#00f;background:#ddf",
            "",
        );
        return null;
    }
    return t;
}
function autoSt(_text: string, map: typeof l) {
    if (!_text.trim()) return _text;
    let text = _text.trim();
    let e = "";
    if (text.endsWith("：")) {
        text = text.slice(0, -1);
        e = "：";
    }
    const t = st(text, map);
    if (!t) return text;
    return e ? `${t}${autoSt("：", map)}` : t;
}
function tLan(text: string, lan: string) {
    if (parseLan(lan) === "zh-HANS") return text;
    const map = require(
        path.join(rootDir, `./${parseLan(lan)}.json`),
    ) as typeof l;
    return autoSt(text, map);
}

const source = require(path.join(rootDir, "./source.json"));
let l: Record<string, string>;

function getLans() {
    const lans = fs
        .readdirSync(rootDir)
        .filter((file) => {
            return (
                file.endsWith(".json") &&
                !file.startsWith("source") &&
                !file.startsWith(".")
            );
        })
        .map((l) => l.replace(".json", ""));
    return ["zh-HANS"].concat(lans);
}

function getLanName(lan: string) {
    return {
        ar: "عربي",
        en: "English",
        eo: "Esperanto",
        es: "Español",
        fr: "Français",
        ru: "Русский",
        "zh-HANS": "简体中文",
        "zh-HANT": "繁体中文",
    }[lan];
}

export { t, tLan, lan, getLans, getLanName, matchFitLan };
const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");
const rootDirL = __dirname.split(path.sep);
const outDir = rootDirL.lastIndexOf("out");
const rootDir = path.join(
    rootDirL.slice(0, outDir).join(path.sep),
    "./lib/translate",
);

let language = "";

/**
 * 获取可用语言
 * @param {string} lan 语言
 * @returns 仅限支持的语言
 */
function parseLan(lan: string) {
    const lans = getLans();
    return matchFitLan(lan, lans);
}

function matchFitLan(lan: string, lanList: string[], defaultLan = "zh-HANS") {
    const zhMap = {
        "zh-CN": "zh-HANS",
        "zh-SG": "zh-HANS",
        "zh-TW": "zh-HANT",
        "zh-HK": "zh-HANT",
    };
    const supportLan = lanList.map((i) => zhMap[i] || i);
    const mainLan = lan.split("-")[0];
    const filterLans = supportLan.filter(
        (i) => i.startsWith(`${mainLan}-`) || i === mainLan,
    );
    if (filterLans.length === 0) return defaultLan;
    if (filterLans.includes(lan)) return lan;
    return filterLans[0];
}

/**
 * 切换语言
 * @param {string} lan 语言
 */
function lan(lan: string) {
    language = parseLan(lan);
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
    return st(text, l);
}
function st(text: string, map: typeof l) {
    if (!text.trim()) return text;
    const id = source[text];
    const t = map[id];
    if (!id) console.log(`%c"${text}":"",`, "color:#f00;background:#fdd");
    else if (!t)
        console.log(
            `%c${id}%c: ${text}`,
            "color:bluecolor:#00f;background:#ddf",
            "",
        );
    return t || text;
}
function tLan(text: string, lan: string) {
    if (parseLan(lan) === "zh-HANS") return text;
    const map = require(
        path.join(rootDir, `./${parseLan(lan)}.json`),
    ) as typeof l;
    return st(text, map);
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

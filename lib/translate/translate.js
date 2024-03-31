export { t, lan, getLans, getLanName };
const path = require("path");
const fs = require("fs");
let rootDirL = __dirname.split(path.sep);
let outDir = rootDirL.lastIndexOf("out");
let rootDir = path.join(rootDirL.slice(0, outDir).join(path.sep), "./lib/translate");

var language = "";

/**
 * 获取可用语言
 * @param {string} lan 语言
 * @returns 仅限支持的语言
 */
function parseLan(lan) {
    let lans = getLans();
    if (!lans.includes(lan)) {
        if (lans.includes(lan.split("-")[0])) return lan.split("-")[0];
        else return "zh-HANS";
    } else return lan;
}

/**
 * 切换语言
 * @param {string} lan 语言
 */
function lan(lan) {
    language = parseLan(lan);
    if (language != "zh-HANS") {
        l = require(path.join(rootDir, `./${language}.json`));
    }
}

/**
 * 翻译
 * @param {string} text 原文字
 * @returns 翻译后的文字
 */
function t(text, lan) {
    if ((lan ? parseLan(lan) : language) === "zh-HANS") return text;
    const id = source[text];
    const map = lan ? require(path.join(rootDir, `./${parseLan(lan)}.json`)) : l;
    const t = map[id];
    if (!id) console.log(`%c"${text}":"",`, "color:#f00;background:#fdd");
    else if (!t) console.log(`%c${id}%c: ${text}`, "color:bluecolor:#00f;background:#ddf", "");
    return t || text;
}

let source = require(path.join(rootDir, "./source.json"));
let l;

function getLans() {
    return fs
        .readdirSync(rootDir)
        .filter((file) => {
            return file.endsWith(".json") && !file.startsWith("source") && !file.startsWith(".");
        })
        .map((l) => l.replace(".json", ""));
}

function getLanName(lan) {
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

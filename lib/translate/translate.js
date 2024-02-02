export { t, lan };
const path = require("path");
let rootDirL = __dirname.split(path.sep);
let outDir = rootDirL.lastIndexOf("out");
let rootDir = path.join(rootDirL.slice(0, outDir).join(path.sep), "./lib/translate");

var language = "";

/**
 * 切换语言
 * @param {string} lan 语言
 */
function lan(lan) {
    language = lan;
    if (lan != "zh-HANS") {
        l = require(path.join(rootDir, `./${lan}.json`));
    }
}

/**
 * 翻译
 * @param {string} text 原文字
 * @returns 翻译后的文字
 */
function t(text) {
    if (language === "zh-HANS") return text;
    const t = l[source[text]];
    if (!t) console.warn(`${language}: ${text}`);
    return t | text;
}

let source = require(path.join(rootDir, "./source.json"));
let l;

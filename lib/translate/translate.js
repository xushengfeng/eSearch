export { t, lan, getLans };
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
let rootDirL = __dirname.split(path.sep);
let outDir = rootDirL.lastIndexOf("out");
let rootDir = path.join(rootDirL.slice(0, outDir).join(path.sep), "./lib/translate");

var language = "";

/**
 * 切换语言
 * @param {string} lan 语言
 */
function lan(lan) {
    let lans = getLans();
    if (!lans.includes(lan)) {
        if (lans.includes(lan.split("-")[0])) language = lan.split("-")[0];
        else language = "zh-HANS";
    } else language = lan;
    if (language != "zh-HANS") {
        l = require(path.join(rootDir, `./${language}.json`));
    }
}

/**
 * 翻译
 * @param {string} text 原文字
 * @returns 翻译后的文字
 */
function t(text) {
    if (language === "zh-HANS") return text;
    const id = source[text];
    const t = l[id];
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

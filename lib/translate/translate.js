export { t, lan };

var language = "";

/**
 * 切换语言
 * @param {string} lan 语言
 */
function lan(lan) {
    language = lan;
    if (lan != "zh-HANS") {
        l = require(`./${lan}.json`);
    }
}

/**
 * 翻译
 * @param {string} text 原文字
 * @returns 翻译后的文字
 */
function t(text) {
    if (l2l[language] == "zh-HANS") return text;
    const t = l[source[text]];
    if (!t) console.warn(`${language}: ${text}`);
    return t | text;
}

let source = require("./source.json");
let l;

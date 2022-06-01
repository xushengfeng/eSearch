module.exports = {
    t,
    lan,
};

var language = "";
var l2l = {
    "zh-CN": "zh-HANS",
    "zh-SG": "zh-HANS",
    "zh-TW": "zh-HANT",
    "zh-HK": "zh-HANT",
    "en-GB": "en",
    "en-UK": "en",
    "fr-BE": "fr",
    "fr-CA": "fr",
    "fr-CH": "fr",
    "fr-FR": "fr",
    "fr-LU": "fr",
    "fr-MC": "fr",
    "ru-RU": "ru",
    "es-AR": "es",
    "es-BO": "es",
    "es-CL": "es",
    "es-CO": "es",
    "es-CR": "es",
    "es-DO": "es",
    "es-EC": "es",
    "es-ES": "es",
    "es-ES": "es",
    "es-GT": "es",
    "es-HN": "es",
    "es-MX": "es",
    "es-NI": "es",
    "es-PA": "es",
    "es-PE": "es",
    "es-PR": "es",
    "es-PY": "es",
    "es-SV": "es",
    "es-UY": "es",
    "es-VE": "es",
    "ar-AE": "ar",
    "ar-BH": "ar",
    "ar-DZ": "ar",
    "ar-EG": "ar",
    "ar-IQ": "ar",
    "ar-JO": "ar",
    "ar-KW": "ar",
    "ar-LB": "ar",
    "ar-LY": "ar",
    "ar-MA": "ar",
    "ar-OM": "ar",
    "ar-QA": "ar",
    "ar-SA": "ar",
    "ar-SY": "ar",
    "ar-TN": "ar",
    "ar-YE": "ar",
};

/**
 * 切换语言
 * @param {string} lan 语言
 */
function lan(lan) {
    language = lan;
}

/**
 * 翻译
 * @param {string} text 原文字
 * @returns 翻译后的文字
 */
function t(text) {
    if (l2l[language] == "zh-HANS") return text;
    return obj?.[text]?.[language] || obj?.[text]?.[l2l[language]] || text;
}

var obj = require("./translate.json");

// var a = Object.keys(obj).join("\n");
// 复制到翻译器翻译
// var b = "".split("\n");
// var n = 0;
// for (let i in obj) {
//     obj[i]["zh-S"] = b[n];
//     n++;
// }
// JSON.stringify(obj);

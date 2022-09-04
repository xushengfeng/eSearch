const s = decodeURIComponent(location.search);
const sl = s
    .slice(1)
    .split("&")
    .map((v) => v.split("="));
for (let i of sl) {
    switch (i[0]) {
        case "text":
            var text = i[1] || "";
            break;
        case "from":
            var fl = i[1] || "";
            break;
        case "to":
            var tl = i[1] || "";
            break;
        default:
            break;
    }
}
var api_id = JSON.parse(localStorage.getItem("fanyi"));
if (!api_id) {
    api_id = {
        baidu: { appid: "", key: "" },
        deepl: { key: "" },
        caiyun: { token: "" },
    };
    localStorage.setItem("fanyi", JSON.stringify(api_id));
}
document.querySelector("textarea").value = text || "";
document.querySelector("textarea").oninput = () => {
    text = document.querySelector("textarea").value;
    translate(text, fl, tl);
};
translate(text, fl, tl);
function translate(text, from, to) {
    baidu(text, from, to);
    youdao(text, from, to);
    caiyun(text, from, to);
}
function youdao(text, from, to) {
    fetch(`http://fanyi.youdao.com/translate?&doctype=json&type=AUTO&i=${encodeURIComponent(text)}`, {
        method: "GET",
    })
        .then((v) => v.json())
        .then((t) => {
        let l = [];
        for (let i of t.translateResult) {
            let t = "";
            for (let ii of i) {
                t += ii.tgt;
            }
            l.push(t);
        }
        document.getElementById("youdao").innerText = l.join("\n");
    });
}
function baidu(text, from, to) {
    if (!api_id.baidu.appid || !api_id.baidu.key)
        return;
    let appid = api_id.baidu.appid;
    let key = api_id.baidu.key;
    let salt = new Date().getTime();
    let str1 = appid + text + salt + key;
    let sign = MD5(str1);
    fetch(`http://api.fanyi.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(text)}&from=en&to=zh&appid=${appid}&salt=${salt}&sign=${sign}`)
        .then((v) => v.json())
        .then((t) => {
        let l = t.trans_result.map((v) => v.dst);
        document.getElementById("baidu").innerText = l.join("\n");
    });
}
function MD5(str1) {
    // @ts-ignore
    return md5(str1);
}
function deepl(text, from, to) {
    if (!api_id.deepl.key)
        return;
    fetch("https://api-free.deepl.com/v2/translate", {
        body: `text=${encodeURIComponent(text)}&target_lang=${to}`,
        headers: {
            Authorization: `DeepL-Auth-Key ${api_id.deepl.key}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
    })
        .then((v) => v.json())
        .then((t) => {
        let l = t.translations.map((x) => x.text);
        document.getElementById("deepl").innerText = l.join("\n");
    });
}
function caiyun(text, from, to) {
    if (!api_id.caiyun.token)
        return;
    let url = "http://api.interpreter.caiyunai.com/v1/translator";
    let token = api_id.caiyun.token;
    let payload = {
        source: text.split("\n"),
        trans_type: "auto2zh",
        request_id: "demo",
        detect: true,
    };
    let headers = {
        "content-type": "application/json",
        "x-authorization": "token " + token,
    };
    fetch(url, { method: "POST", body: JSON.stringify(payload), headers })
        .then((v) => v.json())
        .then((t) => {
        console.log(t);
        document.getElementById("caiyun").innerText = t.target.join("\n");
    });
}

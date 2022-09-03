const s = decodeURIComponent(location.search);
const sl = s
    .slice(1)
    .split("&")
    .map((v) => v.split("="));

for (let i of sl) {
    switch (i[0]) {
        case "text":
            var text = i[1];
            break;
        case "from":
            var fl = i[1];
            break;
        case "to":
            var tl = i[1];
            break;
        default:
            break;
    }
}

const api_id = JSON.parse(localStorage.getItem("fanyi"));

document.querySelector("textarea").value = text;

document.querySelector("textarea").oninput = () => {
    text = document.querySelector("textarea").value;
};

function translate(text: string, from: string, to: string) {
    baidu(text, from, to);
    youdao(text, from, to);
}

function youdao(text: string, from: string, to: string) {
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

function baidu(text: string, from: string, to: string) {
    let appid = api_id.baidu.appid;
    let key = api_id.baidu.key;
    let salt = new Date().getTime();
    let str1 = appid + text + salt + key;
    let sign = MD5(str1);
    fetch(
        `http://api.fanyi.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(
            text
        )}&from=en&to=zh&appid=${appid}&salt=${salt}&sign=${sign}`
    )
        .then((v) => v.json())
        .then((t) => {
            let l = t.trans_result.map((v) => v.dst);
            document.getElementById("baidu").innerText = l.join("\n");
        });
}

function MD5(str1: string) {
    // @ts-ignore
    return md5(str1);
}

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

document.querySelector("textarea").value = text;

document.querySelector("textarea").oninput = () => {
    text = document.querySelector("textarea").value;
};

function translate(text: string, from: string, to: string) {
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

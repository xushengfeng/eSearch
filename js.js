const { ipcRenderer, shell } = require("electron");

t = "";
type = "";
ipcRenderer.on("text", (event, list) => {
    t = list[0];
    type = list[1];
    if (type == "ocr") {
        show_ocr_r(t);
    }
    if (type == "QR") {
        show_t(t);
    }
    if (type == "text") {
        show_t(t);
    }
});

function show_ocr_r(t) {
    var t = JSON.parse(t);
    var r = "";
    var text = t["txts"];
    for (i in text) {
        r += text[i] + "</br>";
    }
    document.getElementById("text").innerHTML = r;
}

function show_t(t) {
    document.getElementById("text").innerHTML = t;
}

function replace_link(t) {
    regex = /(((https?|ftp|file):\/\/)?[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|])/g;
    return t.replace(regex, '<a href="https://$1">$1</a>');
}
function is_link(l) {}
document.getElementById("search_b").addEventListener("click", () => {
    s = // 要么全部，要么选中
        document.getSelection().toString() == ""
            ? document.getElementById("text").innerText
            : document.getSelection().toString();
    url = `https://www.baidu.com/s?wd=${s}`;
    console.log(url);
    shell.openExternal(url);
    window.open(url, "_blank");
});

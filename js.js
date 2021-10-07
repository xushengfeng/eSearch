const { ipcRenderer,shell } = require("electron");

t = "";
type = "";
ipcRenderer.on("text", (event, list) => {
    t = list[0];
    type = list[1];
    if (type == "ocr") {
        document.getElementById("text").innerText = t;
        replace_link();
    }
    if (type == "QR") {
        document.getElementById("text").innerText = t;
        replace_link();
    }
});

document.onkeydown = (e) => {
    if (e.ctrlKey) {
        replace_link();
        document.getElementById("text").contentEditable = false;
    }
};

document.onkeyup = (e) => {
    if (e.ctrlKey) {
        replace_link();
        document.getElementById("text").contentEditable = true;
    }
};

function replace_link() {
    regex = /(((https?|ftp|file):\/\/)?[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|])/g;
    document.getElementById("text").innerHTML = document
        .getElementById("text")
        .innerText.replace(regex, '<a href="https://$1">$1</a>');
}
function is_link(l){
    
}
document.getElementById("search_b").addEventListener("click", () => {
    s = // 要么全部，要么选中
        document.getSelection().toString() == ""
            ? document.getElementById("text").innerText
            : document.getSelection().toString();
    url = `https://www.baidu.com/s?wd=${s}`;
    console.log(url);
    shell.openExternal(url)
    window.open(url, '_blank');
});

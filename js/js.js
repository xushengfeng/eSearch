const { ipcRenderer, shell } = require("electron");
const Store = require("electron-store");

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

store = new Store();
自动搜索 = true;

function show_ocr_r(t) {
    var t = JSON.parse(t);
    var r = "";
    var text = t["words_result"];
    for (i in text) {
        r += text[i]["words"] + "\n";
    }
    document.getElementById("text").innerText = r;
    document.getElementById("text").innerHTML = replace_link(document.getElementById("text").innerHTML);
    if (自动搜索 && text.length == 1 && document.getElementById("text").innerHTML.match(/<url>/) == null) {
        if (t["language"] == "cn") {
            open_link("search");
        } else {
            open_link("translate");
        }
    }
}

function show_t(t) {
    document.getElementById("text").innerText = t;
    document.getElementById("text").innerHTML = replace_link(document.getElementById("text").innerHTML);
    if (自动搜索 && t.match(/\n/) == null && document.getElementById("text").innerHTML.match(/<url>/) == null) {
        if (t.match(/[\u4e00-\u9fa5]/g)?.length >= t.length) {
            // 中文字符过半
            open_link("search");
        } else {
            open_link("translate");
        }
    }
}

function replace_link(t) {
    regex =
        /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+(:[0-9]+)?|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)[^<]/g;
    return t.replace(regex, "<url>$1</url>");
}

editting = true;
document.onkeydown = (e) => {
    if (e.key == "Control") {
        document.querySelector("#text").contentEditable = false;
        document.querySelector("url").style.cursor = "pointer";
        editting = false;
        url_ele();
    }
};
document.onkeyup = (e) => {
    if (e.key == "Control") {
        document.querySelector("#text").contentEditable = true;
        editting = true;
        document.querySelector("url").style.cursor = "";
    }
};

function url_ele() {
    var urls = document.querySelectorAll("url");
    for (i in urls) {
        ((e) => {
            e.onclick = () => {
                if (editting == false) {
                    var url = e.innerText;
                    if (浏览器打开) {
                        shell.openExternal(url);
                    } else {
                        window.open(url, "_blank");
                    }
                }
            };
        })(urls[i]);
    }
}

搜索引擎_list = store.get("搜索引擎");

翻译引擎_list = store.get("翻译引擎");

search_c = "";
for (i in 搜索引擎_list) {
    if (搜索引擎_list[i][0].match(/\*\W*/) != null) {
        search_c += `<option selected value="${搜索引擎_list[i][1]}">${搜索引擎_list[i][0].replace("*", "")}</option>`;
    } else {
        search_c += `<option value="${搜索引擎_list[i][1]}">${搜索引擎_list[i][0]}</option>`;
    }
}
document.querySelector("#search_s").innerHTML = search_c;
translate_c = "";
for (i in 翻译引擎_list) {
    if (翻译引擎_list[i][0].match(/\*\W*/) != null) {
        translate_c += `<option selected value="${翻译引擎_list[i][1]}">${翻译引擎_list[i][0].replace(
            "*",
            ""
        )}</option>`;
    } else {
        translate_c += `<option value="${翻译引擎_list[i][1]}">${翻译引擎_list[i][0]}</option>`;
    }
}
document.querySelector("#translate_s").innerHTML = translate_c;

浏览器打开 = true;
document.querySelector("#browser_i").checked = 浏览器打开;
document.querySelector("#browser").onclick = () => {
    document.querySelector("#browser_i").checked = document.querySelector("#browser_i").checked ? false : true;
    浏览器打开 = document.querySelector("#browser_i").checked;
};

function open_link(id) {
    s = // 要么全部，要么选中
        document.getSelection().toString() == ""
            ? document.getElementById("text").innerText
            : document.getSelection().toString();
    url = document.querySelector(`#${id}_s`).value.replace("%s", s);
    if (浏览器打开) {
        shell.openExternal(url);
    } else {
        window.open(url, "_blank");
    }
}

document.querySelector("#search_b").onclick = () => {
    open_link("search");
};
document.querySelector("#translate_b").onclick = () => {
    open_link("translate");
};
document.querySelector("#search_s").oninput = () => {
    open_link("search");
};
document.querySelector("#translate_s").oninput = () => {
    open_link("translate");
};

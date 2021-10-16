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

自动搜索 = true;

function show_ocr_r(t) {
    var t = JSON.parse(t);
    var r = "";
    var text = t["words_result"];
    for (i in text) {
        r += text[i]["words"] + "</br>";
    }
    document.getElementById("text").innerHTML = replace_link(r);
    if (自动搜索 && text.length == 1) {
        if (t["language"] == "cn") {
            open_link("search");
        } else {
            open_link("translate");
        }
    }
}

function show_t(t) {
    document.getElementById("text").innerHTML = replace_link(t);
    if (自动搜索 && t.match(/\n/) == null) {
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
        /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+(:[0-9]+)?|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/g;
    return t.replace(regex, "<url>$1</url>");
}

editting = true;
document.onkeydown = (e) => {
    if (e.key == "Control") {
        document.getElementById("text").innerHTML = replace_link(document.getElementById("text").innerHTML);
        document.querySelector("#text").contentEditable = false;
        editting = false;
        url_ele();
    }
};
document.onkeyup = (e) => {
    if (e.key == "Control") {
        document.querySelector("#text").contentEditable = true;
        editting = true;
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

搜索引擎_默认 = "百度";
搜索引擎_list = {
    谷歌: "https://www.google.com/search?q=%s",
    百度: "https://www.baidu.com/s?wd=%s",
    必应: "https://cn.bing.com/search?q=%s",
};

翻译引擎_默认 = "google";
翻译引擎_list = {
    google: "https://translate.google.cn/?op=translate&text=%s",
    deepl: "https://www.deepl.com/translator#en/zh/%s",
    小米: "https://translator.ai.xiaomi.com/?text=%s&ua=transfer",
    金山词霸: "http://www.iciba.com/word?w=%s",
    百度: "https://fanyi.baidu.com/#en/zh/%s",
};

search_c = "";
for (i in 搜索引擎_list) {
    if (i == 搜索引擎_默认) {
        search_c += `<option selected value="${搜索引擎_list[i]}">${i}</option>`;
    } else {
        search_c += `<option value="${搜索引擎_list[i]}">${i}</option>`;
    }
}
document.querySelector("#search_s").innerHTML = search_c;
translate_c = "";
for (i in 翻译引擎_list) {
    if (i == 翻译引擎_默认) {
        translate_c += `<option selected value="${翻译引擎_list[i]}">${i}</option>`;
    } else {
        translate_c += `<option value="${翻译引擎_list[i]}">${i}</option>`;
    }
}
document.querySelector("#translate_s").innerHTML = translate_c;

浏览器打开 = document.querySelector("#browser_i").checked;

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
document.querySelector("#translate_b").oninput = () => {
    open_link("translate");
};

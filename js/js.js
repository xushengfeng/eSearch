const { ipcRenderer, shell, clipboard } = require("electron");
const Store = require("electron-store");

t = "";
type = "";
ipcRenderer.on("text", (event, list) => {
    t = list[0];
    language = list[1];
    show_t(t, language);
});

store = new Store();

模糊 = store.get("模糊") || 10;
if (模糊 != 0) {
    document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
} else {
    document.documentElement.style.setProperty("--blur", `none`);
}

自动搜索 = store.get("自动搜索");
自动打开链接 = store.get("自动打开链接");
自动搜索中文占比 = store.get("自动搜索中文占比") || 0.5;

// 判断链接
function is_link(url, s) {
    if (s) {
        // 严格模式
        var regex =
            /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+(:[0-9]+)?|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/g;
        if (url.match(regex) != null) {
            return true;
        } else {
            return false;
        }
    } else {
        // 有.就行
        if (url.match(/\./g) != null && url.match(/\s+/g) == null) {
            return true;
        } else {
            return false;
        }
    }
}

var history_list = store.get("历史记录") || [];

function show_t(t, language) {
    document.getElementById("text").innerText = t;
    if (t != "") history_list[history_list.length] = { text: t, time: new Date().getTime() };
    store.set("历史记录", history_list);
    // 严格模式
    if (is_link(t, true)) {
        if (自动打开链接) open_link("url", t);
    } else {
        if (language == "auto") {
            if (t.match(/[\u4e00-\u9fa5]/g)?.length >= t.length * 自动搜索中文占比) {
                language = "本地语言";
            } else {
                language = "外语";
            }
        }
        if (自动搜索 && t.match(/\n/) == null && t != "") {
            if (language == "本地语言") {
                open_link("search");
            } else {
                open_link("translate");
            }
        }
    }
}

// 选中释放鼠标显示编辑面板
document.getElementById("text").onmouseup = (e) => {
    // 简易判断链接并显示按钮
    if (is_link(document.getSelection().toString(), false)) {
        document.querySelector("#link_bar").style.display = "block";
    } else {
        document.querySelector("#link_bar").style.display = "";
    }
    // 排除没选中
    if (document.getSelection().toString() != "") {
        document.querySelector("#edit_b").style.display = "block";
        if (document.querySelector("#edit_b").offsetWidth + e.clientX <= window.innerWidth) {
            document.querySelector("#edit_b").style.left = e.clientX + "px";
            document.querySelector("#edit_b").style.top = e.clientY + "px";
        } else {
            document.querySelector("#edit_b").style.left =
                window.innerWidth - document.querySelector("#edit_b").offsetWidth + "px";
            document.querySelector("#edit_b").style.top = e.clientY + "px";
        }
    } else {
        document.querySelector("#edit_b").style.display = "none";
    }
};

搜索引擎_list = store.get("搜索引擎") || [
    ["谷歌", "https://www.google.com/search?q=%s"],
    ["*百度", "https://www.baidu.com/s?wd=%s"],
    ["必应", "https://cn.bing.com/search?q=%s"],
];

翻译引擎_list = store.get("翻译引擎") || [
    ["google", "https://translate.google.cn/?op=translate&text=%s"],
    ["deepl", "https://www.deepl.com/translator#en/zh/%s"],
    ["小米", "https://translator.ai.xiaomi.com/?text=%s&ua=transfer"],
    ["金山词霸", "http://www.iciba.com/word?w=%s"],
    ["百度", "https://fanyi.baidu.com/#en/zh/%s"],
];

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

浏览器打开 = store.get("浏览器中打开");
if (浏览器打开)
    document.querySelector("#browser_b").style.backgroundColor = getComputedStyle(
        document.documentElement
    ).getPropertyValue("--hover-color");

document.querySelector("#browser").onclick = () => {
    if (浏览器打开) {
        document.querySelector("#browser_b").style.backgroundColor = "";
        浏览器打开 = false;
    } else {
        document.querySelector("#browser_b").style.backgroundColor = getComputedStyle(
            document.documentElement
        ).getPropertyValue("--hover-color");
        浏览器打开 = true;
    }
};

// 打开浏览界面
function open_link(id, link) {
    if (id == "url") {
        if (link.match(/\/\//g) == null) {
            link = "https://" + link;
        }
        url = link;
    } else {
        s = // 要么全部，要么选中
            document.getSelection().toString() == ""
                ? document.getElementById("text").innerText
                : document.getSelection().toString();
        url = document.querySelector(`#${id}_s`).value.replace("%s", s);
    }
    if (浏览器打开) {
        shell.openExternal(url);
    } else {
        window.open(url, "_blank");
        // TODO 安全问题
    }
}

// 历史记录
history_showed = false;
document.querySelector("#history_b").onclick = () => {
    show_history();
};
// html转义
function html2Escape(sHtml) {
    return sHtml.replace(/[<>&"]/g, function (c) {
        return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
    });
}
function show_history() {
    if (history_showed) {
        document.querySelector("#history_b").style.backgroundColor = "";
        history_showed = false;
        document.querySelector("#history_list").style.height = "0";
    } else {
        document.querySelector("#history_b").style.backgroundColor = getComputedStyle(
            document.documentElement
        ).getPropertyValue("--hover-color");
        history_showed = true;

        var history_text = "";
        if (history_list.length != 0) {
            for (var i in history_list) {
                history_text =
                    `<div><div>${html2Escape(history_list[i].text)}</div><button></button></div>` + history_text;
            }
            document.querySelector("#history_list").innerHTML = history_text;
        }
        // 打开某项历史
        document.querySelectorAll("#history_list > div > div").forEach((e, index) => {
            e.addEventListener("click", () => {
                document.getElementById("text").innerText = history_list[index].text;
                show_history();
            });
        });
        // 删除某项历史
        // TODO多选
        document.querySelectorAll("#history_list > div > button").forEach((e, index) => {
            e.addEventListener("click", () => {
                delete history_list[index];
                history_list = history_list.flat();
                e.parentElement.remove();
                if (history_list.length == 0) {
                    document.querySelector("#history_list").innerText = "暂无历史记录";
                }
                store.set("历史记录", history_list);
            });
        });

        document.querySelector("#history_list").style.height = "100%";
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

document.querySelector("#link_bar").onmousedown = (event) => {
    event.preventDefault();
    var url = document.getSelection().toString();
    open_link("url", url);
};
document.querySelector("#search_bar").onmousedown = (event) => {
    event.preventDefault();
    open_link("search");
};
document.querySelector("#translate_bar").onmousedown = (event) => {
    event.preventDefault();
    open_link("translate");
};
document.querySelector("#cut_bar").onmousedown = (event) => {
    event.preventDefault();
    ipcRenderer.send("edit", "cut");
};
document.querySelector("#copy_bar").onmousedown = (event) => {
    event.preventDefault();
    ipcRenderer.send("edit", "copy");
};
document.querySelector("#paste_bar").onmousedown = (event) => {
    event.preventDefault();
    ipcRenderer.send("edit", "paste");
};

// 滚动条
var text_scroll = 0;
document.querySelector("#text").onscroll = () => {
    clearTimeout(text_scroll - 1);
    document.querySelector("#text").className = "";
    text_scroll = setTimeout(() => {
        document.querySelector("#text").className = "hidescrollbar";
    }, 1000);
};
var history_scroll = 0;
document.querySelector("#history").onscroll = () => {
    clearTimeout(history_scroll - 1);
    document.querySelector("#history").className = "";
    history_scroll = setTimeout(() => {
        document.querySelector("#history").className = "hidescrollbar";
    }, 1000);
};

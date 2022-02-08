const { ipcRenderer, shell } = require("electron");
const hotkeys = require("hotkeys-js");

window_name = "";
t = "";
type = "";
ipcRenderer.on("text", (event, name, list) => {
    window_name = name;

    t = list[0];
    language = list[1];
    show_t(t, language);
});

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
var 历史记录设置 = store.get("历史记录设置") || { 保留历史记录: true, 自动清除历史记录: false, d: 0, h: 0 };
if (历史记录设置.保留历史记录 && 历史记录设置.自动清除历史记录) {
    var now_time = new Date().getTime();
    var d_time = Math.round(历史记录设置.d * 86400 + 历史记录设置.h * 3600) * 1000;
    for (i in history_list) {
        if (now_time - history_list[i].time > d_time) {
            history_list.splice(i, 1);
        }
    }
}

function show_t(t, language) {
    document.getElementById("text").innerText = t;
    if (t != "" && 历史记录设置.保留历史记录) history_list.unshift({ text: t, time: new Date().getTime() });
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
    document.getElementById("text").focus();
    ipcRenderer.send("edit", window_name, "selectAll");
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

浏览器打开 = store.get("浏览器中打开");
if (浏览器打开) document.querySelector("#browser_b").className = "hover_b";

document.querySelector("#browser").onclick = () => {
    if (浏览器打开) {
        document.querySelector("#browser_b").className = "";
        浏览器打开 = false;
    } else {
        document.querySelector("#browser_b").className = "hover_b";
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
        ipcRenderer.send("open_url", url);
    }
}

// 历史记录
// 历史记录界面
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
Date.prototype.format = function (fmt) {
    let ret;
    const opt = {
        "Y+": this.getFullYear().toString(), // 年
        "m+": (this.getMonth() + 1).toString(), // 月
        "d+": this.getDate().toString(), // 日
        "H+": this.getHours().toString(), // 时
        "M+": this.getMinutes().toString(), // 分
        "S+": this.getSeconds().toString(), // 秒
        // 有其他格式化字符需求可以继续添加，必须转化成字符串
    };
    for (let k in opt) {
        ret = new RegExp("(" + k + ")").exec(fmt);
        if (ret) {
            fmt = fmt.replace(ret[1], ret[1].length == 1 ? opt[k] : opt[k].padStart(ret[1].length, "0"));
        }
    }
    return fmt;
};
function show_history() {
    if (history_showed) {
        document.querySelector("#history_b").className = "";
        history_showed = false;
        document.querySelector("#history_list").style.height = "0";
    } else {
        document.querySelector("#history_b").className = "hover_b";
        history_showed = true;

        var history_text = "";
        if (history_list.length != 0) {
            for (var i in history_list) {
                history_text =
                    history_text +
                    `<div><div class="history_title"><span>${new Date(history_list[i].time).format(
                        "mm-dd HH:MM"
                    )}</span><button></button></div><div class="history_text">${html2Escape(
                        history_list[i].text
                    )}</div></div>`;
            }
            document.querySelector("#history_list").innerHTML = history_text;
        }
        // 打开某项历史
        document.querySelectorAll("#history_list > div > .history_text").forEach((e, index) => {
            e.addEventListener("click", () => {
                document.getElementById("text").innerText = history_list[index].text;
                show_history();
            });
        });
        // 删除某项历史
        // TODO多选
        document.querySelectorAll("#history_list > div > .history_title > button").forEach((e, index) => {
            e.addEventListener("click", () => {
                delete history_list[index];
                history_list = history_list.flat();
                e.parentElement.parentElement.remove();
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

// 选中释放鼠标显示编辑面板
window.onmouseup = (e) => {
    // 延时等待(选中取消)
    if (e.clientY <= document.getElementById("b_bar").offsetTop)
        setTimeout(() => {
            show_edit_bar(e);
        }, 10);
};

function show_edit_bar(e) {
    // 简易判断链接并显示按钮
    if (is_link(document.getSelection().toString(), false)) {
        document.querySelector("#link_bar").style.width = "30px";
    } else {
        document.querySelector("#link_bar").style.width = "0";
    }
    // 排除没选中
    if (document.getSelection().toString() != "" || e.button == 2) {
        document.querySelector("#edit_b").className = "edit_s";
        var x = e.clientX < 0 ? 0 : e.clientX;
        if (document.querySelector("#edit_b").offsetWidth + e.clientX > window.innerWidth)
            x = window.innerWidth - document.querySelector("#edit_b").offsetWidth;
        var y = e.clientY < 0 ? 0 : e.clientY;
        document.querySelector("#edit_b").style.left = `${x}px`;
        document.querySelector("#edit_b").style.top = `${y}px`;
    } else {
        document.querySelector("#edit_b").className = "edit_h";
    }
}

document.querySelector("#edit_b").onmousedown = (e) => {
    e.preventDefault();
    switch (e.target.id) {
        case "link_bar":
            var url = document.getSelection().toString();
            open_link("url", url);
            break;
        case "search_bar":
            open_link("search");
            break;
        case "translate_bar":
            open_link("translate");
            break;
        case "selectAll_bar":
            ipcRenderer.send("edit", window_name, "selectAll");
            break;
        case "cut_bar":
            ipcRenderer.send("edit", window_name, "cut");
            break;
        case "copy_bar":
            ipcRenderer.send("edit", window_name, "copy");
            break;
        case "paste_bar":
            ipcRenderer.send("edit", window_name, "paste");
            break;
        case "delete_enter_bar":
            delete_enter();
            break;
    }
};

function delete_enter() {
    if (document.getSelection().toString() == "") {
        var text = document.getElementById("text").innerText;
        document.getElementById("text").innerText = p(text);
    } else {
        var text = document.getSelection().toString();
        var range = document.getSelection().getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(p(text)));
    }

    function p(t) {
        if (t.match(/[\u4e00-\u9fa5]/g)?.length >= t.length * 自动搜索中文占比) {
            t = t.replace(/(?<=[^。])\n/g, "");
        } else {
            t = t.replace(/(?<=[^.])\n/g, " ");
        }
        return t;
    }
}

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

hotkeys("ctrl+h", show_history);

hotkeys("ctrl+,", () => {
    window.open("setting.html");
});

// ctrl滚轮控制字体大小
hotkeys("ctrl+0", () => {
    document.getElementById("text").style.fontSize = "16px";
});

document.onwheel = (e) => {
    if (e.ctrlKey) {
        var d = e.deltaY / Math.abs(e.deltaY);
        var size = (document.getElementById("text").style.fontSize || "16px").replace("px", "") - 0;
        document.getElementById("text").style.fontSize = `${size - d}px`;
    }
};

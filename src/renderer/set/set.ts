/// <reference types="vite/client" />
let config_path = new URLSearchParams(location.search).get("config_path");
const path = require("path") as typeof import("path");
import "../../../lib/template.js";
import "../../../lib/template2.js";
const { shell, ipcRenderer } = require("electron") as typeof import("electron");
const os = require("os") as typeof import("os");
const fs = require("fs") as typeof import("fs");
import close_svg from "../assets/icons/close.svg";

document.querySelectorAll("#tab_bar a").forEach((el: HTMLAnchorElement) => {
    let url = new URL(el.href);
    url.search = location.search;
    el.href = url.toString();
});

let old_store = JSON.parse(fs.readFileSync(path.join(config_path, "config.json"), "utf-8"));
import { t, lan } from "../../../lib/translate/translate";
lan(old_store.语言.语言);
document.body.innerHTML = document.body.innerHTML
    .replace(/\{(.*?)\}/g, (m, v) => t(v))
    .replace(/<t>(.*?)<\/t>/g, (m, v) => t(v));
document.title = t(document.title);

const xstore = old_store;
function store_set(path: string, value: any) {
    let pathx = path.split(".");
    const lastp = pathx.pop();
    const lastobj = pathx.reduce((p, c) => (p[c] = p[c] || {}), xstore);
    lastobj[lastp] = value;
}

let store = { path: path.join(config_path, "config.json") };
let history_store = { path: path.join(config_path, "history.json") };

document.getElementById("set_default_setting").onclick = () => {
    if (confirm("将会把所有设置恢复成默认，无法撤销")) {
        ipcRenderer.send("setting", "set_default_setting");
        give_up = true;
        location.reload();
    }
};

document.getElementById("menu").onclick = (e) => {
    let el = <HTMLElement>e.target;
    if (el.tagName == "LI") {
        let i = 0;
        document
            .getElementById("menu")
            .querySelectorAll("li")
            .forEach((lel, n) => {
                if (lel == el) {
                    i = n;
                    return;
                }
            });
        document.getElementsByTagName("html")[0].scrollTop = document.querySelectorAll("h1")[i].offsetTop;
    }
};

ipcRenderer.send("autostart", "get");
ipcRenderer.on("开机启动状态", (event, v) => {
    (<HTMLInputElement>document.getElementById("autostart")).checked = v;
});
document.getElementById("autostart").oninput = () => {
    ipcRenderer.send("autostart", "set", (<HTMLInputElement>document.getElementById("autostart")).checked);
};

(<HTMLInputElement>document.getElementById("启动提示")).checked = old_store.启动提示;

function get_radio(el: HTMLElement) {
    return (<HTMLInputElement>el.querySelector("input[type=radio]:checked")).value;
}
function set_radio(el: HTMLElement, value: string) {
    (
        <HTMLInputElement>el.querySelector(`input[type=radio][value="${value}"]`) ||
        el.querySelector(`input[type=radio]`)
    ).checked = true;
}
set_radio(document.getElementById("语言"), old_store.语言.语言);
document.getElementById("系统语言").onclick = () => {
    if (navigator.language.split("-")[0] == "zh") {
        set_radio(
            document.getElementById("语言"),
            {
                "zh-CN": "zh-HANS",
                "zh-SG": "zh-HANS",
                "zh-TW": "zh-HANT",
                "zh-HK": "zh-HANT",
            }[navigator.language]
        );
    } else {
        set_radio(document.getElementById("语言"), navigator.language.split("-")[0]);
    }
    lan(get_radio(document.getElementById("语言")));
    document.getElementById("语言重启").innerText = t("重启软件以生效");
};
document.getElementById("语言").onclick = () => {
    lan(get_radio(document.getElementById("语言")));
    document.getElementById("语言重启").innerText = t("重启软件以生效");
};

document.getElementById("语言重启").onclick = () => {
    store_set("语言.语言", get_radio(document.getElementById("语言")));
    ipcRenderer.send("setting", "reload");
};

(<HTMLInputElement>document.getElementById("自动搜索排除")).value = old_store.主搜索功能.自动搜索排除.join("\n");
if (process.platform == "linux") {
    document.getElementById("linux_selection").style.display = "block";
    (<HTMLInputElement>document.getElementById("剪贴板选区搜索")).checked = old_store.主搜索功能.剪贴板选区搜索;
}

var 全局 = old_store.全局;

set_radio(document.getElementById("深色模式"), old_store.全局.深色模式);
document.getElementById("深色模式").onclick = () => {
    ipcRenderer.send("theme", get_radio(document.getElementById("深色模式")));
};

var 模糊 = old_store.全局.模糊;
if (模糊 != 0) {
    document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
} else {
    document.documentElement.style.setProperty("--blur", `none`);
}
(<HTMLInputElement>document.getElementById("模糊")).value = 模糊;
document.getElementById("模糊").oninput = () => {
    var 模糊 = (<HTMLInputElement>document.getElementById("模糊")).value;
    if (Number(模糊) != 0) {
        document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
    } else {
        document.documentElement.style.setProperty("--blur", `none`);
    }
};

document.documentElement.style.setProperty("--alpha", 全局.不透明度);
(<HTMLInputElement>document.getElementById("不透明度")).value = String(全局.不透明度 * 100);
document.getElementById("不透明度").oninput = () => {
    var 不透明度 = (<HTMLInputElement>document.getElementById("不透明度")).value;
    document.documentElement.style.setProperty("--alpha", String(Number(不透明度) / 100));
};

(<HTMLInputElement>document.getElementById("全局缩放")).value = old_store.全局.缩放;

// 单选项目设置加载
function 选择器储存(id, 默认) {
    set_radio(document.querySelector(`#${id}`), old_store[id] || 默认);
    (<HTMLElement>document.querySelector(`#${id}`)).onclick = () => {
        store_set(id, get_radio(<HTMLInputElement>document.querySelector(`#${id}`)));
    };
}

var 快捷键 = old_store.快捷键;
document.querySelectorAll("#快捷键 hot-keys").forEach((el: any) => {
    el.value = 快捷键[el.name].key;
    el.addEventListener("inputend", () => {
        ipcRenderer.send("快捷键", [el.name, el.value]);
    });
});
ipcRenderer.on("状态", (event, name, arg) => {
    (<any>document.querySelector(`hot-keys[name=${name}]`)).t = arg;
    if (t) store_set(`快捷键.${name}.key`, (<any>document.querySelector(`hot-keys[name=${name}]`)).value);
});

var 其他快捷键 = old_store.其他快捷键;
(<HTMLInputElement>document.querySelector(`hot-keys[name="关闭"]`)).value = 其他快捷键.关闭;
(<HTMLInputElement>document.querySelector(`hot-keys[name="OCR(文字识别)"]`)).value = 其他快捷键.OCR;
(<HTMLInputElement>document.querySelector(`hot-keys[name="以图搜图"]`)).value = 其他快捷键.以图搜图;
(<HTMLInputElement>document.querySelector(`hot-keys[name="QR码"]`)).value = 其他快捷键.QR码;
(<HTMLInputElement>document.querySelector(`hot-keys[name="图像编辑"]`)).value = 其他快捷键.图像编辑;
(<HTMLInputElement>document.querySelector(`hot-keys[name="其他应用打开"]`)).value = 其他快捷键.其他应用打开;
(<HTMLInputElement>document.querySelector(`hot-keys[name="放在屏幕上"]`)).value = 其他快捷键.放在屏幕上;
(<HTMLInputElement>document.querySelector(`hot-keys[name="复制"]`)).value = 其他快捷键.复制;
(<HTMLInputElement>document.querySelector(`hot-keys[name="保存"]`)).value = 其他快捷键.保存;
(<HTMLInputElement>document.querySelector(`hot-keys[name="复制颜色"]`)).value = 其他快捷键.复制颜色;

选择器储存("工具栏跟随", "展示内容优先");
选择器储存("光标", "以(1,1)为起点");
选择器储存("取色器默认格式", "HEX");

(<HTMLInputElement>document.getElementById("按钮大小")).value = old_store.工具栏.按钮大小;
(<HTMLInputElement>document.getElementById("按钮图标比例")).value = old_store.工具栏.按钮图标比例;

(<HTMLInputElement>document.getElementById("显示四角坐标")).checked = old_store.显示四角坐标;

// 取色器设置
(<HTMLInputElement>document.getElementById("取色器大小")).value = old_store.取色器大小;
(<HTMLInputElement>document.getElementById("像素大小")).value = old_store.像素大小;
document.getElementById("取色器大小").oninput = () => {
    if (Number((<HTMLInputElement>document.getElementById("取色器大小")).value) % 2 == 0) {
        (<HTMLInputElement>document.getElementById("取色器大小")).value = String(
            Number((<HTMLInputElement>document.getElementById("取色器大小")).value) + 1
        );
    }
    show_color_picker();
};
document.getElementById("像素大小").oninput = () => {
    show_color_picker();
};

show_color_picker();
function show_color_picker() {
    let color_size = Number((<HTMLInputElement>document.getElementById("取色器大小")).value);
    let inner_html = "";
    for (let i = 0; i < color_size ** 2; i++) {
        var l = Math.random() * 40 + 60;
        inner_html += `<span id="point_color_t"style="background:hsl(0,0%,${l}%);width:${
            (<HTMLInputElement>document.getElementById("像素大小")).value
        }px;height:${(<HTMLInputElement>document.getElementById("像素大小")).value}px"></span>`;
    }
    document.getElementById("point_color").style.width =
        Number((<HTMLInputElement>document.getElementById("像素大小")).value) * color_size + "px";
    document.getElementById("point_color").style.height =
        Number((<HTMLInputElement>document.getElementById("像素大小")).value) * color_size + "px";
    document.getElementById("point_color").innerHTML = inner_html;
}

// 选区&遮罩颜色设置
function msk(t: string) {
    return `linear-gradient(${t},${t}),
    conic-gradient(
            rgb(204, 204, 204) 25%,
            rgb(255, 255, 255) 0deg,
            rgb(255, 255, 255) 50%,
            rgb(204, 204, 204) 0deg,
            rgb(204, 204, 204) 75%,
            rgb(255, 255, 255) 0deg
        )
        0% 0% / 8px 8px`;
}
(<HTMLSpanElement>document.querySelector("#遮罩颜色 > span")).style.background = msk(old_store.遮罩颜色);
(<HTMLSpanElement>document.querySelector("#选区颜色 > span")).style.background = msk(old_store.选区颜色);
(<HTMLInputElement>document.querySelector("#遮罩颜色 > input")).value = old_store.遮罩颜色;
(<HTMLInputElement>document.querySelector("#选区颜色 > input")).value = old_store.选区颜色;
(<HTMLInputElement>document.querySelector("#遮罩颜色 > input")).oninput = () => {
    (<HTMLSpanElement>document.querySelector("#遮罩颜色 > span")).style.background = msk(
        (<HTMLInputElement>document.querySelector("#遮罩颜色 > input")).value
    );
};
(<HTMLInputElement>document.querySelector("#选区颜色 > input")).oninput = () => {
    (<HTMLSpanElement>document.querySelector("#选区颜色 > span")).style.background = msk(
        (<HTMLInputElement>document.querySelector("#选区颜色 > input")).value
    );
};

set_radio(document.getElementById("框选后默认操作"), old_store.框选后默认操作);

(<HTMLInputElement>document.getElementById("自动框选")).checked = old_store.框选.自动框选.开启;
(<HTMLInputElement>document.getElementById("自动框选图像识别")).checked = old_store.框选.图像识别;
(<HTMLInputElement>document.getElementById("框选最小阈值")).value = old_store.框选.自动框选.最小阈值;
(<HTMLInputElement>document.getElementById("框选最大阈值")).value = old_store.框选.自动框选.最大阈值;
document.getElementById("框选最小阈值").oninput = () => {
    if (
        (<HTMLInputElement>document.getElementById("框选最小阈值")).value >
        (<HTMLInputElement>document.getElementById("框选最大阈值")).value
    ) {
        (<HTMLInputElement>document.getElementById("框选最大阈值")).value = (<HTMLInputElement>(
            document.getElementById("框选最小阈值")
        )).value;
    }
};
document.getElementById("框选最大阈值").oninput = () => {
    if (
        (<HTMLInputElement>document.getElementById("框选最大阈值")).value <
        (<HTMLInputElement>document.getElementById("框选最小阈值")).value
    ) {
        (<HTMLInputElement>document.getElementById("框选最小阈值")).value = (<HTMLInputElement>(
            document.getElementById("框选最大阈值")
        )).value;
    }
};

(<HTMLInputElement>document.getElementById("记住框选大小")).checked = old_store.框选.记忆.开启;

(<HTMLInputElement>document.getElementById("填充颜色")).value = old_store.图像编辑.默认属性.填充颜色;
(<HTMLInputElement>document.getElementById("边框颜色")).value = old_store.图像编辑.默认属性.边框颜色;
(<HTMLInputElement>document.getElementById("边框宽度")).value = old_store.图像编辑.默认属性.边框宽度;
(<HTMLInputElement>document.getElementById("画笔颜色")).value = old_store.图像编辑.默认属性.画笔颜色;
(<HTMLInputElement>document.getElementById("画笔粗细")).value = old_store.图像编辑.默认属性.画笔粗细;

(<HTMLInputElement>document.getElementById("复制dx")).value = old_store.图像编辑.复制偏移.x;
(<HTMLInputElement>document.getElementById("复制dy")).value = old_store.图像编辑.复制偏移.y;

(<HTMLInputElement>document.getElementById("plugin")).value = old_store.插件.加载后.join("\n");
document.getElementById("plugin_b").onclick = () => {
    ipcRenderer.send(
        "setting",
        "open_dialog",
        { filters: [{ name: "js | css", extensions: ["js", "css"] }], properties: ["openFile"] },
        "plugin"
    );
};

(<HTMLInputElement>document.getElementById("tran_css")).value = old_store.贴图.窗口.变换;
set_radio(document.getElementById("贴图双击"), old_store.贴图.窗口.双击);

set_radio(document.getElementById("快速截屏"), old_store.快速截屏.模式);
(<HTMLInputElement>document.getElementById("快速截屏路径")).value = old_store.快速截屏.路径;
document.getElementById("获取保存路径").onclick = () => {
    ipcRenderer.send("get_save_path", (<HTMLInputElement>document.getElementById("快速截屏路径")).value || "");
    ipcRenderer.on("get_save_path", (e, a) => {
        (<HTMLInputElement>document.getElementById("快速截屏路径")).value = a;
    });
};

(<HTMLInputElement>document.getElementById("开启自动录制")).checked = old_store.录屏.自动录制 !== false;
(<HTMLInputElement>document.getElementById("自动录制延时")).value = old_store.录屏.自动录制 || 0;
(<HTMLInputElement>document.getElementById("视频比特率")).value = old_store.录屏.视频比特率;
(<HTMLInputElement>document.getElementById("默认开启摄像头")).checked = old_store.录屏.摄像头.默认开启;
(<HTMLInputElement>document.getElementById("记录摄像头开启状态")).checked = old_store.录屏.摄像头.记住开启状态;
(<HTMLInputElement>document.getElementById("摄像头镜像")).checked = old_store.录屏.摄像头.镜像;

(<HTMLInputElement>document.getElementById("默认开启音频")).checked = old_store.录屏.音频.默认开启;
(<HTMLInputElement>document.getElementById("记录音频开启状态")).checked = old_store.录屏.音频.记住开启状态;

(<HTMLInputElement>document.getElementById("开启自动转换")).checked = old_store.录屏.转换.自动转换;
(<HTMLInputElement>document.getElementById("格式")).value = old_store.录屏.转换.格式;
(<HTMLInputElement>document.getElementById("码率")).value = old_store.录屏.转换.码率;
(<HTMLInputElement>document.getElementById("帧率")).value = old_store.录屏.转换.帧率;
(<HTMLInputElement>document.getElementById("ff其他参数")).value = old_store.录屏.转换.其他;
(<HTMLInputElement>document.getElementById("高质量gif")).checked = old_store.录屏.转换.高质量gif;

(<HTMLInputElement>document.getElementById("开启键盘按键提示")).checked = old_store.录屏.提示.键盘.开启;
(<HTMLInputElement>document.getElementById("开启鼠标按键提示")).checked = old_store.录屏.提示.鼠标.开启;
(<HTMLInputElement>document.getElementById("开启光标提示")).checked = old_store.录屏.提示.光标.开启;
(<HTMLInputElement>document.getElementById("cursor_css")).value = old_store.录屏.提示.光标.样式;

(<HTMLInputElement>document.getElementById("保存文件名称前缀")).value = old_store.保存名称.前缀;
(<HTMLInputElement>document.getElementById("保存文件名称时间")).value = old_store.保存名称.时间;
(<HTMLInputElement>document.getElementById("保存文件名称后缀")).value = old_store.保存名称.后缀;
document.getElementById("保存文件名称前缀").oninput = document.getElementById("保存文件名称后缀").oninput = (e) => {
    let el = <HTMLInputElement>e.target;
    el.style.width = `${el.value.length || 1}em`;
    show_f_time();
};
document.getElementById("保存文件名称时间").oninput = show_f_time;
import time_format from "../../../lib/time_format";
function show_f_time() {
    var save_time = new Date();
    document.getElementById("保存文件名称_p").innerText = `${
        (<HTMLInputElement>document.getElementById("保存文件名称前缀")).value
    }${time_format((<HTMLInputElement>document.getElementById("保存文件名称时间")).value, save_time)}${
        (<HTMLInputElement>document.getElementById("保存文件名称后缀")).value
    }`;
}
show_f_time();
document.getElementById("保存文件名称前缀").style.width = `${
    (<HTMLInputElement>document.getElementById("保存文件名称前缀")).value.length || 1
}em`;
document.getElementById("保存文件名称后缀").style.width = `${
    (<HTMLInputElement>document.getElementById("保存文件名称后缀")).value.length || 1
}em`;

set_radio(document.getElementById("默认格式"), old_store.保存.默认格式);

(<HTMLInputElement>document.getElementById("jpg质量")).value = old_store.jpg质量;

(<HTMLInputElement>document.getElementById("快速保存")).checked = old_store.保存.快速保存;

var 字体 = old_store.字体;
document.documentElement.style.setProperty("--main-font", 字体.主要字体);
document.documentElement.style.setProperty("--monospace", 字体.等宽字体);
(<HTMLInputElement>document.querySelector("#主要字体 > input")).value = 字体.主要字体;
(<HTMLInputElement>document.querySelector("#等宽字体 > input")).value = 字体.等宽字体;
(<HTMLInputElement>document.getElementById("字体大小")).value = 字体.大小;
(<HTMLInputElement>document.getElementById("记住字体大小")).checked = 字体.记住;

(<HTMLInputElement>document.querySelector("#主要字体 > input")).oninput = () => {
    字体.主要字体 = (<HTMLInputElement>document.querySelector("#主要字体 > input")).value;
    document.documentElement.style.setProperty("--main-font", 字体.主要字体);
};
(<HTMLInputElement>document.querySelector("#等宽字体 > input")).oninput = () => {
    字体.等宽字体 = (<HTMLInputElement>document.querySelector("#等宽字体 > input")).value;
    document.documentElement.style.setProperty("--monospace", 字体.等宽字体);
};

const { hexToCSSFilter } = require("hex-to-css-filter");
(<HTMLInputElement>document.querySelector("#图标颜色 > input")).value = old_store.全局.图标颜色[0];
document.documentElement.style.setProperty("--icon-color", old_store.全局.图标颜色[1]);
(<HTMLInputElement>document.querySelector("#图标颜色 > input")).oninput = () => {
    document.documentElement.style.setProperty(
        "--icon-color",
        hexToCSSFilter((<HTMLInputElement>document.querySelector("#图标颜色 > input")).value).filter.replace(";", "")
    );
};

(<HTMLInputElement>document.getElementById("换行")).checked = old_store.编辑器.自动换行;
(<HTMLInputElement>document.getElementById("拼写检查")).checked = old_store.编辑器.拼写检查;
(<HTMLInputElement>document.getElementById("行号")).checked = old_store.编辑器.行号;

(<HTMLInputElement>document.getElementById("自动搜索")).checked = old_store.自动搜索;
(<HTMLInputElement>document.getElementById("自动打开链接")).checked = old_store.自动打开链接;
(<HTMLInputElement>document.getElementById("自动搜索中文占比")).value = old_store.自动搜索中文占比;

var o_搜索引擎 = old_store.搜索引擎;
if (o_搜索引擎) {
    var text = "";
    var default_en = `<div id="默认搜索引擎">`;
    for (let i in o_搜索引擎) {
        text += `${o_搜索引擎[i][0]}, ${o_搜索引擎[i][1]}\n`;
        default_en += `<label><input type="radio" name="默认搜索引擎" value="${o_搜索引擎[i][0]}">${o_搜索引擎[i][0]}</label>`;
    }
    (<HTMLInputElement>document.getElementById("搜索引擎")).value = text;
    default_en += `</div>`;
    document.getElementById("默认搜索引擎div").innerHTML = default_en;
    set_radio(document.getElementById("默认搜索引擎"), old_store.引擎.默认搜索引擎);
}
document.getElementById("搜索引擎").onchange = () => {
    o_搜索引擎 = [];
    var text = (<HTMLInputElement>document.getElementById("搜索引擎")).value;
    var text_l = text.split("\n");
    var default_en = `<div id="默认搜索引擎">`;
    for (let i in text_l) {
        var r = /(\S+)\W*[,，:：]\W*(\S+)/g;
        var l = text_l[i].replace(r, "$1,$2").split(",");
        if (l[0] != "") {
            o_搜索引擎[i] = [l[0], l[1]];
            default_en += `<label><input type="radio" name="默认搜索引擎" value="${l[0]}">${l[0]}</label>`;
        }
    }
    default_en += `</div>`;
    document.getElementById("默认搜索引擎div").innerHTML = default_en;
    set_radio(document.getElementById("默认搜索引擎"), o_搜索引擎[0][0]);
};

var o_翻译引擎 = old_store.翻译引擎;
if (o_翻译引擎) {
    var text = "";
    var default_en = `<div id="默认翻译引擎">`;
    for (let i in o_翻译引擎) {
        text += `${o_翻译引擎[i][0]}, ${o_翻译引擎[i][1]}\n`;
        default_en += `<label><input type="radio" name="默认翻译引擎" value="${o_翻译引擎[i][0]}">${o_翻译引擎[i][0]}</label>`;
    }
    (<HTMLInputElement>document.getElementById("翻译引擎")).value = text;
    default_en += `</div>`;
    document.getElementById("默认翻译引擎div").innerHTML = default_en;
    set_radio(document.getElementById("默认翻译引擎"), old_store.引擎.默认翻译引擎);
}
document.getElementById("翻译引擎").onchange = () => {
    o_翻译引擎 = [];
    var text = (<HTMLInputElement>document.getElementById("翻译引擎")).value;
    var text_l = text.split("\n");
    var default_en = `<div id="默认翻译引擎">`;
    for (let i in text_l) {
        var r = /(\S+)\W*[,，:：]\W*(\S+)/g;
        var l = text_l[i].replace(r, "$1,$2").split(",");
        if (l[0] != "") {
            o_翻译引擎[i] = [l[0], l[1]];
            default_en += `<label><input type="radio" name="默认翻译引擎" value="${l[0]}">${l[0]}</label>`;
        }
    }
    default_en += `</div>`;
    document.getElementById("默认翻译引擎div").innerHTML = default_en;
    set_radio(document.getElementById("默认翻译引擎"), o_翻译引擎[0][0]);
};
(<HTMLInputElement>document.getElementById("记住引擎")).checked = old_store.引擎.记住;

set_radio(document.getElementById("图像搜索引擎"), old_store.以图搜图.引擎);
(<HTMLInputElement>document.getElementById("记住识图引擎")).checked = old_store.以图搜图.记住;

(<HTMLInputElement>document.getElementById("浏览器中打开")).checked = old_store.浏览器中打开;
(<HTMLInputElement>document.getElementById("搜索窗口自动关闭")).checked = old_store.浏览器.标签页.自动关闭;
(<HTMLInputElement>document.getElementById("标签缩小")).checked = old_store.浏览器.标签页.小;
(<HTMLInputElement>document.getElementById("标签灰度")).checked = old_store.浏览器.标签页.灰度;

document.getElementById("clear_storage").onclick = () => {
    ipcRenderer.send("setting", "clear", "storage");
};
document.getElementById("clear_cache").onclick = () => {
    ipcRenderer.send("setting", "clear", "cache");
};

document.getElementById("main_b").onclick = () => {
    window.location.href = "index.html";
};

function set_ocr() {
    let ocr_in = "";
    for (let i of old_store.离线OCR) {
        ocr_in += `<label><input type="radio" name="OCR类型" value="${i[0]}">${i[0]}</label>`;
    }
    ocr_in += `
    <label><input type="radio" name="OCR类型" value="youdao">
        <t>有道</t>
    </label>
    <label><input type="radio" name="OCR类型" value="baidu">
        <t>百度</t>
    </label>`;
    document.getElementById("OCR类型").outerHTML = `<div id="OCR类型">${ocr_in}</div>`;
    set_radio(document.getElementById("OCR类型"), old_store.OCR.类型);
}

set_ocr();

function get_ocr_type() {
    return get_radio(<HTMLInputElement>document.getElementById("OCR类型"));
}
ocr_d_open();
function ocr_d_open() {
    (<HTMLDetailsElement>document.getElementById("baidu_details")).open = false;
    (<HTMLDetailsElement>document.getElementById("youdao_details")).open = false;
    if (get_ocr_type() == "baidu") {
        (<HTMLDetailsElement>document.getElementById("baidu_details")).open = true;
    } else if (get_ocr_type() == "youdao") {
        (<HTMLDetailsElement>document.getElementById("youdao_details")).open = true;
    }
}
document.getElementById("OCR类型").onclick = ocr_d_open;
(<HTMLInputElement>document.getElementById("记住OCR引擎")).checked = old_store.OCR.记住;
(<HTMLInputElement>document.getElementById("离线切换")).checked = old_store.OCR.离线切换;

function OCR模型展示() {
    document.getElementById("OCR模型列表").innerHTML = "";
    let all = old_store.离线OCR as any[];
    for (let i in all) {
        let d = document.createElement("div");
        let t = document.createElement("input");
        t.type = "text";
        t.value = all[i][0];
        t.oninput = () => {
            all[i][0] = t.value;
            store_set("离线OCR", all);
            set_ocr();
        };
        d.append(t);
        let c = document.createElement("button");
        c.innerHTML = `<img src="${close_svg}" class="icon">`;
        c.onclick = () => {
            if (all.length == 1) return;
            all.splice(Number(i), 1);
            d.remove();
            store_set("离线OCR", all);
            set_ocr();
        };
        d.append(c);
        document.getElementById("OCR模型列表").append(d);
    }
}
OCR模型展示();

document.getElementById("OCR拖拽放置区").ondragover = (e) => {
    e.preventDefault();
    document.getElementById("OCR拖拽放置区").classList.add("拖拽突出");
};
document.getElementById("OCR拖拽放置区").ondragleave = () => {
    document.getElementById("OCR拖拽放置区").classList.remove("拖拽突出");
};
document.getElementById("OCR拖拽放置区").ondrop = (e) => {
    e.preventDefault();
    console.log(e);
    let fs = e.dataTransfer.files;
    let l = [`新模型${crypto.randomUUID().slice(0, 7)}`];
    l[1] = "默认/ppocr_det.onnx";
    l[2] = "默认/ppocr_rec.onnx";
    l[3] = "默认/ppocr_keys_v1.txt";
    for (let f of fs) {
        // @ts-ignore
        let path = f.path as string;
        if (path.includes("det")) {
            l[1] = path;
        } else if (path.includes("rec")) {
            l[2] = path;
        } else {
            l[3] = path;
        }
    }
    let all = old_store.离线OCR;
    all.push(l);
    store_set("离线OCR", all);
    OCR模型展示();
    set_ocr();
    document.getElementById("OCR拖拽放置区").classList.remove("拖拽突出");
};

set_radio(document.getElementById("baidu_ocr_url"), old_store.在线OCR.baidu.url);
(<HTMLInputElement>document.getElementById("baidu_ocr_id")).value = old_store.在线OCR.baidu.id;
(<HTMLInputElement>document.getElementById("baidu_ocr_secret")).value = old_store.在线OCR.baidu.secret;
(<HTMLInputElement>document.getElementById("youdao_ocr_id")).value = old_store.在线OCR.youdao.id;
(<HTMLInputElement>document.getElementById("youdao_ocr_secret")).value = old_store.在线OCR.youdao.secret;

var 历史记录设置 = old_store.历史记录设置;

(<HTMLButtonElement>document.getElementById("清除历史记录")).disabled = !历史记录设置.保留历史记录;
(<HTMLButtonElement>document.getElementById("his_d")).disabled = !历史记录设置.自动清除历史记录;
(<HTMLButtonElement>document.getElementById("his_h")).disabled = !历史记录设置.自动清除历史记录;
(<HTMLInputElement>document.getElementById("his_d")).value = 历史记录设置.d;
(<HTMLInputElement>document.getElementById("his_h")).value = 历史记录设置.h;

document.getElementById("历史记录_b").oninput = () => {
    历史记录设置.保留历史记录 = (<HTMLInputElement>document.getElementById("历史记录_b")).checked;
    (<HTMLButtonElement>document.getElementById("清除历史记录")).disabled = !(<HTMLInputElement>(
        document.getElementById("历史记录_b")
    )).checked;
};
document.getElementById("清除历史记录").oninput = () => {
    历史记录设置.自动清除历史记录 = (<HTMLInputElement>document.getElementById("清除历史记录")).checked;
    (<HTMLButtonElement>document.getElementById("his_d")).disabled = !(<HTMLInputElement>(
        document.getElementById("清除历史记录")
    )).checked;
    (<HTMLButtonElement>document.getElementById("his_h")).disabled = !(<HTMLInputElement>(
        document.getElementById("清除历史记录")
    )).checked;
};
document.getElementById("clear_his").onclick = () => {
    var c = confirm("这将清除所有的历史记录\n且不能复原\n确定清除？");
    if (c) fs.writeFileSync(path.join(config_path, "history.json"), JSON.stringify({ 历史记录: {} }, null, 2));
};

(<HTMLInputElement>document.getElementById("时间格式")).value = old_store.时间格式;

var proxy_l = ["http", "https", "ftp", "socks"];

var 代理 = old_store.代理;
set_radio(document.getElementById("代理"), 代理.mode);
(<HTMLInputElement>document.getElementById("pacScript")).value = 代理.pacScript;
get_proxy();
(<HTMLInputElement>document.getElementById("proxyBypassRules")).value = 代理.proxyBypassRules;

set_proxy_el();
document.getElementById("代理").onclick = set_proxy_el;
function set_proxy_el() {
    const m = get_radio(document.getElementById("代理"));
    const pacScript_el = document.getElementById("pacScript_p");
    const proxyRules_el = document.getElementById("proxyRules_p");
    const proxyBypassRules_el = document.getElementById("proxyBypassRules_p");
    switch (m) {
        case "direct":
            pacScript_el.style.display = proxyRules_el.style.display = proxyBypassRules_el.style.display = "none";
            break;
        case "auto_detect":
            pacScript_el.style.display = proxyRules_el.style.display = "none";
            proxyBypassRules_el.style.display = "block";
            break;
        case "pac_script":
            pacScript_el.style.display = "block";
            proxyRules_el.style.display = "none";
            proxyBypassRules_el.style.display = "block";
            break;
        case "fixed_servers":
            proxyRules_el.style.display = "block";
            pacScript_el.style.display = "none";
            proxyBypassRules_el.style.display = "block";
            break;
        case "system":
            pacScript_el.style.display = proxyRules_el.style.display = "none";
            proxyBypassRules_el.style.display = "block";
            break;
    }
}

function get_proxy() {
    let l = 代理.proxyRules.split(";") as string[];
    for (let rule of l) {
        for (let x of proxy_l) {
            if (rule.includes(x + "=")) {
                (<HTMLInputElement>document.getElementById(`proxy_${x}`)).value = rule.replace(x + "=", "");
            }
        }
    }
}
function set_proxy() {
    let l = [];
    for (let x of proxy_l) {
        let v = (<HTMLInputElement>document.getElementById(`proxy_${x}`)).value;
        if (v) {
            l.push(`${x}=${v}`);
        }
    }
    return l.join(";");
}

(<HTMLInputElement>document.getElementById("主页面失焦")).checked = old_store.关闭窗口.失焦.主页面;

(<HTMLInputElement>document.getElementById("硬件加速")).checked = old_store.硬件加速;

set_radio(<HTMLInputElement>document.getElementById("检查更新频率"), old_store.更新.频率);
(<HTMLInputElement>document.getElementById("dev")).checked = old_store.更新.dev;

document.getElementById("打开config").title = store.path;
document.getElementById("打开config").onclick = () => {
    shell.openPath(store.path);
};

var give_up = false;
document.getElementById("give_up_setting_b").oninput = () => {
    give_up = (<HTMLInputElement>document.getElementById("give_up_setting_b")).checked;
    if (give_up) fs.writeFileSync(store.path, JSON.stringify(old_store, null, 2));
};

window.onbeforeunload = () => {
    try {
        save_setting();
    } catch {
        ipcRenderer.send("setting", "save_err");
    }
    ipcRenderer.send("setting", "reload_main");
};

window.onblur = save_setting;

function save_setting() {
    if (give_up) return;
    store_set("启动提示", (<HTMLInputElement>document.getElementById("启动提示")).checked);
    store_set("语言.语言", get_radio(document.getElementById("语言")));
    store_set("其他快捷键", {
        关闭: (<HTMLInputElement>document.querySelector(`hot-keys[name="关闭"]`)).value,
        OCR: (<HTMLInputElement>document.querySelector(`hot-keys[name="OCR(文字识别)"]`)).value,
        以图搜图: (<HTMLInputElement>document.querySelector(`hot-keys[name="以图搜图"]`)).value,
        QR码: (<HTMLInputElement>document.querySelector(`hot-keys[name="QR码"]`)).value,
        图像编辑: (<HTMLInputElement>document.querySelector(`hot-keys[name="图像编辑"]`)).value,
        其他应用打开: (<HTMLInputElement>document.querySelector(`hot-keys[name="其他应用打开"]`)).value,
        放在屏幕上: (<HTMLInputElement>document.querySelector(`hot-keys[name="放在屏幕上"]`)).value,
        复制: (<HTMLInputElement>document.querySelector(`hot-keys[name="复制"]`)).value,
        保存: (<HTMLInputElement>document.querySelector(`hot-keys[name="保存"]`)).value,
        复制颜色: (<HTMLInputElement>document.querySelector(`hot-keys[name="复制颜色"]`)).value,
    });
    store_set(
        "主搜索功能.自动搜索排除",
        (<HTMLInputElement>document.getElementById("自动搜索排除")).value.split(/\n/).filter((i) => i != "")
    );
    store_set("主搜索功能.剪贴板选区搜索", (<HTMLInputElement>document.getElementById("剪贴板选区搜索")).checked);
    var 模糊 = Number((<HTMLInputElement>document.getElementById("模糊")).value);
    store_set("全局.模糊", 模糊);
    store_set("全局.不透明度", Number((<HTMLInputElement>document.getElementById("不透明度")).value) / 100);
    store_set("全局.缩放", (<HTMLInputElement>document.getElementById("全局缩放")).value);
    try {
        store_set("全局.图标颜色", [
            (<HTMLInputElement>document.querySelector("#图标颜色 > input")).value,
            hexToCSSFilter((<HTMLInputElement>document.querySelector("#图标颜色 > input")).value).filter.replace(
                ";",
                ""
            ),
        ]);
    } catch (e) {}
    store_set("工具栏", {
        按钮大小: (<HTMLInputElement>document.getElementById("按钮大小")).value,
        按钮图标比例: (<HTMLInputElement>document.getElementById("按钮图标比例")).value,
    });
    store_set("显示四角坐标", (<HTMLInputElement>document.getElementById("显示四角坐标")).checked);
    store_set("取色器大小", (<HTMLInputElement>document.getElementById("取色器大小")).value);
    store_set("像素大小", (<HTMLInputElement>document.getElementById("像素大小")).value);
    store_set("遮罩颜色", (<HTMLInputElement>document.querySelector("#遮罩颜色 > input")).value);
    store_set("选区颜色", (<HTMLInputElement>document.querySelector("#选区颜色 > input")).value);
    store_set("框选.自动框选", {
        开启: (<HTMLInputElement>document.getElementById("自动框选")).checked,
        图像识别: (<HTMLInputElement>document.getElementById("自动框选图像识别")).checked,
        最小阈值: (<HTMLInputElement>document.getElementById("框选最小阈值")).value,
        最大阈值: (<HTMLInputElement>document.getElementById("框选最大阈值")).value,
    });
    store_set("框选.记忆.开启", (<HTMLInputElement>document.getElementById("记住框选大小")).checked);
    store_set("图像编辑.默认属性", {
        填充颜色: (<HTMLInputElement>document.getElementById("填充颜色")).value,
        边框颜色: (<HTMLInputElement>document.getElementById("边框颜色")).value,
        边框宽度: (<HTMLInputElement>document.getElementById("边框宽度")).value,
        画笔颜色: (<HTMLInputElement>document.getElementById("画笔颜色")).value,
        画笔粗细: (<HTMLInputElement>document.getElementById("画笔粗细")).value,
    });
    store_set("图像编辑.复制偏移", {
        x: (<HTMLInputElement>document.getElementById("复制dx")).value,
        y: (<HTMLInputElement>document.getElementById("复制dy")).value,
    });
    store_set("插件.加载后", (<HTMLInputElement>document.getElementById("plugin")).value.trim().split("\n"));
    store_set("贴图.窗口.变换", (<HTMLInputElement>document.getElementById("tran_css")).value);
    store_set("贴图.窗口.双击", get_radio(document.getElementById("贴图双击")));
    store_set("框选后默认操作", get_radio(document.getElementById("框选后默认操作")));
    store_set("快速截屏.模式", get_radio(<HTMLInputElement>document.getElementById("快速截屏")));
    store_set(
        "快速截屏.路径",
        (<HTMLInputElement>document.getElementById("快速截屏路径")).value
            ? ((<HTMLInputElement>document.getElementById("快速截屏路径")).value + "/").replace("//", "/")
            : ""
    );
    store_set(
        "录屏.自动录制",
        (<HTMLInputElement>document.getElementById("开启自动录制")).checked &&
            (<HTMLInputElement>document.getElementById("自动录制延时")).value
    );
    store_set("录屏.视频比特率", (<HTMLInputElement>document.getElementById("视频比特率")).value);
    store_set("录屏.摄像头", {
        默认开启: (<HTMLInputElement>document.getElementById("默认开启摄像头")).checked,
        记住开启状态: (<HTMLInputElement>document.getElementById("记录摄像头开启状态")).checked,
        镜像: (<HTMLInputElement>document.getElementById("摄像头镜像")).checked,
    });
    store_set("录屏.音频", {
        默认开启: (<HTMLInputElement>document.getElementById("默认开启音频")).checked,
        记住开启状态: (<HTMLInputElement>document.getElementById("记录音频开启状态")).checked,
    });
    store_set("录屏.转换", {
        自动转换: (<HTMLInputElement>document.getElementById("开启自动转换")).checked,
        格式: (<HTMLInputElement>document.getElementById("格式")).value,
        码率: Number((<HTMLInputElement>document.getElementById("码率")).value),
        帧率: Number((<HTMLInputElement>document.getElementById("帧率")).value),
        其他: (<HTMLInputElement>document.getElementById("ff其他参数")).value,
        高质量gif: (<HTMLInputElement>document.getElementById("高质量gif")).checked,
    });
    store_set("录屏.提示", {
        键盘: {
            开启: (<HTMLInputElement>document.getElementById("开启键盘按键提示")).checked,
        },
        鼠标: {
            开启: (<HTMLInputElement>document.getElementById("开启鼠标按键提示")).checked,
        },
        光标: {
            开启: (<HTMLInputElement>document.getElementById("开启光标提示")).checked,
            样式: (<HTMLInputElement>document.getElementById("cursor_css")).value,
        },
    });
    store_set("保存.默认格式", get_radio(<HTMLInputElement>document.getElementById("默认格式")));
    store_set("保存.快速保存", (<HTMLInputElement>document.getElementById("快速保存")).checked);
    store_set("保存名称", {
        前缀: (<HTMLInputElement>document.getElementById("保存文件名称前缀")).value,
        时间: (<HTMLInputElement>document.getElementById("保存文件名称时间")).value,
        后缀: (<HTMLInputElement>document.getElementById("保存文件名称后缀")).value,
    });
    store_set("jpg质量", (<HTMLInputElement>document.getElementById("jpg质量")).value);
    字体.大小 = (<HTMLInputElement>document.getElementById("字体大小")).value;
    字体.记住 = (<HTMLInputElement>document.getElementById("记住字体大小")).checked
        ? typeof 字体.记住 === "number"
            ? 字体.记住
            : 字体.大小
        : false;
    store_set("字体", 字体);
    store_set("编辑器.自动换行", (<HTMLInputElement>document.getElementById("换行")).checked);
    store_set("编辑器.拼写检查", (<HTMLInputElement>document.getElementById("拼写检查")).checked);
    store_set("编辑器.行号", (<HTMLInputElement>document.getElementById("行号")).checked);
    store_set("自动搜索", (<HTMLInputElement>document.getElementById("自动搜索")).checked);
    store_set("自动打开链接", (<HTMLInputElement>document.getElementById("自动打开链接")).checked);
    store_set("自动搜索中文占比", (<HTMLInputElement>document.getElementById("自动搜索中文占比")).value);
    if (o_搜索引擎) store_set("搜索引擎", o_搜索引擎);
    if (o_翻译引擎) store_set("翻译引擎", o_翻译引擎);
    store_set("引擎", {
        记住: (<HTMLInputElement>document.getElementById("记住引擎")).checked
            ? [get_radio(document.getElementById("默认搜索引擎")), get_radio(document.getElementById("默认翻译引擎"))]
            : false,
        默认搜索引擎: get_radio(document.getElementById("默认搜索引擎")),
        默认翻译引擎: get_radio(document.getElementById("默认翻译引擎")),
    });
    store_set("以图搜图", {
        引擎: get_radio(<HTMLInputElement>document.getElementById("图像搜索引擎")),
        记住: (<HTMLInputElement>document.getElementById("记住识图引擎")).checked
            ? old_store.以图搜图.记住 || get_radio(<HTMLInputElement>document.getElementById("图像搜索引擎"))
            : false,
    });
    store_set("浏览器中打开", (<HTMLInputElement>document.getElementById("浏览器中打开")).checked);
    store_set("浏览器.标签页", {
        自动关闭: (<HTMLInputElement>document.getElementById("搜索窗口自动关闭")).checked,
        小: (<HTMLInputElement>document.getElementById("标签缩小")).checked,
        灰度: (<HTMLInputElement>document.getElementById("标签灰度")).checked,
    });
    历史记录设置.d = Number((<HTMLInputElement>document.getElementById("his_d")).value);
    历史记录设置.h = Number((<HTMLInputElement>document.getElementById("his_h")).value);
    store_set("历史记录设置", 历史记录设置);
    store_set("时间格式", (<HTMLInputElement>document.getElementById("时间格式")).value);
    store_set("OCR", {
        类型: get_ocr_type(),
        离线切换: (<HTMLInputElement>document.getElementById("离线切换")).checked,
        记住: (<HTMLInputElement>document.getElementById("记住OCR引擎")).checked
            ? old_store.OCR.记住 || get_ocr_type()
            : false,
        版本: old_store.OCR.版本,
    });
    store_set("在线OCR.baidu", {
        url: get_radio(document.getElementById("baidu_ocr_url")),
        id: (<HTMLInputElement>document.getElementById("baidu_ocr_id")).value,
        secret: (<HTMLInputElement>document.getElementById("baidu_ocr_secret")).value,
    });
    store_set("在线OCR.youdao", {
        id: (<HTMLInputElement>document.getElementById("youdao_ocr_id")).value,
        secret: (<HTMLInputElement>document.getElementById("youdao_ocr_secret")).value,
    });
    store_set("代理", {
        mode: get_radio(document.getElementById("代理")),
        pacScript: (<HTMLInputElement>document.getElementById("pacScript")).value,
        proxyRules: set_proxy(),
        proxyBypassRules: (<HTMLInputElement>document.getElementById("proxyBypassRules")).value,
    });
    store_set("关闭窗口", {
        失焦: {
            主页面: (<HTMLInputElement>document.getElementById("主页面失焦")).checked,
        },
    });
    store_set("硬件加速", (<HTMLInputElement>document.getElementById("硬件加速")).checked);
    store_set("更新.dev", (<HTMLInputElement>document.getElementById("dev")).checked);
    store_set("更新.频率", get_radio(document.getElementById("检查更新频率")));
    if (user_data_path_inputed)
        fs.writeFile("preload_config", (<HTMLInputElement>document.getElementById("user_data_path")).value, (e) => {
            if (e) throw new Error(t("保存失败，请确保软件拥有运行目录的修改权限，或重新使用管理员模式打开软件"));
        });
    fs.writeFileSync(path.join(config_path, "config.json"), JSON.stringify(xstore, null, 2));
}

// 查找
document.getElementById("find_b_close").onclick = () => {
    find((<HTMLInputElement>document.getElementById("find_input")).value);
};
document.getElementById("find_input").oninput = () => {
    find((<HTMLInputElement>document.getElementById("find_input")).value);
};
document.getElementById("find_b_last").onclick = () => {
    find_focus_i = (find_focus_i - 1) % find_ranges.length;
    if (find_focus_i < 0) {
        find_focus_i = find_ranges.length - 1;
    }
    jump_to_range(find_focus_i);
};
document.getElementById("find_b_next").onclick = () => {
    find_focus_i = (find_focus_i + 1) % find_ranges.length;
    jump_to_range(find_focus_i);
};
function jump_to_range(i: number) {
    let rect = find_ranges[i].getBoundingClientRect();
    document.getElementById("find_t").innerText = `${i + 1} / ${find_ranges.length}`;
    document.documentElement.scrollTo(0, rect.top - document.body.getBoundingClientRect().top);
}
let allTextNodes = [];
window.onload = () => {
    const treeWalker = document.createTreeWalker(document.getElementById("main"), NodeFilter.SHOW_TEXT);
    let currentNode = treeWalker.nextNode();
    allTextNodes = [];
    while (currentNode) {
        allTextNodes.push(currentNode);
        currentNode = treeWalker.nextNode();
    }
    console.log(allTextNodes);
};
let find_ranges: Range[] = [];
let find_focus_i = 0;
function find(t: string) {
    // @ts-ignore
    CSS.highlights.clear();

    const str = t.trim().toLowerCase();
    if (!str) {
        document.getElementById("find_t").innerText = ``;
        return;
    }

    const ranges = allTextNodes
        .map((el) => {
            return { el, text: el.textContent.toLowerCase() };
        })
        .map(({ text, el }) => {
            const indices = [];
            let startPos = 0;
            while (startPos < text.length) {
                const index = text.indexOf(str, startPos);
                if (index === -1) break;
                indices.push(index);
                startPos = index + str.length;
            }

            return indices.map((index) => {
                const range = new Range();
                range.setStart(el, index);
                range.setEnd(el, index + str.length);
                return range;
            });
        });

    find_ranges = ranges.flat();
    find_focus_i = 0;
    jump_to_range(find_focus_i);

    // @ts-ignore
    const searchResultsHighlight = new Highlight(...ranges.flat());
    // @ts-ignore
    CSS.highlights.set("search-results", searchResultsHighlight);
}

var path_info = `<br>
                ${t("OCR 目录：")}${store.path.replace("config.json", "ocr")}<br>
                ${t("文字记录：")}${history_store.path}<br>
                ${t("临时目录：")}${os.tmpdir()}${os.platform() == "win32" ? "\\" : "/"}eSearch<br>
                ${t("运行目录：")}${__dirname}`;
document.createTextNode(path_info);
document.getElementById("user_data_divs").insertAdjacentHTML("afterend", path_info);
try {
    (<HTMLInputElement>document.getElementById("user_data_path")).value =
        fs.readFileSync("preload_config").toString().trim() || store.path.replace(/[/\\]config\.json/, "");
} catch (error) {
    (<HTMLInputElement>document.getElementById("user_data_path")).value = store.path.replace(/[/\\]config\.json/, "");
}
var user_data_path_inputed = false;
document.getElementById("user_data_path").oninput = () => {
    document.getElementById("user_data_divs").classList.add("user_data_divs");
    user_data_path_inputed = true;
};
document.getElementById("move_user_data").onclick = () => {
    ipcRenderer.send("setting", "move_user_data", (<HTMLInputElement>document.getElementById("user_data_path")).value);
};

document.getElementById("reload").onclick = () => {
    save_setting();
    ipcRenderer.send("setting", "reload");
};

ipcRenderer.on("setting", (err, t, id, r) => {
    if (t == "open_dialog") {
        switch (id) {
            case "ocr_det":
                if (!r.canceled) {
                    (<HTMLInputElement>document.getElementById("ocr_det")).value = r.filePaths[0];
                }
                break;
            case "ocr_rec":
                if (!r.canceled) {
                    (<HTMLInputElement>document.getElementById("ocr_rec")).value = r.filePaths[0];
                }
                break;
            case "ocr_字典":
                if (!r.canceled) {
                    (<HTMLInputElement>document.getElementById("ocr_字典")).value = r.filePaths[0];
                }
                break;
            case "plugin":
                if (!r.canceled) {
                    let l = (<HTMLTextAreaElement>document.getElementById("plugin")).value.trim();
                    l += (l && "\n") + r.filePaths[0];
                    (<HTMLTextAreaElement>document.getElementById("plugin")).value = l;
                }
        }
    }
});

var version = `<div>${t("本机系统内核:")} ${os.type()} ${os.release()}</div>`;
var version_l = ["electron", "node", "chrome", "v8"];
for (let i in version_l) {
    version += `<div>${version_l[i]}: ${process.versions[version_l[i]]}</div>`;
}
document.getElementById("versions_info").insertAdjacentHTML("afterend", version);

import pack from "../../../package.json?raw";
var package_json = JSON.parse(pack);
const download = require("download");
document.getElementById("name").innerHTML = package_json.name;
document.getElementById("version").innerHTML = package_json.version;
document.getElementById("description").innerHTML = t(package_json.description);
document.getElementById("version").onclick = () => {
    fetch("https://api.github.com/repos/xushengfeng/eSearch/releases", { method: "GET", redirect: "follow" })
        .then((response) => response.json())
        .then((re) => {
            console.log(re);
            if (document.getElementById("update_info").innerHTML) return;
            let l = [];
            for (let r of re) {
                if (
                    !package_json.version.includes("beta") &&
                    !package_json.version.includes("alpha") &&
                    !old_store.更新.dev
                ) {
                    if (!r.draft && !r.prerelease) l.push(r);
                } else {
                    l.push(r);
                }
            }
            function tag(text: string) {
                let tag = document.createElement("span");
                tag.innerText = t(text);
                return tag;
            }
            for (let i in l) {
                const r = l[i];
                let div = document.createElement("div");
                let tags = document.createElement("div");
                let h = document.createElement("h1");
                h.innerText = r.name;
                let p = document.createElement("p");
                p.innerHTML = r.body.replace(/\r\n/g, "<br>");
                div.append(tags, h, p);
                document.getElementById("update_info").append(div);
                if (i == "0") {
                    let tag_el = tag("最新版本");
                    tag_el.title = t("点击下载");
                    tag_el.classList.add("download_tag");
                    tags.append(tag_el);
                    tag_el.onclick = () => {
                        shell.openExternal(r.html_url);
                    };
                    for (let a of r.assets) {
                        if (a.name == "app") {
                            let el = document.createElement("span");
                            el.innerText = "增量更新";
                            tag_el.after(el);
                            el.onclick = async () => {
                                download(a.browser_download_url, path.join(__dirname, "../../../"), {
                                    extract: true,
                                    rejectUnauthorized: false,
                                })
                                    .on("response", (res) => {
                                        let total = Number(res.headers["content-length"]);
                                        res.on("data", (data) => {
                                            let now = Number(data.length);
                                            el.innerText = `${(now / total) * 100}%`;
                                            if (now == total) {
                                                el.innerText = t("正在覆盖中，稍后你可以重启软件以获取更新");
                                            }
                                        });
                                    })
                                    .then(() => {
                                        el.innerText = t("覆盖完毕");
                                    });
                            };
                        }
                    }
                }
                if (r.name == package_json.version) {
                    tags.append(tag("当前版本"));
                    if (i != "0") {
                        (<HTMLElement>document.getElementById("menu").lastElementChild).style.color = "#335EFE";
                    }
                    break;
                }
            }
        })
        .catch((error) => console.log("error", error));
};

if (old_store.更新.频率 == "setting") {
    setTimeout(() => {
        document.getElementById("version").click();
    }, 10);
}

document.getElementById("info").innerHTML = `<div>${t("项目主页:")} <a href="${package_json.homepage}">${
    package_json.homepage
}</a></div>
    <div><a href="https://github.com/xushengfeng/eSearch/releases/tag/${package_json.version}">${t(
    "更新日志"
)}</a></div>
    <div><a href="https://github.com/xushengfeng/eSearch/issues">${t("错误报告与建议")}</a></div>
    <div>${t("本软件遵循")} <a href="https://www.gnu.org/licenses/gpl-3.0.html">${package_json.license}</a></div>
    <div>${t("本软件基于")} <a href="https://esearch.vercel.app/readme/all_license.json">${t("这些软件")}</a></div>
    <div>Copyright (C) 2021 ${package_json.author.name} ${package_json.author.email}</div>`;

document.getElementById("about").onclick = (e) => {
    console.log(e.target);
    if ((<HTMLElement>e.target).tagName == "A") {
        e.preventDefault();
        shell.openExternal((<HTMLAnchorElement>e.target).href);
    }
};

ipcRenderer.on("about", (event, arg) => {
    if (arg != undefined) {
        location.hash = "#about";
    }
});

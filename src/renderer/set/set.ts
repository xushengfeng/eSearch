/// <reference types="vite/client" />
let configPath = new URLSearchParams(location.search).get("config_path");
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

let old_store = JSON.parse(fs.readFileSync(path.join(configPath, "config.json"), "utf-8"));
import { t, lan } from "../../../lib/translate/translate";
lan(old_store.语言.语言);
document.body.innerHTML = document.body.innerHTML
    .replace(/\{(.*?)\}/g, (_m, v) => t(v))
    .replace(/<t>(.*?)<\/t>/g, (_m, v) => t(v));
document.title = t(document.title);

const xstore = old_store;
function storeSet(path: string, value: any) {
    let pathx = path.split(".");
    const lastp = pathx.pop();
    const lastobj = pathx.reduce((p, c) => (p[c] = p[c] || {}), xstore);
    lastobj[lastp] = value;
}

let store = { path: path.join(configPath, "config.json") };
let historyStore = { path: path.join(configPath, "history.json") };

document.getElementById("set_default_setting").onclick = () => {
    if (confirm("将会把所有设置恢复成默认，无法撤销")) {
        ipcRenderer.send("setting", "set_default_setting");
        giveUp = true;
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
ipcRenderer.on("开机启动状态", (_event, v) => {
    (<HTMLInputElement>document.getElementById("autostart")).checked = v;
});
document.getElementById("autostart").oninput = () => {
    ipcRenderer.send("autostart", "set", (<HTMLInputElement>document.getElementById("autostart")).checked);
};

(<HTMLInputElement>document.getElementById("启动提示")).checked = old_store.启动提示;

function getRadio(el: HTMLElement) {
    return (<HTMLInputElement>el.querySelector("input[type=radio]:checked")).value;
}
function setRadio(el: HTMLElement, value: string) {
    (
        <HTMLInputElement>el.querySelector(`input[type=radio][value="${value}"]`) ||
        el.querySelector(`input[type=radio]`)
    ).checked = true;
}
setRadio(document.getElementById("语言"), old_store.语言.语言);
document.getElementById("系统语言").onclick = () => {
    if (navigator.language.split("-")[0] == "zh") {
        setRadio(
            document.getElementById("语言"),
            {
                "zh-CN": "zh-HANS",
                "zh-SG": "zh-HANS",
                "zh-TW": "zh-HANT",
                "zh-HK": "zh-HANT",
            }[navigator.language]
        );
    } else {
        setRadio(document.getElementById("语言"), navigator.language.split("-")[0]);
    }
    lan(getRadio(document.getElementById("语言")));
    document.getElementById("语言重启").innerText = t("重启软件以生效");
};
document.getElementById("语言").onclick = () => {
    lan(getRadio(document.getElementById("语言")));
    document.getElementById("语言重启").innerText = t("重启软件以生效");
};

document.getElementById("语言重启").onclick = () => {
    storeSet("语言.语言", getRadio(document.getElementById("语言")));
    ipcRenderer.send("setting", "reload");
};

(<HTMLInputElement>document.getElementById("自动搜索排除")).value = old_store.主搜索功能.自动搜索排除.join("\n");
if (process.platform == "linux") {
    document.getElementById("linux_selection").style.display = "block";
    (<HTMLInputElement>document.getElementById("剪贴板选区搜索")).checked = old_store.主搜索功能.剪贴板选区搜索;
}

var 全局 = old_store.全局;

setRadio(document.getElementById("深色模式"), old_store.全局.深色模式);
document.getElementById("深色模式").onclick = () => {
    ipcRenderer.send("theme", getRadio(document.getElementById("深色模式")));
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
    setRadio(document.querySelector(`#${id}`), old_store[id] || 默认);
    (<HTMLElement>document.querySelector(`#${id}`)).onclick = () => {
        storeSet(id, getRadio(<HTMLInputElement>document.querySelector(`#${id}`)));
    };
}

var 快捷键 = old_store.快捷键;
document.querySelectorAll("#快捷键 hot-keys").forEach((el: any) => {
    el.value = 快捷键[el.name].key;
    el.addEventListener("inputend", () => {
        ipcRenderer.send("快捷键", [el.name, el.value]);
    });
});
ipcRenderer.on("状态", (_event, name, arg) => {
    (<any>document.querySelector(`hot-keys[name=${name}]`)).t = arg;
    if (t) storeSet(`快捷键.${name}.key`, (<any>document.querySelector(`hot-keys[name=${name}]`)).value);
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

setRadio(document.getElementById("框选后默认操作"), old_store.框选后默认操作);

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
setRadio(document.getElementById("贴图双击"), old_store.贴图.窗口.双击);

setRadio(document.getElementById("快速截屏"), old_store.快速截屏.模式);
(<HTMLInputElement>document.getElementById("快速截屏路径")).value = old_store.快速截屏.路径;
document.getElementById("获取保存路径").onclick = () => {
    ipcRenderer.send("get_save_path", (<HTMLInputElement>document.getElementById("快速截屏路径")).value || "");
    ipcRenderer.on("get_save_path", (_e, a) => {
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
(<HTMLInputElement>document.getElementById("分段")).value = old_store.录屏.转换.分段;
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
    showFTime();
};
document.getElementById("保存文件名称时间").oninput = showFTime;
import time_format from "../../../lib/time_format";
function showFTime() {
    var saveTime = new Date();
    document.getElementById("保存文件名称_p").innerText = `${
        (<HTMLInputElement>document.getElementById("保存文件名称前缀")).value
    }${time_format((<HTMLInputElement>document.getElementById("保存文件名称时间")).value, saveTime)}${
        (<HTMLInputElement>document.getElementById("保存文件名称后缀")).value
    }`;
}
showFTime();
document.getElementById("保存文件名称前缀").style.width = `${
    (<HTMLInputElement>document.getElementById("保存文件名称前缀")).value.length || 1
}em`;
document.getElementById("保存文件名称后缀").style.width = `${
    (<HTMLInputElement>document.getElementById("保存文件名称后缀")).value.length || 1
}em`;

setRadio(document.getElementById("默认格式"), old_store.保存.默认格式);

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
    var defaultEn = `<div id="默认搜索引擎">`;
    for (let i in o_搜索引擎) {
        text += `${o_搜索引擎[i][0]}, ${o_搜索引擎[i][1]}\n`;
        defaultEn += `<label><input type="radio" name="默认搜索引擎" value="${o_搜索引擎[i][0]}">${o_搜索引擎[i][0]}</label>`;
    }
    (<HTMLInputElement>document.getElementById("搜索引擎")).value = text;
    defaultEn += `</div>`;
    document.getElementById("默认搜索引擎div").innerHTML = defaultEn;
    setRadio(document.getElementById("默认搜索引擎"), old_store.引擎.默认搜索引擎);
}
document.getElementById("搜索引擎").onchange = () => {
    o_搜索引擎 = [];
    var text = (<HTMLInputElement>document.getElementById("搜索引擎")).value;
    var textL = text.split("\n");
    var defaultEn = `<div id="默认搜索引擎">`;
    for (let i in textL) {
        var r = /(\S+)\W*[,，:：]\W*(\S+)/g;
        var l = textL[i].replace(r, "$1,$2").split(",");
        if (l[0] != "") {
            o_搜索引擎[i] = [l[0], l[1]];
            defaultEn += `<label><input type="radio" name="默认搜索引擎" value="${l[0]}">${l[0]}</label>`;
        }
    }
    defaultEn += `</div>`;
    document.getElementById("默认搜索引擎div").innerHTML = defaultEn;
    setRadio(document.getElementById("默认搜索引擎"), o_搜索引擎[0][0]);
};

var o翻译引擎 = old_store.翻译引擎;
if (o翻译引擎) {
    var text = "";
    var defaultEn = `<div id="默认翻译引擎">`;
    for (let i in o翻译引擎) {
        text += `${o翻译引擎[i][0]}, ${o翻译引擎[i][1]}\n`;
        defaultEn += `<label><input type="radio" name="默认翻译引擎" value="${o翻译引擎[i][0]}">${o翻译引擎[i][0]}</label>`;
    }
    (<HTMLInputElement>document.getElementById("翻译引擎")).value = text;
    defaultEn += `</div>`;
    document.getElementById("默认翻译引擎div").innerHTML = defaultEn;
    setRadio(document.getElementById("默认翻译引擎"), old_store.引擎.默认翻译引擎);
}
document.getElementById("翻译引擎").onchange = () => {
    o翻译引擎 = [];
    var text = (<HTMLInputElement>document.getElementById("翻译引擎")).value;
    var textL = text.split("\n");
    var defaultEn = `<div id="默认翻译引擎">`;
    for (let i in textL) {
        var r = /(\S+)\W*[,，:：]\W*(\S+)/g;
        var l = textL[i].replace(r, "$1,$2").split(",");
        if (l[0] != "") {
            o翻译引擎[i] = [l[0], l[1]];
            defaultEn += `<label><input type="radio" name="默认翻译引擎" value="${l[0]}">${l[0]}</label>`;
        }
    }
    defaultEn += `</div>`;
    document.getElementById("默认翻译引擎div").innerHTML = defaultEn;
    setRadio(document.getElementById("默认翻译引擎"), o翻译引擎[0][0]);
};
(<HTMLInputElement>document.getElementById("记住引擎")).checked = old_store.引擎.记住;

setRadio(document.getElementById("图像搜索引擎"), old_store.以图搜图.引擎);
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
    window.location.href = "editor.html";
};

function setOcr() {
    let ocrIn = "";
    for (let i of old_store.离线OCR) {
        ocrIn += `<label><input type="radio" name="OCR类型" value="${i[0]}">${i[0]}</label>`;
    }
    ocrIn += `
    <label><input type="radio" name="OCR类型" value="youdao">
        <t>有道</t>
    </label>
    <label><input type="radio" name="OCR类型" value="baidu">
        <t>百度</t>
    </label>`;
    document.getElementById("OCR类型").outerHTML = `<div id="OCR类型">${ocrIn}</div>`;
    setRadio(document.getElementById("OCR类型"), old_store.OCR.类型);
}

setOcr();

function getOcrType() {
    return getRadio(<HTMLInputElement>document.getElementById("OCR类型"));
}
ocrDOpen();
function ocrDOpen() {
    (<HTMLDetailsElement>document.getElementById("baidu_details")).open = false;
    (<HTMLDetailsElement>document.getElementById("youdao_details")).open = false;
    if (getOcrType() == "baidu") {
        (<HTMLDetailsElement>document.getElementById("baidu_details")).open = true;
    } else if (getOcrType() == "youdao") {
        (<HTMLDetailsElement>document.getElementById("youdao_details")).open = true;
    }
}
document.getElementById("OCR类型").onclick = ocrDOpen;
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
            storeSet("离线OCR", all);
            setOcr();
        };
        d.append(t);
        let c = document.createElement("button");
        c.innerHTML = `<img src="${close_svg}" class="icon">`;
        c.onclick = () => {
            if (all.length == 1) return;
            all.splice(Number(i), 1);
            d.remove();
            storeSet("离线OCR", all);
            setOcr();
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
    storeSet("离线OCR", all);
    OCR模型展示();
    setOcr();
    document.getElementById("OCR拖拽放置区").classList.remove("拖拽突出");
};

setRadio(document.getElementById("baidu_ocr_url"), old_store.在线OCR.baidu.url);
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
    if (c) fs.writeFileSync(path.join(configPath, "history.json"), JSON.stringify({ 历史记录: {} }, null, 2));
};

(<HTMLInputElement>document.getElementById("时间格式")).value = old_store.时间格式;

var proxyL = ["http", "https", "ftp", "socks"];

var 代理 = old_store.代理;
setRadio(document.getElementById("代理"), 代理.mode);
(<HTMLInputElement>document.getElementById("pacScript")).value = 代理.pacScript;
getProxy();
(<HTMLInputElement>document.getElementById("proxyBypassRules")).value = 代理.proxyBypassRules;

setProxyEl();
document.getElementById("代理").onclick = setProxyEl;
function setProxyEl() {
    const m = getRadio(document.getElementById("代理"));
    const pacScriptEl = document.getElementById("pacScript_p");
    const proxyRulesEl = document.getElementById("proxyRules_p");
    const proxyBypassRulesEl = document.getElementById("proxyBypassRules_p");
    switch (m) {
        case "direct":
            pacScriptEl.style.display = proxyRulesEl.style.display = proxyBypassRulesEl.style.display = "none";
            break;
        case "auto_detect":
            pacScriptEl.style.display = proxyRulesEl.style.display = "none";
            proxyBypassRulesEl.style.display = "block";
            break;
        case "pac_script":
            pacScriptEl.style.display = "block";
            proxyRulesEl.style.display = "none";
            proxyBypassRulesEl.style.display = "block";
            break;
        case "fixed_servers":
            proxyRulesEl.style.display = "block";
            pacScriptEl.style.display = "none";
            proxyBypassRulesEl.style.display = "block";
            break;
        case "system":
            pacScriptEl.style.display = proxyRulesEl.style.display = "none";
            proxyBypassRulesEl.style.display = "block";
            break;
    }
}

function getProxy() {
    let l = 代理.proxyRules.split(";") as string[];
    for (let rule of l) {
        for (let x of proxyL) {
            if (rule.includes(x + "=")) {
                (<HTMLInputElement>document.getElementById(`proxy_${x}`)).value = rule.replace(x + "=", "");
            }
        }
    }
}
function setProxy() {
    let l = [];
    for (let x of proxyL) {
        let v = (<HTMLInputElement>document.getElementById(`proxy_${x}`)).value;
        if (v) {
            l.push(`${x}=${v}`);
        }
    }
    return l.join(";");
}

(<HTMLInputElement>document.getElementById("主页面失焦")).checked = old_store.关闭窗口.失焦.主页面;

(<HTMLInputElement>document.getElementById("硬件加速")).checked = old_store.硬件加速;

setRadio(<HTMLInputElement>document.getElementById("检查更新频率"), old_store.更新.频率);
(<HTMLInputElement>document.getElementById("dev")).checked = old_store.更新.dev;

document.getElementById("打开config").title = store.path;
document.getElementById("打开config").onclick = () => {
    shell.openPath(store.path);
};

var giveUp = false;
document.getElementById("give_up_setting_b").oninput = () => {
    giveUp = (<HTMLInputElement>document.getElementById("give_up_setting_b")).checked;
    if (giveUp) fs.writeFileSync(store.path, JSON.stringify(old_store, null, 2));
};

window.onbeforeunload = () => {
    try {
        saveSetting();
    } catch {
        ipcRenderer.send("setting", "save_err");
    }
    ipcRenderer.send("setting", "reload_main");
};

window.onblur = saveSetting;

function saveSetting() {
    if (giveUp) return;
    storeSet("启动提示", (<HTMLInputElement>document.getElementById("启动提示")).checked);
    storeSet("语言.语言", getRadio(document.getElementById("语言")));
    storeSet("其他快捷键", {
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
    storeSet(
        "主搜索功能.自动搜索排除",
        (<HTMLInputElement>document.getElementById("自动搜索排除")).value.split(/\n/).filter((i) => i != "")
    );
    storeSet("主搜索功能.剪贴板选区搜索", (<HTMLInputElement>document.getElementById("剪贴板选区搜索")).checked);
    var 模糊 = Number((<HTMLInputElement>document.getElementById("模糊")).value);
    storeSet("全局.模糊", 模糊);
    storeSet("全局.不透明度", Number((<HTMLInputElement>document.getElementById("不透明度")).value) / 100);
    storeSet("全局.缩放", (<HTMLInputElement>document.getElementById("全局缩放")).value);
    try {
        storeSet("全局.图标颜色", [
            (<HTMLInputElement>document.querySelector("#图标颜色 > input")).value,
            hexToCSSFilter((<HTMLInputElement>document.querySelector("#图标颜色 > input")).value).filter.replace(
                ";",
                ""
            ),
        ]);
    } catch (e) {}
    storeSet("工具栏", {
        按钮大小: (<HTMLInputElement>document.getElementById("按钮大小")).value,
        按钮图标比例: (<HTMLInputElement>document.getElementById("按钮图标比例")).value,
    });
    storeSet("显示四角坐标", (<HTMLInputElement>document.getElementById("显示四角坐标")).checked);
    storeSet("取色器大小", (<HTMLInputElement>document.getElementById("取色器大小")).value);
    storeSet("像素大小", (<HTMLInputElement>document.getElementById("像素大小")).value);
    storeSet("遮罩颜色", (<HTMLInputElement>document.querySelector("#遮罩颜色 > input")).value);
    storeSet("选区颜色", (<HTMLInputElement>document.querySelector("#选区颜色 > input")).value);
    storeSet("框选.自动框选", {
        开启: (<HTMLInputElement>document.getElementById("自动框选")).checked,
        图像识别: (<HTMLInputElement>document.getElementById("自动框选图像识别")).checked,
        最小阈值: (<HTMLInputElement>document.getElementById("框选最小阈值")).value,
        最大阈值: (<HTMLInputElement>document.getElementById("框选最大阈值")).value,
    });
    storeSet("框选.记忆.开启", (<HTMLInputElement>document.getElementById("记住框选大小")).checked);
    storeSet("图像编辑.默认属性", {
        填充颜色: (<HTMLInputElement>document.getElementById("填充颜色")).value,
        边框颜色: (<HTMLInputElement>document.getElementById("边框颜色")).value,
        边框宽度: (<HTMLInputElement>document.getElementById("边框宽度")).value,
        画笔颜色: (<HTMLInputElement>document.getElementById("画笔颜色")).value,
        画笔粗细: (<HTMLInputElement>document.getElementById("画笔粗细")).value,
    });
    storeSet("图像编辑.复制偏移", {
        x: (<HTMLInputElement>document.getElementById("复制dx")).value,
        y: (<HTMLInputElement>document.getElementById("复制dy")).value,
    });
    storeSet("插件.加载后", (<HTMLInputElement>document.getElementById("plugin")).value.trim().split("\n"));
    storeSet("贴图.窗口.变换", (<HTMLInputElement>document.getElementById("tran_css")).value);
    storeSet("贴图.窗口.双击", getRadio(document.getElementById("贴图双击")));
    storeSet("框选后默认操作", getRadio(document.getElementById("框选后默认操作")));
    storeSet("快速截屏.模式", getRadio(<HTMLInputElement>document.getElementById("快速截屏")));
    storeSet(
        "快速截屏.路径",
        (<HTMLInputElement>document.getElementById("快速截屏路径")).value
            ? ((<HTMLInputElement>document.getElementById("快速截屏路径")).value + "/").replace("//", "/")
            : ""
    );
    storeSet(
        "录屏.自动录制",
        (<HTMLInputElement>document.getElementById("开启自动录制")).checked &&
            (<HTMLInputElement>document.getElementById("自动录制延时")).value
    );
    storeSet("录屏.视频比特率", (<HTMLInputElement>document.getElementById("视频比特率")).value);
    storeSet("录屏.摄像头", {
        默认开启: (<HTMLInputElement>document.getElementById("默认开启摄像头")).checked,
        记住开启状态: (<HTMLInputElement>document.getElementById("记录摄像头开启状态")).checked,
        镜像: (<HTMLInputElement>document.getElementById("摄像头镜像")).checked,
    });
    storeSet("录屏.音频", {
        默认开启: (<HTMLInputElement>document.getElementById("默认开启音频")).checked,
        记住开启状态: (<HTMLInputElement>document.getElementById("记录音频开启状态")).checked,
    });
    storeSet("录屏.转换", {
        自动转换: (<HTMLInputElement>document.getElementById("开启自动转换")).checked,
        分段: (<HTMLInputElement>document.getElementById("分段")).value,
        格式: (<HTMLInputElement>document.getElementById("格式")).value,
        码率: Number((<HTMLInputElement>document.getElementById("码率")).value),
        帧率: Number((<HTMLInputElement>document.getElementById("帧率")).value),
        其他: (<HTMLInputElement>document.getElementById("ff其他参数")).value,
        高质量gif: (<HTMLInputElement>document.getElementById("高质量gif")).checked,
    });
    storeSet("录屏.提示", {
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
    storeSet("保存.默认格式", getRadio(<HTMLInputElement>document.getElementById("默认格式")));
    storeSet("保存.快速保存", (<HTMLInputElement>document.getElementById("快速保存")).checked);
    storeSet("保存名称", {
        前缀: (<HTMLInputElement>document.getElementById("保存文件名称前缀")).value,
        时间: (<HTMLInputElement>document.getElementById("保存文件名称时间")).value,
        后缀: (<HTMLInputElement>document.getElementById("保存文件名称后缀")).value,
    });
    storeSet("jpg质量", (<HTMLInputElement>document.getElementById("jpg质量")).value);
    字体.大小 = (<HTMLInputElement>document.getElementById("字体大小")).value;
    字体.记住 = (<HTMLInputElement>document.getElementById("记住字体大小")).checked
        ? typeof 字体.记住 === "number"
            ? 字体.记住
            : 字体.大小
        : false;
    storeSet("字体", 字体);
    storeSet("编辑器.自动换行", (<HTMLInputElement>document.getElementById("换行")).checked);
    storeSet("编辑器.拼写检查", (<HTMLInputElement>document.getElementById("拼写检查")).checked);
    storeSet("编辑器.行号", (<HTMLInputElement>document.getElementById("行号")).checked);
    storeSet("自动搜索", (<HTMLInputElement>document.getElementById("自动搜索")).checked);
    storeSet("自动打开链接", (<HTMLInputElement>document.getElementById("自动打开链接")).checked);
    storeSet("自动搜索中文占比", (<HTMLInputElement>document.getElementById("自动搜索中文占比")).value);
    if (o_搜索引擎) storeSet("搜索引擎", o_搜索引擎);
    if (o翻译引擎) storeSet("翻译引擎", o翻译引擎);
    storeSet("引擎", {
        记住: (<HTMLInputElement>document.getElementById("记住引擎")).checked
            ? [getRadio(document.getElementById("默认搜索引擎")), getRadio(document.getElementById("默认翻译引擎"))]
            : false,
        默认搜索引擎: getRadio(document.getElementById("默认搜索引擎")),
        默认翻译引擎: getRadio(document.getElementById("默认翻译引擎")),
    });
    storeSet("以图搜图", {
        引擎: getRadio(<HTMLInputElement>document.getElementById("图像搜索引擎")),
        记住: (<HTMLInputElement>document.getElementById("记住识图引擎")).checked
            ? old_store.以图搜图.记住 || getRadio(<HTMLInputElement>document.getElementById("图像搜索引擎"))
            : false,
    });
    storeSet("浏览器中打开", (<HTMLInputElement>document.getElementById("浏览器中打开")).checked);
    storeSet("浏览器.标签页", {
        自动关闭: (<HTMLInputElement>document.getElementById("搜索窗口自动关闭")).checked,
        小: (<HTMLInputElement>document.getElementById("标签缩小")).checked,
        灰度: (<HTMLInputElement>document.getElementById("标签灰度")).checked,
    });
    历史记录设置.d = Number((<HTMLInputElement>document.getElementById("his_d")).value);
    历史记录设置.h = Number((<HTMLInputElement>document.getElementById("his_h")).value);
    storeSet("历史记录设置", 历史记录设置);
    storeSet("时间格式", (<HTMLInputElement>document.getElementById("时间格式")).value);
    storeSet("OCR", {
        类型: getOcrType(),
        离线切换: (<HTMLInputElement>document.getElementById("离线切换")).checked,
        记住: (<HTMLInputElement>document.getElementById("记住OCR引擎")).checked
            ? old_store.OCR.记住 || getOcrType()
            : false,
        版本: old_store.OCR.版本,
    });
    storeSet("在线OCR.baidu", {
        url: getRadio(document.getElementById("baidu_ocr_url")),
        id: (<HTMLInputElement>document.getElementById("baidu_ocr_id")).value,
        secret: (<HTMLInputElement>document.getElementById("baidu_ocr_secret")).value,
    });
    storeSet("在线OCR.youdao", {
        id: (<HTMLInputElement>document.getElementById("youdao_ocr_id")).value,
        secret: (<HTMLInputElement>document.getElementById("youdao_ocr_secret")).value,
    });
    storeSet("代理", {
        mode: getRadio(document.getElementById("代理")),
        pacScript: (<HTMLInputElement>document.getElementById("pacScript")).value,
        proxyRules: setProxy(),
        proxyBypassRules: (<HTMLInputElement>document.getElementById("proxyBypassRules")).value,
    });
    storeSet("关闭窗口", {
        失焦: {
            主页面: (<HTMLInputElement>document.getElementById("主页面失焦")).checked,
        },
    });
    storeSet("硬件加速", (<HTMLInputElement>document.getElementById("硬件加速")).checked);
    storeSet("更新.dev", (<HTMLInputElement>document.getElementById("dev")).checked);
    storeSet("更新.频率", getRadio(document.getElementById("检查更新频率")));
    if (userDataPathInputed)
        fs.writeFile("preload_config", (<HTMLInputElement>document.getElementById("user_data_path")).value, (e) => {
            if (e) throw new Error(t("保存失败，请确保软件拥有运行目录的修改权限，或重新使用管理员模式打开软件"));
        });
    fs.writeFileSync(path.join(configPath, "config.json"), JSON.stringify(xstore, null, 2));
}

// 查找
document.getElementById("find_b_close").onclick = () => {
    find((<HTMLInputElement>document.getElementById("find_input")).value);
};
document.getElementById("find_input").oninput = () => {
    find((<HTMLInputElement>document.getElementById("find_input")).value);
};
document.getElementById("find_b_last").onclick = () => {
    findFocusI = (findFocusI - 1) % findRanges.length;
    if (findFocusI < 0) {
        findFocusI = findRanges.length - 1;
    }
    jumpToRange(findFocusI);
};
document.getElementById("find_b_next").onclick = () => {
    findFocusI = (findFocusI + 1) % findRanges.length;
    jumpToRange(findFocusI);
};
function jumpToRange(i: number) {
    let rect = findRanges[i].getBoundingClientRect();
    document.getElementById("find_t").innerText = `${i + 1} / ${findRanges.length}`;
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
let findRanges: Range[] = [];
let findFocusI = 0;
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

    findRanges = ranges.flat();
    findFocusI = 0;
    jumpToRange(findFocusI);

    // @ts-ignore
    const searchResultsHighlight = new Highlight(...ranges.flat());
    // @ts-ignore
    CSS.highlights.set("search-results", searchResultsHighlight);
}

var pathInfo = `<br>
                ${t("OCR 目录：")}${store.path.replace("config.json", "ocr")}<br>
                ${t("文字记录：")}${historyStore.path}<br>
                ${t("临时目录：")}${os.tmpdir()}${os.platform() == "win32" ? "\\" : "/"}eSearch<br>
                ${t("运行目录：")}${__dirname}`;
document.createTextNode(pathInfo);
document.getElementById("user_data_divs").insertAdjacentHTML("afterend", pathInfo);
try {
    (<HTMLInputElement>document.getElementById("user_data_path")).value =
        fs.readFileSync("preload_config").toString().trim() || store.path.replace(/[/\\]config\.json/, "");
} catch (error) {
    (<HTMLInputElement>document.getElementById("user_data_path")).value = store.path.replace(/[/\\]config\.json/, "");
}
var userDataPathInputed = false;
document.getElementById("user_data_path").oninput = () => {
    document.getElementById("user_data_divs").classList.add("user_data_divs");
    userDataPathInputed = true;
};
document.getElementById("move_user_data").onclick = () => {
    ipcRenderer.send("setting", "move_user_data", (<HTMLInputElement>document.getElementById("user_data_path")).value);
};

document.getElementById("reload").onclick = () => {
    saveSetting();
    ipcRenderer.send("setting", "reload");
};

ipcRenderer.on("setting", (_err, t, id, r) => {
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
var versionL = ["electron", "node", "chrome", "v8"];
for (let i in versionL) {
    version += `<div>${versionL[i]}: ${process.versions[versionL[i]]}</div>`;
}
document.getElementById("versions_info").insertAdjacentHTML("afterend", version);

import pack from "../../../package.json?raw";
var packageJson = JSON.parse(pack);
const download = require("download");
document.getElementById("name").innerHTML = packageJson.name;
document.getElementById("version").innerHTML = packageJson.version;
document.getElementById("description").innerHTML = t(packageJson.description);
document.getElementById("version").onclick = () => {
    fetch("https://api.github.com/repos/xushengfeng/eSearch/releases", { method: "GET", redirect: "follow" })
        .then((response) => response.json())
        .then((re) => {
            console.log(re);
            if (document.getElementById("update_info").innerHTML) return;
            let l = [];
            for (let r of re) {
                if (
                    !packageJson.version.includes("beta") &&
                    !packageJson.version.includes("alpha") &&
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
                    let tagEl = tag("最新版本");
                    tagEl.title = t("点击下载");
                    tagEl.classList.add("download_tag");
                    tags.append(tagEl);
                    tagEl.onclick = () => {
                        shell.openExternal(r.html_url);
                    };
                    for (let a of r.assets) {
                        if (a.name == "app") {
                            let el = document.createElement("span");
                            el.innerText = "增量更新";
                            tagEl.after(el);
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
                if (r.name == packageJson.version) {
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

document.getElementById("info").innerHTML = `<div>${t("项目主页:")} <a href="${packageJson.homepage}">${
    packageJson.homepage
}</a></div>
    <div><a href="https://github.com/xushengfeng/eSearch/releases/tag/${packageJson.version}">${t("更新日志")}</a></div>
    <div><a href="https://github.com/xushengfeng/eSearch/issues">${t("错误报告与建议")}</a></div>
    <div>${t("本软件遵循")} <a href="https://www.gnu.org/licenses/gpl-3.0.html">${packageJson.license}</a></div>
    <div>${t("本软件基于")} <a href="https://esearch.vercel.app/readme/all_license.json">${t("这些软件")}</a></div>
    <div>Copyright (C) 2021 ${packageJson.author.name} ${packageJson.author.email}</div>`;

document.getElementById("about").onclick = (e) => {
    console.log(e.target);
    if ((<HTMLElement>e.target).tagName == "A") {
        e.preventDefault();
        shell.openExternal((<HTMLAnchorElement>e.target).href);
    }
};

ipcRenderer.on("about", (_event, arg) => {
    if (arg != undefined) {
        location.hash = "#about";
    }
});

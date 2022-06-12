const { shell, ipcRenderer } = require("electron");
const os = require("os");

document.getElementById("set_default_setting").onclick = () => {
    if (confirm("将会把所有设置恢复成默认，无法撤销")) {
        ipcRenderer.send("setting", "set_default_setting");
        give_up = true;
        location.reload();
    }
};

var menu_o = {};
var menu_t = "";
for (let i of document.querySelectorAll("h1")) {
    menu_o[i.innerText] = i;
    menu_t += `<li>${i.innerText}</li>`;
}
document.getElementById("menu").innerHTML = menu_t;
document.getElementById("menu").onclick = (e) => {
    if (e.target.tagName == "LI") {
        document.getElementsByTagName("html")[0].scrollTop = menu_o[e.target.innerText].offsetTop;
    }
};

ipcRenderer.send("autostart", "get");
ipcRenderer.on("开机启动状态", (event, v) => {
    document.getElementById("autostart").checked = v;
});
document.getElementById("autostart").oninput = () => {
    ipcRenderer.send("autostart", "set", document.getElementById("autostart").checked);
};

document.getElementById("启动提示").checked = store.get("启动提示");

document.getElementById("语言").value = store.get("语言.语言");
document.getElementById("系统语言").onclick = () => {
    if (navigator.language.split("-")[0] == "zh") {
        document.getElementById("语言").value = {
            "zh-CN": "zh-HANS",
            "zh-SG": "zh-HANS",
            "zh-TW": "zh-HANT",
            "zh-HK": "zh-HANT",
        }[navigator.language];
    } else {
        document.getElementById("语言").value = navigator.language.split("-")[0];
    }
};
document.getElementById("语言").onclick = () => {
    lan(document.getElementById("语言").value);
    document.getElementById("语言重启").innerText = t("重启软件以生效");
};

document.getElementById("语言重启").onclick = () => {
    store.set("语言.语言", document.getElementById("语言").value);
    ipcRenderer.send("setting", "reload");
};

document.getElementById("自动搜索排除").value = store.get("主搜索功能.自动搜索排除").join("\n");
if (process.platform == "linux") {
    document.getElementById("linux_selection").style.display = "block";
    document.getElementById("剪贴板选区搜索").checked = store.get("主搜索功能.剪贴板选区搜索");
}

var 全局 = store.get("全局");

document.getElementById("深色模式").value = store.get("全局.深色模式");
document.getElementById("深色模式").onclick = () => {
    ipcRenderer.send("theme", document.getElementById("深色模式").value);
};

模糊 = store.get("全局.模糊");
if (模糊 != 0) {
    document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
} else {
    document.documentElement.style.setProperty("--blur", `none`);
}
document.querySelector("#模糊").value = 模糊;
document.querySelector("#模糊").oninput = () => {
    var 模糊 = document.querySelector("#模糊").value;
    if (模糊 != 0) {
        document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
    } else {
        document.documentElement.style.setProperty("--blur", `none`);
    }
};

document.documentElement.style.setProperty("--alpha", 全局.不透明度);
document.querySelector("#不透明度").value = 全局.不透明度 * 100;
document.querySelector("#不透明度").oninput = () => {
    var 不透明度 = document.querySelector("#不透明度").value;
    document.documentElement.style.setProperty("--alpha", 不透明度 / 100);
};

document.getElementById("全局缩放").value = store.get("全局.缩放");

// 单选项目设置加载
function 选择器储存(id, 默认) {
    document.querySelector(`#${id}`).value = store.get(id) || 默认;
    document.querySelector(`#${id}`).onclick = () => {
        store.set(id, document.querySelector(`#${id}`).value);
    };
}

var 快捷键 = store.get("快捷键");
document.querySelectorAll("#快捷键 hot-keys").forEach((el) => {
    el.value = 快捷键[el.name].key;
    el.addEventListener("inputend", () => {
        ipcRenderer.send("快捷键", [el.name, el.value]);
    });
});
ipcRenderer.on("状态", (event, name, arg) => {
    document.querySelector(`hot-keys[name=${name}]`).t = arg;
});

var 其他快捷键 = store.get("其他快捷键");
document.querySelector(`hot-keys[name="关闭"]`).value = 其他快捷键.关闭;
document.querySelector(`hot-keys[name="OCR(文字识别)"]`).value = 其他快捷键.OCR;
document.querySelector(`hot-keys[name="以图搜图"]`).value = 其他快捷键.以图搜图;
document.querySelector(`hot-keys[name="QR码"]`).value = 其他快捷键.QR码;
document.querySelector(`hot-keys[name="图像编辑"]`).value = 其他快捷键.图像编辑;
document.querySelector(`hot-keys[name="其他应用打开"]`).value = 其他快捷键.其他应用打开;
document.querySelector(`hot-keys[name="放在屏幕上"]`).value = 其他快捷键.放在屏幕上;
document.querySelector(`hot-keys[name="复制"]`).value = 其他快捷键.复制;
document.querySelector(`hot-keys[name="保存"]`).value = 其他快捷键.保存;
document.querySelector(`hot-keys[name="复制颜色"]`).value = 其他快捷键.复制颜色;

选择器储存("工具栏跟随", "展示内容优先");
选择器储存("光标", "以(1,1)为起点");
选择器储存("取色器默认格式", "HEX");

document.getElementById("按钮大小").value = store.get("工具栏.按钮大小");
document.getElementById("按钮图标比例").value = store.get("工具栏.按钮图标比例");

document.querySelector("#显示四角坐标").checked = store.get("显示四角坐标");

// 取色器设置
document.querySelector("#取色器大小").value = store.get("取色器大小");
document.querySelector("#像素大小").value = store.get("像素大小");
document.querySelector("#取色器大小").oninput = () => {
    if ((document.querySelector("#取色器大小").value - 0) % 2 == 0) {
        document.querySelector("#取色器大小").value = document.querySelector("#取色器大小").value - 0 + 1;
    }
    show_color_picker();
};
document.querySelector("#像素大小").oninput = () => {
    show_color_picker();
};

show_color_picker();
function show_color_picker() {
    color_size = document.querySelector("#取色器大小").value - 0;
    inner_html = "";
    for (i = 0; i < color_size ** 2; i++) {
        var l = Math.random() * 40 + 60;
        inner_html += `<span id="point_color_t"style="background:hsl(0,0%,${l}%);width:${
            document.querySelector("#像素大小").value
        }px;height:${document.querySelector("#像素大小").value}px"></span>`;
    }
    document.querySelector("#point_color").style.width =
        (document.querySelector("#像素大小").value - 0) * color_size + "px";
    document.querySelector("#point_color").style.height =
        (document.querySelector("#像素大小").value - 0) * color_size + "px";
    document.querySelector("#point_color").innerHTML = inner_html;
}

// 选区&遮罩颜色设置
document.querySelector("#遮罩颜色 > span").style.backgroundImage = `linear-gradient(${store.get(
    "遮罩颜色"
)}, ${store.get("遮罩颜色")}), url('assets/tbg.svg')`;
document.querySelector("#选区颜色 > span").style.backgroundImage = `linear-gradient(${store.get(
    "选区颜色"
)}, ${store.get("选区颜色")}), url('assets/tbg.svg')`;
document.querySelector("#遮罩颜色 > input").value = store.get("遮罩颜色");
document.querySelector("#选区颜色 > input").value = store.get("选区颜色");
document.querySelector("#遮罩颜色 > input").oninput = () => {
    document.querySelector("#遮罩颜色 > span").style.backgroundImage = `linear-gradient(${
        document.querySelector("#遮罩颜色 > input").value
    }, ${document.querySelector("#遮罩颜色 > input").value}), url('assets/tbg.svg')`;
};
document.querySelector("#选区颜色 > input").oninput = () => {
    document.querySelector("#选区颜色 > span").style.backgroundImage = `linear-gradient(${
        document.querySelector("#选区颜色 > input").value
    }, ${document.querySelector("#选区颜色 > input").value}), url('assets/tbg.svg')`;
};

document.getElementById("框选后默认操作").value = store.get("框选后默认操作");

document.getElementById("自动框选").checked = store.get("框选.自动框选.开启");
document.getElementById("框选最小阈值").value = store.get("框选.自动框选.最小阈值");
document.getElementById("框选最大阈值").value = store.get("框选.自动框选.最大阈值");
document.getElementById("框选最小阈值").oninput = () => {
    if (document.getElementById("框选最小阈值").value > document.getElementById("框选最大阈值").value) {
        document.getElementById("框选最大阈值").value = document.getElementById("框选最小阈值").value;
    }
};
document.getElementById("框选最大阈值").oninput = () => {
    if (document.getElementById("框选最大阈值").value < document.getElementById("框选最小阈值").value) {
        document.getElementById("框选最小阈值").value = document.getElementById("框选最大阈值").value;
    }
};

document.getElementById("填充颜色").value = store.get("图像编辑.默认属性.填充颜色");
document.getElementById("边框颜色").value = store.get("图像编辑.默认属性.边框颜色");
document.getElementById("边框宽度").value = store.get("图像编辑.默认属性.边框宽度");
document.getElementById("画笔颜色").value = store.get("图像编辑.默认属性.画笔颜色");
document.getElementById("画笔粗细").value = store.get("图像编辑.默认属性.画笔粗细");

document.getElementById("复制dx").value = store.get("图像编辑.复制偏移.x");
document.getElementById("复制dy").value = store.get("图像编辑.复制偏移.y");

document.getElementById("快速截屏").value = store.get("快速截屏.模式");
document.getElementById("快速截屏路径").value = store.get("快速截屏.路径");
document.getElementById("获取保存路径").onclick = () => {
    ipcRenderer.send("get_save_path", document.getElementById("快速截屏路径").value || "");
    ipcRenderer.on("get_save_path", (e, a) => {
        document.getElementById("快速截屏路径").value = a;
    });
};

document.getElementById("开启自动录制").checked = store.get("录屏.自动录制") !== false;
document.getElementById("自动录制延时").value = store.get("录屏.自动录制") || 0;
document.getElementById("视频比特率").value = store.get("录屏.视频比特率");
document.getElementById("默认开启摄像头").checked = store.get("录屏.摄像头.默认开启");
document.getElementById("记录摄像头开启状态").checked = store.get("录屏.摄像头.记住开启状态");
document.getElementById("摄像头镜像").checked = store.get("录屏.摄像头.镜像");

document.getElementById("默认开启音频").checked = store.get("录屏.音频.默认开启");
document.getElementById("记录音频开启状态").checked = store.get("录屏.音频.记住开启状态");

document.getElementById("ffmpeg_path").value = store.get("录屏.转换.ffmpeg");
document.getElementById("下载ffmpeg").onclick = () => {
    shell.openExternal("http://ffmpeg.org/download.html");
};
document.getElementById("开启自动转换").checked = store.get("录屏.转换.自动转换");
document.getElementById("格式").value = store.get("录屏.转换.格式");
document.getElementById("码率").value = store.get("录屏.转换.码率");
document.getElementById("帧率").value = store.get("录屏.转换.帧率");
document.getElementById("ff其他参数").value = store.get("录屏.转换.其他");

document.getElementById("开启键盘按键提示").checked = store.get("录屏.提示.键盘.开启");
document.getElementById("开启鼠标按键提示").checked = store.get("录屏.提示.鼠标.开启");
document.getElementById("开启光标提示").checked = store.get("录屏.提示.光标.开启");

document.getElementById("保存文件名称前缀").value = store.get("保存名称.前缀");
document.getElementById("保存文件名称时间").value = store.get("保存名称.时间");
document.getElementById("保存文件名称后缀").value = store.get("保存名称.后缀");
document.getElementById("保存文件名称前缀").oninput = document.getElementById("保存文件名称后缀").oninput = (e) => {
    e.target.style.width = `${e.target.value.length || 1}em`;
    show_f_time();
};
document.getElementById("保存文件名称时间").oninput = show_f_time;
function show_f_time() {
    var f = require("./lib/time_format");
    var save_time = new Date();
    document.getElementById("保存文件名称_p").innerText = `${document.getElementById("保存文件名称前缀").value}${f(
        document.getElementById("保存文件名称时间").value,
        save_time
    )}${document.getElementById("保存文件名称后缀").value}`;
}
show_f_time();
document.getElementById("保存文件名称前缀").style.width = `${
    document.getElementById("保存文件名称前缀").value.length || 1
}em`;
document.getElementById("保存文件名称后缀").style.width = `${
    document.getElementById("保存文件名称后缀").value.length || 1
}em`;

document.getElementById("默认格式").value = store.get("保存.默认格式");

document.getElementById("jpg质量").value = store.get("jpg质量");

var 字体 = store.get("字体");
document.documentElement.style.setProperty("--main-font", 字体.主要字体);
document.documentElement.style.setProperty("--monospace", 字体.等宽字体);
document.querySelector("#主要字体 > input").value = 字体.主要字体;
document.querySelector("#等宽字体 > input").value = 字体.等宽字体;
document.getElementById("字体大小").value = 字体.大小;
document.getElementById("记住字体大小").checked = 字体.记住;

document.querySelector("#主要字体 > input").oninput = () => {
    字体.主要字体 = document.querySelector("#主要字体 > input").value;
    document.documentElement.style.setProperty("--main-font", 字体.主要字体);
};
document.querySelector("#等宽字体 > input").oninput = () => {
    字体.等宽字体 = document.querySelector("#等宽字体 > input").value;
    document.documentElement.style.setProperty("--monospace", 字体.等宽字体);
};

document.getElementById("换行").checked = store.get("编辑器.自动换行");
document.getElementById("拼写检查").checked = store.get("编辑器.拼写检查");
document.getElementById("行号").checked = store.get("编辑器.行号");
document.getElementById("tab").value = store.get("编辑器.tab");
document.getElementById("光标动画").value = store.get("编辑器.光标动画");

document.querySelector("#自动搜索").checked = store.get("自动搜索");
document.querySelector("#自动打开链接").checked = store.get("自动打开链接");
document.querySelector("#自动搜索中文占比").value = store.get("自动搜索中文占比");

var o_搜索引擎 = store.get("搜索引擎");
if (o_搜索引擎) {
    var text = "";
    var default_en = `<set-select name="" id="默认搜索引擎">`;
    for (i in o_搜索引擎) {
        text += `${o_搜索引擎[i][0]}, ${o_搜索引擎[i][1]}\n`;
        default_en += `<div value="${o_搜索引擎[i][0]}">${o_搜索引擎[i][0]}</div>`;
    }
    document.querySelector("#搜索引擎").value = text;
    default_en += `</set-select>`;
    document.getElementById("默认搜索引擎div").innerHTML = default_en;
    document.getElementById("默认搜索引擎").value = store.get("引擎.默认搜索引擎");
}
document.querySelector("#搜索引擎").onchange = () => {
    o_搜索引擎 = [];
    var text = document.querySelector("#搜索引擎").value;
    var text_l = text.split("\n");
    var default_en = `<set-select name="" id="默认搜索引擎">`;
    for (i in text_l) {
        var r = /(\S+)\W*[,，:：]\W*(\S+)/g;
        var l = text_l[i].replace(r, "$1,$2").split(",");
        if (l[0] != "") {
            o_搜索引擎[i] = [l[0], l[1]];
            default_en += `<div value="${l[0]}">${l[0]}</div>`;
        }
    }
    default_en += `</set-select>`;
    document.getElementById("默认搜索引擎div").innerHTML = default_en;
    document.getElementById("默认搜索引擎").value = o_搜索引擎[0][0];
};

var o_翻译引擎 = store.get("翻译引擎");
if (o_翻译引擎) {
    var text = "";
    var default_en = `<set-select name="" id="默认翻译引擎">`;
    for (i in o_翻译引擎) {
        text += `${o_翻译引擎[i][0]}, ${o_翻译引擎[i][1]}\n`;
        default_en += `<div value="${o_翻译引擎[i][0]}">${o_翻译引擎[i][0]}</div>`;
    }
    document.querySelector("#翻译引擎").value = text;
    default_en += `</set-select>`;
    document.getElementById("默认翻译引擎div").innerHTML = default_en;
    document.getElementById("默认翻译引擎").value = store.get("引擎.默认翻译引擎");
}
document.querySelector("#翻译引擎").onchange = () => {
    o_翻译引擎 = [];
    var text = document.querySelector("#翻译引擎").value;
    var text_l = text.split("\n");
    var default_en = `<set-select name="" id="默认翻译引擎">`;
    for (i in text_l) {
        var r = /(\S+)\W*[,，:：]\W*(\S+)/g;
        var l = text_l[i].replace(r, "$1,$2").split(",");
        if (l[0] != "") {
            o_翻译引擎[i] = [l[0], l[1]];
            default_en += `<div value="${l[0]}">${l[0]}</div>`;
        }
    }
    default_en += `</set-select>`;
    document.getElementById("默认翻译引擎div").innerHTML = default_en;
    document.getElementById("默认翻译引擎").value = o_翻译引擎[0][0];
};
document.getElementById("记住引擎").checked = store.get("引擎.记住");

document.getElementById("图像搜索引擎").value = store.get("以图搜图.引擎");
document.getElementById("记住识图引擎").checked = store.get("以图搜图.记住");

document.querySelector("#浏览器中打开").checked = store.get("浏览器中打开");
document.querySelector("#搜索窗口自动关闭").checked = store.get("浏览器.标签页.自动关闭");
document.getElementById("标签缩小").checked = store.get("浏览器.标签页.小");
document.getElementById("标签灰度").checked = store.get("浏览器.标签页.灰度");

document.getElementById("clear_storage").onclick = () => {
    ipcRenderer.send("setting", "clear", "storage");
};
document.getElementById("clear_cache").onclick = () => {
    ipcRenderer.send("setting", "clear", "cache");
};

document.querySelector("#main").onclick = () => {
    window.location.href = "index.html";
};

document.getElementById("OCR类型").value = store.get("OCR.类型");
ocr_d_open();
function ocr_d_open() {
    document.getElementById("baidu_details").open = false;
    document.getElementById("youdao_details").open = false;
    if (document.getElementById("OCR类型").value == "baidu") {
        document.getElementById("baidu_details").open = true;
    } else if (document.getElementById("OCR类型").value == "youdao") {
        document.getElementById("youdao_details").open = true;
    }
}
document.getElementById("OCR类型").onclick = ocr_d_open;
document.getElementById("检查OCR").checked = store.get("OCR.检查OCR");
document.getElementById("记住OCR引擎").checked = store.get("OCR.记住");
document.getElementById("离线切换").checked = store.get("OCR.离线切换");
document.getElementById("ocr_det").value = store.get("OCR.det");
document.getElementById("ocr_rec").value = store.get("OCR.rec");
document.getElementById("ocr_字典").value = store.get("OCR.字典");
document.getElementById("下载离线OCR").onclick = () => {
    ipcRenderer.send("setting", "下载离线OCR");
};
document.getElementById("删除离线OCR").onclick = () => {
    ipcRenderer.send("setting", "删除离线OCR");
};
document.getElementById("baidu_ocr_url").value = store.get("在线OCR.baidu.url");
document.getElementById("baidu_ocr_id").value = store.get("在线OCR.baidu.id");
document.getElementById("baidu_ocr_secret").value = store.get("在线OCR.baidu.secret");
document.getElementById("youdao_ocr_id").value = store.get("在线OCR.youdao.id");
document.getElementById("youdao_ocr_secret").value = store.get("在线OCR.youdao.secret");

历史记录设置 = store.get("历史记录设置");

document.querySelector("#清除历史记录").disabled = !历史记录设置.保留历史记录;
document.querySelector("#his_d").disabled = !历史记录设置.自动清除历史记录;
document.querySelector("#his_h").disabled = !历史记录设置.自动清除历史记录;
document.querySelector("#his_d").value = 历史记录设置.d;
document.querySelector("#his_h").value = 历史记录设置.h;

document.querySelector("#历史记录_b").oninput = () => {
    历史记录设置.保留历史记录 = document.querySelector("#历史记录_b").checked;
    document.querySelector("#清除历史记录").disabled = !document.querySelector("#历史记录_b").checked;
};
document.querySelector("#清除历史记录").oninput = () => {
    历史记录设置.自动清除历史记录 = document.querySelector("#清除历史记录").checked;
    document.querySelector("#his_d").disabled = !document.querySelector("#清除历史记录").checked;
    document.querySelector("#his_h").disabled = !document.querySelector("#清除历史记录").checked;
};
var history_store = new Store({ name: "history" });
document.getElementById("clear_his").onclick = () => {
    var c = confirm("这将清除所有的历史记录\n且不能复原\n确定清除？");
    if (c) history_store.set("历史记录", {});
};

document.getElementById("时间格式").value = store.get("时间格式");

document.getElementById("代理").checked = store.get("开启代理");
var 代理 = store.get("代理");
document.getElementById("pacScript").value = 代理.pacScript;
document.getElementById("proxyRules").value = 代理.proxyRules;
document.getElementById("proxyBypassRules").value = 代理.proxyBypassRules;

document.getElementById("主页面失焦").checked = store.get("关闭窗口.失焦.主页面");

document.getElementById("硬件加速").checked = store.get("硬件加速");

document.getElementById("检查更新").checked = store.get("更新.检查更新");

document.getElementById("打开config").title = store.path;
document.getElementById("打开config").onclick = () => {
    shell.openPath(store.path);
};

var give_up = false;
document.getElementById("give_up_setting_b").oninput = () => {
    give_up = document.getElementById("give_up_setting_b").checked;
};

window.onbeforeunload = () => {
    try {
        save_setting();
    } catch {
        ipcRenderer.send("setting", "save_err");
    }
    ipcRenderer.send("setting", "reload_main");
};

function save_setting() {
    if (give_up) return;
    store.set("启动提示", document.getElementById("启动提示").checked);
    store.set("语言.语言", document.getElementById("语言").value);
    store.set("其他快捷键", {
        关闭: document.querySelector(`hot-keys[name="关闭"]`).value,
        OCR: document.querySelector(`hot-keys[name="OCR(文字识别)"]`).value,
        以图搜图: document.querySelector(`hot-keys[name="以图搜图"]`).value,
        QR码: document.querySelector(`hot-keys[name="QR码"]`).value,
        图像编辑: document.querySelector(`hot-keys[name="图像编辑"]`).value,
        其他应用打开: document.querySelector(`hot-keys[name="其他应用打开"]`).value,
        放在屏幕上: document.querySelector(`hot-keys[name="放在屏幕上"]`).value,
        复制: document.querySelector(`hot-keys[name="复制"]`).value,
        保存: document.querySelector(`hot-keys[name="保存"]`).value,
        复制颜色: document.querySelector(`hot-keys[name="复制颜色"]`).value,
    });
    store.set(
        "主搜索功能.自动搜索排除",
        document
            .getElementById("自动搜索排除")
            .value.split(/\n/)
            .filter((i) => i != "")
    );
    store.set("主搜索功能.剪贴板选区搜索", document.getElementById("剪贴板选区搜索").checked);
    var 模糊 = document.querySelector("#模糊").value - 0;
    store.set("全局.模糊", 模糊);
    store.set("全局.不透明度", document.querySelector("#不透明度").value / 100);
    store.set("全局.缩放", document.getElementById("全局缩放").value);
    store.set("工具栏", {
        按钮大小: document.getElementById("按钮大小").value,
        按钮图标比例: document.getElementById("按钮图标比例").value,
    });
    store.set("显示四角坐标", document.querySelector("#显示四角坐标").checked);
    store.set("取色器大小", document.querySelector("#取色器大小").value);
    store.set("像素大小", document.querySelector("#像素大小").value);
    store.set("遮罩颜色", document.querySelector("#遮罩颜色 > input").value);
    store.set("选区颜色", document.querySelector("#选区颜色 > input").value);
    store.set("框选.自动框选", {
        开启: document.getElementById("自动框选").checked,
        最小阈值: document.getElementById("框选最小阈值").value,
        最大阈值: document.getElementById("框选最大阈值").value,
    });
    store.set("图像编辑.默认属性", {
        填充颜色: document.getElementById("填充颜色").value,
        边框颜色: document.getElementById("边框颜色").value,
        边框宽度: document.getElementById("边框宽度").value,
        画笔颜色: document.getElementById("画笔颜色").value,
        画笔粗细: document.getElementById("画笔粗细").value,
    });
    store.set("图像编辑.复制偏移", {
        x: document.getElementById("复制dx").value,
        y: document.getElementById("复制dy").value,
    });
    store.set("框选后默认操作", document.getElementById("框选后默认操作").value);
    store.set("快速截屏.模式", document.getElementById("快速截屏").value);
    store.set(
        "快速截屏.路径",
        document.getElementById("快速截屏路径").value
            ? (document.getElementById("快速截屏路径").value + "/").replace("//", "/")
            : ""
    );
    store.set(
        "录屏.自动录制",
        document.getElementById("开启自动录制").checked && document.getElementById("自动录制延时").value
    );
    store.set("录屏.视频比特率", document.getElementById("视频比特率").value);
    store.set("录屏.摄像头", {
        默认开启: document.getElementById("默认开启摄像头").checked,
        记住开启状态: document.getElementById("记录摄像头开启状态").checked,
        镜像: document.getElementById("摄像头镜像").checked,
    });
    store.set("录屏.音频", {
        默认开启: document.getElementById("默认开启音频").checked,
        记住开启状态: document.getElementById("记录音频开启状态").checked,
    });
    store.set("录屏.转换", {
        ffmpeg: document.getElementById("ffmpeg_path").value,
        自动转换: document.getElementById("开启自动转换").checked,
        格式: document.getElementById("格式").value,
        码率: Number(document.getElementById("码率").value),
        帧率: Number(document.getElementById("帧率").value),
        其他: document.getElementById("ff其他参数").value,
    });
    store.set("录屏.提示", {
        键盘: {
            开启: document.getElementById("开启键盘按键提示").checked,
        },
        鼠标: {
            开启: document.getElementById("开启鼠标按键提示").checked,
        },
        光标: {
            开启: document.getElementById("开启光标提示").checked,
        },
    });
    store.set("保存.默认格式", document.getElementById("默认格式").value);
    store.set("保存名称", {
        前缀: document.getElementById("保存文件名称前缀").value,
        时间: document.getElementById("保存文件名称时间").value,
        后缀: document.getElementById("保存文件名称后缀").value,
    });
    store.set("jpg质量", document.getElementById("jpg质量").value);
    字体.大小 = document.getElementById("字体大小").value;
    字体.记住 = document.getElementById("记住字体大小").checked
        ? typeof 字体.记住 === "number"
            ? 字体.记住
            : 字体.大小
        : false;
    store.set("字体", 字体);
    store.set("编辑器.自动换行", document.getElementById("换行").checked);
    store.set("编辑器.拼写检查", document.getElementById("拼写检查").checked);
    store.set("编辑器.行号", document.getElementById("行号").checked);
    store.set("编辑器.tab", document.getElementById("tab").value);
    store.set("编辑器.光标动画", document.getElementById("光标动画").value);
    store.set("自动搜索", document.querySelector("#自动搜索").checked);
    store.set("自动打开链接", document.querySelector("#自动打开链接").checked);
    store.set("自动搜索中文占比", document.querySelector("#自动搜索中文占比").value);
    if (o_搜索引擎) store.set("搜索引擎", o_搜索引擎);
    if (o_翻译引擎) store.set("翻译引擎", o_翻译引擎);
    store.set("引擎", {
        记住: document.getElementById("记住引擎").checked
            ? [document.getElementById("默认搜索引擎").value, document.getElementById("默认翻译引擎").value]
            : false,
        默认搜索引擎: document.getElementById("默认搜索引擎").value,
        默认翻译引擎: document.getElementById("默认翻译引擎").value,
    });
    store.set("以图搜图", {
        引擎: document.getElementById("图像搜索引擎").value,
        记住: document.getElementById("记住识图引擎").checked
            ? store.get("以图搜图.记住") || document.getElementById("图像搜索引擎").value
            : false,
    });
    store.set("浏览器中打开", document.querySelector("#浏览器中打开").checked);
    store.set("浏览器.标签页", {
        自动关闭: document.querySelector("#搜索窗口自动关闭").checked,
        小: document.getElementById("标签缩小").checked,
        灰度: document.getElementById("标签灰度").checked,
    });
    历史记录设置.d = document.querySelector("#his_d").value - 0;
    历史记录设置.h = document.querySelector("#his_h").value - 0;
    store.set("历史记录设置", 历史记录设置);
    store.set("时间格式", document.getElementById("时间格式").value);
    store.set("OCR", {
        类型: document.getElementById("OCR类型").value,
        检查OCR: document.getElementById("检查OCR").checked,
        离线切换: document.getElementById("离线切换").checked,
        det: document.getElementById("ocr_det").value,
        rec: document.getElementById("ocr_rec").value,
        字典: document.getElementById("ocr_字典").value,
        记住: document.getElementById("记住OCR引擎").checked
            ? store.get("OCR.记住") || document.getElementById("OCR类型").value
            : false,
        版本: store.get("OCR.版本"),
    });
    store.set("在线OCR.baidu", {
        url: document.getElementById("baidu_ocr_url").value,
        id: document.getElementById("baidu_ocr_id").value,
        secret: document.getElementById("baidu_ocr_secret").value,
    });
    store.set("在线OCR.youdao", {
        id: document.getElementById("youdao_ocr_id").value,
        secret: document.getElementById("youdao_ocr_secret").value,
    });
    store.set("开启代理", document.getElementById("代理").checked);
    store.set("代理", {
        pacScript: document.getElementById("pacScript").value,
        proxyRules: document.getElementById("proxyRules").value,
        proxyBypassRules: document.getElementById("proxyBypassRules").value,
    });
    store.set("关闭窗口", {
        失焦: {
            主页面: document.getElementById("主页面失焦").checked,
        },
    });
    store.set("硬件加速", document.getElementById("硬件加速").checked);
    store.set("更新.检查更新", document.getElementById("检查更新").checked);
}

// 查找
document.getElementById("find_b_close").onclick = () => {
    find(document.getElementById("find_input").value, { start: false });
    document.getElementById("find_t").innerText = ``;
};
document.getElementById("find_input").onchange = () => {
    find(document.getElementById("find_input").value, { start: Boolean(document.getElementById("find_input").value) });
};
document.getElementById("find_b_last").onclick = () => {
    find(document.getElementById("find_input").value, { start: true, forward: false, findNext: true });
};
document.getElementById("find_b_next").onclick = () => {
    find(document.getElementById("find_input").value, { start: true, forward: true, findNext: true });
};
function find(t, o) {
    ipcRenderer.send("setting", "find", { t, o });
}
ipcRenderer.on("found", (e, a, b) => {
    document.getElementById("find_t").innerText = `${a} / ${b}`;
});

var path_info = `${t("运行目录：")}${__dirname}<br>
                ${t("配置目录：")}${store.path.replace(/[/\\]config\.json/, "")}<br>
                ${t("OCR 目录：")}${store.path.replace("config.json", "ocr")}<br>
                ${t("临时目录：")}${os.tmpdir()}${os.platform == "win32" ? "\\" : "/"}eSearch<br>
                ${t("文字记录：")}${history_store.path}`;
document.createTextNode(path_info);
document.getElementById("path_info").insertAdjacentHTML("afterend", path_info);

var version = `<div>${t("本机系统内核:")} ${os.type()} ${os.release()}</div>`;
var version_l = ["electron", "node", "chrome", "v8"];
for (i in version_l) {
    version += `<div>${version_l[i]}: ${process.versions[version_l[i]]}</div>`;
}
document.getElementById("versions_info").insertAdjacentHTML("afterend", version);

var package = require("./package.json");
document.getElementById("name").innerHTML = package.name;
document.querySelector("#version").innerHTML = package.version;
document.getElementById("description").innerHTML = t(package.description);
document.getElementById("version").onclick = () => {
    var requestOptions = {
        method: "GET",
        redirect: "follow",
    };

    fetch("https://api.github.com/repos/xushengfeng/eSearch/releases/latest", requestOptions)
        .then((response) => response.text())
        .then((result) => {
            result = JSON.parse(result);
            console.log(result);
            if (version_new(result.name, package.version) && !result.draft && !result.prerelease) {
                document.getElementById("update_info").innerHTML = `${t("有新版本:")} <a href="${result.html_url}">${
                    result.name
                }</a>`;
                document.getElementById("menu").lastElementChild.style.color = "#335EFE";
            } else {
                document.getElementById("update_info").innerHTML = t("暂无更新");
                (")");
            }
        })
        .catch((error) => console.log("error", error));
};

if (new Date().getDay() >= 6) {
    document.getElementById("version").click();
}

function version_new(v1, v2) {
    v1 = v1.split(".").map((v) => Number(v));
    v2 = v2.split(".").map((v) => Number(v));
    if (v1[0] > v2[0]) {
        return true;
    } else if (v1[0] == v2[0] && v1[1] > v2[1]) {
        return true;
    } else if (v1[0] == v2[0] && v1[1] == v2[1] && v1[2] > v2[2]) {
        return true;
    } else {
        return false;
    }
}
document.querySelector("#info").innerHTML = `<div>${t("项目主页:")} <a href="${package.homepage}">${
    package.homepage
}</a></div>
    <div><a href="https://github.com/xushengfeng/eSearch/releases/tag/${package.version}">${t("更新日志")}</a></div>
    <div><a href="https://github.com/xushengfeng/eSearch/issues">${t("错误报告与建议")}</a></div>
    <div>${t("本软件遵循")} <a href="https://www.gnu.org/licenses/gpl-3.0.html">${package.license}</a></div>
    <div>${t("本软件基于")} <a href="https://esearch.vercel.app/readme/all_license.json">${t("这些软件")}</a></div>
    <div>Copyright (C) 2021 ${package.author.name} ${package.author.email}</div>`;

document.querySelector("#about").onclick = (e) => {
    console.log(e.target);
    if (e.target.tagName == "A") {
        e.preventDefault();
        shell.openExternal(e.target.href);
    }
};

ipcRenderer.on("about", (event, arg) => {
    if (arg != undefined) {
        location.hash = "#about";
    }
});

var io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
        document.getElementById("version").click();
    }
});

io.observe(document.querySelector("#about > img"));

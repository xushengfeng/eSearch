const Color = require("color");
const { shell } = require("electron");

模糊 = store.get("模糊") || 10;
if (模糊 != 0) {
    document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
} else {
    document.documentElement.style.setProperty("--blur", `none`);
}
document.querySelector("#模糊").value = store.get("模糊") || 10;
document.querySelector("#模糊").oninput = () => {
    var 模糊 = document.querySelector("#模糊").value;
    if (模糊 < 0) {
        document.querySelector("#模糊").value = 0;
    }
    if (模糊 != 0) {
        document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
    } else {
        document.documentElement.style.setProperty("--blur", `none`);
    }
    store.set("模糊", 模糊);
};

// 单选项目设置加载
function 选择器储存(id, 默认) {
    document.querySelector(`#${id}`).value = store.get(id) || 默认;
    document.querySelector(`#${id}`).onclick = () => {
        store.set(id, document.querySelector(`#${id}`).value);
    };
}

document.querySelector("#自动识别 hot-keys div").innerHTML =
    `<kbd>${store.get("key_自动识别")?.replace(/\+/g, "</kbd>+<kbd>")}</kbd>` || "";
document.querySelector("#截图搜索 hot-keys div").innerHTML =
    `<kbd>${store.get("key_截图搜索")?.replace(/\+/g, "</kbd>+<kbd>")}</kbd>` || "";
document.querySelector("#选中搜索 hot-keys div").innerHTML =
    `<kbd>${store.get("key_选中搜索")?.replace(/\+/g, "</kbd>+<kbd>")}</kbd>` || "";
document.querySelector("#剪贴板搜索 hot-keys div").innerHTML =
    `<kbd>${store.get("key_剪贴板搜索")?.replace(/\+/g, "</kbd>+<kbd>")}</kbd>` || "";

if (document.title == "eSearch-设置") {
    选择器储存("工具栏跟随", "展示内容优先");
    选择器储存("光标", "以(1,1)为起点");
    选择器储存("取色器默认格式", "HEX");
}

document.querySelector("#显示四角坐标").checked = store.get("显示四角坐标") || false;
document.querySelector("#显示四角坐标").oninput = () => {
    store.set("显示四角坐标", document.querySelector("#显示四角坐标").checked);
};

// 取色器设置
document.querySelector("#取色器大小").value = store.get("取色器大小") || "15";
document.querySelector("#像素大小").value = store.get("像素大小") || "10";
document.querySelector("#取色器大小").oninput = () => {
    if ((document.querySelector("#取色器大小").value - 0) % 2 == 0) {
        document.querySelector("#取色器大小").value = document.querySelector("#取色器大小").value - 0 + 1;
    }
    show_color_picker();
    store.set("取色器大小", document.querySelector("#取色器大小").value - 0);
};
document.querySelector("#像素大小").oninput = () => {
    show_color_picker();
    store.set("像素大小", document.querySelector("#像素大小").value - 0);
};

point_color_view = document.querySelector("#point_color_view");
var img = document.createElement("img");
img.src = "assets/sample_picture.svg";
img.onload = () => {
    point_color_view.width = img.width;
    point_color_view.height = img.height;
    point_color_view.getContext("2d").drawImage(img, 0, 0);
    show_color_picker();
};
function show_color_picker() {
    color_size = document.querySelector("#取色器大小").value - 0;
    color = point_color_view.getContext("2d").getImageData(0, 0, color_size, color_size).data; // 取色器密度
    // 分开每个像素的颜色
    color_g = [];
    for (var i = 0, len = color.length; i < len; i += 4) {
        color_g.push(color.slice(i, i + 4));
    }
    inner_html = "";
    for (i in color_g) {
        color_g[i][3] /= 255;
        inner_html += `<span id="point_color_t" style="background: ${Color.rgb(color_g[i]).string()}; width:${
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
document.querySelector("#遮罩颜色 > span").style.backgroundImage =
    `linear-gradient(${store.get("遮罩颜色")}, ${store.get("遮罩颜色")}), url('assets/tbg.svg')` ||
    "linear-gradient(#0005, #0005), url('assets/tbg.svg')";
document.querySelector("#选区颜色 > span").style.backgroundImage =
    `linear-gradient(${store.get("选区颜色")}, ${store.get("选区颜色")}), url('assets/tbg.svg')` ||
    "linear-gradient(#0000, #0000), url('assets/tbg.svg')";
document.querySelector("#遮罩颜色 > input").value = store.get("遮罩颜色") || "#0005";
document.querySelector("#选区颜色 > input").value = store.get("选区颜色") || "#0000";
document.querySelector("#遮罩颜色 > input").oninput = () => {
    document.querySelector("#遮罩颜色 > span").style.backgroundImage = `linear-gradient(${
        document.querySelector("#遮罩颜色 > input").value
    }, ${document.querySelector("#遮罩颜色 > input").value}), url('assets/tbg.svg')`;
    store.set("遮罩颜色", document.querySelector("#遮罩颜色 > input").value);
};
document.querySelector("#选区颜色 > input").oninput = () => {
    document.querySelector("#选区颜色 > span").style.backgroundImage = `linear-gradient(${
        document.querySelector("#选区颜色 > input").value
    }, ${document.querySelector("#选区颜色 > input").value}), url('assets/tbg.svg')`;
    store.set("选区颜色", document.querySelector("#选区颜色 > input").value);
};

字体 = store.get("字体") || { 主要字体: "", 等宽字体: "" };
document.documentElement.style.setProperty("--main-font", 字体.主要字体);
document.documentElement.style.setProperty("--monospace", 字体.等宽字体);
document.querySelector("#主要字体 > input").oninput = () => {
    字体.主要字体 = document.querySelector("#主要字体 > input").value;
    document.documentElement.style.setProperty("--main-font", 字体.主要字体);
    store.set("字体", 字体);
};
document.querySelector("#等宽字体 > input").oninput = () => {
    字体.等宽字体 = document.querySelector("#等宽字体 > input").value;
    document.documentElement.style.setProperty("--monospace", 字体.等宽字体);
    store.set("字体", 字体);
};

document.querySelector("#自动搜索").checked = store.get("自动搜索") || false;
document.querySelector("#自动搜索").onclick = () => {
    store.set("自动搜索", document.querySelector("#自动搜索").checked);
};
document.querySelector("#自动打开链接").checked = store.get("自动打开链接") || false;
document.querySelector("#自动打开链接").onclick = () => {
    store.set("自动打开链接", document.querySelector("#自动打开链接").checked);
};
document.querySelector("#自动搜索中文占比").value = store.get("自动搜索中文占比") || 0.5;
document.querySelector("#自动搜索中文占比").oninput = () => {
    store.set("自动搜索中文占比", document.querySelector("#自动搜索中文占比").checked);
};

var o_搜索引擎 = store.get("搜索引擎");
if (o_搜索引擎 != undefined) {
    var text = "";
    for (i in o_搜索引擎) {
        text += `${o_搜索引擎[i][0]}, ${o_搜索引擎[i][1]}\n`;
    }
    document.querySelector("#搜索引擎").value = text;
}

document.querySelector("#搜索引擎").oninput = () => {
    var list = [];
    var text = document.querySelector("#搜索引擎").value;
    var text_l = text.split("\n");
    for (i in text_l) {
        var r = /(\S+)\W*[,，:：]\W*(\S+)/g;
        var l = text_l[i].replace(r, "$1,$2").split(",");
        if (l[0] != "") list[i] = [l[0], l[1]];
    }

    store.set("搜索引擎", list);
};

var o_翻译引擎 = store.get("翻译引擎");
if (o_翻译引擎 != undefined) {
    var text = "";
    for (i in o_翻译引擎) {
        text += `${o_翻译引擎[i][0]}, ${o_翻译引擎[i][1]}\n`;
    }
    document.querySelector("#翻译引擎").value = text;
}

document.querySelector("#翻译引擎").oninput = () => {
    var list = [];
    var text = document.querySelector("#翻译引擎").value;
    var text_l = text.split("\n");
    for (i in text_l) {
        var r = /(\S+)\W*[,，]\W*(\S+)/g;
        var l = text_l[i].replace(r, "$1,$2").split(",");
        if (l[0] != "") list[i] = [l[0], l[1]];
    }

    store.set("翻译引擎", list);
};

document.querySelector("#浏览器中打开").checked = store.get("浏览器中打开") || false;
document.querySelector("#浏览器中打开").onclick = () => {
    store.set("浏览器中打开", document.querySelector("#浏览器中打开").checked);
};

document.querySelector("#main").onclick = () => {
    window.location.href = "index.html";
};

document.querySelector("#ocr_local").oninput = () => {
    ocr_l_c();
    store.set("ocr_local", document.querySelector("#ocr_local").checked);
};
function ocr_l_c() {
    if (document.querySelector("#ocr_local").checked) {
        document.querySelector("#ocr_url").disabled = true;
        document.querySelector("#ocr_access_token").disabled = true;
    } else {
        document.querySelector("#ocr_url").disabled = false;
        document.querySelector("#ocr_access_token").disabled = false;
    }
}
document.querySelector("#ocr_local").checked = store.get("ocr_local") || true;
ocr_l_c();
document.querySelector("#ocr_url").value = store.get("ocr_url") || "";
document.querySelector("#ocr_access_token").value = store.get("ocr_access_token") || "";

document.querySelector("#ocr_url").oninput = () => {
    store.set("ocr_url", document.querySelector("#ocr_url").value);
};
document.querySelector("#ocr_access_token").oninput = () => {
    store.set("ocr_access_token", document.querySelector("#ocr_access_token").value);
};

// 进度条
scroll = setTimeout(() => {
    document.querySelector("body").className = "hidescrollbar";
}, 1000);
document.querySelector("body").onscroll = () => {
    clearTimeout(scroll - 1);
    document.querySelector("body").className = "";
    scroll = setTimeout(() => {
        document.querySelector("body").className = "hidescrollbar";
    }, 1000);
};

var package = require("./package.json");
document.querySelector(
    "#name"
).innerHTML = `<span>${package.name} ${package.version}</span></br>${package.description}`;
document.querySelector("#info").innerHTML = `<div>项目主页: <a href="${package.homepage}">${package.homepage}</a></div>
    <div>本软件遵循 <a href="https://www.gnu.org/licenses/gpl-3.0.html">${package.license}</a> 协议</div>
    <div>Copyright (C) 2021 ${package.author.name} ${package.author.email}</div>`;
var version = ``;
var version_l = ["electron", "node", "chrome", "v8"];
for (i in version_l) {
    version += `<div>${version_l[i]}: ${process.versions[version_l[i]]}</div>`;
}
document.querySelector("#version").innerHTML = version;

document.querySelector("#info").onclick = (e) => {
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

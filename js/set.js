// 单选项目设置加载
function 选择器储存(id, 默认) {
    document.querySelector(`#${id}`).value = store.get(id) || 默认;
    document.querySelector(`#${id}`).onclick = () => {
        store.set(id, document.querySelector(`#${id}`).value);
    };
}

document.querySelector("#自动识别 hot-keys input").value = store.get("key_自动识别") || "";
document.querySelector("#截图搜索 hot-keys input").value = store.get("key_截图搜索") || "";
document.querySelector("#选中搜索 hot-keys input").value = store.get("key_选中搜索") || "";
document.querySelector("#剪贴板搜索 hot-keys input").value = store.get("key_剪贴板搜索") || "";

if (document.title == "eSearch-设置") {
    选择器储存("工具栏跟随", "展示内容优先");
    选择器储存("光标", "以(1,1)为起点");
    选择器储存("取色器默认格式", "HEX");
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

document.querySelector("#自动搜索").checked = store.get("自动搜索") || false;
document.querySelector("#自动搜索").onclick = () => {
    store.set("自动搜索", document.querySelector("#自动搜索").checked);
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

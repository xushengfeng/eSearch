const Store = require("electron-store");

store = new Store();

function 选择器储存(id, 默认) {
    document.querySelector(`#${id}`).value = store.get(id) || 默认;
    document.querySelector(`#${id}`).onclick = () => {
        store.set(id, document.querySelector(`#${id}`).value);
    };
}

if (document.title == "eSearch-设置") {
    选择器储存("工具栏跟随", "展示内容优先");
    选择器储存("光标", "以(1,1)为起点");
    选择器储存("取色器默认格式", "HEX");
}

document.querySelector("#遮罩颜色 > span").style.background = store.get("遮罩颜色") || "#0005";
document.querySelector("#选区颜色 > span").style.background = store.get("选区颜色") || "#0000";
document.querySelector("#遮罩颜色 > input").value = store.get("遮罩颜色") || "#0005";
document.querySelector("#选区颜色 > input").value = store.get("选区颜色") || "#0000";
document.querySelector("#遮罩颜色 > input").oninput = () => {
    document.querySelector("#遮罩颜色 > span").style.background = document.querySelector("#遮罩颜色 > input").value;
    store.set("遮罩颜色", document.querySelector("#遮罩颜色 > input").value);
};
document.querySelector("#选区颜色 > input").oninput = () => {
    document.querySelector("#选区颜色 > span").style.background = document.querySelector("#选区颜色 > input").value;
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

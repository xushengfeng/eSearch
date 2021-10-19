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

document.querySelector("#搜索引擎").onchange = () => {
    var list = [];
    var text = document.querySelector("#搜索引擎").value;
    var text_l = text.split("\n");
    for (i in text_l) {
        var r = /(\S+)\W*[,，]\W*(\S+)/g;
        var l = text_l[i].replace(r, "$1,$2").split(",");
        list[i] = [l[0], l[1]];
    }

    store.set("搜索引擎", list);
};

document.querySelector("#翻译引擎").onchange = () => {
    var list = [];
    var text = document.querySelector("#翻译引擎").value;
    var text_l = text.split("\n");
    for (i in text_l) {
        var r = /(\S+)\W*[,，]\W*(\S+)/g;
        var l = text_l[i].replace(r, "$1,$2").split(",");
        list[i] = [l[0], l[1]];
    }

    store.set("翻译引擎", list);
};

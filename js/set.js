const Store = require("electron-store");

store = new Store();

function 选择器储存(id, 默认) {
    document.querySelector(`#${id}`).value = store.get(id) || 默认;
    document.querySelector(`#${id}`).onclick = () => {
        store.set(id, document.querySelector(`#${id}`).value);
    };
    document.querySelector(`#${id}`).oninput = () => {
        store.set(id, document.querySelector(`#${id}`).value);
    };
}

if (document.title == "Information-portal-设置") {
    选择器储存("工具栏跟随", "展示内容优先");
    选择器储存("弹出时间", "500");
    选择器储存("保留时间", "500");
    选择器储存("光标", "以(1,1)为起点");
    选择器储存("取色器默认格式", "RGBA");
}

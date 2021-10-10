const Store = require("electron-store");

store = new Store();

function 选择器储存(id, 默认) {
    document.querySelector(`#${id}`).value = store.get(id) || 默认;
    document.querySelector(`#${id}`).onclick = () => {
        store.set(id, document.querySelector(`#${id}`).value);
    };
}
选择器储存("工具栏跟随","展示内容优先");
工具栏跟随 = store.get("工具栏跟随") || "展示内容优先";

选择器储存("弹出时间","500");
弹出时间 = store.get("弹出时间") || "500";

选择器储存("保留时间","500");
保留时间 = store.get("保留时间") || "500";

选择器储存("光标", "以(1,1)为起点");
光标 = store.get("光标") || "以(1,1)为起点";

选择器储存("取色器默认格式","RGBA");
取色器默认格式 = store.get("取色器默认格式") || "RGBA";

// 获取
store.get("unicorn");

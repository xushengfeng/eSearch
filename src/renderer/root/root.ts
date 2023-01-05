let config_path = new URLSearchParams(location.search).get("config_path");
const Store = require("electron-store");
import { t, lan } from "../../../lib/translate/translate";

function init() {
    var store = new Store({
        cwd: config_path || "",
    });
    var 模糊 = store.get("全局.模糊");
    if (模糊 != 0) {
        document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
    } else {
        document.documentElement.style.setProperty("--blur", `none`);
    }

    document.documentElement.style.setProperty("--alpha", store.get("全局.不透明度"));

    var 字体 = store.get("字体");
    document.documentElement.style.setProperty("--main-font", 字体.主要字体);
    document.documentElement.style.setProperty("--monospace", 字体.等宽字体);

    document.documentElement.style.setProperty("--icon-color", store.get("全局.图标颜色")[1]);
    lan(store.get("语言.语言"));
    document.title = t(document.title);
}

export default init;

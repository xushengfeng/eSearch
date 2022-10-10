import root_init from "../root/root";
root_init();
const Store = require("electron-store");
var store = new Store();
if (store.get("语言.语言") != "zh-CN") {
    let href = `http://fanyi.baidu.com/transpage?query=https%3A%2F%2Fe-search.vercel.app%2Fhelp.html&from=zh&to=${
        store.get("语言.语言").split("-")[0]
    }&source=url&render=1`;

    (<HTMLAnchorElement>document.getElementById("language")).href = href;
    document.getElementById("language").innerText = "Translation";
}

const { shell } = require("electron");
document.onclick = (e) => {
    let el = <HTMLElement>e.target;
    if (el.tagName == "A") {
        shell.openExternal((<HTMLAnchorElement>el).href);
    }
};

if (process.platform != "linux") {
    document.getElementById("ffmpeg_linux").style.display = "none";
}

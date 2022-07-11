if (store.get("语言.语言") != "zh-CN") {
    let href = `http://fanyi.baidu.com/transpage?query=https%3A%2F%2Fe-search.vercel.app%2Fhelp.html&from=zh&to=${
        store.get("语言.语言").split("-")[0]
    }&source=url&render=1`;

    document.getElementById("language").href = href;
    document.getElementById("language").innerText = "Translation";
}

const { shell } = require("electron");
document.onclick = (e) => {
    let el = e.target;
    if (el.tagName == "A") {
        shell.openExternal(el.href);
    }
};

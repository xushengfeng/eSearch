const { shell } = require("electron");
document.onclick = (e) => {
    let el = e.target;
    if (el.tagName == "A") {
        shell.openExternal(el.href);
    }
};

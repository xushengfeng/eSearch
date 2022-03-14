const { ipcRenderer, shell } = require("electron");

var top_tab = {};

ipcRenderer.on("url", (event, pid, id, title, url) => {
    top_tab = { title: title, url: url };
    console.log(top_tab);
    var li = document.getElementById("tab").cloneNode(true);
    li.style.display = "block";
    li.querySelector("span").innerText = title;
    var button = li.querySelector("button");
    button.onclick = () => {
        ipcRenderer.send("tab_view", pid, id, "close");
    };
    document.getElementById("tabs").appendChild(li);
});

ipcRenderer.on("open_in_browser", () => {
    shell.openExternal(top_tab.url);
});

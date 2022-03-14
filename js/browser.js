const { ipcRenderer, shell } = require("electron");

var top_tab = {};

ipcRenderer.on("url", (event, pid, id, title, url) => {
    top_tab = { title: title, url: url };
    console.log(top_tab);
    var li = document.getElementById("tab").cloneNode(true);
    li.style.display = "flex";
    li.querySelector("span").innerText = title;
    li.querySelector("span").onclick = () => {
        ipcRenderer.send("tab_view", pid, id, "top");
        focus_tab(li);
    };
    var button = li.querySelector("button");
    button.onclick = () => {
        ipcRenderer.send("tab_view", pid, id, "close");
        var l = document.querySelectorAll("li");
        for (i in l) {
            if (l[i] === li)
                if (i == 0) {
                    focus_tab(l[1]);
                } else {
                    focus_tab(l[i - 1]);
                }
        }
        document.getElementById("tabs").removeChild(li);
    };
    document.getElementById("tabs").appendChild(li);
    focus_tab(li);
});

function focus_tab(li) {
    var l = document.querySelectorAll("li");
    for (i of l) {
        if (i === li) {
            i.className = "tab_focus";
        } else {
            i.className = "";
        }
    }
}

ipcRenderer.on("open_in_browser", () => {
    shell.openExternal(top_tab.url);
});

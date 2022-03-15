const { ipcRenderer, shell } = require("electron");

var li_list = [];

ipcRenderer.on("url", (event, pid, id, title, url) => {
    var li = document.getElementById("tab").cloneNode(true);
    li_list.push(li);
    li.style.display = "flex";
    li.setAttribute("data-url", url);
    li.querySelector("span").innerText = title;
    li.querySelector("span").onclick = () => {
        ipcRenderer.send("tab_view", pid, id, "top");
        focus_tab(li);
    };
    var button = li.querySelector("button");
    button.onclick = () => {
        ipcRenderer.send("tab_view", pid, id, "close");
        var l = document.querySelectorAll("li");
        for (i in li_list) {
            if (li_list[i] === li) {
                if (i == 0) {
                    focus_tab(li_list[1]);
                } else {
                    focus_tab(li_list[i - 1]);
                }
                li_list.splice(i, 1);
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
    for (j in li_list) {
        if (li_list[j] === li) {
            li_list.splice(j, 1);
            li_list.push(li);
        }
    }
}

ipcRenderer.on("open_in_browser", () => {
    var url = document.querySelector(".tab_focus").getAttribute("data-url");
    shell.openExternal(url);
});

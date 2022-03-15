const { ipcRenderer, shell } = require("electron");

var li_list = [];
var pid;

ipcRenderer.on("url", (event, pid, id, arg, arg1) => {
    pid = pid;
    if (arg == "new") {
        new_tab(pid, id, arg1);
    }
    if (arg == "title") {
        title(pid, id, arg1);
    }
    if (arg == "icon") {
        icon(pid, id, arg1);
    }
    if (arg == "url") {
        url(pid, id, arg1);
    }
});

function new_tab(pid, id, url) {
    var li = document.getElementById("tab").cloneNode(true);
    li_list.push(li);
    li.style.display = "flex";
    li.setAttribute("data-url", url);
    li.querySelector("span").onclick = () => {
        ipcRenderer.send("tab_view", pid, id, "top");
        focus_tab(li);
    };
    var button = li.querySelector("button");
    button.onclick = () => {
        ipcRenderer.send("tab_view", pid, id, "close");
        var l = document.querySelectorAll("li");
        for (i in l) {
            if (l[i] === li && document.querySelector(".tab_focus") === li) {
                // 模板排除
                if (i == l.length - 2) {
                    focus_tab(l[l.length - 3]);
                } else {
                    focus_tab(l[i + 1]);
                }
            }
        }
        document.getElementById("tabs").removeChild(li);
    };
    document.getElementById("tabs").appendChild(li);
    focus_tab(li);
    li.id = "id" + id;
}

function focus_tab(li) {
    var l = document.querySelectorAll("li");
    for (i of l) {
        if (i === li) {
            i.classList.add("tab_focus");
        } else {
            i.classList.remove("tab_focus");
        }
    }
    for (j in li_list) {
        if (li_list[j] === li) {
            li_list.splice(j, 1);
            li_list.push(li);
        }
    }
}

function title(pid, id, arg) {
    document.querySelector(`#id${id} > span`).innerHTML = arg;
}

function icon(pid, id, arg) {
    document.querySelector(`#id${id} > img`).src = arg[0];
}

function url(pid, id, url) {
    document.querySelector(`#id${id}`).setAttribute("data-url", url);
}

document.getElementById("buttons").onclick = (e) => {
    var id = li_list[li_list.length - 1].id.replace("id", "");
    if (e.target.id == "browser") {
        open_in_browser();
    } else if (e.target.id == "add_history") {
        var 历史记录 = store.get("历史记录");
        var the_历史记录 = [
            {
                text: document.querySelector(".tab_focus").getAttribute("data-url"),
                time: new Date().getTime(),
            },
        ];
        the_历史记录.push.apply(the_历史记录, 历史记录);
        store.set("历史记录", the_历史记录);
    } else {
        if (e.target.id) ipcRenderer.send("tab_view", pid, id, e.target.id);
    }
};

function open_in_browser() {
    var url = document.querySelector(".tab_focus").getAttribute("data-url");
    shell.openExternal(url);
}

ipcRenderer.on("open_in_browser", open_in_browser);

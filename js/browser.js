const { ipcRenderer, shell } = require("electron");

var li_list = [];
var pid;

ipcRenderer.on("url", (event, _pid, id, arg, arg1) => {
    pid = _pid;
    if (arg == "new") {
        new_tab(_pid, id, arg1);
    }
    if (arg == "title") {
        title(_pid, id, arg1);
    }
    if (arg == "icon") {
        icon(_pid, id, arg1);
    }
    if (arg == "url") {
        url(_pid, id, arg1);
    }
    if (arg == "load") {
        load(_pid, id, arg1);
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
        close_tab(pid, id);
    };
    document.getElementById("tabs").appendChild(li);
    focus_tab(li);
    li.id = "id" + id;
}

function close_tab(li, pid, id) {
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
    document.querySelector(`#id${id} > span`).innerHTML = document.querySelector(`#id${id} > span`).title = arg;
}

function icon(pid, id, arg) {
    document.querySelector(`#id${id} > img`).src = arg[0];
}

function url(pid, id, url) {
    document.querySelector(`#id${id}`).setAttribute("data-url", url);
}

function load(pid, id, loading) {
    if (loading) {
        document.querySelector(`#id${id} > img`).src = `./assets/icons/reload.svg`;
        document.querySelector("#reload").style.display = "none";
        document.querySelector("#stop").style.display = "block";
    } else {
        document.querySelector(`#id${id} > img`).classList.remove("loading");
        document.querySelector("#reload").style.display = "block";
        document.querySelector("#stop").style.display = "none";
    }
}

document.getElementById("buttons").onclick = (e) => {
    main_event(e);
};
function main_event(e) {
    var id = li_list[li_list.length - 1].id.replace("id", "");
    if (e.target.id == "browser") {
        open_in_browser();
    } else if (e.target.id == "add_history") {
        var history_store = new Store({ name: "history" });
        history_store.set(`历史记录.${new Date().getTime()}`, {
            text: document.querySelector(".tab_focus").getAttribute("data-url"),
        });
    } else {
        if (e.target.id) ipcRenderer.send("tab_view", pid, id, e.target.id);
    }
}

function open_in_browser() {
    var url = document.querySelector(".tab_focus").getAttribute("data-url");
    shell.openExternal(url);
    if (store.get("搜索窗口自动关闭")) {
        id = document.querySelector(".tab_focus").id.replace("id", "");
        close_tab(document.querySelector(".tab_focus"), pid, id);
    }
}

ipcRenderer.on("view_events", (event, arg) => {
    var e = { target: { id: arg } };
    main_event(e);
});

document.getElementById("tabs").onwheel = (e) => {
    e.preventDefault();
    var i = e.deltaX + e.deltaY + e.deltaZ >= 0 ? 1 : -1;
    document.getElementById("tabs").scrollLeft += i * Math.sqrt(e.deltaX ** 2 + e.deltaY ** 2 + e.deltaZ ** 2);
};

const { ipcRenderer } = require("electron");
ipcRenderer.on("img", (event, url) => {
    document.getElementById("ding_photo").src = url;
});
ipcRenderer.on("window_name", (event, name) => {
    window_name = name;
});
ipcRenderer.on("window_size", (event, size) => {
    window_size = size;
});
ipcRenderer.on("window_position", (event, position) => {
    window_position = position;
});
窗口透明度 = document.getElementById("透明度");
窗口透明度.oninput = () => {
    document.getElementById("ding_photo").style.opacity = `${窗口透明度.value / 100}`;
};
document.querySelector("#size").oninput = () => {
    document.querySelector("#size_p").innerHTML = `${document.querySelector("#size").value}%`;
    var zoom = (document.querySelector("#size").value - 0) / 100;
    resize(zoom, 0, 0);
};
function resize(zoom, dx, dy) {
    if (zoom < 0.25) zoom = 0.25;
    if (zoom > 3) zoom = 3;
    ipcRenderer.send("ding_resize", window_name, dx, dy, window_size[0], window_size[1], zoom);
}
window.onresize = () => {
    document.querySelector("#size_main_p").style.display = "block";
    document.querySelector("#size_main_p").style.opacity = "1";
    document.querySelector("#size").value = (window.innerWidth / window_size[0]) * 100;
    document.querySelector("#size_p").innerHTML = document.querySelector("#size_main_p").innerHTML = `${(
        (window.innerWidth / window_size[0]) *
        100
    ).toFixed(0)}%`;
    show_size_timer = setTimeout(() => {
        document.querySelector("#size_main_p").style.opacity = "0";
    }, 500);
    clearTimeout(show_size_timer - 1);
};
document.querySelector("#minimize").onclick = () => {
    ipcRenderer.send("ding_minimize", window_name);
};
document.querySelector("#back").onclick = () => {
    ipcRenderer.send("ding_back", window_name, window_position, window_size);
};

document.querySelector("#close").onclick = () => {
    ipcRenderer.send("ding_close", window_name);
};

document.querySelector("#ding_photo").onmousedown = (e) => {
    if (e.button == 2) {
        document.querySelector("#ding_photo").style.cursor = "move";
        ipcRenderer.send("move", window_name, "down");
    }
};
document.querySelector("#ding_photo").onmouseup = () => {
    document.querySelector("#ding_photo").style.cursor = "default";
    ipcRenderer.send("move", window_name, "up");
};

document.querySelector("#ding_photo").onwheel = (e) => {
    resize(
        (document.querySelector("#size").value -
            0 -
            (e.deltaY / Math.abs(e.deltaY)) * document.querySelector("#size").step -
            0) /
            100,
        e.clientX,
        e.clientY
    );
};

document.onmouseenter = () => {
    document.querySelector("#tool_bar").style.transform = "translateY(0%)";
};
document.onmouseleave = () => {
    document.querySelector("#tool_bar").style.transform = "";
};

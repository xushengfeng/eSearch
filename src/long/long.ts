const { ipcRenderer } = require("electron");

var ratio = window.devicePixelRatio;

ipcRenderer.on("rect", async (event, t, arg) => {
    switch (t) {
        case "init":
            document.getElementById("rect").style.left = arg[0] / ratio + "px";
            document.getElementById("rect").style.top = arg[1] / ratio + "px";
            document.getElementById("rect").style.width = arg[2] / ratio + "px";
            document.getElementById("rect").style.height = arg[3] / ratio + "px";
            break;
    }
});

document.getElementById("finish").onclick = () => {
    document.getElementById("rect").style.opacity = 0;
    ipcRenderer.send("clip_main_b", "long_e");
};

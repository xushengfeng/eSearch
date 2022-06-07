const { ipcRenderer } = require("electron");
ipcRenderer.on("record", async (event, t, arg) => {
    console.log(t, arg);
    switch (t) {
        case "init":
            document.getElementById("rect").style.left = arg[0] + "px";
            document.getElementById("rect").style.top = arg[1] + "px";
            document.getElementById("rect").style.width = arg[2] + "px";
            document.getElementById("rect").style.height = arg[3] + "px";
            break;
    }
});

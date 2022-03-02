const { exec } = require("child_process");
const { ipcRenderer } = require("electron");
function open(path) {
    switch (process.platform) {
        case "win32":
            exec(`rundll32.exe C:\\Windows\\system32\\shell32.dll,OpenAs_RunDLL ${path}`, (e) => {
                if (!e) return true;
            });
            break;
        case "linux":
            // 判断桌面环境
            exec("echo $XDG_SESSION_DESKTOP", (e, disk) => {
                if (disk == "KDE\n") {
                    exec(`cd ${__dirname}/ && ./kde-open-with ${path}`);
                } else {
                    exec(`cd ${__dirname}/ && ./gtk-open-with ${path}`);
                }
            });
            break;
        case "darwin":
            ipcRenderer.send("clip_main_b", "mac_app");
            ipcRenderer.on("mac_app_path", (ev, c, paths) => {
                if (!c) {
                    var co = `open -a ${paths[0].replace(/ /g, "\\ ")} ${path}`;
                    exec(co);
                    return true;
                }
            });
            break;
    }
}
module.exports = open;

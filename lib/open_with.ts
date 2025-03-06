import { renderSendSync } from "./ipc";
const { exec } = require("node:child_process");
const { ipcRenderer } = require("electron");
function open(path: string) {
    switch (process.platform) {
        case "win32":
            exec(
                `rundll32.exe C:\\Windows\\system32\\shell32.dll,OpenAs_RunDLL ${path}`,
            );
            break;
        case "linux": {
            const run_path = ipcRenderer.sendSync("run_path");
            // 判断桌面环境
            exec("echo $XDG_SESSION_DESKTOP", (e, desktop) => {
                if (desktop === "KDE\n") {
                    exec(`cd ${run_path}lib && ./kde-open-with ${path}`);
                } else {
                    exec(`cd ${run_path}lib && ./gtk-open-with ${path}`);
                }
            });
            break;
        }
        case "darwin": {
            const { canceled: c, filePaths: paths } = renderSendSync(
                "clip_mac_app",
                [],
            );
            if (!c) {
                const co = `open -a ${paths[0].replace(/ /g, "\\ ")} ${path}`;
                exec(co);
            }

            break;
        }
    }
}
export default open;

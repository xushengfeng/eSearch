// Modules to control application life and create native browser window
const {
    app,
    Tray,
    Menu,
    clipboard,
    globalShortcut,
    BrowserWindow,
    ipcMain,
    dialog,
    Notification,
    net,
    BrowserView,
} = require("electron");
const os = require("os");
var robot = require("robotjs");
const Store = require("electron-store");

var screen = require("electron").screen;
const path = require("path");
if (app.getAppPath().slice(-8) == "app.asar") {
    run_path = path.resolve(__dirname, "..");
} else {
    run_path = path.resolve(__dirname, "");
}

app.whenReady().then(() => {
    tray = new Tray(`${run_path}/assets/icons/64x64.png`);
    const contextMenu = Menu.buildFromTemplate([
        {
            label: "自动搜索",
            click: () => {
                auto_open();
            },
        },
        {
            label: "截图搜索",
            click: () => {
                setTimeout(() => {
                    clip_window.webContents.send("reflash");
                    clip_window.show();
                    clip_window.setFullScreen(true);
                }, 500);
            },
        },
        {
            label: "选中搜索",
            click: () => {
                open_selection();
            },
        },
        {
            label: "剪贴板搜索",
            click: () => {
                open_clip_board();
            },
        },
        {
            type: "separator",
        },
        {
            label: "主页面",
            click: () => {
                create_main_window("", "text");
            },
        },
        {
            label: "设置",
            click: () => {
                Store.initRenderer();
                create_setting_window();
            },
        },
        {
            type: "separator",
        },
        {
            label: "退出",
            click: () => {
                app.quit();
            },
        },
    ]);
    tray.setContextMenu(contextMenu);

    Store.initRenderer();

    ipcMain.on("快捷键", (event, arg) => {
        eval(`${arg[0]} = globalShortcut.register("${arg[1]}", () => {
            ${arg[2]};
        });`);

        event.sender.send("状态", eval(arg[0]));
    });

    function auto_open() {
        var o_clipboard = clipboard.readText();
        robot.keyTap("c", "control");
        var t = clipboard.readText();
        if (o_clipboard != t) {
            open_clip_board();
        } else {
            clip_window.webContents.send("reflash");
            clip_window.show();
            clip_window.setFullScreen(true);
        }
        clipboard.writeText(o_clipboard);
    }

    // Create the browser window.
    const clip_window = new BrowserWindow({
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        x: 0,
        y: 0,
        width: screen.getPrimaryDisplay().workAreaSize.width * screen.getPrimaryDisplay().scaleFactor,
        height: screen.getPrimaryDisplay().workAreaSize.width * screen.getPrimaryDisplay().scaleFactor,
        show: false,
        // fullscreen: true,
        fullscreenable: true,
        transparent: true,
        frame: false,
        skipTaskbar: true,
        // autoHideMenuBar: true,
        movable: false,
        resizable: false,
        alwaysOnTop: true,
        enableLargerThanScreen: true, // mac
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    // and load the index.html of the app.
    clip_window.loadFile("capture.html");

    // Open the DevTools.
    // clip_window.webContents.openDevTools();

    // 监听截图奇奇怪怪的事件
    ipcMain.on("window-close", () => {
        clip_window.setFullScreen(false);
        clip_window.hide();
    });

    ipcMain.on("ocr", (event, arg) => {
        const request = net.request({
            method: "POST",
            url: "http://127.0.0.1:8080",
            headers: { "Content-type": "application/text" },
        });
        request.on("response", (response) => {
            if (response.statusCode == "200") {
                response.on("data", (chunk) => {
                    create_main_window(chunk.toString(), "ocr");
                });
                response.on("end", () => {
                    event.sender.send("ocr_back", "ok");
                });
            } else if (response.statusCode == "404") {
                event.sender.send("ocr_back", "else");
                dialog.showMessageBox({
                    title: "警告",
                    message: "识别失败\n找不到服务器",
                    icon: `${run_path}/assets/icons/warning.png`,
                });
            } else {
                event.sender.send("ocr_back", "else");
                dialog.showMessageBox({
                    title: "警告",
                    message: "识别失败\n请尝试重新识别",
                    icon: `${run_path}/assets/icons/warning.png`,
                });
            }
        });
        request.write(arg);
        request.end();
    });

    ipcMain.on("QR", (event, arg) => {
        if (arg != "nothing") {
            create_main_window(arg, "QR");
        } else {
            dialog.showMessageBox({
                title: "警告",
                message: "无法识别二维码\n请尝试重新识别",
                icon: `${run_path}/assets/icons/warning.png`,
            });
        }
    });

    ipcMain.on("save", (event) => {
        save_time = new Date();
        save_name_time = `${save_time.getFullYear()}-${
            save_time.getMonth() + 1
        }-${save_time.getDate()}-${save_time.getHours()}-${save_time.getMinutes()}-${save_time.getSeconds()}-${save_time.getMilliseconds()}`;
        dialog
            .showSaveDialog({
                title: "选择要保存的位置",
                defaultPath: `Screenshot-${save_name_time}.png`,
                filters: [{ name: "Images", extensions: ["png"] }],
            })
            .then((x) => {
                event.sender.send("save_path", x.filePath);
                new Notification({
                    title: "eSearch保存图像成功",
                    body: `已保存图像到${x.filePath}`,
                    icon: `${run_path}/assets/icons/64x64.png`,
                }).show();
            });
    });

    ipcMain.on("ding", (event, arg) => {
        create_ding_window(arg[0], arg[1], arg[2], arg[3], arg[4]);
    });
});

app.on("will-quit", () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
});

function open_selection() {
    o_clipboard = clipboard.readText();
    robot.keyTap("c", "control");
    t = clipboard.readText();
    if (o_clipboard != t) {
        create_main_window(t, "text");
    }
    clipboard.writeText(o_clipboard);
}

function open_clip_board() {
    t = clipboard.readText();
    create_main_window(t, "text");
}

function create_ding_window(x, y, w, h, img) {
    const ding_window = new BrowserWindow({
        x: x,
        y: y,
        width: w,
        height: h,
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        autoHideMenuBar: true,
        enableLargerThanScreen: true, // mac
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    ding_window.setAspectRatio(w / h);
    ding_window.loadFile("ding.html");
    ding_window.webContents.openDevTools();
    ding_window.webContents.on("did-finish-load", () => {
        ding_window.webContents.send("img", img);
    });
    ipcMain.on("ding_close", () => {
        ding_window.close();
    });
    ipcMain.on("ding_resize", () => {});
}

function create_main_window(t, type) {
    const main_window = new BrowserWindow({
        // x: x,
        // y: y,
        // width: w,
        // height: h,
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    main_window.loadFile("index.html");
    main_window.webContents.openDevTools();
    main_window.webContents.on("did-finish-load", () => {
        main_window.webContents.send("text", [t, type]);
    });
}

function create_setting_window() {
    const main_window = new BrowserWindow({
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    main_window.loadFile("setting.html");
    main_window.webContents.openDevTools();
}

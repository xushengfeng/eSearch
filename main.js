// Modules to control application life and create native browser window
const {
    app,
    Tray,
    Menu,
    clipboard,
    globalShortcut,
    desktopCapturer,
    BrowserWindow,
    ipcMain,
    dialog,
    Notification,
    net,
    shell,
} = require("electron");
var robot = require("robotjs");
const Store = require("electron-store");
var screen = require("electron").screen;
const path = require("path");
run_path = path.resolve(__dirname, "");
const { exec } = require("child_process");

// 自动开启开发者模式
if (app.isPackaged || process.argv.includes("-n")) {
    dev = false;
} else {
    dev = true;
}

ipcMain.on("autostart", (event, v) => {
    if (process.platform == "linux") {
        if (v) {
            exec("mkdir ~/.config/autostart");
            exec(`cp ${run_path}/assets/esearch.desktop ~/.config/autostart/`);
        } else {
            exec("rm ~/.config/autostart/esearch.desktop");
        }
    } else {
        app.setLoginItemSettings(v);
    }
});

// 自动判断选中搜索还是截图搜索
function auto_open() {
    var o_clipboard = clipboard.readText();
    robot.keyTap("c", "control");
    var t = clipboard.readText();
    if (o_clipboard != t) {
        open_clip_board();
    } else {
        full_screen();
    }
    clipboard.writeText(o_clipboard);
}

function open_selection() {
    var o_clipboard = clipboard.readText();
    robot.keyTap("c", "control");
    var t = clipboard.readText();
    if (o_clipboard != t) {
        create_main_window([t]);
    }
    clipboard.writeText(o_clipboard);
}

function open_clip_board() {
    var t = clipboard.readText();
    create_main_window([t]);
}

// cil参数重复启动;
first_open = true;
const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
    first_open = false;
    app.quit();
} else {
    app.on("second-instance", (event, commanLine, workingDirectory) => {
        arg_run(commanLine);
    });
}
function arg_run(c) {
    if (c.includes("-n")) dev = false;
    switch (true) {
        case c.includes("-a"):
            auto_open();
            break;
        case c.includes("-c"):
            full_screen();
            break;
        case c.includes("-s"):
            open_selection();
            break;
        case c.includes("-b"):
            open_clip_board();
            break;
    }
}

app.whenReady().then(() => {
    // 托盘
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
                    full_screen();
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
                create_main_window([""]);
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
            label: "教程帮助",
            click: () => {
                create_help_window();
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

    // 启动时提示
    if (first_open)
        new Notification({
            title: "eSearch",
            body: `eSearch已经在后台启动`,
            icon: `${run_path}/assets/icons/64x64.png`,
        }).show();

    // 初始化设置
    Store.initRenderer();
    store = new Store();

    // 快捷键
    ipcMain.on("快捷键", (event, arg) => {
        eval(`${arg[0]} = globalShortcut.register("${arg[1]}", () => {
            ${arg[2]};
        });`);

        event.sender.send("状态", eval(arg[0]));
    });

    globalShortcut.register(store.get("key_自动识别") || "CommandOrControl+Shift+Z", () => {
        auto_open();
    });
    if (store.get("key_截图搜索") != undefined)
        globalShortcut.register(store.get("key_截图搜索"), () => {
            full_screen();
        });
    if (store.get("key_选中搜索") != undefined)
        globalShortcut.register(store.get("key_选中搜索"), () => {
            open_selection();
        });
    if (store.get("key_剪贴板搜索") != undefined)
        globalShortcut.register(store.get("key_剪贴板搜索"), () => {
            open_clip_board();
        });
    create_clip_window();
});

app.on("will-quit", () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
});

// 截图窗口
clip_window = null;
function create_clip_window() {
    clip_window = new BrowserWindow({
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        show: false,
        alwaysOnTop: true,
        fullscreenable: true,
        transparent: true,
        frame: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        movable: false,
        enableLargerThanScreen: true, // mac
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    clip_window.loadFile("capture.html");

    if (dev) clip_window.webContents.openDevTools();

    // 监听截图奇奇怪怪的事件
    ipcMain.on("window-close", () => {
        clip_window.setFullScreen(false);
        clip_window.hide();
    });

    ipcMain.handle("DESKTOP_CAPTURER_GET_SOURCES", (event, opts) => desktopCapturer.getSources(opts));

    ipcMain.on("ocr", (event, arg) => {
        other_ocr_path = store.get("OCR路径") || "";
        if (other_ocr_path == "") {
            ocr(event, arg);
        } else {
            other_ocr = require(other_ocr_path);
            other_ocr(event, arg, create_main_window);
        }
    });

    ipcMain.on("QR", (event, arg) => {
        if (arg != "nothing") {
            create_main_window([arg]);
        } else {
            dialog.showMessageBox({
                title: "警告",
                message: "无法识别二维码\n请尝试重新识别",
                icon: `${run_path}/assets/icons/warning.png`,
            });
        }
    });

    ipcMain.on("open", (event) => {
        dialog
            .showOpenDialog({
                title: "选择要打开应用的位置",
            })
            .then((x) => {
                console.log(x);
                event.sender.send("open_path", x.filePaths[0]);
            });
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
                if (x.filePath) {
                    notification = new Notification({
                        title: "eSearch保存图像成功",
                        body: `已保存图像到${x.filePath}`,
                        icon: `${run_path}/assets/icons/64x64.png`,
                    });
                    notification.on("click", () => {
                        shell.showItemInFolder(x.filePath);
                    });
                    notification.show();
                } else {
                    new Notification({
                        title: "eSearch保存图像失败",
                        body: `用户已取消保存`,
                        icon: `${run_path}/assets/icons/64x64.png`,
                    }).show();
                }
            });
    });

    ipcMain.on("ding", (event, arg) => {
        create_ding_window(arg[0], arg[1], arg[2], arg[3], arg[4]);
    });

    // 移动光标
    ipcMain.on("move_mouse", (event, arrow, d) => {
        var mouse = robot.getMousePos();
        switch (arrow) {
            case "up":
                robot.moveMouse(mouse.x, mouse.y - 1 * d);
                break;
            case "right":
                robot.moveMouse(mouse.x + 1 * d, mouse.y);
                break;
            case "down":
                robot.moveMouse(mouse.x, mouse.y + 1 * d);
                break;
            case "left":
                robot.moveMouse(mouse.x - 1 * d, mouse.y);
                break;
        }
    });

    var x = robot.screen.capture();
    clip_window.webContents.send("reflash", x.image, x.width, x.height);

    // cil参数启动;
    if (first_open) arg_run(process.argv);
}
function full_screen() {
    if (clip_window == null) {
        create_clip_window();
    }
    var x = robot.screen.capture();
    clip_window.webContents.send("reflash", x.image, x.width, x.height);
    clip_window.show();
    clip_window.setFullScreen(true);
}
function ocr(event, arg) {
    const request = net.request({
        method: "POST",
        url: store.get("ocr_url") || "http://127.0.0.1:8080",
        headers: { "Content-type": "application/x-www-form-urlencoded" },
    });
    request.on("response", (response) => {
        if (response.statusCode == "200") {
            response.on("data", (chunk) => {
                var t = chunk.toString();
                var t = JSON.parse(t);
                var r = "";
                var text = t["words_result"];
                for (i in text) {
                    r += text[i]["words"] + "\n";
                }
                create_main_window([r, text["language"]]);
            });
            response.on("end", () => {
                event.sender.send("ocr_back", "ok");
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
    request.on("error", () => {
        event.sender.send("ocr_back", "else");
        dialog.showMessageBox({
            title: "警告",
            message: "识别失败\n找不到服务器",
            icon: `${run_path}/assets/icons/warning.png`,
        });
    });
    access_token = store.get("ocr_access_token") || "";
    data = JSON.stringify({
        access_token: access_token,
        image: arg,
        detect_direction: true,
        paragraph: true,
    });
    request.write(data);
    request.end();
}

// 菜单栏设置(截图没必要)
const isMac = process.platform === "darwin";
const template = [
    // { role: 'appMenu' }
    ...(isMac
        ? [
              {
                  label: app.name,
                  submenu: [
                      { role: "about" },
                      { type: "separator" },
                      { role: "services" },
                      { type: "separator" },
                      { role: "hide" },
                      { role: "hideOthers" },
                      { role: "unhide" },
                      { type: "separator" },
                      { role: "quit" },
                  ],
              },
          ]
        : []),
    // { role: 'fileMenu' }
    {
        label: "文件",
        submenu: [isMac ? { label: "退出", role: "close" } : { label: "退出", role: "quit" }],
    },
    // { role: 'editMenu' }
    {
        label: "编辑",
        submenu: [
            { label: "撤销", role: "undo" },
            { label: "重做", role: "redo" },
            { type: "separator" },
            { label: "剪切", role: "cut" },
            { label: "复制", role: "copy" },
            { label: "粘贴", role: "paste" },
            ...(isMac
                ? [
                      { label: "", role: "pasteAndMatchStyle" },
                      { label: "删除", role: "delete" },
                      { label: "全选", role: "selectAll" },
                      { type: "separator" },
                      {
                          label: "Speech",
                          submenu: [
                              { label: "开始朗读", role: "startSpeaking" },
                              { label: "停止朗读", role: "stopSpeaking" },
                          ],
                      },
                  ]
                : [{ label: "删除", role: "delete" }, { type: "separator" }, { label: "全选", role: "selectAll" }]),
        ],
    },
    // { role: 'viewMenu' }
    {
        label: "视图",
        submenu: [
            { label: "重新加载", role: "reload" },
            { label: "强制重载", role: "forceReload" },
            { label: "开发者工具", role: "toggleDevTools" },
            { type: "separator" },
            { label: "实际大小", role: "resetZoom" },
            { label: "放大", role: "zoomIn" },
            { label: "缩小", role: "zoomOut" },
            { type: "separator" },
            { label: "全屏", role: "togglefullscreen" },
        ],
    },
    // { role: 'windowMenu' }
    {
        label: "窗口",
        submenu: [
            { label: "最小化", role: "minimize" },
            ...(isMac
                ? [
                      { type: "separator" },
                      { label: "置于最前面", role: "front" },
                      { type: "separator" },
                      { label: "窗口", role: "window" },
                  ]
                : []),
        ],
    },
    {
        label: "帮助",
        role: "help",
        submenu: [
            {
                label: "教程帮助",
                click: () => {
                    create_help_window();
                },
            },
            { type: "separator" },
            {
                label: "关于",
                click: () => {
                    create_setting_window(true);
                },
            },
        ],
    },
];
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// ding窗口
ding_windows_l = { dock: [0, 0, 10, 50] };
function create_ding_window(x, y, w, h, img) {
    if (Object.keys(ding_windows_l).length == 1) {
        ding_window = new BrowserWindow({
            icon: path.join(run_path, "assets/icons/1024x1024.png"),
            fullscreen: true,
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

        ding_window.loadFile("ding.html");
        if (dev) ding_window.webContents.openDevTools();
        ding_window.webContents.on("did-finish-load", () => {
            var id = new Date().getTime();
            ding_window.webContents.send("img", id, x, y, w, h, img);
            ding_windows_l[id] = [x, y, w, h];
        });

        ding_window.setAlwaysOnTop(true, "screen-saver");
    } else {
        var id = new Date().getTime();
        ding_window.webContents.send("img", id, x, y, w, h, img);
        ding_windows_l[id] = [x, y, w, h];
    }
    can_c_ignore = true;
    ipcMain.on("ding_ignore", (event, v) => {
        if (v) {
            can_c_ignore = false;
            ding_window.setIgnoreMouseEvents(false);
        } else {
            can_c_ignore = true;
        }
    });
    ipcMain.on("ding_p_s", (event, wid, p_s) => {
        ding_windows_l[wid] = p_s;
    });
    // 关闭窗口
    ipcMain.on("ding_close", (event, wid) => {
        delete ding_windows_l[wid];
        if (Object.keys(ding_windows_l).length == 1) {
            ding_window.close();
        }
    });
    // 自动改变鼠标穿透
    function ding_click_through() {
        var n_xy = screen.getCursorScreenPoint();
        var in_window = 0;
        for (i in Object.values(ding_windows_l)) {
            ii = Object.values(ding_windows_l)[i];
            // 如果光标在某个窗口上，不穿透
            var x2 = ii[0] + ii[2],
                y2 = ii[1] + ii[3];
            if (ii[0] <= n_xy.x && n_xy.x <= x2 && ii[1] <= n_xy.y && n_xy.y <= y2) {
                in_window += 1;
            }
        }
        // 窗口可能destroyed
        try {
            if (can_c_ignore)
                if (in_window > 0) {
                    ding_window.setIgnoreMouseEvents(false);
                } else {
                    ding_window.setIgnoreMouseEvents(true);
                }
        } catch {}
        setTimeout(ding_click_through, 10);
    }
    ding_click_through();
}

// 主窗口
function create_main_window(t, web_page) {
    const main_window = new BrowserWindow({
        x: screen.getCursorScreenPoint().x - 800,
        y: screen.getCursorScreenPoint().y - 600,
        width: 800,
        height: 600,
        minWidth: 800,
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    // 自定义界面
    if (web_page == undefined) {
        main_window.loadFile("index.html");
    } else {
        main_window.loadFile(web_page);
    }

    if (dev) main_window.webContents.openDevTools();
    main_window.webContents.on("did-finish-load", () => {
        main_window.webContents.send("text", [t[0], t[1] || "auto"]);
    });

    ipcMain.on("edit", (event, v) => {
        switch (v) {
            case "selectAll":
                main_window.webContents.selectAll();
                break;
            case "cut":
                main_window.webContents.cut();
                break;
            case "copy":
                main_window.webContents.copy();
                break;
            case "paste":
                main_window.webContents.paste();
                break;
        }
    });

    ipcMain.on("open_url", (event, url) => {
        const search_window = new BrowserWindow({
            webPreferences: {
                sandbox: true,
            },
        });
        search_window.loadURL(url);
    });
}

// 设置窗口
function create_setting_window(about) {
    const main_window = new BrowserWindow({
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    main_window.loadFile("setting.html");
    if (dev) main_window.webContents.openDevTools();
    main_window.webContents.on("did-finish-load", () => {
        main_window.webContents.send("about", about);
    });
}

// 帮助窗口
function create_help_window() {
    const main_window = new BrowserWindow({
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    main_window.loadFile("help.html");
    if (dev) main_window.webContents.openDevTools();
}

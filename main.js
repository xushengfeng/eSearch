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

// 自动开启开发者模式
if (app.isPackaged) {
    dev = false;
} else {
    dev = true;
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

    // 自动判断选中搜索还是截图搜索
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

    function open_selection() {
        o_clipboard = clipboard.readText();
        robot.keyTap("c", "control");
        t = clipboard.readText();
        if (o_clipboard != t) {
            create_main_window([t]);
        }
        clipboard.writeText(o_clipboard);
    }

    function open_clip_board() {
        t = clipboard.readText();
        create_main_window([t]);
    }

    // 启动时提示
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
            clip_window.webContents.send("reflash");
            clip_window.show();
            clip_window.setFullScreen(true);
        });
    if (store.get("key_选中搜索") != undefined)
        globalShortcut.register(store.get("key_选中搜索"), () => {
            open_selection();
        });
    if (store.get("key_剪贴板搜索") != undefined)
        globalShortcut.register(store.get("key_剪贴板搜索"), () => {
            open_clip_board();
        });

    // 截图窗口
    const clip_window = new BrowserWindow({
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        x: 0,
        y: 0,
        width: screen.getPrimaryDisplay().workAreaSize.width * screen.getPrimaryDisplay().scaleFactor,
        height: screen.getPrimaryDisplay().workAreaSize.width * screen.getPrimaryDisplay().scaleFactor,
        show: false,
        alwaysOnTop: true,
        fullscreenable: true,
        transparent: true,
        frame: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        movable: false,
        resizable: false,
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
        ocr(event, arg);
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
});

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

app.on("will-quit", () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
});

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
        ],
    },
];
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// ding窗口
const windows = {};
function create_ding_window(x, y, w, h, img) {
    ding_name = `ding_window${new Date().getTime()}`;
    windows[ding_name] = new BrowserWindow({
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

    windows[ding_name].setAspectRatio(w / h);
    windows[ding_name].loadFile("ding.html");
    if (dev) windows[ding_name].webContents.openDevTools();
    windows[ding_name].webContents.on("did-finish-load", () => {
        // 传递窗口初始状态
        windows[ding_name].webContents.send("img", img);
        windows[ding_name].webContents.send("window_name", ding_name);
        windows[ding_name].webContents.send("window_size", [w, h]);
        windows[ding_name].webContents.send("window_position", [x, y]);
    });
    // 关闭窗口
    ipcMain.on("ding_close", (enent, arg) => {
        windows[arg].close();
    });
    // 最小化
    ipcMain.on("ding_minimize", (enent, arg) => {
        windows[arg].minimize();
    });
    // 调整大小
    ipcMain.on("ding_resize", (enent, name, dx, dy, w, h, zoom) => {
        var nw = windows[name].getBounds().width;
        var nh = windows[name].getBounds().height;
        // 以鼠标为中心缩放
        var x = windows[name].getBounds().x + dx - w * zoom * (dx / nw);
        var y = windows[name].getBounds().y + dy - h * zoom * (dy / nh);
        windows[name].setBounds({
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(w * zoom),
            height: Math.round(h * zoom),
        });
    });
    // 归位
    ipcMain.on("ding_back", (enent, name, p, s) => {
        windows[name].setBounds({ x: p[0], y: p[1], width: s[0], height: s[1] });
    });
    // 右键移动窗口
    ipcMain.on("move", (enent, name, v) => {
        if (v == "down") {
            var ding_xy = windows[name].getBounds();
            var m_xy = screen.getCursorScreenPoint();
            moving = true;
        } else {
            // up
            moving = false;
        }
        function move_ding() {
            if (moving) {
                var n_m_xy = screen.getCursorScreenPoint();
                windows[name].setBounds({ x: ding_xy.x + n_m_xy.x - m_xy.x, y: ding_xy.y + n_m_xy.y - m_xy.y });
                setTimeout(move_ding, 10);
            }
        }
        move_ding();
    });
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

    ipcMain.on("edit", (enent, v) => {
        switch (v) {
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
}

// 设置窗口
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
    if (dev) main_window.webContents.openDevTools();
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

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
    shell,
    nativeImage,
    nativeTheme,
} = require("electron");
const { Buffer } = require("buffer");
var robot = require("robotjs");
const Store = require("electron-store");
var screen = require("electron").screen;
const path = require("path");
run_path = path.resolve(__dirname, "");
const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");

// 自动开启开发者模式
if (app.isPackaged || process.argv.includes("-n")) {
    dev = false;
} else {
    dev = true;
}

ipcMain.on("autostart", (event, m, v) => {
    if (m == "set") {
        if (process.platform == "linux") {
            if (v) {
                exec("mkdir ~/.config/autostart");
                exec(`cp ${run_path}/assets/e-search.desktop ~/.config/autostart/`);
            } else {
                exec("rm ~/.config/autostart/e-search.desktop");
            }
        } else {
            app.setLoginItemSettings(v);
        }
    } else {
        if (process.platform == "linux") {
            exec("test -e ~/.config/autostart/e-search.desktop", (error, stdout, stderr) => {
                error ? event.sender.send("开机启动状态", false) : event.sender.send("开机启动状态", true);
            });
        } else {
            event.sender.send("开机启动状态", app.getLoginItemSettings().openAtLogin);
        }
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
        case c.includes("-g"):
            create_main_window([""]);
            break;
        case c.includes("-q"):
            quick_clip();
            break;
    }
}

var port = 8080;

app.whenReady().then(() => {
    // 托盘
    tray =
        process.platform == "linux"
            ? new Tray(`${run_path}/assets/icons/32x32.png`)
            : new Tray(`${run_path}/assets/icons/16x16.png`);
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
            title: app.name,
            body: `${app.name} 已经在后台启动`,
            icon: `${run_path}/assets/icons/64x64.png`,
        }).show();

    // 初始化设置
    Store.initRenderer();
    store = new Store();
    if (store.get("首次运行") === undefined) set_default_setting();
    fix_setting_tree();

    // 检查并开启服务
    function start_service() {
        const request = net.request({
            method: "POST",
            url: `http://127.0.0.1:${port}`,
        });
        var dir = store.path.replace("config.json", "service-installed");
        request.on("response", () => {
            if (!fs.existsSync(dir)) fs.mkdir(dir, () => {});
        });
        request.on("error", () => {
            if (store.get("检查OCR")) check_service_no();
        });
        request.write("");
        request.end();
    }
    start_service();

    // 快捷键
    var 快捷键函数 = {
        自动识别: { f: "auto_open()" },
        截图搜索: { f: "full_screen()" },
        选中搜索: { f: "open_selection()" },
        剪贴板搜索: { f: "open_clip_board()" },
        快速截图: { f: "quick_clip()" },
        主页面: { f: "create_main_window([''])" },
    };
    ipcMain.on("快捷键", (event, arg) => {
        try {
            eval(`${arg[0]} = globalShortcut.register("${arg[1]}", () => {
            ${快捷键函数[arg[0]].f};
        });`);
            event.sender.send("状态", eval(arg[0]));
        } catch (error) {
            event.sender.send("状态", false);
        }
    });

    var 快捷键 = store.get("快捷键");
    for (k in 快捷键) {
        var m = 快捷键[k];
        try {
            if (m.key)
                eval(`globalShortcut.register("${m.key}", () => {
            ${快捷键函数[k].f};
        });`);
        } catch (error) {
            delete 快捷键[k].key;
            store.set(`快捷键`, 快捷键);
        }
    }

    // tmp目录
    if (!fs.existsSync(os.tmpdir() + "/eSearch")) fs.mkdir(os.tmpdir() + "/eSearch", () => {});
    create_clip_window();

    nativeTheme.themeSource = store.get("深色模式");
});

app.on("will-quit", () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
    if (process.platform == "win32") {
        exec(`rmdir ${os.tmpdir() + "\\eSearch"}`);
    } else {
        exec(`rm -r ${os.tmpdir() + "/eSearch"}`);
    }
});

var the_icon = null;
if (process.platform == "win32") {
    the_icon = path.join(run_path, "assets/icons/icon.ico");
} else {
    the_icon = path.join(run_path, "assets/icons/1024x1024.png");
}

// 截图窗口
var clip_window = null;
function create_clip_window() {
    clip_window = new BrowserWindow({
        icon: the_icon,
        width: screen.getPrimaryDisplay().workAreaSize.width,
        height: screen.getPrimaryDisplay().workAreaSize.height,
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
    clip_window.webContents.on("did-finish-load", () => {
        clip_window.webContents.setZoomFactor(store.get("全局缩放") || 1.0);
    });

    if (dev) clip_window.webContents.openDevTools();

    // 监听截图奇奇怪怪的事件
    ipcMain.on("clip_main_b", (event, type, arg) => {
        switch (type) {
            case "window-close":
                n_full_screen();
                break;
            case "ocr":
                ocr(event, arg);
                break;
            case "QR":
                if (arg != "nothing") {
                    create_main_window([arg]);
                } else {
                    dialog.showMessageBox({
                        title: "警告",
                        message: "无法识别二维码\n请尝试重新识别",
                        icon: `${run_path}/assets/icons/warning.png`,
                    });
                }
                break;
            case "open":
                dialog
                    .showOpenDialog({
                        title: "选择要打开应用的位置",
                    })
                    .then((x) => {
                        console.log(x);
                        event.sender.send("open_path", x.filePaths[0]);
                    });
                break;
            case "save":
                var saved_path = store.get("保存路径") || "";
                n_full_screen();
                dialog
                    .showSaveDialog({
                        title: "选择要保存的位置",
                        defaultPath: `${saved_path}${get_file_name()}.${arg}`,
                        filters: [{ name: "图像", extensions: [arg] }],
                    })
                    .then((x) => {
                        event.sender.send("save_path", x.filePath);
                        if (x.filePath) {
                        } else {
                            new Notification({
                                title: `${app.name} 保存图像失败`,
                                body: `用户已取消保存`,
                                icon: `${run_path}/assets/icons/64x64.png`,
                            }).show();
                            clip_window.show();
                            clip_window.setSimpleFullScreen(true);
                        }
                    });
                break;
            case "ding":
                create_ding_window(arg[0], arg[1], arg[2], arg[3], arg[4]);
                break;
            case "mac_app":
                n_full_screen();
                dialog
                    .showOpenDialog({
                        defaultPath: "/Applications",
                    })
                    .then((x) => {
                        if (x.canceled) {
                            clip_window.show();
                            clip_window.setSimpleFullScreen(true);
                        }
                        event.sender.send("mac_app_path", x.canceled, x.filePaths);
                    });
                break;
            case "ok_save":
                noti(arg);
                save_path = arg.split("/");
                save_path.pop();
                store.set("保存路径", save_path.join("/") + "/");
                break;
        }
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
    clip_window.setSimpleFullScreen(true);
    x = null;
    port = store.get("端口");
}

function n_full_screen() {
    clip_window.setSimpleFullScreen(false);
    clip_window.hide();
}

function check_service_no() {
    var dir = store.path.replace("config.json", "service-installed");
    if (!fs.existsSync(dir)) {
        dialog
            .showMessageBox({
                title: "服务未安装",
                message: `${app.name} 服务未安装\n需要下载并安装服务才能使用OCR`,
                icon: `${run_path}/assets/icons/warning.png`,
                checkboxLabel: "不再提示",
                buttons: ["下载", "取消"],
                defaultId: 0,
                cancelId: 1,
            })
            .then((resolve) => {
                if (resolve.checkboxChecked) store.set("检查OCR", false);
                if (resolve.response == 0) shell.openExternal("https://github.com/xushengfeng/eSearch-service");
            });
    } else {
        console.log(`存在目录${dir}`);
        if (store.get("自动运行命令")) {
            console.log("启动");
            exec(store.get("自动运行命令"), (e) => {
                console.log(e);
            });
        } else {
            dialog.showMessageBox({
                title: "服务未启动",
                message: `检测到服务未启动\n请手动启动 ${app.name} 服务`,
                buttons: ["确定"],
                icon: `${run_path}/assets/icons/warning.png`,
            });
        }
    }
}
function ocr(event, arg) {
    const check_r = net.request({
        method: "POST",
        url: `http://127.0.0.1:${port}`,
    });
    check_r.on("response", () => {
        const request = net.request({
            method: "POST",
            url: `http://127.0.0.1:${port}`,
            headers: { "Content-type": "application/x-www-form-urlencoded" },
        });
        request.on("response", (response) => {
            try {
                response.on("data", (chunk) => {
                    var t = chunk.toString();
                    var t = JSON.parse(t);
                    var r = "";
                    var text = t["words_result"];
                    for (i in text) {
                        r += text[i]["words"] + "\n";
                    }
                    create_main_window([r]);
                    response.on("end", () => {
                        event.sender.send("ocr_back", "ok");
                    });
                });
            } catch (error) {
                event.sender.send("ocr_back", "else");
                dialog.showMessageBox({
                    title: "警告",
                    message: "识别失败\n请尝试重新识别",
                    icon: `${run_path}/assets/icons/warning.png`,
                });
            }
        });
        data = JSON.stringify({
            image: arg,
        });
        request.write(data);
        request.end();
    });

    check_r.on("error", () => {
        event.sender.send("ocr_back", "else");
        check_service_no();
    });

    check_r.write("");
    check_r.end();
}

ipcMain.on("setting", (event, arg) => {
    switch (arg) {
        case "reload_main":
            if (clip_window && !clip_window.isVisible()) clip_window.reload();
            break;
    }
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
                      { label: `关于 ${app.name}`, role: "about" },
                      { type: "separator" },
                      { label: "设置", click: create_setting_window, accelerator: "CmdOrCtrl+," },
                      { type: "separator" },
                      { label: "服务", role: "services" },
                      { type: "separator" },
                      { label: `隐藏 ${app.name}`, role: "hide" },
                      { label: "隐藏其他 ", role: "hideOthers" },
                      { label: "全部显示", role: "unhide" },
                      { type: "separator" },
                      { label: `退出 ${app.name}`, role: "quit" },
                  ],
              },
          ]
        : []),
    // { role: 'fileMenu' }
    {
        label: "文件",
        submenu: [
            {
                label: "保存到历史记录",
                click: () => {
                    main_edit("save");
                },
                accelerator: "CmdOrCtrl+S",
            },
            { type: "separator" },
            ...(isMac
                ? []
                : [{ label: "设置", click: create_setting_window, accelerator: "CmdOrCtrl+," }, { type: "separator" }]),
            {
                label: "其他编辑器打开",
                click: () => {
                    main_edit("edit_on_other");
                },
            },
            {
                label: "打开方式...",
                click: () => {
                    main_edit("choose_editer");
                },
            },
            { type: "separator" },
            { label: "关闭", role: "close" },
        ],
    },
    // { role: 'editMenu' }
    {
        label: "编辑",
        submenu: [
            {
                label: "撤销",
                click: () => {
                    main_edit("undo");
                },
                accelerator: "CmdOrCtrl+Z",
            },
            {
                label: "重做",
                click: () => {
                    main_edit("redo");
                },
                accelerator: isMac ? "Cmd+Shift+Z" : "Ctrl+Y",
            },
            { type: "separator" },
            { label: "剪切", role: "cut" },
            { label: "复制", role: "copy" },
            { label: "粘贴", role: "paste" },
            ...(isMac ? [{ label: "粘贴并匹配样式", role: "pasteAndMatchStyle" }] : []),
            { label: "删除", role: "delete" },
            { label: "全选", role: "selectAll" },
            {
                label: "自动删除换行",
                click: () => {
                    main_edit("delete_enter");
                },
            },
            { type: "separator" },
            {
                label: "查找",
                click: () => {
                    main_edit("show_find");
                },
                accelerator: "CmdOrCtrl+F",
            },
            {
                label: "替换",
                click: () => {
                    main_edit("show_find");
                },
                accelerator: isMac ? "CmdOrCtrl+Option+F" : "CmdOrCtrl+H",
            },
            { type: "separator" },
            {
                label: "自动换行",
                click: () => {
                    main_edit("wrap");
                },
            },
            { type: "separator" },
            ...(isMac
                ? [
                      {
                          label: "Speech",
                          submenu: [
                              { label: "开始朗读", role: "startSpeaking" },
                              { label: "停止朗读", role: "stopSpeaking" },
                          ],
                      },
                  ]
                : []),
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
            {
                label: "历史记录",
                click: () => {
                    main_edit("show_history");
                },
                accelerator: "CmdOrCtrl+Shift+H",
            },
            { type: "separator" },
            { label: "实际大小", role: "resetZoom", accelerator: "" },
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
            { label: "浏览器打开", click: open_in_browser },
            { type: "separator" },
            { label: "最小化", role: "minimize" },
            { label: "关闭", role: "close" },
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
            icon: the_icon,
            simpleFullscreen: true,
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
            ding_window.webContents.setZoomFactor(store.get("全局缩放") || 1.0);
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
    var can_c_ignore = true;
    ipcMain.on("ding_ignore", (event, v) => {
        can_c_ignore = v;
        if (!v) ding_window.setIgnoreMouseEvents(false);
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
        var ratio = screen.getPrimaryDisplay().scaleFactor;
        var in_window = 0;
        for (i in Object.values(ding_windows_l)) {
            ii = Object.values(ding_windows_l)[i];
            // 如果光标在某个窗口上，不穿透
            var x2 = ii[0] + ii[2],
                y2 = ii[1] + ii[3];
            if (ii[0] <= n_xy.x * ratio && n_xy.x * ratio <= x2 && ii[1] <= n_xy.y * ratio && n_xy.y * ratio <= y2) {
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
var main_window_l = {};
var main_window_focus;
function create_main_window(t, web_page) {
    var window_name = new Date().getTime();
    main_window_l[window_name] = new BrowserWindow({
        x: screen.getCursorScreenPoint().x - 800,
        y: screen.getCursorScreenPoint().y - 600,
        width: 800,
        height: 600,
        minWidth: 800,
        transparent: true,
        icon: the_icon,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    // 自定义界面
    if (web_page == undefined) {
        main_window_l[window_name].loadFile("index.html");
    } else {
        main_window_l[window_name].loadFile(web_page);
    }

    if (dev) main_window_l[window_name].webContents.openDevTools();
    main_window_l[window_name].webContents.on("did-finish-load", () => {
        main_window_l[window_name].webContents.setZoomFactor(store.get("全局缩放") || 1.0);
        main_window_l[window_name].webContents.send("text", window_name, [t[0], t[1] || "auto"]);
    });

    main_window_l[window_name].on("closed", () => {
        delete main_window_l[window_name];
        main_window_focus = null;
    });

    main_window_l[window_name].on("focus", () => {
        main_window_focus = main_window_l[window_name];
    });
    main_window_l[window_name].on("blur", () => {
        main_window_focus = null;
    });

    ipcMain.on("edit", (event, name, v) => {
        switch (v) {
            case "selectAll":
                main_window_l[name].webContents.selectAll();
                break;
            case "cut":
                main_window_l[name].webContents.cut();
                break;
            case "copy":
                main_window_l[name].webContents.copy();
                break;
            case "paste":
                main_window_l[name].webContents.paste();
                break;
        }
    });
}
function main_edit(m) {
    if (main_window_focus) main_window_focus.webContents.send("edit", m);
}

var focused_search_window = null;
ipcMain.on("open_url", async (event, url) => {
    const search_window = new BrowserWindow({
        webPreferences: {
            sandbox: true,
        },
    });
    if (store.get("开启代理")) await search_window.webContents.session.setProxy(store.get("代理"));
    search_window.loadURL(url);
    search_window.on("focus", () => {
        focused_search_window = search_window;
    });
    search_window.on("blur", () => {
        focused_search_window = null;
    });
    search_window.webContents.on("did-create-window", async (child_window) => {
        if (store.get("开启代理")) await child_window.webContents.session.setProxy(store.get("代理"));
        child_window.on("focus", () => {
            focused_search_window = child_window;
        });
        child_window.on("blur", () => {
            focused_search_window = null;
        });
    });
});
function open_in_browser() {
    if (focused_search_window != null) {
        url = focused_search_window.webContents.getURL();
        shell.openExternal(url);
    }
}

// 设置窗口
function create_setting_window(about) {
    const main_window = new BrowserWindow({
        icon: the_icon,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    main_window.loadFile("setting.html");

    if (dev) main_window.webContents.openDevTools();
    main_window.webContents.on("did-finish-load", () => {
        main_window.webContents.setZoomFactor(store.get("全局缩放") || 1.0);
        main_window.webContents.send("about", about);
    });
}

// 帮助窗口
function create_help_window() {
    const main_window = new BrowserWindow({
        icon: the_icon,
        transparent: true,
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    main_window.loadFile("help.html");
    main_window.webContents.on("did-finish-load", () => {
        main_window.webContents.setZoomFactor(store.get("全局缩放") || 1.0);
    });

    if (dev) main_window.webContents.openDevTools();
}

function get_file_name() {
    function f(fmt, date) {
        let ret;
        const opt = {
            YYYY: date.getFullYear() + "",
            YY: (date.getFullYear() % 1000) + "",
            MM: (date.getMonth() + 1 + "").padStart(2, "0"),
            M: date.getMonth() + 1 + "",
            DD: (date.getDate() + "").padStart(2, "0"),
            D: date.getDate() + "",
            d: date.getDay() + "",
            HH: (date.getHours() + "").padStart(2, "0"),
            H: date.getHours() + "",
            hh: ((date.getHours() % 12) + "").padStart(2, "0"),
            h: (date.getHours() % 12) + "",
            mm: (date.getMinutes() + "").padStart(2, "0"),
            m: date.getMinutes() + "",
            ss: (date.getSeconds() + "").padStart(2, "0"),
            s: date.getSeconds() + "",
            S: date.getMilliseconds() + "",
        };
        for (let k in opt) {
            ret = new RegExp(`\(\[\-\.\_\]\)\(\?\<\!\\\\)${k}\(\[\-\.\_\]\)\?`, "g");
            fmt = fmt.replace(ret, `$1${opt[k]}$2`);
        }
        return fmt;
    }
    var save_time = new Date();
    var save_name_time = f(store.get("保存名称"), save_time).replace("\\", "");
    return save_name_time;
}
// 快速截图
function quick_clip() {
    var x = robot.screen.capture();
    var image = nativeImage.createFromBuffer(Buffer.from(x.image), { width: x.width, height: x.height });
    if (store.get("快速截图.模式") == "clip") {
        clipboard.writeImage(image);
    } else if (store.get("快速截图.模式") == "path" && store.get("快速截图.路径")) {
        var file_name = `${store.get("快速截图.路径")}${get_file_name()}.png`;
        function check_file(n, name) {
            // 检查文件是否存在于当前目录中。
            fs.access(name, fs.constants.F_OK, (err) => {
                if (!err) {
                    /* 存在文件，需要重命名 */
                    name = file_name.replace(/\.png$/, `(${n}).png`);
                    check_file(n + 1, name);
                } else {
                    file_name = name;
                    fs.writeFile(
                        file_name,
                        Buffer.from(image.toDataURL().replace(/^data:image\/\w+;base64,/, ""), "base64"),
                        (err) => {
                            if (err) return;
                            noti(file_name);
                        }
                    );
                }
            });
        }
        check_file(1, file_name);
    }
}

function noti(file_path) {
    notification = new Notification({
        title: `${app.name} 保存图像成功`,
        body: `已保存图像到 ${file_path}`,
        icon: `${run_path}/assets/icons/64x64.png`,
    });
    notification.on("click", () => {
        shell.showItemInFolder(file_path);
    });
    notification.show();
}

ipcMain.on("get_save_path", (event, path) => {
    dialog
        .showOpenDialog({
            title: "选择要保存的位置",
            defaultPath: path,
            properties: ["openDirectory"],
        })
        .then((x) => {
            if (x.filePaths) event.sender.send("get_save_path", x.filePaths[0] + "/");
        });
});

ipcMain.on("theme", (e, v) => {
    nativeTheme.themeSource = v;
    store.set("深色模式", v);
});

// 默认设置
var default_setting = {
    首次运行: false,
    快捷键: {
        自动识别: {
            key: "CommandOrControl+Shift+Z",
        },
        截图搜索: {},
        选中搜索: {},
        剪贴板搜索: {},
        快速截图: {},
        主页面: {},
    },
    其他快捷键: {},
    模糊: 10,
    字体: {
        主要字体: "",
        等宽字体: "",
    },
    全局缩放: 1,
    工具栏跟随: "展示内容优先",
    取色器默认格式: "HEX",
    自动搜索: true,
    遮罩颜色: "#0008",
    选区颜色: "#0000",
    像素大小: 10,
    取色器大小: 15,
    显示四角坐标: true,
    其他应用打开: "",
    检查OCR: true,
    自动运行命令: "",
    端口: 8080,
    自动打开链接: false,
    自动搜索中文占比: 0.2,
    浏览器中打开: false,
    保存路径: app.getPath("pictures") + "/",
    保存名称: "eSearch-YYYY-MM-DD-HH-mm-ss-S",
    jpg质量: 0.92,
    框选后默认操作: "no",
    快速截图: { 模式: "clip", 路径: "" },
    搜索引擎: [
        ["谷歌", "https://www.google.com/search?q=%s"],
        ["*百度", "https://www.baidu.com/s?wd=%s"],
        ["必应", "https://cn.bing.com/search?q=%s"],
    ],
    翻译引擎: [
        ["google", "https://translate.google.cn/?op=translate&text=%s"],
        ["deepl", "https://www.deepl.com/translator#en/zh/%s"],
        ["金山词霸", "http://www.iciba.com/word?w=%s"],
        ["百度", "https://fanyi.baidu.com/#en/zh/%s"],
    ],
    历史记录: [],
    历史记录设置: {
        保留历史记录: true,
        自动清除历史记录: false,
        d: 14,
        h: 0,
    },
    ding_dock: [0, 0],
    开启代理: false,
    代理: {
        pacScript: "",
        proxyRules: "",
        proxyBypassRules: "",
    },
    深色模式: "system",
};
function set_default_setting() {
    for (i in default_setting) {
        store.set(i, default_setting[i]);
    }
}

ipcMain.on("默认设置", set_default_setting);

// 增加设置项后，防止undefined
function fix_setting_tree() {
    var tree = "default_setting";
    walk(tree);
    function walk(path) {
        var x = eval(path);
        if (Object.keys(x).length == 0) {
            path = path.slice(tree.length + 1); /* 去除开头主tree */
            if (store.get(path) === undefined) store.set(path, x);
        } else {
            for (let i in x) {
                var c_path = path + "." + i;
                if (x[i].constructor === Object) {
                    walk(c_path);
                } else {
                    c_path = c_path.slice(tree.length + 1); /* 去除开头主tree */
                    if (store.get(c_path) === undefined) store.set(c_path, x[i]);
                }
            }
        }
    }
}

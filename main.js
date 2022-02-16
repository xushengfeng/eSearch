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
} = require("electron");
var robot = require("robotjs");
const Store = require("electron-store");
var screen = require("electron").screen;
const path = require("path");
run_path = path.resolve(__dirname, "");
const { exec } = require("child_process");
const fs = require("fs");

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
    if (store.get("首次运行") === undefined) set_default_setting();
    fix_setting_tree();

    // 检查并开启服务
    function start_service() {
        const request = net.request({
            method: "POST",
            url: "http://127.0.0.1:8080",
        });
        request.on("error", () => {
            var dir = store.path.replace("config.json", "service-installed");
            console.log(`存在目录${dir}`);
            if (fs.existsSync(dir) && store.get("自动运行命令")) {
                console.log("启动");
                exec(store.get("自动运行命令"));
            }
        });
        request.write("");
        request.end();
    }
    start_service();

    // 快捷键
    var 快捷键函数 = {
        自动识别: {
            f: "auto_open()",
        },
        截图搜索: {
            f: "full_screen()",
        },
        选中搜索: {
            f: "open_selection()",
        },
        剪贴板搜索: {
            f: "open_clip_board()",
        },
        主页面: {
            f: "create_main_window([''])",
        },
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
    create_clip_window();
});

app.on("will-quit", () => {
    // Unregister all shortcuts.
    globalShortcut.unregisterAll();
});

// 截图窗口
var clip_window = null;
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
    clip_window.webContents.on("did-finish-load", () => {
        clip_window.webContents.setZoomFactor(store.get("全局缩放") || 1.0);
    });

    if (dev) clip_window.webContents.openDevTools();

    // 监听截图奇奇怪怪的事件
    ipcMain.on("window-close", () => {
        clip_window.setFullScreen(false);
        clip_window.hide();
    });

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

    ipcMain.on("save", (event, type) => {
        var save_time = new Date();
        var save_name_time = `${save_time.getFullYear()}-${
            save_time.getMonth() + 1
        }-${save_time.getDate()}-${save_time.getHours()}-${save_time.getMinutes()}-${save_time.getSeconds()}-${save_time.getMilliseconds()}`;
        var saved_path = store.get("保存路径") || "";
        clip_window.setFullScreen(false);
        clip_window.hide();
        dialog
            .showSaveDialog({
                title: "选择要保存的位置",
                defaultPath: `${saved_path}Screenshot-${save_name_time}.${type}`,
                filters: [{ name: "图像", extensions: [type] }],
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
                    save_path = x.filePath.split("/");
                    save_path.pop();
                    store.set("保存路径", save_path.join("/") + "/");
                } else {
                    new Notification({
                        title: "eSearch保存图像失败",
                        body: `用户已取消保存`,
                        icon: `${run_path}/assets/icons/64x64.png`,
                    }).show();
                    clip_window.show();
                    clip_window.setFullScreen(true);
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
    const check_r = net.request({
        method: "POST",
        url: `http://127.0.0.1:8080`,
    });
    check_r.on("response", () => {
        const request = net.request({
            method: "POST",
            url: `http://127.0.0.1:8080`,
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
        dialog.showMessageBox({
            title: "警告",
            message: "识别失败\n找不到服务器",
            icon: `${run_path}/assets/icons/warning.png`,
        });
    });

    check_r.write("");
    check_r.end();
}

var check_service_v = true;
ipcMain.on("check_service", (event) => {
    const request = net.request({
        method: "POST",
        url: "http://127.0.0.1:8080",
    });
    var dir = store.path.replace("config.json", "service-installed");
    request.on("error", () => {
        event.sender.send("check_service_back", "error");
        if (!fs.existsSync(dir)) {
            if (check_service_v) {
                dialog
                    .showMessageBox({
                        title: "服务未安装",
                        message: "服务未安装\n需要下载并安装服务才能使用OCR",
                        icon: `${run_path}/assets/icons/warning.png`,
                        buttons: ["下载", "取消并不再提示", "取消"],
                        defaultId: 0,
                    })
                    .then((resolve) => {
                        switch (resolve.response) {
                            case 0:
                                shell.openExternal("https://github.com/xushengfeng/eSearch-service");
                                break;
                            case 1:
                                store.set("检查OCR", false);
                                break;
                            case 2:
                                check_service_v = false;
                                break;
                        }
                    });
            }
        } else {
            if (store.get("自动运行命令")) {
                exec(store.get("自动运行命令"));
            } else {
                dialog.showMessageBox({
                    title: "服务未启动",
                    message: "检测到服务未启动\n请手动启动eSearch服务",
                    icon: `${run_path}/assets/icons/warning.png`,
                });
            }
        }
    });
    request.on("response", () => {
        event.sender.send("check_service_back", "ok");
        if (!fs.existsSync(dir)) fs.mkdir(dir, () => {});
    });
    request.write("");
    request.end();
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
            {
                label: "自动删除换行",
                click: delete_enter,
            },
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
            { label: "浏览器打开", click: open_in_browser },
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
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
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
function delete_enter() {
    if (main_window_focus) main_window_focus.webContents.send("delete_enter");
}

var focused_search_window = null;
ipcMain.on("open_url", (event, url) => {
    const search_window = new BrowserWindow({
        webPreferences: {
            sandbox: true,
        },
    });
    search_window.loadURL(url);
    search_window.on("focus", () => {
        focused_search_window = search_window;
    });
    search_window.on("blur", () => {
        focused_search_window = null;
    });
    search_window.webContents.on("did-create-window", (child_window) => {
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
        main_window.webContents.setZoomFactor(store.get("全局缩放") || 1.0);
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
    main_window.webContents.on("did-finish-load", () => {
        main_window.webContents.setZoomFactor(store.get("全局缩放") || 1.0);
    });

    if (dev) main_window.webContents.openDevTools();
}

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
    自动打开链接: false,
    自动搜索中文占比: 0.2,
    浏览器中打开: false,
    保存路径: "",
    框选后默认操作: "no",
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

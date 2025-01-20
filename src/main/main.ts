/// <reference types="vite/client" />

import {
    app,
    Tray,
    Menu,
    clipboard,
    globalShortcut,
    BrowserWindow,
    ipcMain,
    dialog,
    Notification,
    shell,
    nativeTheme,
    WebContentsView,
    screen,
    desktopCapturer,
    session,
    crashReporter,
    nativeImage,
    type NativeImage,
    type View,
} from "electron";
import type { Buffer } from "node:buffer";

import minimist from "minimist";

import initScreenShots from "../renderer/screenShot/screenShot";

import Store from "../../lib/store/store";
import type {
    setting,
    MainWinType,
    translateWinType,
    功能,
} from "../ShareTypes";
import { join, resolve, dirname } from "node:path";
import { exec } from "node:child_process";
import {
    readFileSync,
    rmSync,
    existsSync,
    mkdir,
    readFile,
    mkdirSync,
    writeFile,
    writeFileSync,
    statSync,
} from "node:fs";
import { release, tmpdir } from "node:os";
import { t, lan, getLans } from "../../lib/translate/translate";
import { matchFitLan } from "xtranslator";
import time_format from "../../lib/time_format";
import url from "node:url";

const runPath = join(resolve(__dirname, ""), "../../");
const tmpDir = join(tmpdir(), "eSearch");

// 自定义用户路径
try {
    let preloadConfig = "";
    try {
        preloadConfig = readFileSync(join(runPath, "preload_config"))
            .toString()
            .trim();
        if (preloadConfig.startsWith("."))
            preloadConfig = join(runPath, preloadConfig);
    } catch (error) {}
    const portable = "portable";
    const userDataPath =
        preloadConfig ||
        (statSync(join(runPath, portable)).isDirectory()
            ? join(runPath, portable)
            : "");
    console.log(`userDataPath: ${userDataPath}`);

    if (userDataPath) app.setPath("userData", userDataPath);
} catch (e) {}

// 获取运行位置
ipcMain.on("run_path", (event) => {
    event.returnValue = runPath;
});

const store = new Store();

ipcMain.on("store", (e, x) => {
    if (x.type === "get") {
        e.returnValue = store.get(x.path);
    } else if (x.type === "set") {
        store.set(x.path, x.value);
    } else if (x.type === "path") {
        e.returnValue = app.getPath("userData");
    }
});

let /** 是否开启开发模式 */ dev: boolean;
// 自动开启开发者模式
if (
    process.argv.includes("-d") ||
    import.meta.env.DEV ||
    process.env.ESEARCH_DEV ||
    store.get("dev")
) {
    dev = true;
} else {
    dev = false;
}

const devCSS = "[data-dev]{display:none}";

if (dev) {
    setInterval(() => {
        const usage = process.memoryUsage();
        const main = usage.rss / 1024 / 1024;
        let rander = 0;
        for (const i of app.getAppMetrics().filter((i) => i.type === "Tab")) {
            rander += i.memory.workingSetSize;
        }
        rander = rander / 1024;
        console.log(
            `Memory： ${main.toFixed(7)} + ${rander.toFixed(7)} = ${main + rander}`,
        );
    }, 1500);
}

const screenShotArgs = [
    { c: store.get("额外截屏器.命令"), path: store.get("额外截屏器.位置") },
    (m: string) =>
        feedbackUrl({
            title: "截屏库调用错误",
            main: "截屏库调用错误",
            steps: "截屏",
            more: m,
        }),
    t,
] as const;

const keepClip = store.get("保留截屏窗口");

function mainUrl(fileName: string) {
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
        const mainUrl = `${process.env.ELECTRON_RENDERER_URL}/${fileName}`;
        return mainUrl;
    }
    return join(__dirname, "../renderer", fileName);
}

/** 加载网页 */
function rendererPath(window: BrowserWindow, fileName: string) {
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
        const x = new url.URL(mainUrl(fileName));
        window.loadURL(x.toString());
    } else {
        window.loadFile(mainUrl(fileName));
    }
    window.webContents.on("will-navigate", (event) => {
        event.preventDefault();
    });
    window.webContents.setWindowOpenHandler(() => {
        return { action: "deny" };
    });
}
function rendererPath2(
    window: Electron.WebContents,
    fileName: string,
    q: Electron.LoadFileOptions,
) {
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
        const x = new url.URL(mainUrl(fileName));
        if (q) {
            if (q.search) x.search = q.search;
            if (q.query) {
                for (const i in q.query) {
                    x.searchParams.set(i, q.query[i]);
                }
            }
            if (q.hash) x.hash = q.hash;
        }
        window.loadURL(x.toString());
    } else {
        window.loadFile(mainUrl(fileName), q);
    }
}

if (!store.get("硬件加速")) {
    app.disableHardwareAcceleration();
}

/**
 * 复制选区，存在变化，回调
 */
async function copyText(callback: (t: string) => void) {
    const oClipboard = clipboard.readText();
    if (process.platform === "darwin") {
        exec(
            `osascript -e 'tell application "System Events"' -e 'delay 0.1' -e 'key code 8 using command down' -e 'end tell'`,
        );
    } else if (process.platform === "win32") {
        exec(`"${join(runPath, "lib/copy.exe")}"`);
    } else if (process.platform === "linux") {
        // @ts-ignore
        exec(store.get("主搜索功能.linux_copy") || "xdotool key ctrl+c");
    }
    setTimeout(() => {
        const t = clipboard.readText();
        let v = "";
        if (oClipboard !== t) v = t;
        for (const i of store.get("主搜索功能.自动搜索排除")) {
            if (t.match(i)) {
                v = "";
                break;
            }
        }
        callback(v);
        clipboard.writeText(oClipboard);
    }, 300);
}

/** 自动判断选中搜索还是截屏搜索 */
function autoOpen() {
    copyText((t) => {
        if (t) {
            createMainWindow({ type: "text", content: t });
        } else {
            showPhoto();
        }
    });
}

/** 选区搜索 */
function openSelection() {
    copyText((t) => {
        if (t) createMainWindow({ type: "text", content: t });
    });
}

/** 剪贴板搜索 */
function openClipBoard() {
    const t = clipboard.readText(
        process.platform === "linux" && store.get("主搜索功能.剪贴板选区搜索")
            ? "selection"
            : "clipboard",
    );
    createMainWindow({ type: "text", content: t });
}

// cli参数重复启动;
const isFirstInstance = app.requestSingleInstanceLock();
if (!isFirstInstance) {
    app.quit();
} else {
    app.on("second-instance", (_event, commanLine, _workingDirectory) => {
        argRun(commanLine);
    });
}

function sleep(time: number) {
    if (!time) return;
    return new Promise((rj: (v: boolean) => void) => {
        setTimeout(() => {
            rj(true);
        }, time);
    });
}

/**
 * 根据命令运行
 * @param {string[]} c 命令
 */
async function argRun(c: string[], first?: boolean) {
    const argv = minimist(c.slice(1));
    if (argv.dev) {
        dev = true;
    }

    if (argv.v || argv.version) {
        console.log(app.getVersion());
        if (first) app.exit();
    }
    if (argv.h || argv.help) {
        const list: (string | [string | [string, string], number, string])[] = [
            [["v", "version"], 0, app.getVersion()],
            [["h", "help"], 0, "帮助"],
            ["config", 0, "打开配置"],
            "",
            [["i", "input"], 0, "输入图片，如果空，则截屏"],
            ["delay", 0, "延时截屏"],
            "",
            `[${t("动作")}] [i] [more]`,
            t("动作"),
            [["s", "save"], 0, "保存到路径或剪贴板"],
            [["p", "path"], 1, "保存的路径"],
            ["n", 1, "连拍数"],
            ["dt", 1, "连拍间隔（ms）"],
            ["clipborad", 1, "保存到剪贴板"],
            [["o", "ocr"], 0, "文字识别"],
            [
                "engine",
                1,
                store
                    .get("离线OCR")
                    .map((i) => i[0])
                    .concat(["baidu", "youdao"])
                    .join(", "),
            ],
            ["[mode]", 1, ""],
            [["m", "img"], 0, "以图搜图"],
            ["engine", 1, "baidu, yandex, google"],
            ["[mode]", 1, ""],
            [["d", "ding"], 0, "贴图"],
            [["t", "text"], 0, "主页面打开文字"],
            ["[mode]", 1, ""],
            "",
            "文字处理模式，不设置则自动判断",
            ["trans", 0, "翻译"],
            ["search", 0, "搜索"],
        ];
        function add(t: string) {
            return t.length === 1 ? `-${t}` : t.startsWith("[") ? t : `--${t}`;
        }
        const list1: (string | [string, string])[] = list.map((i) => {
            if (typeof i === "string") {
                return i;
            }
            const t =
                typeof i[0] === "string"
                    ? add(i[0])
                    : i[0].map((x) => add(x)).join(",");
            return [`${" ".repeat(i[1] * 2)}${t}`, i[2]];
        });
        const maxWidth =
            Math.max(
                ...list1
                    .filter((i) => typeof i !== "string")
                    .map((i) => i[0].length),
            ) + 8;
        console.log(
            list1
                .map((i) => {
                    if (typeof i === "string") return i;
                    return `${i[0]}${" ".repeat(maxWidth - i[0].length)}${t(i[1])}`;
                })
                .join("\n"),
        );
        if (first) app.exit();
    }
    if (argv.config) {
        shell.openExternal(join(app.getPath("userData"), "config.json"));
        if (first) app.exit();
    }

    const path = argv.i || argv.input;
    async function getImg() {
        let img: NativeImage | undefined = undefined;
        if (!path) {
            const screenShots = initScreenShots(...screenShotArgs);
            await sleep(argv.delay || 0);
            img = screenShots().screen.at(0)?.captureSync().image;
        } else {
            img = nativeImage.createFromBuffer(readFileSync(path));
        }
        return img;
    }
    const textMode: setting["主页面"]["模式"] = argv.trans
        ? "translate"
        : argv.search
          ? "search"
          : "auto";
    const e = argv.engine;
    if (argv.s || argv.save) {
        const n = argv.n as number;
        const dt = (argv.dt as number) || 100;

        const savePath = argv.p || argv.path;
        const sp =
            typeof savePath !== "string"
                ? checkFile(
                      join(
                          store.get("快速截屏.路径") ||
                              store.get("保存.保存路径.图片"),
                          getFileName(),
                      ),
                  )
                : statSync(savePath).isDirectory()
                  ? checkFile(join(savePath, getFileName()))
                  : savePath;

        if (n) {
            if (!sp) return;
            try {
                mkdirSync(sp, { recursive: true });
            } catch (error) {}
            const screenShots = initScreenShots(...screenShotArgs);
            for (let i = 0; i < n; i++) {
                setTimeout(() => {
                    const image = screenShots()[0].captureSync().image;
                    const buffer = image.toPNG();
                    const filePath = join(sp, `${i}.png`);
                    writeFile(filePath, buffer, () => {});
                }, dt * n);
            }
        } else {
            const img = await getImg();
            if (!img) return;
            if (argv.clipboard) {
                clipboard.writeImage(img);
            } else {
                writeFileSync(`${sp}.png`, img.toPNG());
            }
        }
    } else if (argv.o || argv.ocr) {
        const img = await getImg();
        if (!img) return;
        createMainWindow({
            type: "ocr",
            content: img.toDataURL(),
            arg0: e,
            mode: textMode,
        });
    } else if (argv.d || argv.ding) {
        const img = await getImg();
        if (!img) return;
        ding(img);
    } else if (argv.m || argv.img) {
        const img = await getImg();
        if (!img) return;
        createMainWindow({
            type: "image",
            content: img.toDataURL(),
            arg0: e,
            mode: textMode,
        });
    } else if (argv.t || argv.text) {
        createMainWindow({
            type: "text",
            content: argv.t || argv.text,
            mode: textMode,
        });
    } else {
        const path = argv._.find((i) => i.match(/(\.png)|(\.jpg)|(\.svg)$/i));
        if (path) showPhoto(path);
    }
}

async function rmR(dir_path: string) {
    rmSync(dir_path, { recursive: true });
}

// 快捷键
const 快捷键函数: Record<keyof setting["快捷键"], () => void> = {
    自动识别: autoOpen,
    截屏搜索: showPhoto,
    选中搜索: openSelection,
    剪贴板搜索: openClipBoard,
    快速截屏: quickClip,
    连拍: async () => {
        lianPai();
    },
    结束广截屏: () => {
        clipWindow?.webContents.send("long_e");
    },
    剪贴板贴图: () => dingFromClipBoard(),
    主页面: () => createMainWindow({ type: "text", content: "" }),
};

let contextMenu: Electron.Menu;
let tray: Tray;

app.commandLine.appendSwitch(
    "enable-experimental-web-platform-features",
    "enable",
);

app.whenReady().then(() => {
    console.log(
        `eSearch ${app.getVersion()} 启动\n项目地址：https://github.com/xushengfeng/eSearch`,
    );

    crashReporter.start({ uploadToServer: false });

    if (store.get("首次运行") === undefined) setDefaultSetting();
    fixSettingTree();

    // 初始化语言
    lan(store.get("语言.语言") || "");

    argRun(process.argv, true);

    // 托盘
    tray = isMac
        ? new Tray(`${runPath}/assets/logo/macIconTemplate.png`)
        : new Tray(`${runPath}/assets/logo/32x32.png`);
    contextMenu = Menu.buildFromTemplate([
        {
            label: `${t("自动识别")}`,
            click: () => {
                autoOpen();
            },
        },
        {
            label: t("截屏搜索"),
            click: () => {
                setTimeout(() => {
                    showPhoto();
                }, store.get("主搜索功能.截屏搜索延迟"));
            },
        },
        {
            label: t("选中搜索"),
            click: () => {
                openSelection();
            },
        },
        {
            label: t("剪贴板搜索"),
            click: () => {
                openClipBoard();
            },
        },
        {
            type: "separator",
        },
        {
            label: t("OCR(文字识别)"),
            click: () => {
                sendCaptureEvent(undefined, "ocr");
            },
        },
        {
            label: t("以图搜图"),
            click: () => {
                sendCaptureEvent(undefined, "search");
            },
        },
        {
            type: "separator",
        },
        {
            label: t("浏览器打开"),
            type: "checkbox",
            checked: store.get("浏览器中打开"),
            click: (i) => {
                store.set("浏览器中打开", i.checked);
            },
        },
        {
            type: "separator",
        },
        {
            label: t("从剪贴板贴图"),
            click: () => {
                dingFromClipBoard();
            },
        },
        {
            type: "separator",
        },
        {
            label: t("主页面模式"),
            type: "submenu",
            submenu: [
                {
                    label: t("自动"),
                    type: "radio",
                    checked: store.get("主页面.模式") === "auto",
                    click: () => store.set("主页面.模式", "auto"),
                },
                {
                    label: t("搜索"),
                    type: "radio",
                    checked: store.get("主页面.模式") === "search",
                    click: () => store.set("主页面.模式", "search"),
                },
                {
                    label: t("翻译"),
                    type: "radio",
                    checked: store.get("主页面.模式") === "translate",
                    click: () => store.set("主页面.模式", "translate"),
                },
            ],
        },
        {
            label: t("复用主页面"),
            toolTip: t("可加快OCR加载"),
            type: "checkbox",
            checked: store.get("主页面.复用"),
            click: (i) => store.set("主页面.复用", i.checked),
        },
        { type: "separator" },
        {
            label: t("主页面"),
            click: () => {
                createMainWindow({ type: "text", content: "" });
            },
        },
        {
            label: t("设置"),
            click: () => {
                createSettingWindow();
            },
        },
        {
            label: t("教程帮助"),
            click: () => {
                createHelpWindow();
            },
        },
        {
            type: "separator",
        },
        ...(dev
            ? [
                  {
                      label: t("退出开发者模式"),
                      click: () => {
                          store.set("dev", false);
                          app.relaunch();
                          app.exit(0);
                      },
                  },
              ]
            : []),
        {
            label: t("检查更新"),
            click: async () => {
                checkUpdate(true);
            },
        },
        {
            label: t("反馈"),
            click: (_i, win) => {
                shell.openExternal(
                    feedbackUrl({
                        title: `[${win?.getTitle()?.replace("eSearch - ", "") ?? "……界面"}] 存在……问题`,
                    }),
                );
            },
        },
        {
            label: t("重启"),
            click: () => {
                app.relaunch();
                app.exit(0);
            },
        },
        {
            label: t("退出"),
            click: () => {
                app.quit();
            },
        },
    ]);
    tray.setToolTip(app.getName());
    if (store.get("点击托盘自动截图")) {
        tray.on("click", () => {
            showPhoto();
        });
        tray.on("right-click", () => {
            tray.popUpContextMenu(contextMenu);
        });
    } else {
        tray.setContextMenu(contextMenu);
    }

    // 启动时提示
    if (store.get("启动提示"))
        new Notification({
            title: app.name,
            body: `${app.name} ${t("已经在后台启动")}`,
            icon: `${runPath}/assets/logo/64x64.png`,
        }).show();

    const 快捷键: object = store.get("快捷键");
    for (const k in 快捷键) {
        const m = 快捷键[k];
        try {
            if (m.key)
                globalShortcut.register(m.key, () => {
                    快捷键函数[k]();
                });
        } catch (error) {
            快捷键[k].key = undefined;
            store.set("快捷键", 快捷键);
        }
    }
    const 工具快捷键 = store.get("全局工具快捷键");
    for (const k in 工具快捷键) {
        const m = 工具快捷键[k] as string;
        try {
            if (m)
                globalShortcut.register(m, () => {
                    sendCaptureEvent(undefined, k as 功能);
                });
        } catch (error) {
            工具快捷键[k] = "";
            store.set("全局工具快捷键", 工具快捷键);
        }
    }

    // tmp目录
    if (!existsSync(tmpDir)) mkdir(tmpDir, () => {});
    if (keepClip) {
        clipWindow = createClipWindow();
    } else {
        new BrowserWindow({ show: false });
    }

    nativeTheme.themeSource = store.get("全局.深色模式");

    // 菜单栏设置
    setMenu();
});

const isMac = process.platform === "darwin";

function setMenu() {
    const menuTemplate = [
        ...(isMac
            ? [
                  {
                      label: app.name,
                      submenu: [
                          { label: `${t("关于")} ${app.name}`, role: "about" },
                          { type: "separator" },
                          {
                              label: t("设置"),
                              click: () => {
                                  createSettingWindow();
                              },
                              accelerator: "CmdOrCtrl+,",
                          },
                          { type: "separator" },
                          { label: t("服务"), role: "services" },
                          { type: "separator" },
                          { label: `${t("隐藏")} ${app.name}`, role: "hide" },
                          { label: t("隐藏其他"), role: "hideOthers" },
                          { label: t("全部显示"), role: "unhide" },
                          { type: "separator" },
                          { label: `退出 ${app.name}`, role: "quit" },
                      ],
                  },
              ]
            : []),
        {
            label: t("文件"),
            submenu: [
                {
                    label: t("保存到历史记录"),
                    click: (_i, w) => {
                        mainEdit(w, "save");
                    },
                    accelerator: "CmdOrCtrl+S",
                },
                { type: "separator" },
                ...(isMac
                    ? []
                    : [
                          {
                              label: t("设置"),
                              click: () => {
                                  createSettingWindow();
                              },
                              accelerator: "CmdOrCtrl+,",
                          },
                          { type: "separator" },
                      ]),
                {
                    label: t("其他编辑器打开"),
                    click: (_i, w) => {
                        mainEdit(w, "edit_on_other");
                    },
                },
                {
                    label: t("打开方式..."),
                    click: (_i, w) => {
                        mainEdit(w, "choose_editer");
                    },
                },
                { type: "separator" },
                {
                    id: "close",
                    label: t("关闭"),
                    role: "close",
                    accelerator: "CmdOrCtrl+W",
                },
            ],
        },
        {
            label: t("编辑"),
            submenu: [
                {
                    label: t("撤销"),
                    click: (_i, w) => {
                        mainEdit(w, "undo");
                        w?.webContents.undo();
                    },
                    accelerator: "CmdOrCtrl+Z",
                },
                {
                    label: t("重做"),
                    click: (_i, w) => {
                        mainEdit(w, "redo");
                        w?.webContents.redo();
                    },
                    accelerator: isMac ? "Cmd+Shift+Z" : "Ctrl+Y",
                },
                { type: "separator" },
                {
                    label: t("剪切"),
                    click: (_i, w) => {
                        mainEdit(w, "cut");
                        w?.webContents.cut();
                    },
                    accelerator: "CmdOrCtrl+X",
                },
                {
                    label: t("复制"),
                    click: (_i, w) => {
                        mainEdit(w, "copy");
                        w?.webContents.copy();
                    },
                    accelerator: "CmdOrCtrl+C",
                },
                {
                    label: t("粘贴"),
                    click: (_i, w) => {
                        mainEdit(w, "paste");
                        w?.webContents.paste();
                    },
                    accelerator: "CmdOrCtrl+V",
                },
                {
                    label: t("删除"),
                    click: (_i, w) => {
                        mainEdit(w, "delete");
                        w?.webContents.delete();
                    },
                },
                {
                    label: t("全选"),
                    click: (_i, w) => {
                        mainEdit(w, "select_all");
                        w?.webContents.selectAll();
                    },
                    accelerator: "CmdOrCtrl+A",
                },
                { type: "separator" },
                {
                    label: t("查找"),
                    click: (_i, w) => {
                        mainEdit(w, "show_find");
                    },
                    accelerator: "CmdOrCtrl+F",
                },
                {
                    label: t("替换"),
                    click: (_i, w) => {
                        mainEdit(w, "show_find");
                    },
                    accelerator: "CmdOrCtrl+F",
                },
                { type: "separator" },
                {
                    label: t("自动换行"),
                    click: (_i, w) => {
                        mainEdit(w, "wrap");
                    },
                },
                {
                    label: t("拼写检查"),
                    click: (_i, w) => {
                        mainEdit(w, "spellcheck");
                    },
                },
                { type: "separator" },
                ...(isMac
                    ? [
                          {
                              label: t("朗读"),
                              submenu: [
                                  {
                                      label: t("开始朗读"),
                                      role: "startSpeaking",
                                  },
                                  {
                                      label: t("停止朗读"),
                                      role: "stopSpeaking",
                                  },
                              ],
                          },
                      ]
                    : []),
            ],
        },
        {
            label: t("浏览器"),
            submenu: [
                {
                    label: t("后退"),
                    click: (_i, w) => {
                        viewEvents(w, "back");
                    },
                    accelerator: isMac ? "Command+[" : "Alt+Left",
                },
                {
                    label: t("前进"),
                    click: (_i, w) => {
                        viewEvents(w, "forward");
                    },
                    accelerator: isMac ? "Command+]" : "Alt+Right",
                },
                {
                    label: t("刷新"),
                    click: (_i, w) => {
                        viewEvents(w, "reload");
                    },
                    accelerator: "F5",
                },
                {
                    label: t("停止加载"),
                    click: (_i, w) => {
                        viewEvents(w, "stop");
                    },
                    accelerator: "Esc",
                },
                {
                    label: t("浏览器打开"),
                    click: (_i, w) => {
                        viewEvents(w, "browser");
                    },
                },
                {
                    label: t("保存到历史记录"),
                    click: (_i, w) => {
                        viewEvents(w, "add_history");
                    },
                    accelerator: "CmdOrCtrl+D",
                },
                {
                    label: t("开发者工具"),
                    click: (_i, w) => {
                        viewEvents(w, "dev");
                    },
                },
            ],
        },
        {
            label: t("视图"),
            submenu: [
                { label: t("重新加载"), role: "reload" },
                { label: t("强制重载"), role: "forceReload" },
                { label: t("开发者工具"), role: "toggleDevTools" },
                { type: "separator" },
                {
                    label: t("历史记录"),
                    click: (_i, w) => {
                        mainEdit(w, "show_history");
                    },
                    accelerator: "CmdOrCtrl+H",
                },
                {
                    id: "show_photo",
                    label: t("图片区"),
                    click: (_i, w) => {
                        mainEdit(w, "show_photo");
                    },
                    accelerator: "CmdOrCtrl+P",
                },
                { type: "separator" },
                { label: t("实际大小"), role: "resetZoom", accelerator: "" },
                { label: t("放大"), role: "zoomIn" },
                { label: t("缩小"), role: "zoomOut" },
                { type: "separator" },
                { label: t("全屏"), role: "togglefullscreen" },
            ],
        },
        {
            label: t("窗口"),
            submenu: [
                { label: t("最小化"), role: "minimize" },
                { label: t("关闭"), role: "close" },
                ...(isMac
                    ? [
                          { type: "separator" },
                          { label: t("置于最前面"), role: "front" },
                          { type: "separator" },
                          { label: t("窗口"), role: "window" },
                      ]
                    : []),
            ],
        },
        {
            label: t("帮助"),
            role: "help",
            submenu: [
                {
                    label: t("教程帮助"),
                    click: () => {
                        createHelpWindow();
                    },
                },
                { type: "separator" },
                {
                    label: t("关于"),
                    click: () => {
                        createSettingWindow(true);
                    },
                },
            ],
        },
    ] as Electron.MenuItemConstructorOptions[];
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    rmR(tmpDir);
});

function feedbackUrl(op?: {
    title?: string;
    main?: string;
    steps?: string;
    expected?: string;
    more?: string;
}) {
    const url = new URL(
        "https://github.com/xushengfeng/eSearch/issues/new?assignees=&labels=bug&projects=&template=bug_report.yaml",
    );
    url.searchParams.append("title", op?.title || "...存在...的错误");
    url.searchParams.append("main", op?.main || "");
    url.searchParams.append("steps", op?.steps || "");
    url.searchParams.append("expected", op?.expected || "");
    url.searchParams.append("more", op?.more || "");
    url.searchParams.append("v", app.getVersion());
    url.searchParams.append(
        "os",
        `${process.platform} ${release()} (${process.arch})`,
    );
    return url.toString();
}

const theIcon =
    process.platform === "win32"
        ? join(runPath, "assets/logo/icon.ico")
        : join(runPath, "assets/logo/1024x1024.png");

ipcMain.on("dialog", (e, arg0) => {
    const id = dialog.showMessageBoxSync(arg0);
    e.returnValue = id;
});

// 截屏窗口
let clipWindow: BrowserWindow | null = null;
let clipWindowLoaded = false;
const getClipWin = async () => {
    if (clipWindowLoaded && !clipWindow?.isDestroyed())
        return clipWindow as BrowserWindow;
    if (!clipWindow || clipWindow.isDestroyed())
        clipWindow = createClipWindow();

    return new Promise((re: (v: BrowserWindow) => void) => {
        clipWindow?.webContents.once("did-finish-load", () => {
            clipWindowLoaded = true;
            return re(clipWindow as BrowserWindow);
        });
    });
};
/** 初始化截屏后台窗口 */
function createClipWindow() {
    const _clipWindow = new BrowserWindow({
        icon: theIcon,
        width: screen.getPrimaryDisplay().workAreaSize.width,
        height: screen.getPrimaryDisplay().workAreaSize.height,
        show: false,
        alwaysOnTop: !dev, // 为了方便调试，调试模式就不居上了
        fullscreenable: true,
        transparent: true,
        frame: false,
        resizable: process.platform === "linux", // gnome下为false时无法全屏
        skipTaskbar: true,
        autoHideMenuBar: true,
        movable: false,
        enableLargerThanScreen: true, // mac
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            zoomFactor: store.get("全局.缩放") || 1.0,
        },
    });

    if (!dev) {
        _clipWindow.webContents.insertCSS(devCSS);
    }

    if (!dev) _clipWindow.setAlwaysOnTop(true, "screen-saver");

    rendererPath(_clipWindow, "capture.html");

    if (dev) _clipWindow.webContents.openDevTools();

    _clipWindow.webContents.on("render-process-gone", (_e, d) => {
        console.log(d);
        const id = dialog.showMessageBoxSync({
            message: t("截屏程序崩溃，是否重启？"),
            buttons: [t("重启"), t("退出应用")],
            defaultId: 0,
            cancelId: 1,
            detail: JSON.stringify(d),
        });
        if (id === 0) exitFullScreen();
        if (id === 1) app.exit();
    });
    _clipWindow.webContents.once("did-finish-load", () => {
        clipWindowLoaded = true;
    });
    return _clipWindow;
}

// * 监听截屏奇奇怪怪的事件
ipcMain.on("clip_main_b", (event, type, arg) => {
    switch (type) {
        case "window-show":
            fullScreen();
            break;
        case "window-close":
            exitFullScreen();
            isLongStart = false;
            break;
        case "ocr":
            ocr(arg);
            break;
        case "search":
            imageSearch(arg);
            break;
        case "QR":
            createMainWindow({ type: "qr", content: arg });
            break;
        case "open":
            dialog
                .showOpenDialog({
                    title: t("选择要打开应用的位置"),
                })
                .then((x) => {
                    console.log(x);
                    event.sender.send("open_path", x.filePaths[0]);
                });
            break;
        case "save": {
            const savedPath = store.get("保存.保存路径.图片") || "";
            hideClip();
            dialog
                .showSaveDialog({
                    title: t("选择要保存的位置"),
                    defaultPath: join(savedPath, `${getFileName()}.${arg}`),
                    filters: [{ name: t("图像"), extensions: [arg] }],
                })
                .then((x) => {
                    event.sender.send("save_path", x.filePath);
                    if (x.filePath) {
                    } else {
                        new Notification({
                            title: `${app.name} ${t("保存文件失败")}`,
                            body: t("用户已取消保存"),
                            icon: `${runPath}/assets/logo/64x64.png`,
                        }).show();
                        clipWindow?.show();
                        clipWindow?.setSimpleFullScreen(true);
                    }
                });
            break;
        }
        case "ding":
            createDingWindow(arg[0], arg[1], arg[2], arg[3], arg[4]);
            break;
        case "mac_app":
            hideClip();
            dialog
                .showOpenDialog({
                    defaultPath: "/Applications",
                })
                .then((x) => {
                    if (x.canceled) {
                        clipWindow?.show();
                        clipWindow?.setSimpleFullScreen(true);
                    }
                    event.sender.send("mac_app_path", x.canceled, x.filePaths);
                });
            break;
        case "record":
            createRecorderWindow(arg.rect, {
                id: arg.id,
                w: arg.w,
                h: arg.h,
                r: arg.ratio,
            });
            break;
        case "long_s":
            isLongStart = true;
            longWin();
            break;
        case "long_e":
            clipWindow?.setIgnoreMouseEvents(false);
            isLongStart = false;
            break;
        case "get_mouse":
            event.returnValue = screen.getCursorScreenPoint();
            break;
        case "translate":
            createTranslator(arg);
            break;
        case "ignore_mouse":
            clipWindow?.setIgnoreMouseEvents(arg);
            break;
        case "editor":
            createPhotoEditor(arg);
            break;
        case "recordx":
            createSuperRecorderWindow();
            break;
    }
});

/**
 * 获取图片
 * @param {?string} imgPath 路径
 */
function showPhoto(imgPath?: string) {
    if (imgPath) {
        console.log(imgPath);
        readFile(imgPath, (err, data) => {
            if (err) console.error(err);
            sendCaptureEvent(data);
        });
    } else {
        sendCaptureEvent();
    }
}

async function fullScreen() {
    const nearestScreen = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint(),
    );
    const win = await getClipWin();
    win.setBounds({
        x: nearestScreen.bounds.x,
        y: nearestScreen.bounds.y,
    });
    win.show();
    win.setSimpleFullScreen(true);
}

async function sendCaptureEvent(data?: Buffer, type?: 功能) {
    (await getClipWin())?.webContents.send(
        "reflash",
        screen.getAllDisplays(),
        data,
        screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id,
        type,
    );
}

/** 关闭或隐藏截屏 */
function exitFullScreen() {
    if (keepClip) {
        clipWindow?.setSimpleFullScreen(false);
        clipWindow?.hide();
        try {
            clipWindow?.reload();
        } catch {}
    } else {
        clipWindow?.close();
        clipWindow = null;
        clipWindowLoaded = false;
    }
}

/** 隐藏截屏窗口 */
function hideClip() {
    clipWindow?.setSimpleFullScreen(false);
    clipWindow?.hide();
}

/** 快速截屏 */
function quickClip() {
    const screenShots = initScreenShots(...screenShotArgs);
    for (const c of screenShots().screen) {
        const image: NativeImage = c.captureSync().image;
        if (store.get("快速截屏.模式") === "clip") {
            clipboard.writeImage(image);
        } else if (
            store.get("快速截屏.模式") === "path" &&
            store.get("快速截屏.路径")
        ) {
            const filename = checkFile(
                join(store.get("快速截屏.路径"), `${getFileName()}.png`),
            );
            if (!image) return;
            writeFileSync(filename, image.toPNG());
            noti(filename);
        }
    }
}
function checkFile(name: string, baseName = name, n = 1) {
    // 检查文件是否存在于当前目录中。
    if (existsSync(name)) {
        /* 存在文件，需要重命名 */
        const name = baseName.replace(/\.(\w+$)/, `(${n}).$1`);
        return checkFile(name, baseName, n + 1);
    }
    return name;
}

/** 连拍 */
function lianPai(d = store.get("连拍.间隔"), maxN = store.get("连拍.数")) {
    const basePath = store.get("快速截屏.路径");
    if (!basePath) return;
    const screenShots = initScreenShots(...screenShotArgs);
    const dirPath = checkFile(join(basePath, getFileName()));
    mkdirSync(dirPath, { recursive: true });
    for (let i = 0; i < maxN; i++) {
        setTimeout(() => {
            const image = screenShots()[0].captureSync().image;
            const buffer = image.toPNG();
            const filePath = join(dirPath, `${i}.png`);
            writeFile(filePath, buffer, () => {});
        }, d * maxN);
    }
}

function ocr(arg) {
    createMainWindow({ type: "ocr", content: arg[0], arg0: arg[1] });
}

function imageSearch(arg) {
    createMainWindow({ type: "image", content: arg[0], arg0: arg[1] });
}

let recording = false;
const recorderWinW = 264;
const recorderWinH = 24;

let recorder: BrowserWindow;
let recorderTipWin: BrowserWindow;
function createRecorderWindow(
    rect0: number[],
    screenx: { id: string; w: number; h: number; r: number },
) {
    const s = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const ratio = screenx.r;
    const p = {
        x: screen.getCursorScreenPoint().x,
        y: screen.getCursorScreenPoint().y,
    };
    const rect = rect0.map((v) => v / ratio);
    const sx = s.bounds.x;
    const sy = s.bounds.y;
    const sx1 = sx + s.bounds.width;
    const sy1 = sy + s.bounds.height;
    const hx = sx + rect[0] + rect[2] / 2;
    const hy = sy + rect[1] + rect[3] / 2;
    const w = recorderWinW;
    const h = recorderWinH;
    let x = p.x <= hx ? sx + rect[0] : sx + rect[0] + rect[2] - w;
    let y = p.y <= hy ? sy + rect[1] - h - 8 : sy + rect[1] + rect[3] + 8;
    x = Math.max(x, sx);
    x = Math.min(x, sx1 - w);
    y = Math.max(y, sy);
    y = Math.min(y, sy1 - h);
    x = Math.round(x);
    y = Math.round(y);
    recorder = new BrowserWindow({
        icon: theIcon,
        autoHideMenuBar: true,
        resizable: process.platform === "linux",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
        },
    });
    rendererPath(recorder, "recorder.html");
    if (dev) recorder.webContents.openDevTools();

    recorder.on("close", () => {
        store.set("录屏.大小.x", recorder.getBounds().x);
        store.set("录屏.大小.y", recorder.getBounds().y);
        try {
            recorderTipWin.close();
        } catch (error) {}
    });

    recorder.on("resize", () => {
        if (recorder.isResizable()) {
            store.set("录屏.大小.width", recorder.getBounds().width);
            store.set("录屏.大小.height", recorder.getBounds().height);
        }
    });

    recorder.webContents.on("did-finish-load", () => {
        desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
            let dId = sources.find((s) => s.display_id === screenx.id)?.id;
            if (!dId) dId = sources[0].id;
            recorder.webContents.send(
                "record",
                "init",
                dId,
                rect0,
                screenx.w,
                screenx.h,
            );
        });
    });

    globalShortcut.register("Super+R", () => {
        if (!recorder.isDestroyed()) {
            recorder.webContents.send("record", "start_stop");
        }
    });

    const border = 2;
    const rect1 = rect0.map((v) => Math.round(v / ratio));
    recorderTipWin = new BrowserWindow({
        x: rect1[0] - border,
        y: rect1[1] - border,
        width: rect1[2] + border * 2,
        height: rect1[3] + border * 2 + 24,
        transparent: true,
        frame: false,
        autoHideMenuBar: true,
        resizable: process.platform === "linux",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
        },
    });
    rendererPath(recorderTipWin, "recorderTip.html");
    if (dev) recorderTipWin.webContents.openDevTools();

    recorderTipWin.setAlwaysOnTop(true, "screen-saver");

    recorderTipWin.setIgnoreMouseEvents(true);

    const tipB = recorderTipWin.getBounds();

    function mouse() {
        if (recorderTipWin.isDestroyed()) return;
        if (!recording || recorder.isDestroyed()) {
            return;
        }
        const nowXY = screen.getCursorScreenPoint();
        recorderTipWin.webContents.send("record", "mouse", {
            x: nowXY.x - tipB.x,
            y: nowXY.y - tipB.y,
        });
        setTimeout(mouse, 10);
    }
    recording = true;
    if (store.get("录屏.提示.光标.开启")) mouse();
}

ipcMain.on("record", (_event, type, arg) => {
    switch (type) {
        case "stop":
            recorderTipWin.close();
            recording = false;

            break;
        case "start":
            recorder.minimize();
            break;
        case "time":
            recorderTipWin.webContents.send("record", "time", arg);
            break;
        case "ff": {
            // 处理视频
            const savedPath = store.get("保存.保存路径.视频") || "";
            dialog
                .showSaveDialog({
                    title: t("选择要保存的位置"),
                    defaultPath: join(
                        savedPath,
                        `${getFileName()}.${arg.格式}`,
                    ),
                    filters: [{ name: t("视频"), extensions: [] }],
                })
                .then(async (x) => {
                    if (x.filePath) {
                        let fpath = x.filePath;
                        if (!fpath.includes(".")) {
                            fpath += `.${arg.格式}`;
                        }
                        recorder.webContents.send("ff", "save_path", fpath);
                    } else {
                        new Notification({
                            title: `${app.name} ${t("保存视频失败")}`,
                            body: t("用户已取消保存"),
                            icon: `${runPath}/assets/logo/64x64.png`,
                        }).show();
                    }
                });
            break;
        }
        case "state":
            recorder.webContents.send("record", "state", arg);
            break;
        case "camera":
            switch (arg) {
                case 0:
                    // 摄像头
                    recorderTipWin.webContents.send("record", "camera", true);
                    break;
                case 1:
                    // 摄像头关
                    recorderTipWin.webContents.send("record", "camera", true);
                    break;
            }
            break;
        case "pause_time":
            break;
    }
});

function createSuperRecorderWindow() {
    const recorder = new BrowserWindow({
        icon: theIcon,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
        },
    });
    recorder.minimize();
    rendererPath(recorder, "videoEditor.html");
    if (dev) recorder.webContents.openDevTools();
    recorder.webContents.on("did-finish-load", () => {
        desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
            const dId = sources[0].id;
            recorder.webContents.send("record", "init", dId);
        });
    });
}

ipcMain.on("setting", async (event, arg, arg1) => {
    switch (arg) {
        case "save_err":
            console.log("保存设置失败");
            break;
        case "reload_main":
            if (
                clipWindow &&
                !clipWindow.isDestroyed() &&
                !clipWindow.isVisible()
            )
                clipWindow.reload();
            contextMenu.items[8].checked = store.get("浏览器中打开");
            tray.popUpContextMenu(contextMenu);
            tray.closeContextMenu();
            break;
        case "set_default_setting": {
            store.clear();
            setDefaultSetting();
            const dResolve = await dialog.showMessageBox({
                title: t("重启"),
                message: `${t("已恢复默认设置，部分设置需要重启$1生效").replace("$1", ` ${app.name} `)}`,
                buttons: [t("重启"), t("稍后")],
                defaultId: 0,
                cancelId: 1,
            });
            if (dResolve.response === 0) {
                app.relaunch();
                app.exit(0);
            }
            break;
        }
        case "reload":
            app.relaunch();
            app.exit(0);
            break;
        case "clear": {
            const ses = session.defaultSession;
            if (arg1 === "storage") {
                ses.clearStorageData()
                    .then(() => {
                        event.sender.send("setting", "storage", true);
                    })
                    .catch(() => {
                        event.sender.send("setting", "storage", false);
                    });
            } else {
                Promise.all([
                    ses.clearAuthCache(),
                    ses.clearCache(),
                    ses.clearCodeCaches({}),
                    ses.clearHostResolverCache(),
                ])
                    .then(() => {
                        event.sender.send("setting", "cache", true);
                    })
                    .catch(() => {
                        event.sender.send("setting", "cache", false);
                    });
            }
            break;
        }
        case "move_user_data": {
            if (!arg1) return;
            const toPath = resolve(arg1);
            const prePath = app.getPath("userData");
            mkdirSync(toPath, { recursive: true });
            if (process.platform === "win32") {
                exec(`xcopy ${prePath}\\** ${toPath} /Y /s`);
            } else {
                exec(`cp -r ${prePath}/** ${toPath}`);
            }
            break;
        }
        case "get_autostart": {
            if (process.platform === "linux") {
                exec(
                    "test -e ~/.config/autostart/e-search.desktop",
                    (error, _stdout, _stderr) => {
                        event.returnValue = !error;
                    },
                );
            } else {
                event.returnValue = app.getLoginItemSettings().openAtLogin;
            }
            break;
        }
        case "set_autostart": {
            if (process.platform === "linux") {
                if (arg1) {
                    exec("mkdir ~/.config/autostart");
                    exec(
                        `cp ${runPath}/assets/e-search.desktop ~/.config/autostart/`,
                    );
                } else {
                    exec("rm ~/.config/autostart/e-search.desktop");
                }
            } else {
                app.setLoginItemSettings({ openAtLogin: arg1 });
            }
            break;
        }
        case "theme":
            nativeTheme.themeSource = arg1;
            store.set("全局.深色模式", arg1);
            break;
        case "快捷键": {
            const [name, key] = arg1;
            try {
                try {
                    // @ts-ignore
                    globalShortcut.unregister(store.get(`快捷键.${name}.key`));
                } catch {}
                let ok = false;
                if (key) {
                    ok = globalShortcut.register(key, () => {
                        快捷键函数[arg1[0]]();
                    });
                }
                event.returnValue = key ? ok : true;
            } catch (error) {
                event.returnValue = false;
            }
            break;
        }
        case "快捷键2": {
            const [name, key] = arg1;
            try {
                try {
                    globalShortcut.unregister(
                        store.get(`全局工具快捷键.${name}`) as string,
                    );
                } catch {}
                let ok = true;
                if (key) {
                    ok = globalShortcut.register(key, () => {
                        sendCaptureEvent(undefined, name as 功能);
                    });
                }
                event.returnValue = ok;
            } catch (error) {
                event.returnValue = false;
            }
            break;
        }
        case "feedback":
            event.returnValue = feedbackUrl();
            break;
    }
});

// 长截屏

let isLongStart = false;

function longWin() {
    clipWindow?.setIgnoreMouseEvents(true);
    function mouse() {
        if (!isLongStart) {
            clipWindow?.setIgnoreMouseEvents(false);
            return;
        }
        if (!clipWindow) return;
        if (clipWindow.isDestroyed()) return;
        const nowXY = screen.getCursorScreenPoint();
        const tipB = clipWindow.getBounds();
        clipWindow.webContents.send("clip", "mouse", {
            x: nowXY.x - tipB.x,
            y: nowXY.y - tipB.y,
        });
        setTimeout(mouse, 10);
    }
    mouse();
}

// ding窗口
const dingwindowList: {
    [key: string]: { win: BrowserWindow; display: Electron.Display };
} = {};

function dingFromClipBoard() {
    const img = clipboard.readImage();
    if (img.getSize().height && img.getSize().width) {
        console.log("ding img");
        ding(img);
    }
}

function ding(img: NativeImage) {
    const nowPoint = screen.getCursorScreenPoint();
    const size = img.getSize();
    if (!size.width || !size.height) return;
    createDingWindow(
        nowPoint.x,
        nowPoint.y,
        size.width,
        size.height,
        img.toDataURL(),
    );
}

function createDingWindow(
    x: number,
    y: number,
    w: number,
    h: number,
    img: string,
    type: "translate" | "ding" = "ding",
) {
    if (Object.keys(dingwindowList).length === 0) {
        const screenL = screen.getAllDisplays();
        const id = new Date().getTime();
        for (const i of screenL) {
            const dingWindow = new BrowserWindow({
                icon: theIcon,
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
                },
                x: i.bounds.x,
                y: i.bounds.y,
                width: i.bounds.width,
                height: i.bounds.height,
            });
            dingwindowList[i.id] = { win: dingWindow, display: i };

            rendererPath(dingWindow, "ding.html");
            if (dev) dingWindow.webContents.openDevTools();
            dingWindow.webContents.on("did-finish-load", () => {
                dingWindow.webContents.send("screen_id", i.id);
                dingWindow.webContents.send(
                    "img",
                    id,
                    x - i.bounds.x,
                    y - i.bounds.y,
                    w,
                    h,
                    img,
                    type,
                );
            });
            dingWindow.setIgnoreMouseEvents(true);

            dingWindow.setAlwaysOnTop(true, "screen-saver");
        }
        forceDingThrogh();
    } else {
        const id = new Date().getTime();
        for (const i in dingwindowList) {
            const b = dingwindowList[i].win.getBounds();
            dingwindowList[i].win.webContents.send(
                "img",
                id,
                x - b.x,
                y - b.y,
                w,
                h,
                img,
            );
        }
    }
    // 自动改变鼠标穿透
    function dingClickThrough() {
        const nowXY = screen.getCursorScreenPoint();
        for (const i in dingwindowList) {
            try {
                const b = dingwindowList[i].win.getBounds();
                dingwindowList[i].win.webContents.send(
                    "mouse",
                    nowXY.x - b.x,
                    nowXY.y - b.y,
                );
            } catch (error) {}
        }
        setTimeout(dingClickThrough, 10);
    }
    dingClickThrough();
}
let dingThrogh: null | boolean = null;
ipcMain.on("ding_ignore", (_event, v) => {
    for (const id in dingwindowList) {
        if (dingwindowList[id]?.win.isDestroyed()) continue;
        dingwindowList[id]?.win?.setIgnoreMouseEvents(
            dingThrogh === null ? v : dingThrogh,
        );
    }
});

function forceDingThrogh() {
    if (store.get("贴图.强制鼠标穿透")) {
        globalShortcut.register(store.get("贴图.强制鼠标穿透"), () => {
            dingThrogh = !dingThrogh;
            for (const id in dingwindowList) {
                dingwindowList[id]?.win?.setIgnoreMouseEvents(dingThrogh);
            }
        });
    }
}

ipcMain.on("ding_event", (_event, type, id, more) => {
    if (type === "close" && more) {
        for (const i in dingwindowList) {
            dingwindowList[i].win.close();
            delete dingwindowList[i];
        }
        return;
    }

    if (type === "move_start") {
        const nowXY = screen.getCursorScreenPoint();

        for (const i in dingwindowList) {
            const display = dingwindowList[i].display;
            more.x = nowXY.x - display.bounds.x;
            more.y = nowXY.y - display.bounds.y;
            dingwindowList[i].win.webContents.send("ding", type, id, more);
        }
        return;
    }

    for (const i in dingwindowList) {
        dingwindowList[i].win.webContents.send("ding", type, id, more);
    }
});
ipcMain.on("ding_edit", (_event, img_path: Buffer<ArrayBufferLike>) => {
    sendCaptureEvent(img_path);
});

function createTranslator(op: translateWinType) {
    if (op.type === "ding") {
        createDingWindow(
            op.rect.x,
            op.rect.y,
            op.rect.w,
            op.rect.h,
            op.img,
            "translate",
        );
        return;
    }
    const win = new BrowserWindow({
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    const screenSize = (
        screen.getAllDisplays().find((i) => i.id === op.displayId) ||
        screen.getPrimaryDisplay()
    ).bounds;
    let x = Math.floor(op.dipRect.x);
    let y = Math.floor(op.dipRect.y);
    const w = Math.floor(op.dipRect.w);
    const h = Math.floor(op.dipRect.h);
    if (w > h) {
        const y1 = Math.max(0, op.dipRect.y - op.dipRect.h);
        const y2 = Math.min(
            screenSize.height - op.dipRect.h,
            op.dipRect.y + op.dipRect.h,
        );
        y =
            Math.abs(y1 - y) > Math.abs(y2 - y)
                ? Math.floor(y1)
                : Math.floor(y2);
    } else {
        const x1 = Math.max(0, op.dipRect.x - op.dipRect.w);
        const x2 = Math.min(
            screenSize.width - op.dipRect.w,
            op.dipRect.x + op.dipRect.w,
        );
        x =
            Math.abs(x1 - x) > Math.abs(x2 - x)
                ? Math.floor(x1)
                : Math.floor(x2);
    }
    win.setBounds({
        x: x,
        y: y,
        width: w,
        height: h,
    });

    rendererPath(win, "translator.html");
    if (dev) win.webContents.openDevTools();
    win.webContents.on("did-finish-load", () => {
        win.webContents.send(
            "init",
            op.displayId,
            screen.getAllDisplays(),
            op.rect,
        );
    });

    win.setAlwaysOnTop(true, "screen-saver");
}

function createPhotoEditor(img: string) {
    const win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    rendererPath(win, "photoEditor.html");
    if (dev) win.webContents.openDevTools();

    win.webContents.on("did-finish-load", () => {
        win.webContents.send("img", img);
    });
}

// 主页面
const mainWindowL: {
    [n: number]: {
        win: BrowserWindow;
        browser: { top: number; bottom: number };
    };
} = {};

const mainToSearchL: { [n: number]: Array<number> } = {};
async function createMainWindow(op: MainWinType) {
    if (store.get("主页面.复用") && Object.keys(mainWindowL).length > 0) {
        const name = Math.max(
            ...Object.keys(mainWindowL).map((i) => Number(i)),
        );
        const mainWindow = mainWindowL[name].win;
        op.time = new Date().getTime();
        mainWindow.webContents.send("text", name, op);
        mainWindow.focus();
        return name;
    }

    const windowName = new Date().getTime();
    const [w, h, m] = store.get("主页面大小");
    const vr = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint(),
    ).bounds;
    const px = screen.getCursorScreenPoint().x;
    const py = screen.getCursorScreenPoint().y;
    const x = px > vr.x + vr.width / 2 ? px - w : px;
    const y = py > vr.y + vr.height / 2 ? py - h : py;
    const bg = nativeTheme.shouldUseDarkColors
        ? store.get("全局.主题.dark.bg")
        : store.get("全局.主题.light.bg");
    const mainWindow = new BrowserWindow({
        x: Math.max(vr.x, x),
        y: Math.max(vr.y, y),
        width: w,
        height: h,
        minWidth: 400,
        backgroundColor: bg,
        icon: theIcon,
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: bg,
            symbolColor: nativeTheme.shouldUseDarkColors
                ? store.get("全局.主题.dark.fontColor")
                : store.get("全局.主题.light.fontColor"),
        },
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        },
        show: true,
    }) as BrowserWindow & { html: string };
    mainWindowL[windowName] = {
        browser: { top: 0, bottom: 48 },
        win: mainWindow,
    };

    mainToSearchL[windowName] = [];

    if (m) mainWindow.maximize();

    rendererPath(mainWindow, "editor.html");

    await mainWindow.webContents.session.setProxy(store.get("代理"));

    if (dev) mainWindow.webContents.openDevTools();

    op.time = windowName;

    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow.webContents.setZoomFactor(store.get("全局.缩放") || 1.0);
        // 确保切换到index时能传递window_name
        mainWindow.webContents.send("text", windowName, op);

        if (op.type === "image" && op.arg0 === "ai") {
            createBrowser(windowName, "./aiVision.html").then((c) => {
                c?.executeJavaScript(`setImg("${op.content}")`);
            });
        }

        if (mainWindow.html) {
            mainWindow.webContents.send("html", mainWindow.html);
        }
    });

    mainWindow.on("close", () => {
        store.set("主页面大小", [
            mainWindow.getNormalBounds().width,
            mainWindow.getNormalBounds().height,
            mainWindow.isMaximized(),
        ]);
        for (const i of mainWindow.contentView.children) {
            if (i instanceof WebContentsView) i.webContents.close();
        }
    });

    mainWindow.on("closed", () => {
        delete mainWindowL[windowName];
    });

    // 浏览器大小适应
    mainWindow.on("resize", () => {
        setTimeout(() => {
            for (const i of mainWindow.contentView.children) {
                if (i.getBounds().width !== 0)
                    setViewSize(i, mainWindow, mainWindowL[windowName].browser);
            }
        }, 0);
    });

    return windowName;
}

async function createSettingWindow(about?: boolean) {
    const settingWindow = new BrowserWindow({
        minWidth: 600,
        backgroundColor: nativeTheme.shouldUseDarkColors
            ? store.get("全局.主题.dark.bg")
            : store.get("全局.主题.light.bg"),
        icon: theIcon,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        },
        show: true,
    });

    rendererPath(
        settingWindow,
        store.get("新版设置") ? "new_setting.html" : "setting.html",
    );

    await settingWindow.webContents.session.setProxy(store.get("代理"));

    if (dev) settingWindow.webContents.openDevTools();

    settingWindow.webContents.on("did-finish-load", () => {
        settingWindow.webContents.setZoomFactor(store.get("全局.缩放") || 1.0);
        settingWindow.webContents.send("about", about);
    });
}

async function createHelpWindow() {
    shell.openExternal(
        `https://github.com/xushengfeng/eSearch/blob/${app.getVersion()}/docs/use/readme.md`,
    );
}

/**
 * 向聚焦的主页面发送事件信息
 * @param {String} m
 */
function mainEdit(window?: BrowserWindow, m?: string) {
    window?.webContents.send("edit", m);
}

const searchWindowL: { [n: number]: WebContentsView } = {};
ipcMain.on("open_url", (_event, window_name, url) => {
    createBrowser(window_name, url);
});

/** 创建浏览器页面 */
async function createBrowser(windowName: number, url: string) {
    console.log(url);

    if (!windowName)
        // biome-ignore lint: init window
        windowName = await createMainWindow({ type: "text", content: "" });

    const mainWindow = mainWindowL[windowName].win;

    if (mainWindow.isDestroyed()) return null;
    minViews(mainWindow);
    const view = new Date().getTime();
    let webPreferences: Electron.WebPreferences = {};
    if (url.startsWith("translate") || url === "./aiVision.html") {
        webPreferences = {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        };
    }
    const searchView = new WebContentsView({
        webPreferences,
    });
    searchWindowL[view] = searchView;
    await searchView.webContents.session.setProxy(store.get("代理"));
    mainWindow.contentView.addChildView(searchView);

    if (url.startsWith("translate")) {
        rendererPath2(searchView.webContents, "translate.html", {
            query: { text: url.replace("translate/?text=", "") },
        });
    } else if (url === "./aiVision.html") {
        rendererPath2(searchView.webContents, "aiVision.html", {});
    } else searchView.webContents.loadURL(url);
    const bSize = mainWindowL[windowName].browser;
    setViewSize(searchView, mainWindow, bSize);
    searchView.webContents.setWindowOpenHandler(({ url }) => {
        createBrowser(windowName, url);
        return { action: "deny" };
    });
    if (dev) searchView.webContents.openDevTools();
    if (!mainWindow.isDestroyed())
        mainWindow.webContents.send("url", view, "new", url);
    searchView.webContents.on("page-title-updated", (_event, title) => {
        if (!mainWindow.isDestroyed())
            mainWindow.webContents.send("url", view, "title", title);
    });
    searchView.webContents.on("page-favicon-updated", (_event, favlogo) => {
        if (!mainWindow.isDestroyed())
            mainWindow.webContents.send("url", view, "icon", favlogo);
    });
    searchView.webContents.on("did-navigate", (_event, url) => {
        if (!mainWindow.isDestroyed())
            mainWindow.webContents.send("url", view, "url", url);
    });
    searchView.webContents.on("did-start-loading", () => {
        if (!mainWindow.isDestroyed())
            mainWindow.webContents.send("url", view, "load", true);
    });
    searchView.webContents.on("did-stop-loading", () => {
        if (!mainWindow.isDestroyed())
            mainWindow.webContents.send("url", view, "load", false);
    });
    searchView.webContents.on("did-fail-load", (_event, err_code, err_des) => {
        rendererPath2(searchView.webContents, "browser_bg.html", {
            query: {
                type: "did-fail-load",
                err_code: String(err_code),
                err_des,
            },
        });
        if (dev) searchView.webContents.openDevTools();
    });
    searchView.webContents.on("render-process-gone", () => {
        rendererPath2(searchView.webContents, "browser_bg.html", {
            query: { type: "render-process-gone" },
        });
        if (dev) searchView.webContents.openDevTools();
    });
    searchView.webContents.on("unresponsive", () => {
        rendererPath2(searchView.webContents, "browser_bg.html", {
            query: { type: "unresponsive" },
        });
        if (dev) searchView.webContents.openDevTools();
    });
    searchView.webContents.on("responsive", () => {
        searchView.webContents.loadURL(url);
    });
    searchView.webContents.on("certificate-error", () => {
        rendererPath2(searchView.webContents, "browser_bg.html", {
            query: { type: "certificate-error" },
        });
        if (dev) searchView.webContents.openDevTools();
    });
    return new Promise((resolve: (x: Electron.WebContents) => void) => {
        searchView.webContents.on("did-finish-load", () => {
            resolve(searchView.webContents);
        });
    });
}
/**
 * 标签页事件
 * @param {BrowserWindow} w 浏览器
 * @param {String} arg 事件字符
 */
function viewEvents(w?: BrowserWindow, arg?: string) {
    w?.webContents.send("view_events", arg);
}

ipcMain.on("tab_view", (e, id, arg, arg2) => {
    const mainWindow = BrowserWindow.fromWebContents(e.sender);
    const searchWindow = searchWindowL[id];
    if (!mainWindow) return;
    switch (arg) {
        case "close":
            mainWindow.contentView.removeChildView(searchWindow);
            searchWindow.webContents.close();
            delete searchWindowL[id];
            break;
        case "top": {
            // 有时直接把主页面当成浏览器打开，这时pid未初始化就触发top了，直接忽略
            if (!mainWindow) return;
            minViews(mainWindow);
            searchWindow.setVisible(true);
            break;
        }
        case "back":
            searchWindow.webContents.goBack();
            break;
        case "forward":
            searchWindow.webContents.goForward();
            break;
        case "stop":
            searchWindow.webContents.stop();
            break;
        case "reload":
            searchWindow.webContents.reload();
            break;
        case "home":
            minViews(mainWindow);
            break;
        case "save_html":
            // @ts-ignore
            mainWindow.html = arg2;
            minViews(mainWindow);
            break;
        case "dev":
            searchWindow.webContents.openDevTools();
            break;
        case "size": {
            const bSize = Object.values(mainWindowL).find(
                (i) => i.win === mainWindow,
            )?.browser;
            if (!bSize) break;
            bSize.bottom = arg2.bottom;
            bSize.top = arg2.top;
            for (const w of mainWindow.contentView.children) {
                if (w.getBounds().width !== 0)
                    setViewSize(w, mainWindow, bSize);
            }
            break;
        }
    }
});

function setViewSize(
    w: View,
    window: BrowserWindow,
    size: (typeof mainWindowL)[0]["browser"],
) {
    w.setBounds({
        x: 0,
        y: size.top,
        width: window.getBounds().width,
        height: window.getBounds().height - size.bottom - size.top,
    });
}

/** 最小化某个窗口的所有标签页 */
function minViews(mainWindow?: BrowserWindow) {
    if (!mainWindow) return;
    for (const v of mainWindow.contentView.children) {
        v.setVisible(false);
    }
}

/** 生成一个文件名 */
function getFileName() {
    const saveNameTime = time_format(
        store.get("保存名称.时间"),
        new Date(),
    ).replace("\\", "");
    const fileName =
        store.get("保存名称.前缀") + saveNameTime + store.get("保存名称.后缀");
    return fileName;
}

/** 提示保存成功 */
function noti(filePath: string) {
    const notification = new Notification({
        title: `${app.name} ${t("保存文件成功")}`,
        body: `${t("已保存文件到")} ${filePath}`,
        icon: `${runPath}/assets/logo/64x64.png`,
    });
    notification.on("click", () => {
        shell.showItemInFolder(filePath);
    });
    notification.show();
}

ipcMain.on("window", (event, type: string, v) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (type === "close") {
        win.close();
    }
    if (type === "ignore") {
        win.setIgnoreMouseEvents(v);
    }
    if (type === "top") {
        win.setAlwaysOnTop(v);
    }
    if (type === "show") {
        win.show();
    }
    if (type === "max") {
        win.maximize();
    }
});

ipcMain.on("get_save_file_path", (event, arg: string, isVideo: boolean) => {
    const savedPath = isVideo
        ? store.get("保存.保存路径.视频") || ""
        : store.get("保存.保存路径.图片") || "";
    const defaultPath = join(savedPath, `${getFileName()}.${arg}`);
    if (store.get("保存.快速保存") && savedPath) {
        event.returnValue = defaultPath;
        return;
    }
    dialog
        .showSaveDialog({
            title: t("选择要保存的位置"),
            defaultPath: defaultPath,
            filters: [
                { name: isVideo ? t("视频") : t("图像"), extensions: [arg] },
            ],
        })
        .then((x) => {
            event.returnValue = x.filePath;
        });
});

ipcMain.on("ok_save", (_event, arg: string, isVideo: boolean) => {
    noti(arg);
    if (isVideo) {
        store.set("保存.保存路径.视频", dirname(arg));
    } else {
        store.set("保存.保存路径.图片", dirname(arg));
    }
});

ipcMain.on("get_save_path", (event, path = app.getPath("pictures")) => {
    dialog
        .showOpenDialog({
            title: t("选择要保存的位置"),
            defaultPath: path,
            properties: ["openDirectory"],
        })
        .then((x) => {
            if (x.filePaths[0]) event.returnValue = x.filePaths[0];
        });
});

ipcMain.on("app", (e, type, arg) => {
    if (type === "systemLan") {
        e.returnValue = matchBestLan();
    }
    if (type === "feedback") {
        e.returnValue = feedbackUrl(arg);
    }
});

// 默认设置
const defaultSetting: setting = {
    首次运行: false,
    设置版本: app.getVersion(),
    启动提示: true,
    dev: false,
    新版设置: Math.random() <= 0.2,
    保留截屏窗口: true,
    语言: {},
    快捷键: {
        自动识别: {
            key: "Alt+V",
        },
        截屏搜索: {
            key: "Alt+C",
        },
        选中搜索: {},
        剪贴板搜索: {},
        快速截屏: {},
        连拍: { key: "" },
        主页面: {},
        结束广截屏: { key: "" },
        剪贴板贴图: { key: "" },
    },
    点击托盘自动截图: process.platform !== "linux",
    全局工具快捷键: {
        close: "",
        ocr: "",
        search: "",
        QR: "",
        open: "",
        ding: "",
        record: "",
        long: "",
        copy: "",
        save: "",
        screens: "",
        translate: "",
        editor: "",
    },
    工具快捷键: {
        close: "Escape",
        ocr: "Enter",
        search: "",
        QR: "",
        open: "",
        ding: "",
        record: "",
        long: "",
        copy: isMac ? "Command+C" : "Control+C",
        save: isMac ? "Command+S" : "Control+S",
        screens: "",
        translate: "",
        editor: "",
    },
    截屏编辑快捷键: {
        select: { 键: "1", 副: { rect: "1+2", free: "1+3", draw: "1+4" } },
        draw: { 键: "2", 副: { free: "2+3", eraser: "2+4", spray: "2+5" } },
        shape: {
            键: "3",
            副: {
                line: "3+4",
                circle: "3+5",
                rect: "3+6",
                polyline: "5",
                polygon: "6",
                text: "7",
                number: "8",
                arrow: "9",
                mask: "3+e",
            },
        },
        filter: {
            键: "4",
            副: {
                pixelate: "4+5",
                blur: "4+6",
                brightness: "",
                contrast: "",
                saturation: "",
                hue: "",
                noise: "",
                invert: "",
                sepia: "",
                bw: "",
                brownie: "",
                vintage: "",
                koda: "",
                techni: "",
                polaroid: "",
                gray_average: "",
                gray_lightness: "",
                gray_luminosity: "",
                gamma: "",
            },
        },
    },
    大小栏快捷键: {
        左上x: "",
        左上y: "",
        右下x: "",
        右下y: "",
        宽: "",
        高: "",
    },
    主页面快捷键: {
        搜索: "Ctrl+Shift+S",
        翻译: "Ctrl+Shift+T",
        打开链接: "Ctrl+Shift+L",
        删除换行: "Ctrl+Enter",
        图片区: "Ctrl+P",
        关闭: "Ctrl+W",
    },
    其他快捷键: {
        复制颜色: "K",
        隐藏或显示栏: "",
    },
    主搜索功能: {
        自动搜索排除: [],
        剪贴板选区搜索: true,
        截屏搜索延迟: 0,
    },
    全局: {
        模糊: 25,
        缩放: 1,
        不透明度: 0.4,
        深色模式: "system",
        主题: {
            light: {
                barbg: "#FFFFFF",
                bg: "#FFFFFF",
                emphasis: "#dfdfdf",
                fontColor: "#000",
                iconColor: "none",
            },
            dark: {
                barbg: "#000000",
                bg: "#000000",
                emphasis: "#333",
                fontColor: "#fff",
                iconColor: "invert(1)",
            },
        },
    },
    工具栏: {
        按钮大小: 48,
        按钮图标比例: 0.7,
        初始位置: { left: "10px", top: "100px" },
        功能: [
            "close",
            "screens",
            "ocr",
            "search",
            "QR",
            "open",
            "ding",
            "record",
            "long",
            "translate",
            "editor",
            "copy",
            "save",
        ],
        稍后出现: false,
    },
    字体: {
        主要字体: "",
        等宽字体: "",
        记住: false,
        大小: 16,
    },
    编辑器: {
        自动换行: true,
        拼写检查: true,
        行号: true,
        工具: [],
    },
    工具栏跟随: "展示内容优先",
    自动搜索: true,
    鼠标跟随栏: {
        显示: true,
    },
    取色器: { 像素大小: 10, 大小: 15, 显示: true, 默认格式: "HEX" },
    显示四角坐标: true,
    框选: {
        自动框选: {
            图像识别: false,
            最小阈值: 50,
            最大阈值: 150,
        },
        记忆: { 开启: false, rects: {} },
        颜色: {
            遮罩: "#0008",
            光标参考线: "#00f",
            选区参考线: "#1115",
        },
        参考线: {
            光标: false,
            选区: { x: [], y: [] },
        },
    },
    图像编辑: {
        默认属性: {
            填充颜色: "#fff",
            边框颜色: "#333",
            边框宽度: 1,
            画笔颜色: "#333",
            画笔粗细: 2,
        },
        复制偏移: {
            x: 10,
            y: 10,
        },
        形状属性: {
            arrow: { sw: 3 },
            mask: { fc: "#0005" },
        },
        记忆: {
            select: "rect",
            draw: "free",
            shape: "rect",
            filter: "pixelate",
        },
        arrow: {
            type: "stroke",
            w: 10,
            h: 16,
        },
        收藏: {
            color: [],
            形状: [],
        },
    },
    OCR: {
        类型: "默认",
        离线切换: true,
        记住: false,
        识别段落: true,
    },
    离线OCR: [
        [
            "默认",
            "默认/ppocr_det.onnx",
            "默认/ppocr_rec.onnx",
            "默认/ppocr_keys_v1.txt",
        ],
    ],
    AI: {
        运行后端: "cpu",
        在线模型: [],
    },
    在线OCR: {
        baidu: {
            url: "",
            id: "",
            secret: "",
            time: 0,
            token: "",
        },
        youdao: {
            id: "",
            secret: "",
        },
    },
    以图搜图: {
        引擎: "baidu",
        记住: false,
    },
    自动打开链接: false,
    自动搜索中文占比: 0.2,
    浏览器中打开: false,
    浏览器: {
        标签页: {
            自动关闭: true,
            小: false,
            灰度: false,
        },
    },
    保存: {
        默认格式: "png",
        保存路径: { 图片: "", 视频: "" },
        快速保存: false,
        保存并复制: false,
    },
    保存名称: { 前缀: "eSearch-", 时间: "YYYY-MM-DD-HH-mm-ss-S", 后缀: "" },
    框选后默认操作: "no",
    快速截屏: { 模式: "clip", 路径: "" },
    引擎: {
        记忆: {
            搜索: "必应",
            翻译: "Deepl",
        },
        搜索: [
            { name: "必应", url: "https://cn.bing.com/search?q=%s" },
            { name: "Google", url: "https://www.google.com/search?q=%s" },
            { name: "百度", url: "https://www.baidu.com/s?wd=%s" },
            { name: "Yandex", url: "https://yandex.com/search/?text=%s" },
        ],
        翻译: [
            {
                name: "Google",
                url: "https://translate.google.com.hk/?op=translate&text=%s",
            },
            {
                name: "Deepl",
                url: "https://www.deepl.com/translator#any/any/%s",
            },
            { name: "金山词霸", url: "http://www.iciba.com/word?w=%s" },
            { name: "百度", url: "https://fanyi.baidu.com/#auto/auto/%s" },
            { name: "腾讯", url: "https://fanyi.qq.com/?text=%s" },
            { name: "翻译", url: "translate/?text=%s" },
        ],
    },
    历史记录设置: {
        保留历史记录: true,
        自动清除历史记录: false,
        d: 14,
        h: 0,
    },
    ding_dock: [0, 0],
    贴图: {
        窗口: {
            变换: ["transform: rotateY(180deg);"],
            双击: "归位",
            提示: false,
        },
        强制鼠标穿透: "",
    },
    代理: {
        mode: "direct",
        pacScript: "",
        proxyRules: "",
        proxyBypassRules: "",
    },
    主页面: {
        模式: "auto",
        复用: true,
        失焦关闭: false,
        简洁模式: false,
        高级窗口按钮: true,
        显示图片区: 10,
        自动复制OCR: false,
    },
    主页面大小: [800, 600, false],
    时间格式: "MM/DD hh:mm:ss",
    硬件加速: true,
    更新: {
        检查更新: true,
        频率: "start",
        模式: "小版本",
        忽略版本: "",
    },
    录屏: {
        模式: "normal",
        自动录制: true,
        自动录制延时: 3,
        视频比特率: 2.5,
        摄像头: {
            默认开启: false,
            记住开启状态: false,
            镜像: false,
            设备: "",
            背景: {
                模式: "none",
                模糊: 40,
                imgUrl: "",
                videoUrl: "",
                fit: "cover",
            },
        },
        音频: {
            默认开启: false,
            记住开启状态: false,
            设备: "",
        },
        转换: {
            自动转换: false,
            格式: "webm",
            码率: 2.5,
            帧率: 30,
            其他: "",
            高质量gif: false,
            分段: 10,
        },
        提示: {
            键盘: {
                开启: false,
                位置: { x: "+", y: "+", offsetX: 4, offsetY: 4 },
                大小: 1,
            },
            鼠标: {
                开启: false,
            },
            光标: {
                开启: false,
                样式: "width: 24px;\nheight: 24px;\nborder-radius: 50%;\nbackground-color: #ff08;",
            },
        },
        大小: {
            x: 0,
            y: 0,
            width: 800,
            height: 600,
        },
        超级录屏: {
            编码选择: "性能优先",
            关键帧间隔: 150,
            格式: "gif",
            缩放: 2,
            自动停止录制: 5,
            导出后关闭: false,
        },
    },
    屏幕翻译: {
        type: "ding",
        dTime: 3000,
        css: { bg: "", text: "" },
        语言: {
            from: "",
            to: "",
        },
    },
    翻译: {
        翻译器: [],
        收藏: {
            fetch: [],
            文件: [],
        },
        常用语言: [],
    },
    额外截屏器: { 命令: "", 位置: "" },
    连拍: {
        数: 5,
        间隔: 100,
    },
    广截屏: {
        模式: "自动",
        t: 800,
        方向: "y",
    },
    高级图片编辑: { 配置: [], 默认配置: "" },
};
try {
    defaultSetting.保存.保存路径.图片 = app.getPath("pictures");
    defaultSetting.保存.保存路径.视频 = app.getPath("videos");
} catch (e) {
    console.error(e);
}

function matchBestLan() {
    const supportLan = getLans();
    const l = matchFitLan(app.getLocale(), supportLan);
    if (l) return l;
    return "zh-HANS";
}

function setDefaultSetting() {
    for (const i in defaultSetting) {
        if (i === "语言") {
            const language = matchBestLan();
            store.set(i, { 语言: language });
        } else {
            store.set(i, defaultSetting[i]);
        }
    }
}

// 增加设置项后，防止undefined
function fixSettingTree() {
    if (store.get("设置版本") === app.getVersion() && !dev) return;
    walk([]);
    function walk(path: string[]) {
        const x = path.reduce((o, i) => o[i], defaultSetting);
        for (const i in x) {
            const cPath = path.concat([i]); // push
            if (x[i].constructor === Object) {
                walk(cPath);
            } else {
                const nPath = cPath.join(".");
                if (store.get(nPath) === undefined) store.set(nPath, x[i]);
            }
        }
    }
    versionTrans();
    store.set("设置版本", app.getVersion());
}

function versionTrans() {
    const version = store.get("设置版本");
    if (versionCompare(version, "14.1.0") <= 0) {
        const oldSetting = store.get("贴图.窗口.变换");
        if (typeof oldSetting === "string") {
            store.set("贴图.窗口.变换", [oldSetting]);
        }
    }
}

function versionCompare(v1: string, v2: string) {
    const v1Arr = v1.split(".");
    const v2Arr = v2.split(".");
    for (let i = 0; i < v1Arr.length; i++) {
        if (v1Arr[i] > v2Arr[i]) {
            return 1;
        }
        if (v1Arr[i] < v2Arr[i]) {
            return -1;
        }
    }
    return 0;
}

function checkUpdate(s手动检查?: boolean) {
    const version = store.get("设置版本");
    const m = store.get("更新.模式");
    fetch("https://api.github.com/repos/xushengfeng/eSearch/releases")
        .then((v) => v.json())
        .then((re) => {
            const isDev =
                version.includes("beta") ||
                version.includes("alpha") ||
                m === "dev";
            const first = re.find((r) =>
                isDev ? true : !r.draft && !r.prerelease,
            );
            let update = false;
            const firstName = first.name;
            if (m === "dev") {
                if (firstName !== version) update = true;
            } else if (m === "小版本" || s手动检查) {
                if (
                    firstName.split(".").slice(0, 2).join(".") !==
                    version.split(".").slice(0, 2).join(".")
                )
                    update = true;
            } else {
                if (firstName.split(".").at(0) !== version.split(".").at(0))
                    update = true;
            }
            if (store.get("更新.忽略版本") !== firstName)
                if (update) {
                    showVersion({
                        v: first.name,
                        url: first.html_url,
                    });
                } else if (s手动检查) {
                    showVersion();
                }
        })
        .catch(() => {
            if (s手动检查) showVersion("err");
        });
}

function showVersion(arg?: { v: string; url: string } | "err") {
    let title = "";
    let b = "";
    let url = "https://github.com/xushengfeng/eSearch/releases";
    if (arg) {
        if (arg === "err") {
            title = t("无法检查更新");
            b = t("请检查网络，稍后重试");
        } else {
            title = `${app.name} ${t("有新版本：")}${arg.v}`;
            b = `${t("点击下载")}`;
            url = arg.url;
        }
    } else {
        title = t("已是最新版本");
    }
    const notification = new Notification({
        title,
        body: b,
        icon: `${runPath}/assets/logo/64x64.png`,
    });
    notification.on("click", () => {
        shell.openExternal(url);
    });
    notification.show();
}

if (store.get("更新.频率") === "start") checkUpdate();

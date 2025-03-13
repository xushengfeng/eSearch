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
    type BaseWindow,
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
    EditToolsType,
} from "../ShareTypes";
import { join, resolve, dirname } from "node:path";
import { exec, execSync } from "node:child_process";
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
import main, { matchFitLan } from "xtranslator";
import time_format from "../../lib/time_format";
import url from "node:url";
import { mainOn, mainOnReflect, mainSend } from "../../lib/ipc";

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

const store = new Store();

ipcMain.on("store", (e, x) => {
    if (x.type === "get") {
        e.returnValue = store.get(x.path);
    } else if (x.type === "set") {
        store.set(x.path, x.value);
    } else if (x.type === "path") {
        e.returnValue = app.getPath("userData");
    } else if (x.type === "getAll") {
        e.returnValue = store.getAll();
    } else if (x.type === "setAll") {
        store.setAll(x.value);
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

    const ocrE = store
        .get("离线OCR")
        .map((i) => i[0])
        .concat(["baidu", "youdao"]);
    const searchE = ["baidu, yandex, google"];

    function getEngine(e: string, list: string[], df: string) {
        if (!list.includes(e)) {
            console.log(`${e} ∉ ${list.join(", ")}`);
        }
        return e || df;
    }

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
            [["h", "help"], 0, t("帮助")],
            ["config", 0, t("打开配置")],
            "",
            [["i", "input"], 0, t("输入图片，如果空，则截屏")],
            ["delay", 0, t("延时截屏")],
            "",
            `[${t("动作")}] [i] [more]`,
            t("动作"),
            [["s", "save"], 0, t("保存到路径或剪贴板")],
            [["p", "path"], 1, t("保存的路径")],
            ["n", 1, t("连拍数")],
            ["dt", 1, t("连拍间隔（ms）")],
            ["clipborad", 1, t("保存到剪贴板")],
            [["o", "ocr"], 0, t("文字识别")],
            ["engine", 1, ocrE.join(", ")],
            ["[mode]", 1, ""],
            [["m", "img"], 0, t("以图搜图")],
            ["engine", 1, searchE.join(", ")],
            ["[mode]", 1, ""],
            [["d", "ding"], 0, t("贴图")],
            [["t", "text"], 0, t("主页面打开文字")],
            ["[mode]", 1, ""],
            "",
            t("文字处理模式，不设置则自动判断"),
            ["trans", 0, t("翻译")],
            ["search", 0, t("搜索")],
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
                    return `${i[0]}${" ".repeat(maxWidth - i[0].length)}${i[1]}`;
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
            arg0: getEngine(e, ocrE, store.get("OCR.类型")),
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
            arg0: getEngine(e, searchE, store.get("以图搜图.引擎")),
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
        mainSend(clipWindow?.webContents, "clip_stop_long", []);
    },
    剪贴板贴图: () => dingFromClipBoard(),
    主页面: () => createMainWindow({ type: "text", content: "" }),
};

let contextMenu: Electron.Menu | null = null;
let tray: Tray | null = null;
const trayIcons: Record<string, NativeImage> = {
    macTem: nativeImage.createFromPath(
        `${runPath}/assets/logo/macIconTemplate.png`,
    ),
    color: nativeImage.createFromPath(`${runPath}/assets/logo/32x32.png`),
    white: nativeImage.createFromPath(`${runPath}/assets/logo/32x32_white.png`),
    black: nativeImage.createFromPath(`${runPath}/assets/logo/32x32_black.png`),
};

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

    if (store.get("托盘") !== "无") {
        // 托盘
        tray = new Tray(`${runPath}/assets/logo/32x32.png`);
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
                label: t("文字识别（OCR）"),
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
        tray?.setToolTip(app.getName());
        if (store.get("点击托盘自动截图")) {
            tray?.on("click", () => {
                showPhoto();
            });
            tray?.on("right-click", () => {
                if (contextMenu) tray?.popUpContextMenu(contextMenu);
            });
        } else {
            if (contextMenu) tray?.setContextMenu(contextMenu);
        }
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

    setTray();
});

function setTray() {
    if (!tray) return;
    const i = store.get("托盘");
    if (i === "彩色") {
        tray.setImage(trayIcons.color);
    }
    if (i === "白") {
        tray.setImage(trayIcons.white);
    }
    if (i === "黑") {
        tray.setImage(trayIcons.black);
    }
    if (i === "跟随系统" || i === "跟随系统反") {
        if (isMac) tray.setImage(trayIcons.macTem);
    }
    if (i === "跟随系统") {
        if (nativeTheme.shouldUseDarkColors) {
            tray.setImage(trayIcons.black);
        } else {
            tray.setImage(trayIcons.white);
        }
    }
    if (i === "跟随系统反") {
        if (nativeTheme.shouldUseDarkColors) {
            tray.setImage(trayIcons.white);
        } else {
            tray.setImage(trayIcons.black);
        }
    }
}

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
                        if (w instanceof BrowserWindow) w.webContents.undo();
                    },
                    accelerator: "CmdOrCtrl+Z",
                },
                {
                    label: t("重做"),
                    click: (_i, w) => {
                        mainEdit(w, "redo");
                        if (w instanceof BrowserWindow) w.webContents.redo();
                    },
                    accelerator: isMac ? "Cmd+Shift+Z" : "Ctrl+Y",
                },
                { type: "separator" },
                {
                    label: t("剪切"),
                    click: (_i, w) => {
                        mainEdit(w, "cut");
                        if (w instanceof BrowserWindow) w.webContents.cut();
                    },
                    accelerator: "CmdOrCtrl+X",
                },
                {
                    label: t("复制"),
                    click: (_i, w) => {
                        mainEdit(w, "copy");
                        if (w instanceof BrowserWindow) w.webContents.copy();
                    },
                    accelerator: "CmdOrCtrl+C",
                },
                {
                    label: t("粘贴"),
                    click: (_i, w) => {
                        mainEdit(w, "paste");
                        if (w instanceof BrowserWindow) w.webContents.paste();
                    },
                    accelerator: "CmdOrCtrl+V",
                },
                {
                    label: t("删除"),
                    click: (_i, w) => {
                        mainEdit(w, "delete");
                        if (w instanceof BrowserWindow) w.webContents.delete();
                    },
                },
                {
                    label: t("全选"),
                    click: (_i, w) => {
                        mainEdit(w, "select_all");
                        if (w instanceof BrowserWindow)
                            w.webContents.selectAll();
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

function feedbackUrl2(op?: {
    title?: string;
    main?: string;
}) {
    const url = new URL(
        "https://github.com/xushengfeng/eSearch/issues/new?template=feature_request.yaml&labels=新需求",
    );
    if (op?.title) url.searchParams.append("title", op.title);
    url.searchParams.append("main", op?.main || "");
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

mainOn("dialogMessage", ([arg0]) => {
    const id = dialog.showMessageBoxSync(arg0);
    return id;
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

mainOn("clip_show", () => {
    fullScreen();
});
mainOn("clip_close", () => {
    exitFullScreen();
    isLongStart = false;
});
mainOn("clip_ocr", ([img, type]) => {
    createMainWindow({ type: "ocr", content: img, arg0: type });
});
mainOn("clip_search", ([img, type]) => {
    createMainWindow({ type: "image", content: img, arg0: type });
});
mainOn("clip_qr", ([img]) => {
    createMainWindow({ type: "qr", content: img });
});
mainOn("clip_save", async ([type]) => {
    const savedPath = store.get("保存.保存路径.图片") || "";
    hideClip();
    const x = await dialog.showSaveDialog({
        title: t("选择要保存的位置"),
        defaultPath: join(savedPath, `${getFileName()}.${type}`),
        filters: [{ name: t("图像"), extensions: [type] }],
    });

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
    return x.filePath;
});
mainOn("clip_ding", ([img, type, rect]) => {
    createDingWindow(rect.x, rect.y, rect.w, rect.h, img, type);
});
mainOn("clip_mac_app", async () => {
    hideClip();
    const x = await dialog.showOpenDialog({
        defaultPath: "/Applications",
    });
    if (x.canceled) {
        clipWindow?.show();
        clipWindow?.setSimpleFullScreen(true);
    }
    return { canceled: x.canceled, filePaths: x.filePaths };
});
mainOn("clip_record", ([rect, id, w, h, r]) => {
    createRecorderWindow(rect, {
        id: id,
        w: w,
        h: h,
        r: r,
    });
});
mainOn("clip_long_s", () => {
    isLongStart = true;
    longWin();
});
mainOn("clip_long_e", () => {
    clipWindow?.setIgnoreMouseEvents(false);
    isLongStart = false;
});
mainOn("getMousePos", () => {
    return screen.getCursorScreenPoint();
});
mainOn("clip_translate", ([arg]) => {
    createTranslator(arg);
});
mainOn("clip_editor", ([arg]) => {
    createPhotoEditor(arg);
});
mainOn("clip_recordx", () => {
    createSuperRecorderWindow();
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
    mainSend((await getClipWin())?.webContents, "clip_init", [
        screen.getAllDisplays(),
        data,
        screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id,
        type,
    ]);
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

let recording = false;
const recorderWinW = 264;
const recorderWinH = 24;

let recorder: BrowserWindow;
let recorderTipWin: BrowserWindow;
function createRecorderWindow(
    rect0: [number, number, number, number],
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
            mainSend(recorder.webContents, "recordInit", [
                dId,
                rect0,
                screenx.w,
                screenx.h,
            ]);
        });
    });

    globalShortcut.register("Super+R", () => {
        if (!recorder.isDestroyed()) {
            mainSend(recorder.webContents, "recordStartStop", []);
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
        mainSend(recorderTipWin.webContents, "recordMouse", [
            nowXY.x - tipB.x,
            nowXY.y - tipB.y,
        ]);
        setTimeout(mouse, 10);
    }
    recording = true;
    if (store.get("录屏.提示.光标.开启")) mouse();
}

mainOn("recordStop", () => {
    recorderTipWin.close();
    recording = false;
});
mainOn("recordStart", () => {
    recorder.minimize();
});
mainOnReflect("recordTime", () => {
    return [recorderTipWin.webContents];
});
mainOnReflect("recordCamera", () => {
    return [recorderTipWin.webContents];
});
mainOnReflect("recordState", () => {
    return [recorder.webContents];
});
mainOn("recordSavePath", ([ext]) => {
    const savedPath = store.get("保存.保存路径.视频") || "";
    dialog
        .showSaveDialog({
            title: t("选择要保存的位置"),
            defaultPath: join(savedPath, `${getFileName()}.${ext}`),
            filters: [{ name: t("视频"), extensions: [] }],
        })
        .then(async (x) => {
            if (x.filePath) {
                let fpath = x.filePath;
                if (!fpath.includes(".")) {
                    fpath += `.${ext}`;
                }
                mainSend(recorder.webContents, "recordSavePathReturn", [fpath]);
            } else {
                new Notification({
                    title: `${app.name} ${t("保存视频失败")}`,
                    body: t("用户已取消保存"),
                    icon: `${runPath}/assets/logo/64x64.png`,
                }).show();
            }
        });
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
            mainSend(recorder.webContents, "superRecorderInit", [dId]);
        });
    });
}
mainOn("reloadMainFromSetting", () => {
    if (clipWindow && !clipWindow.isDestroyed() && !clipWindow.isVisible())
        clipWindow.reload();
    if (contextMenu && tray) {
        contextMenu.items[8].checked = store.get("浏览器中打开");
        tray.popUpContextMenu(contextMenu);
        tray.closeContextMenu();
    }
});
mainOn("set_default_setting", async () => {
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
});
mainOn("reload", () => {
    app.relaunch();
    app.exit(0);
});
mainOn("exit", () => {
    app.exit(0);
});
mainOn("clearStorage", () => {
    const ses = session.defaultSession;
    ses.clearStorageData();
});
mainOn("clearCache", () => {
    const ses = session.defaultSession;
    Promise.all([
        ses.clearAuthCache(),
        ses.clearCache(),
        ses.clearCodeCaches({}),
        ses.clearHostResolverCache(),
    ]);
});
mainOn("move_user_data", ([target]) => {
    if (!target) return;
    const toPath = resolve(target);
    const prePath = app.getPath("userData");
    mkdirSync(toPath, { recursive: true });
    if (process.platform === "win32") {
        execSync(`xcopy ${prePath}\\** ${toPath} /Y /s`);
    } else {
        execSync(`cp -r ${prePath}/** ${toPath}`);
    }
});
mainOn("getAutoStart", () => {
    if (process.platform === "linux") {
        try {
            execSync("test -e ~/.config/autostart/e-search.desktop");
            return true;
        } catch (error) {
            return false;
        }
    }
    return app.getLoginItemSettings().openAtLogin;
});
mainOn("setAutoStart", ([arg1]) => {
    if (process.platform === "linux") {
        if (arg1) {
            exec("mkdir ~/.config/autostart");
            exec(`cp ${runPath}/assets/e-search.desktop ~/.config/autostart/`);
        } else {
            exec("rm ~/.config/autostart/e-search.desktop");
        }
    } else {
        app.setLoginItemSettings({ openAtLogin: arg1 });
    }
});
mainOn("theme", ([arg1]) => {
    nativeTheme.themeSource = arg1;
    store.set("全局.深色模式", arg1);
});

mainOn("hotkey", ([type, name, key]) => {
    if (type === "快捷键") {
        try {
            try {
                // @ts-ignore
                globalShortcut.unregister(store.get(`快捷键.${name}.key`));
            } catch {}
            let ok = false;
            if (key) {
                ok = globalShortcut.register(key, () => {
                    快捷键函数[name]();
                });
            }
            return key ? ok : true;
        } catch (error) {
            return false;
        }
    } else {
        try {
            try {
                globalShortcut.unregister(
                    // @ts-ignore
                    store.get(`全局工具快捷键.${name}`) as string,
                );
            } catch {}
            let ok = true;
            if (key) {
                ok = globalShortcut.register(key, () => {
                    sendCaptureEvent(undefined, name as 功能);
                });
            }
            return ok;
        } catch (error) {
            return false;
        }
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
        mainSend(clipWindow.webContents, "clip_mouse_posi", [
            nowXY.x - tipB.x,
            nowXY.y - tipB.y,
        ]);
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
        const id = Date.now();
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
                mainSend(dingWindow.webContents, "addDing", [
                    id,
                    x - i.bounds.x,
                    y - i.bounds.y,
                    w,
                    h,
                    img,
                    type,
                ]);
            });
            dingWindow.setIgnoreMouseEvents(true);

            dingWindow.setAlwaysOnTop(true, "screen-saver");
        }
        forceDingThrogh();
    } else {
        const id = Date.now();
        for (const i in dingwindowList) {
            const b = dingwindowList[i].win.getBounds();
            mainSend(dingwindowList[i].win.webContents, "addDing", [
                id,
                x - b.x,
                y - b.y,
                w,
                h,
                img,
                "ding",
            ]);
        }
    }
    // 自动改变鼠标穿透
    function dingClickThrough() {
        const nowXY = screen.getCursorScreenPoint();
        for (const i in dingwindowList) {
            try {
                const b = dingwindowList[i].win.getBounds();
                mainSend(dingwindowList[i].win.webContents, "dingMouse", [
                    nowXY.x - b.x,
                    nowXY.y - b.y,
                ]);
            } catch (error) {}
        }
        setTimeout(dingClickThrough, 10);
    }
    dingClickThrough();
}
let dingThrogh: null | boolean = null;
mainOn("dingIgnore", ([v]) => {
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

mainOnReflect("dingShare", ([data]) => {
    if (data.type === "close" && data.closeAll) {
        for (const i in dingwindowList) {
            dingwindowList[i].win.close();
            delete dingwindowList[i];
        }
        return [];
    }

    if (data.type === "move_start") {
        const nowXY = screen.getCursorScreenPoint();

        for (const i in dingwindowList) {
            const display = dingwindowList[i].display;
            data.more.x = nowXY.x - display.bounds.x;
            data.more.y = nowXY.y - display.bounds.y;
        }
    }

    return Object.values(dingwindowList).map((i) => i.win.webContents);
});
mainOn("edit_pic", ([img]) => {
    sendCaptureEvent(img);
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
        mainSend(win.webContents, "translatorInit", [
            op.displayId,
            screen.getAllDisplays(),
            op.rect,
        ]);
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
        mainSend(win.webContents, "superPhotoEditorInit", [img]);
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
        op.time = Date.now();
        mainSend(mainWindow.webContents, "editorInit", [name, op]);
        mainWindow.focus();
        return name;
    }

    const windowName = Date.now();
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
    });
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
        mainSend(mainWindow.webContents, "editorInit", [windowName, op]);

        if (op.type === "image" && op.arg0 === "ai") {
            createBrowser(windowName, "./aiVision.html").then((c) => {
                c?.executeJavaScript(`setImg("${op.content}")`);
            });
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

async function createSettingWindow() {
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

    rendererPath(settingWindow, "setting.html");

    await settingWindow.webContents.session.setProxy(store.get("代理"));

    if (dev) settingWindow.webContents.openDevTools();

    settingWindow.webContents.on("did-finish-load", () => {
        settingWindow.webContents.setZoomFactor(store.get("全局.缩放") || 1.0);
    });
}

async function createHelpWindow() {
    shell.openExternal(
        `https://github.com/xushengfeng/eSearch/blob/${app.getVersion()}/docs/use/readme.md`,
    );
}

/**
 * 向聚焦的主页面发送事件信息
 */
function mainEdit(window: BaseWindow | undefined, m: EditToolsType) {
    if (window instanceof BrowserWindow)
        mainSend(window.webContents, "editorEvent", [m]);
}

const searchWindowL: { [n: number]: WebContentsView } = {};
mainOn("open_this_browser", ([window_name, url]) => {
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
    const view = Date.now();
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
        mainSend(mainWindow.webContents, "browserNew", [view, url]);
    searchView.webContents.on("page-title-updated", (_event, title) => {
        if (!mainWindow.isDestroyed())
            mainSend(mainWindow.webContents, "browserTitle", [view, title]);
    });
    searchView.webContents.on("page-favicon-updated", (_event, favlogo) => {
        if (!mainWindow.isDestroyed())
            mainSend(mainWindow.webContents, "browserIcon", [view, favlogo[0]]);
    });
    searchView.webContents.on("did-navigate", (_event, url) => {
        if (!mainWindow.isDestroyed())
            mainSend(mainWindow.webContents, "browserUrl", [view, url]);
    });
    searchView.webContents.on("did-start-loading", () => {
        if (!mainWindow.isDestroyed())
            mainSend(mainWindow.webContents, "browserLoad", [view, true]);
    });
    searchView.webContents.on("did-stop-loading", () => {
        if (!mainWindow.isDestroyed())
            mainSend(mainWindow.webContents, "browserLoad", [view, false]);
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
 */
function viewEvents(
    w: BaseWindow | undefined,
    arg:
        | "home"
        | "back"
        | "forward"
        | "reload"
        | "stop"
        | "browser"
        | "add_history"
        | "dev",
) {
    if (w instanceof BrowserWindow) mainSend(w.webContents, "viewEvent", [arg]);
}

mainOn("tabView", ([id, arg], e) => {
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
        case "dev":
            searchWindow.webContents.openDevTools();
            break;
    }
});

mainOn("tabViewSize", ([arg2], e) => {
    const mainWindow = BrowserWindow.fromWebContents(e.sender);
    if (!mainWindow) return;
    const bSize = Object.values(mainWindowL).find(
        (i) => i.win === mainWindow,
    )?.browser;
    if (!bSize) return;
    bSize.bottom = arg2.bottom;
    bSize.top = arg2.top;
    for (const w of mainWindow.contentView.children) {
        if (w.getBounds().width !== 0) setViewSize(w, mainWindow, bSize);
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

mainOn("windowIgnoreMouse", ([arg], e) => {
    BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(arg);
});
mainOn("windowClose", (_, e) => {
    BrowserWindow.fromWebContents(e.sender)?.close();
});
mainOn("windowMax", (_, e) => {
    BrowserWindow.fromWebContents(e.sender)?.maximize();
});
mainOn("windowTop", ([top], e) => {
    BrowserWindow.fromWebContents(e.sender)?.setAlwaysOnTop(top);
});
mainOn("windowShow", (_, e) => {
    BrowserWindow.fromWebContents(e.sender)?.show();
});

mainOn("save_file_path", async ([type, isVideo]) => {
    const savedPath = isVideo
        ? store.get("保存.保存路径.视频") || ""
        : store.get("保存.保存路径.图片") || "";
    const defaultPath = join(savedPath, `${getFileName()}.${type}`);
    if (store.get("保存.快速保存") && savedPath) {
        return defaultPath;
    }
    const x = await dialog.showSaveDialog({
        title: t("选择要保存的位置"),
        defaultPath: defaultPath,
        filters: [
            { name: isVideo ? t("视频") : t("图像"), extensions: [type] },
        ],
    });
    return x.filePath;
});

mainOn("ok_save", ([arg, isVideo]) => {
    noti(arg);
    if (isVideo) {
        store.set("保存.保存路径.视频", dirname(arg));
    } else {
        store.set("保存.保存路径.图片", dirname(arg));
    }
});

mainOn("selectPath", async ([path, p]) => {
    try {
        const x = await dialog.showOpenDialog({
            title: t("选择文件"),
            defaultPath: path || app.getPath("pictures"),
            properties: p,
        });
        return x.filePaths[0] || "";
    } catch (error) {
        return "";
    }
});

mainOn("runPath", () => {
    return runPath;
});
mainOn("userDataPath", () => {
    return app.getPath("userData");
});

mainOn("systemLan", () => {
    return matchBestLan();
});
mainOn("feedbackBug", ([arg]) => {
    return feedbackUrl(arg);
});
mainOn("feedbackFeature", ([arg]) => {
    return feedbackUrl2(arg);
});

nativeTheme.on("updated", () => {
    setTray();
});

// 默认设置
const defaultSetting: setting = {
    首次运行: false,
    设置版本: app.getVersion(),
    启动提示: true,
    dev: false,
    保留截屏窗口: true,
    语言: {},
    托盘: "彩色",
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
    鼠标快捷键: {
        右键: "取色器",
        双击: "复制",
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
            开启: false,
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
            设备列表: [],
            启用系统内录: true,
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
    网络: {
        github镜像: {
            启用: false,
            api: "https://api.kkgithub.com/",
            base: "https://gh.llkk.cc/https://github.com/",
        },
    },
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
            // @ts-ignore
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
                // @ts-ignore
                if (store.get(nPath) === undefined) store.set(nPath, x[i]);
            }
        }
    }
    versionTrans();
    store.set("设置版本", app.getVersion());
    store.set("网络.github镜像.启用", matchBestLan() === "zh-HANS");
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

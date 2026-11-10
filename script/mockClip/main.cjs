const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

/** --size=2880x1800 可模拟其他分辨率，默认 960x640 */
const sizeArg = process.argv
    .find((i) => i.startsWith("--size="))
    ?.slice("--size=".length);
const [WIDTH, HEIGHT] = (sizeArg ?? "960x640")
    .split("x")
    .map((i) => Number.parseInt(i, 10) || 0);
const OUT_DIR = "/tmp/opencode";
const CONFIG_PATH = path.join(OUT_DIR, "mockClip-config.json");
const visible = process.argv.includes("--visible");
const offscreen = process.argv.includes("--offscreen");
/** 模拟真实截屏窗口：透明、全屏、置顶 */
const overlay = process.argv.includes("--overlay");

const defaults = require("./defaults.cjs");

function deepMerge(target, source) {
    if (source == null || typeof source !== "object" || Array.isArray(source)) {
        return structuredClone(source);
    }
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const targetValue = target?.[key];
        const sourceValue = source[key];
        if (
            targetValue &&
            typeof targetValue === "object" &&
            !Array.isArray(targetValue) &&
            sourceValue &&
            typeof sourceValue === "object" &&
            !Array.isArray(sourceValue)
        ) {
            result[key] = deepMerge(targetValue, sourceValue);
        } else {
            result[key] = structuredClone(sourceValue);
        }
    }
    return result;
}

let config = structuredClone(defaults);
try {
    if (fs.existsSync(CONFIG_PATH)) {
        config = deepMerge(
            config,
            JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")),
        );
    }
} catch (error) {
    console.error("读取 mock 配置失败", error);
}

function getPath(obj, keyPath) {
    return keyPath.split(".").reduce((v, k) => (v == null ? v : v[k]), obj);
}

function setPath(obj, keyPath, value) {
    const keys = keyPath.split(".");
    const last = keys.pop();
    let target = obj;
    for (const key of keys) {
        if (target[key] == null || typeof target[key] !== "object") {
            target[key] = {};
        }
        target = target[key];
    }
    target[last] = value;
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error("保存 mock 配置失败", error);
    }
}

function makeScreenshot() {
    const buffer = Buffer.alloc(WIDTH * HEIGHT * 4);
    const colors = [
        [255, 255, 255],
        [230, 236, 246],
        [210, 220, 238],
        [180, 196, 220],
    ];
    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const i = (y * WIDTH + x) * 4;
            const grid = (Math.floor(x / 80) + Math.floor(y / 80)) % 2;
            const c = colors[grid];
            // createFromBitmap 使用 BGRA 顺序
            buffer[i] = c[2];
            buffer[i + 1] = c[1];
            buffer[i + 2] = c[0];
            buffer[i + 3] = 255;
        }
    }
    // 几个彩色区域，方便观察绘制位置和颜色
    const blocks = [
        [40, 40, 180, 120, [220, 60, 60]],
        [240, 40, 180, 120, [60, 180, 90]],
        [440, 40, 180, 120, [60, 110, 220]],
        [640, 40, 180, 120, [230, 190, 60]],
        [100, 300, 320, 180, [250, 250, 250]],
        [560, 300, 300, 180, [40, 40, 40]],
    ];
    for (const [x0, y0, w, h, c] of blocks) {
        for (let y = y0; y < y0 + h; y++) {
            for (let x = x0; x < x0 + w; x++) {
                const i = (y * WIDTH + x) * 4;
                buffer[i] = c[2];
                buffer[i + 1] = c[1];
                buffer[i + 2] = c[0];
                buffer[i + 3] = 255;
            }
        }
    }
    return nativeImage
        .createFromBitmap(buffer, {
            width: WIDTH,
            height: HEIGHT,
        })
        .toPNG();
}

let win = null;

function sendClipInit() {
    if (!win || win.isDestroyed()) return;
    const displays = [
        {
            id: 1,
            bounds: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
            size: { width: WIDTH, height: HEIGHT },
            workArea: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
            workAreaSize: { width: WIDTH, height: HEIGHT },
            scaleFactor: 1,
            rotation: 0,
            internal: false,
            touchSupport: "unknown",
        },
    ];
    win.webContents.send("ipc", "clip_init", [
        displays,
        makeScreenshot(),
        1,
        "no",
        process.pid,
    ]);
    console.log(`已发送 mock clip_init: ${WIDTH}x${HEIGHT}`);
}

app.whenReady().then(async () => {
    ipcMain.on("store", (event, data) => {
        try {
            if (data.type === "get") {
                event.returnValue = getPath(config, data.path);
            } else if (data.type === "set") {
                setPath(config, data.path, data.value);
                saveConfig();
                event.returnValue = undefined;
            } else if (data.type === "getAll") {
                event.returnValue = config;
            } else if (data.type === "setAll") {
                config = deepMerge(defaults, data.value);
                saveConfig();
                event.returnValue = undefined;
            } else {
                event.returnValue = undefined;
            }
        } catch (error) {
            console.error("store 处理失败", data, error);
            event.returnValue = undefined;
        }
    });

    ipcMain.on("ipc", (event, key, data) => {
        switch (key) {
            case "clip_show":
                if (visible && win && !win.isDestroyed()) {
                    win.showInactive();
                }
                event.returnValue = null;
                break;
            case "clip_close":
                console.log("mock clip_close");
                event.returnValue = null;
                break;
            case "clip_hide":
                console.log("mock clip_hide");
                event.returnValue = null;
                break;
            case "clip_save": {
                const ext = data?.[0] ?? "png";
                event.returnValue = path.join(OUT_DIR, `mockClip-save.${ext}`);
                break;
            }
            case "save_file_path": {
                const ext = data?.[0] ?? "png";
                event.returnValue = path.join(OUT_DIR, `mockClip-save.${ext}`);
                break;
            }
            case "clip_mac_app":
                event.returnValue = { canceled: true, filePaths: [] };
                break;
            case "getMousePos":
                event.returnValue = {
                    po: { x: 0, y: 0 },
                    ab: { x: 0, y: 0 },
                };
                break;
            case "clip_ocr":
            case "clip_search":
            case "clip_qr":
            case "clip_editor":
            case "clip_translate":
            case "clip_recordx":
            case "clip_ding":
            case "copy_image_file":
            case "ok_save":
            case "clip_stop_long":
            case "long_compact_start":
            case "long_compact_end":
            case "long_compact_preview":
            case "long_compact_warn":
            case "long_control_start":
            case "long_control_stop":
            case "captureSources":
                console.log(`mock ipc: ${key}`);
                event.returnValue = null;
                break;
            default:
                console.log(`mock ipc 未处理: ${key}`);
                event.returnValue = null;
        }
    });

    ipcMain.handle("dialogMessage", () => 0);

    ipcMain.on("mock-input", (_event, events) => {
        let delay = 0;
        for (const item of events ?? []) {
            const { delay: wait, ...event } = item;
            setTimeout(() => {
                if (win && !win.isDestroyed()) {
                    win.webContents.sendInputEvent(event);
                }
            }, delay);
            delay += wait ?? 20;
        }
    });

    win = new BrowserWindow({
        width: WIDTH,
        height: HEIGHT,
        useContentSize: true,
        show: overlay || (visible && !offscreen),
        title: "eSearch mock clip",
        alwaysOnTop: overlay,
        skipTaskbar: !visible,
        transparent: overlay,
        frame: !overlay,
        fullscreen: overlay,
        hasShadow: overlay ? false : undefined,
        movable: overlay ? false : undefined,
        resizable: overlay ? false : undefined,
        autoHideMenuBar: overlay,
        enableLargerThanScreen: overlay,
        webPreferences: {
            offscreen,
            paintWhenInitiallyHidden: true,
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false,
            backgroundThrottling: false,
            zoomFactor: 1,
        },
    });

    win.webContents.on("console-message", (...args) => {
        const details = args[1];
        if (details && typeof details === "object" && "message" in details) {
            console.log("[renderer]", details.message);
        } else {
            console.log("[renderer]", args.slice(1).join(" "));
        }
    });
    win.webContents.on("did-finish-load", () => {
        setTimeout(sendClipInit, 300);
    });
    win.webContents.on("destroyed", () => {
        win = null;
    });

    await win.loadFile(path.join(__dirname, "../../out/renderer/capture.html"));
});

app.on("window-all-closed", () => {
    if (visible) app.quit();
});

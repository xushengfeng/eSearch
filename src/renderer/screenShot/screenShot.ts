const { ipcRenderer, nativeImage, shell } =
    require("electron") as typeof import("electron");
import type { MessageBoxSyncOptions } from "electron";

let Screenshots: typeof import("node-screenshots").Screenshots;
try {
    Screenshots = require("node-screenshots").Screenshots;
} catch (error) {
    const id = ipcRenderer.sendSync("dialog", {
        message:
            "截屏需要VS运行库才能正常使用\n是否需要从微软官网（https://aka.ms/vs）下载？",
        buttons: ["取消", "下载"],
        defaultId: 1,
    } as MessageBoxSyncOptions);
    if (id === 1) {
        shell.openExternal("https://aka.ms/vs/17/release/vc_redist.x64.exe");
    }
}

function dispaly2screen(displays?: Electron.Display[], imgBuffer?: Buffer) {
    let allScreens: (Partial<Electron.Display> & {
        captureSync?: () => ReturnType<typeof toCanvas>;
        image?: ReturnType<typeof toCanvas>; // 缓存，在切换屏幕时不重新截屏
    })[] = [];
    allScreens = [];
    let buffer = imgBuffer;
    if (!buffer && process.platform === "linux" && process.arch === "arm64") {
        const fs = require("node:fs") as typeof import("node:fs");
        const { execSync } =
            require("node:child_process") as typeof import("node:child_process");
        const x: (typeof allScreens)[0] = {
            ...displays[0],
            captureSync: () => {
                const command = ipcRenderer.sendSync("store", {
                    type: "get",
                    path: "额外截屏器.命令",
                });
                try {
                    if (!command) throw "";
                    execSync(command, {});
                    const path = "/dev/shm/esearch-img.png";
                    fs.rm(path, () => {});
                    buffer = fs.readFileSync(path);
                    fs.rm(path, () => {});
                } catch (error) {
                    if (!command) {
                        ipcRenderer.send("dialog", {
                            message: "Linux arm64 平台需要额外截屏软件",
                            buttons: ["确定"],
                        } as MessageBoxSyncOptions);
                    } else {
                        ipcRenderer.send("dialog", {
                            message: "命令运行出错，无法读取截屏，请检查设置",
                            buttons: ["确定"],
                        } as MessageBoxSyncOptions);
                    }
                    return null;
                }

                const data = toCanvas(buffer);
                x.image = data;
                const image = data.image;
                const s = image.getSize();
                x.bounds = { x: 0, y: 0, width: s.width, height: s.height };
                x.size = { width: s.width, height: s.height };
                x.scaleFactor = 1;
                return data;
            },
        };
        return [x];
    }
    if (buffer) {
        const data = toCanvas(buffer); // 闭包，这里就不用缓存到image了
        const image = data.image;
        const s = image.getSize();
        return [
            {
                bounds: { x: 0, y: 0, width: s.width, height: s.height },
                size: { width: s.width, height: s.height },
                scaleFactor: 1,
                captureSync: () => data,
            },
        ] as typeof allScreens;
    }

    const screens = Screenshots.all();
    // todo 更新算法
    /**
     * 修复屏幕信息
     * @see https://github.com/nashaofu/node-screenshots/issues/18
     */
    for (const i in displays || screens) {
        const d = displays[i] || {};
        const s = screens[i];
        const x: (typeof allScreens)[0] = {
            ...d,
            captureSync: () => {
                if (x.image) return x.image;
                const data = toCanvas(s.captureSync(true));
                x.image = data;
                return data;
            },
        };
        allScreens.push(x);
    }
    return allScreens;
}

function toCanvas(img: Buffer) {
    const image = nativeImage.createFromBuffer(img);
    const { width: w, height: h } = image.getSize();

    const bitmap = image.toBitmap();
    const x = new Uint8ClampedArray(bitmap.length);
    for (let i = 0; i < bitmap.length; i += 4) {
        // 交换R和B通道的值，同时复制G和Alpha通道的值
        x[i] = bitmap[i + 2];
        x[i + 1] = bitmap[i + 1];
        x[i + 2] = bitmap[i];
        x[i + 3] = bitmap[i + 3];
    }
    const d = new ImageData(x, w, h);
    return { data: d, image };
}

export default dispaly2screen;

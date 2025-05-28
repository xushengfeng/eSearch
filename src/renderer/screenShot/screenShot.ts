const { ipcRenderer, nativeImage, shell, dialog } =
    require("electron") as typeof import("electron");
import type { MessageBoxSyncOptions } from "electron";
import { renderSendSync } from "../../../lib/ipc";

type ReturnData = {
    bounds: { x: number; y: number; width: number; height: number };
    size: { width: number; height: number };
    scaleFactor: number;
    id: number;
    capture: () => {
        toImageData: () => ImageData;
        toNativeImage: () => Electron.NativeImage;
    };
};

function d(op: MessageBoxSyncOptions) {
    if (ipcRenderer) {
        return renderSendSync("dialogMessage", [op]);
    }
    return dialog.showMessageBoxSync(op);
}

let _t: (t: string) => string = (t) => t;

let Screenshots: typeof import("node-screenshots");

let _command: string | undefined;
let commandSavePath = "/dev/shm/esearch-img.png";

function init(
    command: { c: string; path?: string },
    feedback?: (m: string) => string,
    t?: (t: string) => string,
) {
    _command = command.c;
    if (command.path) commandSavePath = command.path;
    if (t) _t = t;
    if (process.platform === "linux" && process.arch === "arm64") {
        if (!_command) {
            d({
                message: `${_t("Linux arm64 平台需要额外截屏软件")}\n${_t("请在 设置-高级 中设置截屏命令")}`,
                buttons: [_t("确定")],
            } as MessageBoxSyncOptions);
        }
    } else if (!_command)
        try {
            Screenshots = require("node-screenshots");
        } catch (error) {
            if (process.platform === "win32") {
                const id = d({
                    message: `${_t("截屏需要VS运行库才能正常使用")}\n${_t("是否需要从微软官网（https://aka.ms/vs）下载？")}`,
                    buttons: [_t("取消"), _t("下载")],
                    defaultId: 1,
                } as MessageBoxSyncOptions);
                if (id === 1) {
                    shell.openExternal(
                        `https://aka.ms/vs/17/release/vc_redist.${process.arch}.exe`,
                    );
                }
            } else {
                const me =
                    error && typeof error === "object" && "message" in error
                        ? (error.message as string)
                        : String(error);
                let m = `${_t("截屏库加载时遇到错误：")}\n${me}`;
                if (me.includes("GLIBC_")) {
                    m = `${_t("需要glibc")}${me.match(/GLIBC_([0-9.]+)/)?.[1]}\n${_t("请尝试更新glibc版本")}\n${_t("或者设置外部截屏器")}`;
                }
                const id = d({
                    message: m,
                    buttons: [_t("取消"), _t("反馈")],
                    defaultId: 1,
                });
                const f =
                    feedback ??
                    ((m: string) =>
                        renderSendSync("feedbackBug", [
                            {
                                title: "截屏库调用错误",
                                main: "截屏库调用错误",
                                steps: "截屏",
                                more: m,
                            },
                        ]));

                if (id === 1) {
                    shell.openExternal(f(me));
                }
            }
        }
    return dispaly2screen;
}

function dispaly2screen(
    displays?: Electron.Display[],
    imgBuffer?: Buffer,
): {
    screen: ReturnData[];
    window: { rect: { x: number; y: number; w: number; h: number } }[];
} {
    let allScreens: ReturnData[] = [];
    allScreens = [];
    let buffer = imgBuffer;

    if (!buffer && process.platform === "linux" && process.arch === "arm64") {
        if (!_command) {
            d({
                message: _t("Linux arm64 平台需要额外截屏软件"),
                buttons: [_t("确定")],
            } as MessageBoxSyncOptions);
            return { screen: [], window: [] };
        }
    }
    if (!buffer && _command) {
        const fs = require("node:fs") as typeof import("node:fs");
        // biome-ignore format:
        const { execSync } = require("node:child_process") as typeof import("node:child_process");
        const x: (typeof allScreens)[0] = {
            bounds: displays?.[0]?.bounds ?? {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            },
            size: displays?.[0]?.bounds ?? { width: 0, height: 0 },
            scaleFactor: displays?.[0]?.scaleFactor ?? 1,
            id: displays?.[0]?.id ?? -1,
            capture: () => {
                const command = _command as string;
                try {
                    const path = commandSavePath;
                    fs.rm(path, () => {});
                    execSync(command, {});
                    buffer = fs.readFileSync(path);
                    fs.rm(path, () => {});
                } catch (error) {
                    d({
                        message: _t("命令运行出错，无法读取截屏，请检查设置"),
                        buttons: [_t("确定")],
                    } as MessageBoxSyncOptions);

                    return {
                        toImageData: () => emptyImageData(),
                        toNativeImage: () => nativeImage.createEmpty(),
                    };
                }

                const data = toCanvas(buffer);
                const image = data.image;
                const s = image.getSize();
                x.bounds = { x: 0, y: 0, width: s.width, height: s.height };
                x.size = { width: s.width, height: s.height };
                x.scaleFactor = 1;
                return {
                    toImageData: () => data.data,
                    toNativeImage: () => data.image,
                };
            },
        };
        return { screen: [x], window: [] };
    }
    if (buffer) {
        const data = toCanvas(buffer);
        const image = data.image;
        const s = image.getSize();
        return {
            screen: [
                {
                    bounds: { x: 0, y: 0, width: s.width, height: s.height },
                    size: { width: s.width, height: s.height },
                    scaleFactor: 1,
                    id: -1,
                    capture: () => ({
                        toImageData: () => data.data,
                        toNativeImage: () => data.image,
                    }),
                },
            ],
            window: [],
        };
    }

    const screens = Screenshots.Monitor.all();
    const windows = Screenshots.Window.all();
    // todo 更新算法
    /**
     * 修复屏幕信息
     * @see https://github.com/nashaofu/node-screenshots/issues/18
     */
    for (const i in displays || screens) {
        const d = displays?.[i];
        const s = screens[i];
        const x: (typeof allScreens)[0] = {
            bounds: d?.bounds ?? { x: 0, y: 0, width: 0, height: 0 },
            size: d?.size ?? { width: 0, height: 0 },
            scaleFactor: d?.scaleFactor ?? 1,
            id: d?.id ?? -1,
            capture: () => {
                const data = s.captureImageSync();
                return {
                    toImageData: () =>
                        toCanvas2(
                            data.toRawSync(true),
                            data.width,
                            data.height,
                        ),
                    toNativeImage: () => {
                        return nativeImage.createFromBuffer(
                            data.toPngSync(true),
                        );
                    },
                };
            },
        };
        allScreens.push(x);
    }
    return {
        screen: allScreens,
        window: windows.map((w) => ({
            rect: { x: w.x, y: w.y, w: w.width, h: w.height },
        })),
    };
}

function emptyImageData() {
    return {
        width: 0,
        height: 0,
        data: new Uint8ClampedArray(0),
        colorSpace: "srgb",
    } as const;
}

function toCanvas(img: Buffer) {
    const image = nativeImage.createFromBuffer(img);
    const { width: w, height: h } = image.getSize();

    if (typeof ImageData === "undefined")
        return { data: emptyImageData(), image };
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

function toCanvas2(img: Buffer, w: number, h: number) {
    const x = new Uint8ClampedArray(img);
    const d = new ImageData(x, w, h);
    return d;
}

export default init;

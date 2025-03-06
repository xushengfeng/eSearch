// biome-ignore format:
const { ipcRenderer, ipcMain} = require("electron") as typeof import("electron");

import type { translateWinType, 功能 } from "../src/ShareTypes";

type Message = {
    clip_show: () => void;
    clip_close: () => void;
    clip_ocr: (img: string, type: string) => void;
    clip_search: (img: string, type: string) => void;
    clip_qr: (img: string) => void;
    clip_save: (ext: string) => string;
    clip_ding: (
        img: string,
        type: "translate" | "ding",
        rect: { w: number; h: number; x: number; y: number },
    ) => void;
    clip_mac_app: () => { canceled: boolean; filePaths: string[] };
    clip_record: (
        rect: [number, number, number, number],
        id: string,
        w: number,
        h: number,
        r: number,
    ) => void;
    clip_long_s: () => void;
    clip_long_e: () => void;
    getMousePos: () => { x: number; y: number };
    clip_translate: (t: translateWinType) => void;
    ignoreMouse: (ignore: boolean) => void;
    clip_editor: (img: string) => void;
    clip_recordx: () => void;
    save_file_path: (type: string, isVideo?: boolean) => string;
    ok_save: (m: string) => void;
    clip_stop_long: () => void;
    clip_mouse_posi: (x: number, y: number) => void;
    clip_init: (
        displays: Electron.Display[],
        imgBuffer: Buffer | undefined,
        mainid: number,
        act: 功能 | undefined,
    ) => void;
};

const name = "ipc";

function mainSend<K extends keyof Message>(
    webContents: Electron.WebContents | undefined,
    key: K,
    data: Parameters<Message[K]>,
): void {
    webContents?.send(name, key, data);
}

function renderOn<K extends keyof Message>(
    key: K,
    callback: (data: Parameters<Message[K]>) => void,
) {
    ipcRenderer.on(name, (event, k, data) => {
        if (k === key) {
            callback(data);
        }
    });
}

function renderSend<K extends keyof Message>(
    key: K,
    data: Parameters<Message[K]>,
): void {
    ipcRenderer.send(name, key, data);
}

function renderSendSync<K extends keyof Message>(
    key: K,
    data: Parameters<Message[K]>,
): ReturnType<Message[K]> {
    return ipcRenderer.sendSync(name, key, data);
}

function mainOn<K extends keyof Message>(
    key: K,
    callback: (
        data: Parameters<Message[K]>,
        event: Electron.IpcMainEvent,
    ) => ReturnType<Message[K]> | Promise<ReturnType<Message[K]>>,
) {
    ipcMain.on(name, async (event, k, data) => {
        if (k === key) {
            event.returnValue = await callback(data, event);
        }
    });
}

export { mainSend, renderOn, renderSend, renderSendSync, mainOn };

// biome-ignore format:
const { ipcRenderer, ipcMain} = require("electron") as typeof import("electron");

import type {
    MessageBoxSyncOptions,
    NativeTheme,
    OpenDialogOptions,
} from "electron";
import type {
    DingResize,
    DingStart,
    translateWinType,
    功能,
} from "../src/ShareTypes";

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
    clip_editor: (img: string) => void;
    clip_recordx: () => void;
    save_file_path: (type: string, isVideo?: boolean) => string;
    ok_save: (m: string, isVideo?: boolean) => void;
    clip_stop_long: () => void;
    clip_mouse_posi: (x: number, y: number) => void;
    clip_init: (
        displays: Electron.Display[],
        imgBuffer: Buffer | undefined,
        mainid: number,
        act: 功能 | undefined,
    ) => void;
    open_this_browser: (window_name: number, url: string) => void;
    edit_pic: (img: Buffer<ArrayBufferLike>) => void;
    dialogMessage: (op: MessageBoxSyncOptions) => number;
    windowClose: () => void;
    windowMax: () => void;
    windowTop: (ignore: boolean) => void;
    windowIgnoreMouse: (top: boolean) => void;
    windowShow: () => void;
    runPath: () => string;
    systemLan: () => string;
    feedbackBug: (op?: {
        title?: string;
        main?: string;
        steps?: string;
        expected?: string;
        more?: string;
    }) => string;
    feedbackFeature: (op?: {
        title?: string;
        main?: string;
    }) => string;
    selectPath: (
        defalutPath: string,
        p: OpenDialogOptions["properties"],
    ) => string;
    tabView: (
        id: number,
        type:
            | "close"
            | "top"
            | "back"
            | "forward"
            | "stop"
            | "reload"
            | "home"
            | "dev",
    ) => void;
    tabViewSize: (size: { top: number; bottom: number }) => void;
    viewEvent: (
        type:
            | "close"
            | "top"
            | "back"
            | "forward"
            | "stop"
            | "reload"
            | "home"
            | "dev",
    ) => void;
    hotkey: (type: "快捷键" | "快捷键2", name: string, key: string) => boolean;
    reloadMainFromSetting: () => void;
    set_default_setting: () => void;
    reload: () => void;
    clearStorage: () => void;
    clearCache: () => void;
    move_user_data: (target: string) => void;
    getAutoStart: () => boolean;
    setAutoStart: (value: boolean) => void;
    theme: (t: NativeTheme["themeSource"]) => void;
    dingIgnore: (ignore: boolean) => void;
    recordStop: () => void;
    recordStart: () => void;
    recordTime: (time: string) => void;
    recordCamera: (camera: boolean) => void;
    recordState: (state: "stop" | "pause") => void;
    recordSavePath: (ext: string) => void;
    dingShare: (
        data:
            | { type: "close"; id: string; closeAll: boolean }
            | { type: "move_start"; more: DingStart }
            | { type: "move_end" }
            | { type: "back"; id: string }
            | { type: "resize"; more: DingResize },
    ) => void;
};

const name = "ipc";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const renderOnData = new Map<string, ((data: any) => void)[]>();
const mainOnData = new Map<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    ((data: any, event: Electron.IpcMainEvent) => any)[]
>();

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
    const callbacks = renderOnData.get(key) || [];
    callbacks.push(callback);
    renderOnData.set(key, callbacks);
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
    const callbacks = mainOnData.get(key) || [];
    callbacks.push(callback);
    mainOnData.set(key, callbacks);
}

ipcRenderer?.on(name, (event, key, data) => {
    const callbacks = renderOnData.get(key);
    if (callbacks) {
        for (const callback of callbacks) {
            callback(data);
        }
    } else {
        console.log(`ipcRenderer.on: ${key} not found`);
    }
});

ipcMain?.on(name, async (event, key, data) => {
    const callbacks = mainOnData.get(key);
    if (callbacks) {
        for (const callback of callbacks) {
            const result = await callback(data, event);
            if (result !== undefined) {
                event.returnValue = result;
            }
        }
    } else {
        console.log(`ipcMain.on: ${key} not found`);
    }
});

export { mainSend, renderOn, renderSend, renderSendSync, mainOn };

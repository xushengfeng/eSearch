// biome-ignore format:
const { ipcRenderer, ipcMain} = require("electron") as typeof import("electron");

import type {
    Display,
    MessageBoxSyncOptions,
    NativeTheme,
    OpenDialogOptions,
} from "electron";
import type {
    BrowserAction,
    DingResize,
    DingStart,
    EditToolsType,
    GithubUrlType,
    MainWinType,
    setting,
    translateWinType,
    功能,
} from "../src/ShareTypes";

type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
    ? 1
    : 2
    ? true
    : false;

// biome-ignore lint/suspicious/noExplicitAny: 相信ai
type IsVoidFunction<T> = T extends (...args: any[]) => any
    ? Equals<ReturnType<T>, void>
    : false;

type VoidKeys<M> = {
    [K in keyof M]: IsVoidFunction<M[K]> extends true ? K : never;
}[keyof M];

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
    clip_translate: (t: Omit<translateWinType, "type">) => void;
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
    openUrl: (url: string) => void;
    noti: (op: { body: string; title: string }) => void;
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
    tabView: (id: number, type: BrowserAction) => void;
    tabViewSize: (size: { top: number; bottom: number }) => void;
    viewEvent: (type: BrowserAction | "add_history" | "browser") => void;
    hotkey:
        | ((
              type: "快捷键",
              name: keyof setting["快捷键"],
              key: string,
          ) => boolean)
        | ((type: "快捷键2", name: 功能, key: string) => boolean);
    reloadMainFromSetting: () => void;
    getDefaultSetting: () => setting;
    reload: () => void;
    exit: () => void;
    clearStorage: () => void;
    clearCache: () => void;
    move_user_data: (target: string) => void;
    getAutoStart: () => boolean;
    setAutoStart: (value: boolean) => void;
    theme: (t: NativeTheme["themeSource"]) => void;
    dingIgnore: (ignore: boolean) => void;
    recordInit: (
        id: string,
        r: [number, number, number, number],
        screenW: number,
        screenH: number,
    ) => void;
    recordStartStop: () => void;
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
    addDing: (
        wid: number,
        x: number,
        y: number,
        w: number,
        h: number,
        url: string,
        type: "translate" | "ding",
    ) => void;
    superRecorderInit: (sourceId: string) => void;
    superPhotoEditorInit: (img: string) => void;
    translatorInit: (
        id: number,
        display: Display[],
        rect: { x: number; y: number; w: number; h: number },
    ) => void;
    recordMouse: (x: number, y: number) => void;
    dingMouse: (x: number, y: number) => void;
    recordSavePathReturn: (path: string) => void; // todo remove
    editorEvent: (type: EditToolsType) => void;
    editorInit: (name: number, list: MainWinType) => void;
    browserNew: (id: number, url: string) => void;
    browserTitle: (id: number, title: string) => void;
    browserIcon: (id: number, icon: string) => void;
    browserUrl: (id: number, url: string) => void;
    browserLoad: (id: number, load: boolean) => void;
    userDataPath: () => string;
    githubUrl: (path: string, _type?: GithubUrlType | "auto") => string;
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

/**
 * 渲染进程之间的通信，主进程起到中转作用
 */
function mainOnReflect<K extends VoidKeys<Message>>(
    key: K,
    callback: (
        data: Parameters<Message[K]>,
        event: Electron.IpcMainEvent,
    ) => Electron.WebContents[],
) {
    // @ts-ignore 适用于无返回的函数
    mainOn(key, async (data, event) => {
        const webContents = await callback(data, event);
        if (webContents) {
            for (const wc of webContents) {
                wc.send(name, key, data);
            }
        }
    });
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

export {
    mainSend,
    renderOn,
    renderSend,
    renderSendSync,
    mainOn,
    mainOnReflect,
};

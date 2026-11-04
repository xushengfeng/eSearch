const { ipcRenderer, ipcMain } =
    require("electron") as typeof import("electron");

import type {
    Display,
    MessageBoxSyncOptions,
    NativeTheme,
    OpenDialogOptions,
} from "electron";
import type {
    BrowserAction,
    CaptureSourceInfo,
    DingResize,
    DingStart,
    GithubUrlType,
    LiveDingData,
    LiveDingTarget,
    LongControlInit,
    LongWarnLevel,
    MainWinType,
    NormRect,
    setting,
    translateWinType,
    功能,
} from "../src/ShareTypes";

type Equals<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false;

// biome-ignore lint/suspicious/noExplicitAny: 相信ai
type IsVoidFunction<T> = T extends (...args: any[]) => any
    ? Equals<ReturnType<T>, void>
    : false;

type VoidKeys<M> = {
    [K in keyof M]: IsVoidFunction<M[K]> extends true ? K : never;
}[keyof M];

/** 录屏选区，坐标为截屏画布像素，相对所选屏幕 */
export type RecordRect = {
    rect: [number, number, number, number];
    id: string;
    w: number;
    h: number;
    r: number;
};

type Message = {
    clip_show: () => void;
    clip_close: () => void;
    copy_image_file: (buffer: ArrayBuffer, type: string) => void;
    clip_ocr: (img: string, type: string) => void;
    clip_search: (img: string, type: string) => void;
    clip_qr: (img: string) => void;
    clip_hide: () => void;
    clip_save: (ext: string) => string;
    clip_ding: (
        img: string,
        type: "translate" | "ding",
        rect: { w: number; h: number; x: number; y: number },
    ) => void;
    clip_mac_app: () => { canceled: boolean; filePaths: string[] };
    getMousePos: () => {
        ab: { x: number; y: number };
        po: { x: number; y: number };
    };
    clip_translate: (t: Omit<translateWinType, "type">) => void;
    clip_editor: (img: string) => void;
    /** 普通录屏：固定录制区域；超级录屏：不传 */
    clip_recordx: (opt?: RecordRect) => void;
    save_file_path: (type: string, isVideo?: boolean) => string;
    ok_save: (m: string, isVideo?: boolean) => void;
    clip_stop_long: () => void;
    /** 截屏页进入紧凑长截屏：首帧已完成，交给主进程摆控制窗 */
    long_compact_start: (data: {
        displayId: number;
        rect: [number, number, number, number];
        ratio: number;
        preview?: { data: string; w: number; h: number };
    }) => void;
    /** 紧凑模式的新拼接预览 */
    long_compact_preview: (data: {
        data: string;
        w: number;
        h: number;
    }) => void;
    /** 主进程通知截屏页开始抓帧 */
    long_compact_run: (preview: boolean) => void;
    /** 紧凑模式滚动速度预警 */
    long_compact_warn: (level: LongWarnLevel) => void;
    /** 紧凑长截屏完成，恢复全屏编辑器 */
    long_compact_end: () => void;
    long_control_init: (data: LongControlInit) => void;
    /** 紧凑控制窗滚动速度预警 */
    long_control_warn: (level: LongWarnLevel) => void;
    long_control_preview: (data: {
        data: string;
        w: number;
        h: number;
    }) => void;
    long_control_start: () => void;
    long_control_stop: () => void;
    clip_init: (
        displays: Electron.Display[],
        imgBuffer: Buffer | undefined,
        mainid: number,
        act: 功能 | undefined,
        mainPid?: number,
    ) => void;
    open_this_browser: (window_name: number, url: string) => void;
    edit_pic: (img: Buffer<ArrayBufferLike>) => void;
    dialogMessage: (op: MessageBoxSyncOptions) => number;
    openUrl: (url: string) => void;
    noti: (op: { body: string; title: string }) => void;
    windowClose: () => void;
    windowMax: () => void;
    windowTop: (ignore: boolean) => void;
    windowTopest: (ignore: boolean) => void;
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
    feedbackFeature: (op?: { title?: string; main?: string }) => string;
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
    recordStop: () => void;
    recordTime: (time: string) => void;
    recordCamera: (camera: boolean) => void;
    recordState: (state: "stop") => void;
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
        live?: LiveDingData,
        displayId?: number,
    ) => void;
    superRecorderInit: (sourceId: string, fixed?: RecordRect) => void;
    superPhotoEditorInit: (img: string) => void;
    recordMemWarning: () => void;
    translatorInit: (
        id: number,
        display: Display[],
        rect: { x: number; y: number; w: number; h: number },
    ) => void;
    /** 指针相对贴图窗口的坐标，以及屏幕坐标 */
    dingMouse: (x: number, y: number, absX?: number, absY?: number) => void;
    /** 独立窗口模式：初始化单个贴图 */
    dingInit: (
        id: number,
        x: number,
        y: number,
        w: number,
        h: number,
        url: string,
        type: "translate" | "ding",
        live?: LiveDingData,
        displayId?: number,
    ) => void;
    /** 独立窗口模式：移动、缩放系统窗口 */
    dingSetBounds: (x: number, y: number, w: number, h: number) => void;
    /** 截屏页请求窗口视频源 */
    getCaptureSources: (requestId: number) => void;
    captureSources: (requestId: number, sources: CaptureSourceInfo[]) => void;
    /** 动态贴图；target 为空表示需要用户选择窗口 */
    clip_ding_live: (data: {
        poster: string;
        rect: { x: number; y: number; w: number; h: number };
        displayId: number;
        target: LiveDingTarget | null;
        /** 已经取到的窗口源，避免 PipeWire 再次弹选择框 */
        sources?: CaptureSourceInfo[];
    }) => void;
    /** 选源页初始化 */
    dingPickerInit: (data: {
        sources: CaptureSourceInfo[];
        rect: { x: number; y: number; w: number; h: number };
        poster: string;
    }) => void;
    /** 选源页确认 */
    dingLivePick: (data: {
        sourceId: string;
        crop: NormRect;
        poster: string;
        rect: { x: number; y: number; w: number; h: number };
        appName?: string;
        title?: string;
    }) => void;
    dingLiveCancel: () => void;
    /** 动态贴图转为静态，主进程释放数量额度 */
    dingLiveStop: (id: number) => void;
    /** 动态贴图更换窗口源 */
    dingLiveChangeSource: (data: {
        id: number;
        rect: { x: number; y: number; w: number; h: number };
        poster: string;
        displayId?: number;
    }) => void;
    /** 主进程通知贴图切换源 */
    dingLiveSwitch: (id: number, live: LiveDingData, poster: string) => void;
    /** 选源页重新请求窗口列表（会再次弹出系统选择框） */
    dingPickerRefresh: () => void;
    dingPickerSources: (sources: CaptureSourceInfo[]) => void;
    /** 选源页临时降低/恢复置顶，避免挡住系统选择框 */
    dingPickerTop: (top: boolean) => void;
    editorInit: (name: number, list: MainWinType) => void;
    browserNew: (id: number, url: string) => void;
    browserTitle: (id: number, title: string) => void;
    browserIcon: (id: number, icon: string) => void;
    browserUrl: (id: number, url: string) => void;
    browserLoad: (id: number, load: boolean) => void;
    userDataPath: () => string;
    githubUrl: (path: string, _type?: GithubUrlType | "auto") => string;
    getScreens: () => Display[];
    getLogs: () => {
        from: "screenShot" | "ding" | "mainWindow" | "translator";
        message: string;
        type: "info" | "warning" | "error";
        lineCount: number;
    }[];
};

const name = "ipc";

// biome-ignore lint/suspicious/noExplicitAny: 消息数据由各页面自定义
const renderOnData = new Map<string, ((data: any) => void)[]>();
const mainOnData = new Map<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: 消息数据由主进程自定义
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
        try {
            for (const callback of callbacks) {
                const result = await callback(data, event);
                if (result !== undefined) {
                    event.returnValue = result;
                }
            }
        } catch (error) {
            console.error(`ipcMain.on: ${key}`, error);
        }
        // renderSendSync 的调用方在等 returnValue 才被唤醒。handler 返回 undefined
        // 时（用户取消保存对话框、或本来就没有返回值的 handler）它永远不会被赋值，
        // 调用方所在的渲染进程就此永久阻塞——全屏置顶的截屏覆盖层连 Esc 都收不到。
        // 兜一个 null，让"取消"变成一个可判定的返回值（调用方已有 if (!x) return 分支）。
        if (event.returnValue === undefined) {
            event.returnValue = null;
        }
    } else {
        console.log(`ipcMain.on: ${key} not found`);
    }
});

export {
    mainOn,
    mainOnReflect,
    mainSend,
    renderOn,
    renderSend,
    renderSendSync,
};

export interface setting {
    首次运行: false;
    设置版本: string; // 用于新版本识别
    启动提示: true;
    dev: boolean;
    语言: { 语言?: string };
    托盘: "无" | "彩色" | "黑" | "白" | "跟随系统" | "跟随系统反";
    保留截屏窗口: boolean;
    快捷键: {
        自动识别: { key?: string };
        截屏搜索: { key?: string };
        选中搜索: { key?: string };
        剪贴板搜索: { key?: string };
        快速截屏: { key?: string };
        连拍: { key: string };
        主页面: { key?: string };
        结束广截屏: { key: string };
        剪贴板贴图: { key: string };
    };
    点击托盘自动截图: boolean;
    全局工具快捷键: { [key in 功能]: string };
    工具快捷键: { [key in 功能]: string };
    截屏编辑快捷键: {
        [key in keyof EditType]: {
            键: string;
            副: { [key1 in EditType[key]]: string };
        };
    };
    鼠标快捷键: {
        双击: "复制" | "保存";
        右键: "取色器" | "关闭";
    };
    大小栏快捷键: {
        左上x: string;
        左上y: string;
        右下x: string;
        右下y: string;
        宽: string;
        高: string;
    };
    主页面快捷键: {
        搜索: string;
        翻译: string;
        打开链接: string;
        删除换行: string;
        图片区: string;
        关闭: string;
    };
    其他快捷键: {
        复制颜色: string;
        隐藏或显示栏: string;
    };
    主搜索功能: {
        自动搜索排除: string[];
        剪贴板选区搜索: boolean;
        截屏搜索延迟: number;
    };
    全局: {
        模糊: number;
        缩放: number;
        不透明度: number;
        深色模式: Electron.NativeTheme["themeSource"];
        主题: {
            [k in "light" | "dark"]: {
                barbg: string;
                bg: string;
                emphasis: string;
                fontColor: string;
                fontInEmphasis: string;
                iconColor: string; // filters
            };
        };
    };
    工具栏: {
        按钮大小: number;
        按钮图标比例: number;
        初始位置: { left: string; top: string };
        功能: 功能[];
        稍后出现: boolean;
    };
    字体: {
        主要字体: string;
        等宽字体: string;
        大小: number;
    };
    编辑器: {
        自动换行: boolean;
        拼写检查: boolean;
        行号: boolean;
        工具: {
            name: string;
            key: string;
            regex: { r: string; p: string }[];
        }[]; // todo set
    };
    工具栏跟随: "展示内容优先" | "效率优先";
    自动搜索: boolean;
    取色器: {
        显示: boolean;
        像素大小: number;
        大小: number;
        默认格式:
            | "HEX"
            | "RGB"
            | "HSL"
            | "HSV"
            | "HWB"
            | "LAB"
            | "LCH"
            | "OKLAB"
            | "OKLCH"
            | "CMYK";
    };
    鼠标跟随栏: {
        显示: boolean;
    };
    显示四角坐标: boolean;
    框选: {
        自动框选: {
            图像识别: boolean;
            最小阈值: number;
            最大阈值: number;
        };
        识别窗口: boolean;
        记忆: { 开启: boolean; rects: { [screenId: string]: number[] } };
        颜色: {
            遮罩: string;
            光标参考线: string;
            选区参考线: string;
        };
        参考线: {
            光标: boolean;
            选区: { x: number[]; y: number[] };
        };
    };
    图像编辑: {
        默认属性: {
            填充颜色: string;
            边框颜色: string;
            边框宽度: number;
            画笔颜色: string;
            画笔粗细: number;
        };
        复制偏移: {
            x: number;
            y: number;
        };
        形状属性: {
            [k in EditType["shape"] | EditType["draw"]]?: {
                fc?: string;
                sc?: string;
                sw?: number;
                shadow?: number;
            };
        };
        记忆: EditType;
        arrow: {
            type: "fill" | "stroke";
            w: number;
            h: number;
        };
        收藏: {
            color: string[];
            形状: {
                type: keyof EditType["shape"] | EditType["draw"];
                fc?: string;
                sc?: string;
                sw?: number;
                shadow?: number;
            }[];
        }; // todo set
    };
    OCR: {
        类型: string;
        离线切换: boolean;
        识别段落: boolean;
        整体方向识别: boolean;
    };
    离线OCR: {
        id: string;
        name: string;
        detPath: string;
        recPath: string;
        dicPath: string;
        scripts: string[];
        accuracy: "high" | "low";
        speed: "fast" | "slow";
        optimize?: {
            space: boolean;
        };
    }[];
    AI: {
        运行后端: "cpu" | "cuda" | "coreml" | "directml" | "webgpu";
        在线模型: {
            name: string;
            type: "chatgpt";
            supportVision: boolean;
            url: string;
            key: string;
            config: Record<string, unknown>;
        }[];
    };
    在线OCR: {
        baidu: {
            url: string;
            id: string;
            secret: string;
            time: number;
            token: string;
        };
        youdao: {
            id: string;
            secret: string;
        };
    };
    以图搜图: {
        引擎: string;
    };
    自动打开链接: boolean;
    自动搜索中文占比: number;
    浏览器中打开: boolean;
    浏览器: {
        标签页: {
            自动关闭: boolean;
            小: boolean;
            灰度: boolean;
        };
    };
    保存: {
        默认格式: "png" | "jpg" | "svg" | "webp";
        保存路径: { 图片: string; 视频: string };
        快速保存: boolean;
        保存并复制: boolean;
    };
    保存名称: { 前缀: string; 时间: string; 后缀: string };
    框选后默认操作: "no" | 功能;
    快速截屏: { 模式: "clip" | "path"; 路径: string };
    引擎: {
        记忆: {
            搜索: string;
            翻译: string;
        };
        搜索: { name: string; url: string }[];
        翻译: { name: string; url: string }[];
    };
    历史记录设置: {
        保留历史记录: boolean;
        自动清除历史记录: boolean;
        d: number;
    };
    ding_dock: [number, number];
    贴图: {
        窗口: {
            变换: string[];
            双击: "归位" | "关闭";
            提示: boolean;
        };
        强制鼠标穿透: string;
    };
    代理: Electron.ProxyConfig;
    主页面: {
        模式: "auto" | "search" | "translate";
        复用: boolean;
        复用后聚焦: boolean;
        失焦关闭: boolean;
        简洁模式: boolean;
        显示图片区: number;
        自动复制OCR: boolean;
        复制OCR后提示: boolean;
    };
    主页面大小: [number, number, boolean];
    时间格式: string;
    硬件加速: boolean;
    更新: {
        检查更新: boolean;
        频率: "manual" | "start";
        模式: "大版本" | "小版本" | "dev";
        忽略版本: string;
    };
    录屏: {
        模式: "normal" | "super";
        自动录制: boolean;
        自动录制延时: number;
        视频比特率: number;
        摄像头: {
            开启: boolean;
            设备: string;
            镜像: boolean;
            背景: {
                模式: "none" | "hide" | "blur" | "img" | "video";
                模糊: number;
                imgUrl: string;
                videoUrl: string;
                fit: "cover" | "fit";
            };
        };
        音频: {
            设备列表: string[];
            启用系统内录: boolean;
        };
        转换: {
            格式: string;
            码率: number;
            帧率: number;
            其他: string;
            高质量gif: boolean;
            分段: number;
        };
        提示: {
            键盘: {
                开启: boolean;
                位置: {
                    x: "+" | "-";
                    y: "+" | "-";
                    offsetX: number;
                    offsetY: number;
                };
                大小: number;
            };
            鼠标: {
                开启: boolean;
            };
            光标: {
                开启: boolean;
                样式: string;
            };
        };
        大小: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        超级录屏: {
            编码选择: "性能优先" | "内存优先";
            关键帧间隔: number;
            缩放: number;
            格式: string;
            自动停止录制: number;
            导出后关闭: boolean;
        };
    };
    屏幕翻译: {
        type: translateWinType["type"];
        dTime: number;
        css: {
            bg: string;
            text: string;
        };
        语言: {
            from: string;
            to: string;
        };
    };
    翻译: {
        翻译器: {
            id: string;
            name: string;
            type: keyof typeof import("xtranslator")["default"]["e"];
            keys: Record<string, unknown>;
        }[];
        收藏: {
            文件: { path: string; template: string }[];
            fetch: myFetch[];
        };
        常用语言: string[];
    };
    额外截屏器: {
        命令: string;
        位置: string;
    };
    连拍: {
        数: number;
        间隔: number;
    };
    广截屏: {
        模式: "自动" | "定时";
        t: number;
        方向: "y" | "xy";
    };
    高级图片编辑: {
        配置: {
            name: string;
            raduis: number;
            outerRadius: boolean;
            "shadow.x": number;
            "shadow.y": number;
            "shadow.blur": number;
            "shadow.color": string;
            "padding.x": number;
            "padding.y": number;
            autoPadding: boolean;
            bgType:
                | "color"
                | "image"
                | "linear-gradient"
                | "radial-gradient"
                | "conic-gradient";
            bgColor: string;
            bgUrl: string;
            "bg.gradient.repeat": boolean;
            "bg.gradient.repeatSize": number | `${number}px`;
            "bg.gradient.angle": number;
            "bg.gradient.x": number; // 0-1
            "bg.gradient.y": number; // 0-1
            "bg.gradient": { offset: number; color: string }[];
        }[];
        默认配置: string;
    };
    网络: {
        github镜像: {
            启用: boolean;
            base: string;
            api: string;
        };
    };
}

type 功能列表 = [
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
];

type 功能 = 功能列表[number];

type EditType = {
    select: "rect" | "free" | "draw";
    draw: "free" | "eraser" | "spray";
    shape:
        | "line"
        | "circle"
        | "rect"
        | "polyline"
        | "polygon"
        | "text"
        | "number"
        | "arrow"
        | "mask";
    filter:
        | "pixelate"
        | "blur"
        | "brightness"
        | "contrast"
        | "saturation"
        | "hue"
        | "noise"
        | "invert"
        | "sepia"
        | "bw"
        | "brownie"
        | "vintage"
        | "koda"
        | "techni"
        | "polaroid"
        | "gray_average"
        | "gray_lightness"
        | "gray_luminosity"
        | "gamma";
};

type MainWinType = {
    type: "text" | "ocr" | "image" | "qr";
    content: string;
    mode?: setting["主页面"]["模式"];
    arg0?: string;
    time?: number;
};

type translateWinType = {
    img: string;
    rect: { x: number; y: number; w: number; h: number };
    dipRect: { x: number; y: number; w: number; h: number };
    displayId: number;
    type: "live" | "ding";
};

type myFetch = {
    name: string;
    url: string;
    method: "get" | "post";
    headers: Record<string, string>;
    body: string;
    getter: (string | number)[];
};

type Dire =
    | "move"
    | "西北"
    | "东南"
    | "东北"
    | "西南"
    | "西"
    | "东"
    | "北"
    | "南"
    | "";

type DingStart = {
    id: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
    d: Dire;
};

type DingResize = {
    id: string;
    zoom: number;
    dx: number;
    dy: number;
    clip: boolean | undefined;
};

type BrowserAction =
    | "close"
    | "top"
    | "back"
    | "forward"
    | "stop"
    | "reload"
    | "home"
    | "dev";

type EditToolsType =
    | "save"
    | "undo"
    | "redo"
    | "copy"
    | "cut"
    | "paste"
    | "delete"
    | "select_all"
    | "delete_enter"
    | "show_find"
    | "show_history"
    | "edit_on_other"
    | "choose_editer"
    | "wrap"
    | "spellcheck"
    | "excel"
    | "md_table"
    | "link"
    | "search"
    | "translate";

type GithubUrlType = Omit<keyof setting["网络"]["github镜像"], "启用">;

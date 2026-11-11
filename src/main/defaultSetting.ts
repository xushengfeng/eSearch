import { app } from "electron";
import { matchFitLan } from "xtranslator";
import { githubMirrorList } from "../../lib/github_mirror";
import { getLans } from "../../lib/translate/translate";
import type { setting } from "../ShareTypes";

const isMac = process.platform === "darwin";

// 默认设置
const defaultSetting: setting = {
    设置版本: app.getVersion(),
    启动提示: true,
    dev: false,
    保留截屏窗口: true,
    语言: { 语言: matchBestLan() },
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
        dingLive: "",
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
        dingLive: "",
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
        select: { 副: { rect: "1+2", free: "1+3", draw: "1+4" } },
        more: { 键: "0" },
        draw: { 副: { free: "2+3", eraser: "2+4", spray: "2+5" } },
        shape: {
            副: {
                line: "3+4",
                circle: "3+5",
                rect: "3+6",
                polyline: "",
                polygon: "",
                text: "",
                number: "",
                arrow: "",
                mask: "3+e",
            },
        },
        filter: {
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
                emphasis: "#D7E3F8",
                barbg: "#D7E3F8",
                bg: "#FAFAFF",
                fontColor: "#1A1C1E",
                fontInEmphasis: "#1A1C1E",
                iconColor:
                    "invert(6%) sepia(11%) saturate(695%) hue-rotate(169deg) brightness(95%) contrast(88%)",
            },
            dark: {
                emphasis: "#3B4858",
                barbg: "#3B4858",
                bg: "#1A1C1E",
                fontColor: "#FAFAFF",
                fontInEmphasis: "#FAFAFF",
                iconColor:
                    "invert(99%) sepia(21%) saturate(4777%) hue-rotate(180deg) brightness(109%) contrast(106%)",
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
            "dingLive",
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
            图像识别: true,
            最小阈值: 50,
            最大阈值: 150,
        },
        识别窗口: true,
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
        编辑栏: {
            功能: [
                "draw.free",
                "shape.rect",
                "shape.text",
                "shape.arrow",
                "shape.number",
                "filter.pixelate",
            ],
        },
        复制偏移: {
            x: 10,
            y: 10,
        },
        形状属性: {
            arrow: {
                sw: 3,
                arrowW: 10,
                arrowH: 16,
                arrowType: "stroke",
            },
            mask: { fc: "#0005" },
        },
        记忆: {
            select: "rect",
        },
        收藏: {
            color: [],
            形状: [],
        },
    },
    OCR: {
        类型: "0",
        离线切换: true,
        识别段落: true,
        整体方向识别: false,
        全局det路径: "ppocr6_small_det.onnx",
    },
    离线OCR: [
        {
            id: "0",
            name: "默认",
            detPath: "",
            recPath: "",
            dicPath: "",
            scripts: ["zh-HANS", "en"],
            accuracy: "low",
            speed: "fast",
            optimize: {
                space: false,
            },
        },
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
        复制为文件: false,
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
            独立窗口: false,
        },
        强制鼠标穿透: "",
        动态: {
            帧率: 30,
            最大数量: 4,
        },
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
        复用后聚焦: true,
        失焦关闭: false,
        简洁模式: false,
        显示图片区: 10,
        自动复制OCR: false,
        复制OCR后提示: false,
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
            码率: 2.5,
            帧率: 30,
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
        超级录屏: {
            编码选择: "性能优先",
            关键帧间隔: 150,
            格式: "gif",
            缩放: 2,
            导出后关闭: false,
        },
    },
    屏幕翻译: {
        type: "ding",
        dTime: 3000,
        color: { bg: "rgb(255,255,255,0.5)", text: "" },
        语言: {
            from: "auto",
            to: matchBestLan(),
        },
    },
    翻译: {
        翻译器: [],
        收藏: {
            fetch: [],
            文件: [],
        },
        常用语言: [],
        Firefox本地模型: {},
    },
    额外截屏器: { 命令: "", 位置: "" },
    使用XDGDesktopPortal: false,
    自定义屏幕属性: [],
    连拍: {
        数: 5,
        间隔: 100,
    },
    广截屏: {
        模式: "自动",
        t: 800,
        方向: "y",
        显示模式: "自动",
    },
    高级图片编辑: { 配置: [], 默认配置: "" },
    网络: {
        github镜像: {
            启用: true,
            api: githubMirrorList.api[
                Math.floor(Math.random() * githubMirrorList.api.length)
            ],
            base: githubMirrorList.base[
                Math.floor(Math.random() * githubMirrorList.base.length)
            ],
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

export { matchBestLan };
export default defaultSetting;

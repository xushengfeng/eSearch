import fs from "node:fs";
import { checkbox, confirm, select } from "@inquirer/prompts";
import type { setting } from "../../src/ShareTypes";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { xset } from "../../lib/store/parse.ts";

type state = boolean | null;

const testList: {
    name: string;
    crossState?: true; // win mac linux
    config?: Record<string, unknown>;
}[] = [
    { name: "截屏.框选裁切" },
    { name: "截屏.取色器" },
    { name: "截屏.自由画笔" },
    { name: "截屏.几何" },
    { name: "截屏.马赛克" },
    { name: "截屏.模糊" },
    { name: "截屏.方向键调节" },
    { name: "截屏.四则运算式" },
    {
        name: "截屏.autodo",
        config: {
            框选后默认操作: "ocr",
        },
    },
    { name: "截屏.保存", crossState: true },
    { name: "截屏.保存到剪贴板", crossState: true },
    { name: "截屏.滚动截屏", crossState: true },
    { name: "ocr.识别文字" },
    { name: "主页面.ocr同步" },
    { name: "主页面.搜索" },
    { name: "主页面.校对" },
    { name: "主页面.翻译" },
    { name: "主页面.翻译.复制" },
    { name: "主页面.翻译.保存" },
    { name: "主页面.以图搜图.yandex" },
    { name: "主页面.以图搜图.ai" },
    { name: "贴图.多个", crossState: true },
    { name: "贴图.滚轮缩放" },
    { name: "贴图.局部放大" },
    { name: "贴图.透明" },
    { name: "贴图.归位" },
    { name: "贴图.鼠标穿透", crossState: true },
    { name: "贴图.翻译" },
    { name: "贴图.变换" },
    { name: "屏幕翻译" },
    { name: "二维码" },
    { name: "标准录屏", crossState: true },
    { name: "标准录屏.摄像头", crossState: true },
    { name: "标准录屏.麦克风", crossState: true },
    { name: "标准录屏.系统声音", crossState: true },
    { name: "标准录屏.短视频" },
    { name: "标准录屏.长视频" },
    { name: "标准录屏.光标和键盘" },
    { name: "标准录屏.虚拟背景" },
    { name: "截屏美化" },
];

const testResultsPath = "./test_results.json";
const testConfigTempPath = path.join(os.tmpdir(), "eSearch_test_dir");
const testResults: { name: string; state: state }[] = fs.existsSync(
    testResultsPath,
)
    ? JSON.parse(fs.readFileSync(testResultsPath, "utf-8"))
    : [];

const isMac = process.platform === "darwin";

const defaultSetting: setting = {
    首次运行: false,
    设置版本: "15.0.0",
    启动提示: true,
    dev: false,
    保留截屏窗口: true,
    语言: { 语言: "zh-HANS" },
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
                fontInEmphasis: "#000",
                iconColor: "none",
            },
            dark: {
                barbg: "#000000",
                bg: "#000000",
                emphasis: "#333",
                fontColor: "#fff",
                fontInEmphasis: "#fff",
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
        类型: "0",
        离线切换: true,
        识别段落: true,
        整体方向识别: false,
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
            启用: true,
            api: "https://api.kkgithub.com/",
            base: "https://github.moeyy.xyz/https://github.com/",
        },
    },
};

const testResultsL = testList.map((test) => {
    const result = testResults.find((r) => r.name === test.name);
    return {
        name: test.name,
        config: test.config ?? {},
        state: result?.state ?? null,
    };
});

function saveTestResults(results: { name: string; state: state }[]) {
    for (const i of testResultsL) {
        i.state = results.find((x) => x.name === i.name)?.state ?? null;
    }
    fs.writeFileSync(testResultsPath, JSON.stringify(results, null, 4));
}

async function selectTest() {
    const toTest = testResultsL.filter((i) => i.state === null);
    if (toTest.length === 0) {
        console.log("无需要测试项目");
    } else {
        if (!(await confirm({ message: "进行测试" }))) return;
    }

    const toT = await select({
        message: "选择进行的测试",
        choices: toTest.map((i) => ({ name: i.name, value: i.name })),
    });

    const settingX = structuredClone(defaultSetting);
    const c = toTest.find((i) => i.name === toT)?.config;
    if (c) {
        // @ts-expect-error
        for (const [k, v] of Object.entries(c)) xset(settingX, k, v);
    }
    fs.writeFileSync(
        path.join(testConfigTempPath, "config.json"),
        JSON.stringify(settingX, null, 4),
    );
    execSync(
        `"${"../../build/linux-unpacked/e-search"}" --userData "${testConfigTempPath}"`,
    );

    const result = await select({
        message: "运行结束，选择测试结果",
        choices: [
            { name: "通过", value: true },
            { name: "失败", value: false },
            { name: "搁置", value: null },
        ],
    });
    saveTestResults(
        testResultsL.map((i) => ({
            name: i.name,
            state: i.name === toT ? result : i.state,
        })),
    );
    await selectTest();
}

try {
    fs.rmSync(testConfigTempPath, { recursive: true });
    fs.mkdirSync(testConfigTempPath, { recursive: true });
} catch (error) {}

console.log(
    `共${testResultsL.length}个测试，通过${testResultsL.filter((i) => i.state === true).length}，未通过${testResultsL.filter((i) => i.state === false).length}，将进行${testResultsL.filter((i) => i.state === null).length}个测试`,
);

const isEdit = await confirm({
    message: "是否编辑需要测试的项目？",
});

if (isEdit) {
    const r = testResultsL.map((i) => ({
        name: `${i.name}${i.state === false ? " (失败)" : ""}`,
        checked: i.state === null,
        value: i.name,
    }));
    const results = await checkbox({
        message: "请选择需要测试的功能",
        choices: r,
    });
    const x: { name: string; state: state }[] = testResultsL.map((i) => ({
        name: i.name,
        state: results.includes(i.name) ? null : i.state,
    }));
    saveTestResults(x);
}

await selectTest();

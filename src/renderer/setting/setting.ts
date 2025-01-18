import type { setting, 功能 } from "../../ShareTypes";
import type { SettingPath, GetValue } from "../../../lib/store/renderStore";
import {
    ele,
    type ElType,
    input,
    pureStyle,
    txt,
    view,
    setTranslate,
    radioGroup,
    trackPoint,
    button,
    label,
    image,
    addStyle,
    p,
    noI18n,
    pack,
    addClass,
} from "dkh-ui";
import store from "../../../lib/store/renderStore";
import { initStyle, getImgUrl } from "../root/root";
import { t, lan } from "../../../lib/translate/translate";
const { ipcRenderer } = require("electron") as typeof import("electron");

type settingItem<t extends SettingPath> = {
    [key in t]: {
        name: string;
        desc?: string;
        el: (value: GetValue<setting, key>) => ElType<HTMLElement>;
    };
};

const s: Partial<settingItem<SettingPath>> = {
    工具栏跟随: {
        name: "工具栏跟随",
        el: (v) =>
            xSelect<typeof v>(
                [{ value: "展示内容优先" }, { value: "效率优先" }],
                "工具栏跟随",
            ),
    },
    "工具栏.按钮大小": {
        name: "按钮大小",
        el: () => xRange({ min: 16, max: 80, text: "px" }),
    },
    "工具栏.按钮图标比例": {
        name: "图标比例",
        el: () => xRange({ min: 0.01, max: 1, step: 0.01 }),
    },
    // todo 排序
    "工具栏.初始位置": {
        name: "工具栏位置",
        el: (v) => {
            const el = view();
            const iEvent = () => el.el.dispatchEvent(new CustomEvent("input"));
            const l = input().addInto(el).on("input", iEvent);
            const t = input().addInto(el).on("input", iEvent);
            const b = view().addInto(el);
            button("左上")
                .addInto(b)
                .on("click", () => {
                    l.sv("10px");
                    t.sv("100px");
                    iEvent();
                });
            button("右上")
                .addInto(b)
                .on("click", () => {
                    const size = store.get("工具栏.按钮大小");
                    l.sv(`calc(100vw - 10px - ${size} * 2 - 8px)`);
                    t.sv("100px");
                    iEvent();
                });
            return el
                .bindGet(() => {
                    return {
                        left: l.gv,
                        top: t.gv,
                    };
                })
                .bindSet((_v: typeof v) => {
                    l.sv(_v.left);
                    t.sv(_v.top);
                });
        },
    },
    "工具栏.稍后出现": {
        name: "稍后出现",
        desc: "截屏时，工具栏和绘制栏都会隐藏，直到调整完框选",
        el: () => xSwitch(),
    },
    "鼠标跟随栏.显示": {
        name: "显示鼠标跟随栏",
        el: () => xSwitch(),
    },
    "取色器.显示": {
        name: "显示取色器",
        el: () => xSwitch(),
    },
    "取色器.大小": {
        name: "取色器大小",
        el: () => xRange({ min: 1, max: 31, step: 2 }),
    },
    "取色器.像素大小": {
        name: "取色器像素大小",
        el: () => xRange({ min: 1, max: 10, text: "px" }),
    },
    // todo 取色器预览
    "取色器.默认格式": {
        name: "取色器默认格式",
        el: () =>
            xSelect(
                [
                    { value: "HEX", name: "HEX" },
                    { value: "RGB", name: "rgb" },
                    { value: "HSL", name: "hsl" },
                    { value: "HSV", name: "hsv" },
                    { value: "HWB", name: "hwb" },
                    { value: "LAB", name: "lab" },
                    { value: "LCH", name: "lch" },
                    { value: "OKLAB", name: "Oklab" },
                    { value: "OKLCH", name: "Oklch" },
                    { value: "CMYK", name: "CMYK" },
                ],
                "取色器默认格式",
            ),
    },
    "框选.颜色.遮罩": {
        name: "遮罩颜色",
        el: () => xColor(),
    },
    显示四角坐标: {
        name: "显示四角坐标",
        desc: "截屏框选附近除了框选大小，还会加上左上角和右下角坐标",
        el: () => xSwitch(),
    },
    框选后默认操作: {
        name: "框选后默认操作",
        desc: "框选完鼠标松开一瞬间，执行操作",
        el: () =>
            xSelect(
                [
                    { value: "no", name: t("无") },
                    ...tools
                        .filter((i) => i.key !== "close" && i.key !== "screens")
                        .map((i) => ({
                            value: i.key,
                            name: iconEl(i.icon).style({
                                width: "24px",
                                position: "initial",
                            }),
                        })),
                ],
                "框选后默认操作",
            ),
    },
    "框选.自动框选.图像识别": {
        name: "框选图像识别",
        desc: "使用OpenCV自动识别边缘轮廓",
        el: () => xSwitch(),
    },
    // todo 边缘识别高级设置
    "框选.记忆.开启": {
        name: "记住框选大小",
        desc: "开启后默认不启用自动框选",
        el: () => xSwitch(),
    },
    "框选.参考线.选区": {
        name: "框选参考线",
        el: (_V) => {
            function x() {
                return input()
                    .bindSet((v: number[], el) => {
                        el.value = v.join(", ");
                        i();
                    })
                    .bindGet((el) =>
                        el.value
                            .split(/[,，]/)
                            .filter(Boolean)
                            .map((i) => Number(i)),
                    )
                    .on("input", i);
            }
            function i() {
                el.el.dispatchEvent(new CustomEvent("input"));
            }
            const xEl = x();
            const yEl = x();
            const el = view()
                .add([
                    view().add([xEl, yEl]),
                    view().add([
                        button(txt("无")).on("click", () => {
                            xEl.sv([]);
                            yEl.sv([]);
                        }),
                        button(txt("九宫格")).on("click", () => {
                            const v = 0.333;
                            xEl.sv([v, 1 - v]);
                            yEl.sv([v, 1 - v]);
                        }),
                        button(txt("黄金比例")).on("click", () => {
                            const v = 0.618;
                            xEl.sv([v, 1 - v]);
                            yEl.sv([v, 1 - v]);
                        }),
                    ]),
                ])
                .bindGet(() => ({
                    x: xEl.gv,
                    y: yEl.gv,
                }))
                .bindSet((v: typeof _V) => {
                    xEl.sv(v.x);
                    yEl.sv(v.y);
                });
            return el;
        },
    },
    "框选.颜色.选区参考线": {
        name: "框选参考线颜色",
        el: () => xColor(),
    },
    "框选.参考线.光标": { name: "光标参考线", el: () => xSwitch() },
    "框选.颜色.光标参考线": { name: "光标参考线颜色", el: () => xColor() },
    "快速截屏.模式": {
        name: "快速截屏模式",
        el: (v) =>
            xSelect<typeof v>(
                [
                    { value: "clip", name: "剪贴板" },
                    { value: "path", name: "目录" },
                ],
                "快速截屏模式",
            ),
    },
    "快速截屏.路径": { name: "快速截屏路径", el: () => xPath() },
    "连拍.数": { name: "单次连拍数量", el: () => xRange({ min: 2, max: 25 }) },
    "连拍.间隔": {
        name: "连拍间隔时间",
        el: () => xRange({ min: 10, max: 1000, text: "ms" }),
    },
    "广截屏.模式": {
        name: "广截屏模式",
        el: (v) =>
            xSelect<typeof v>(
                [{ value: "自动" }, { value: "定时" }],
                "广截屏模式",
            ),
    },
    "广截屏.t": {
        name: "广截屏定时间隔",
        el: () => xRange({ min: 10, max: 1000, text: "ms" }),
    },
    "图像编辑.默认属性.填充颜色": { name: "默认填充颜色", el: () => xColor() },
    "图像编辑.默认属性.边框颜色": { name: "默认边框颜色", el: () => xColor() },
    "图像编辑.默认属性.边框宽度": {
        name: "默认边框宽度",
        el: () => xRange({ min: 0, max: 20, text: "px" }),
    },
    "图像编辑.默认属性.画笔颜色": { name: "默认画笔颜色", el: () => xColor() },
    "图像编辑.默认属性.画笔粗细": {
        name: "默认画笔粗细",
        el: () => xRange({ min: 0, max: 20, text: "px" }),
    },
    "图像编辑.复制偏移.x": {
        name: "复制偏移x轴",
        el: () => xRange({ min: -50, max: 50, text: "px" }),
    },
    "图像编辑.复制偏移.y": {
        name: "复制偏移y轴",
        el: () => xRange({ min: -50, max: 50, text: "px" }),
    },
    "图像编辑.arrow.type": {
        name: "箭头样式",
        el: (v) =>
            xSelect<typeof v>(
                [
                    { value: "fill", name: "实心" },
                    { value: "stroke", name: "空心" },
                ],
                "箭头样式",
            ),
    },
    "图像编辑.arrow.w": {
        name: "箭头高度",
        el: () => xRange({ min: 0, max: 50, text: "px" }),
    },
    "图像编辑.arrow.h": {
        name: "箭头宽度",
        el: () => xRange({ min: 0, max: 50, text: "px" }),
    },
    "OCR.离线切换": {
        name: "OCR离线切换",
        desc: "离线时切换离线OCR",
        el: () => xSwitch(),
    },
    "OCR.识别段落": {
        name: "识别段落",
        el: () => xSwitch(),
    },
    // todo 模型拖拽与下载
    "在线OCR.baidu.url": {
        name: "百度OCR类型",
        desc: "位置版不起实质效果，但可以扩充免费使用次数:)",
        el: () =>
            xSelect(
                [
                    {
                        value: "https://aip.baidubce.com/rest/2.0/ocr/v1/general",
                        name: "标准含位置版",
                    },
                    {
                        value: "https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic",
                        name: "标准版",
                    },
                    {
                        value: "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate",
                        name: "高精度含位置版",
                    },
                    {
                        value: "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic",
                        name: "高精度版",
                    },
                    {
                        value: "https://aip.baidubce.com/rest/2.0/ocr/v1/formula",
                        name: "公式",
                    },
                    {
                        value: "https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting",
                        name: "手写文字",
                    },
                    {
                        value: "https://aip.baidubce.com/rest/2.0/ocr/v1/table",
                        name: "表格",
                    },
                ],
                "百度OCR类型",
            ),
    },
    "在线OCR.baidu.id": {
        name: "API Key",
        el: () => xSecret(),
    },
    "在线OCR.baidu.secret": {
        name: "Secret Key：",
        el: () => xSecret(),
    },
    "在线OCR.youdao.id": {
        name: "应用ID",
        el: () => xSecret(),
    },
    "在线OCR.youdao.secret": {
        name: "应用秘钥",
        el: () => xSecret(),
    },
    "AI.运行后端": {
        name: "运行后端",
        el: (v) =>
            xSelect<typeof v>(
                [
                    { value: "cpu", name: "CPU" },
                    { value: "cuda", name: "CUDA" },
                    { value: "coreml", name: "coreML" },
                    { value: "directml", name: "DirectML" },
                ],
                "运行后端",
            ),
    },
    // todo 在线模型
    "录屏.自动录制": {
        name: "自动录制",
        desc: "超级录屏默认开启",
        el: () => xSwitch(),
    },
    "录屏.自动录制延时": {
        name: "自动录制",
        el: () => xRange({ min: 0, max: 10, text: "s" }),
    },
    "录屏.视频比特率": {
        name: "视频比特率",
        el: () => xRange({ min: 1, max: 40, text: "Mbps", step: 0.5 }),
    },
    "录屏.提示.键盘.开启": {
        name: "录屏键盘提示",
        el: () => xSwitch(),
    },
    // todo 位置
    "录屏.提示.键盘.位置.offsetX": {
        name: "键盘提示偏移x",
        el: () => xRange({ min: 0, text: "px" }),
    },
    "录屏.提示.键盘.位置.offsetY": {
        name: "键盘提示偏移y",
        el: () => xRange({ min: 0, text: "px" }),
    },
    "录屏.提示.键盘.大小": {
        name: "键盘提示大小",
        el: () => xRange({ min: 0.25, max: 5, step: 0.25 }),
    },
    "录屏.提示.鼠标.开启": {
        name: "开启鼠标按键提示",
        el: () => xSwitch(),
    },
    "录屏.提示.光标.开启": {
        name: "开启光标提示",
        el: () => xSwitch(),
    },
    "录屏.提示.光标.样式": {
        name: "光标提示样式",
        el: () => ele("textarea"),
    },
    "录屏.摄像头.默认开启": {
        name: "默认开启摄像头",
        el: () => xSwitch(),
    },
    "录屏.摄像头.记住开启状态": {
        name: "记住摄像头开启状态",
        el: () => xSwitch(),
    },
    "录屏.摄像头.镜像": {
        name: "镜像",
        el: () => xSwitch(),
    },
    "录屏.摄像头.背景.模式": {
        name: "摄像头背景",
        el: (v) =>
            xSelect<typeof v>(
                [
                    { value: "none", name: "正常" },
                    { value: "hide", name: "隐藏" },
                    { value: "blur", name: "模糊" },
                    { value: "img", name: "图片" },
                    { value: "video", name: "视频" },
                ],
                "摄像头背景",
            ),
    },
    "录屏.摄像头.背景.模糊": {
        name: "背景模糊程度",
        el: () => xRange({ min: 1, max: 120, text: "px" }),
    },
    "录屏.摄像头.背景.imgUrl": { name: "背景图片路径", el: () => xPath() },
    "录屏.摄像头.背景.videoUrl": { name: "背景视频路径", el: () => xPath() },
    "录屏.摄像头.背景.fit": {
        name: "图片或视频填充模式",
        el: (v) =>
            xSelect<typeof v>(
                [
                    { value: "cover", name: "裁剪适应" },
                    { value: "fit", name: "拉伸填充" },
                ],
                "图片或视频填充模式",
            ),
    },
    "录屏.音频.默认开启": { name: "默认开启音频", el: () => xSwitch() },
    "录屏.音频.记住开启状态": { name: "记录音频开启状态", el: () => xSwitch() },
    "录屏.转换.自动转换": { name: "自动转换", el: () => xSwitch() },
    "录屏.转换.分段": {
        name: "分段转换间隔时间",
        desc: "边录制边转换以提升效率，0为不分段",
        el: () => xNumber("s"),
    },
    "录屏.转换.格式": {
        name: "输出格式",
        el: () => input(),
    },
    "录屏.转换.码率": {
        name: "码率",
        desc: "超级录屏也适用",
        el: () => xNumber("Mbps"),
    },
    "录屏.转换.帧率": {
        name: "帧率",
        desc: "超级录屏也适用",
        el: () => xNumber("fps"),
    },
    "录屏.转换.其他": {
        name: "FFmpegff其他参数",
        el: () => input(),
    },
    "录屏.转换.高质量gif": {
        name: "高质量 Gif",
        desc: "转换时速度会很慢",
        el: () => xSwitch(),
    },
    "录屏.超级录屏.编码选择": {
        name: "编码选择",
        desc: "视具体硬件支持",
        el: (v) =>
            xSelect<typeof v>(
                [{ value: "性能优先" }, { value: "内存优先" }],
                "编码选择",
            ),
    },
    "录屏.超级录屏.关键帧间隔": {
        name: "关键帧间隔",
        desc: "越小处理速度越快，但会增加内存占用",
        el: () => xRange({ max: 500, min: 1 }),
    },
    "录屏.超级录屏.自动停止录制": {
        name: "自动停止录制",
        el: () => xNumber("min"),
    },
    "录屏.超级录屏.导出后关闭": {
        name: "导出后关闭",
        el: () => xSwitch(),
    },
    "保存名称.前缀": {
        name: "文件名称前缀",
        el: () => input(),
    },
    "保存名称.时间": {
        name: "文件名称时间",
        el: () => input(),
    },
    "保存名称.后缀": {
        name: "文件名称后缀",
        el: () => input(),
    },
    // todo 预览
    // 代码提示
    // todo 移除保存格式，使用上次记住的
    // todo 根据文件后缀识别
    // todo 不记住svg
    "保存.保存并复制": {
        name: "保存并复制",
        el: () => xSwitch(),
    },
    "保存.快速保存": {
        name: "快速保存",
        desc: "按下保存键后，默认保存到上次保存的位置，无需选择",
        el: () => xSwitch(),
    },
    "贴图.窗口.双击": {
        name: "双击",
        desc: "设定双击窗口行为",
        el: (v) =>
            xSelect<typeof v>(
                [{ value: "归位" }, { value: "关闭" }],
                "设定双击窗口行为",
            ),
    },
    // todo 窗口变换
    "贴图.窗口.提示": {
        name: "提示",
        desc: "使用阴影提示贴图窗口",
        el: () => xSwitch(),
    },
    // todo 翻译引擎选择与编辑
    // todo 翻译语言
    "屏幕翻译.dTime": {
        name: "自动屏幕翻译定时",
        el: () => xNumber("ms"),
    },
    // todo 生词本
    // todo 移除记住字体大小
    "编辑器.自动换行": {
        name: "自动换行",
        el: () => xSwitch(),
    },
    "编辑器.拼写检查": {
        name: "拼写检查",
        el: () => xSwitch(),
    },
    "编辑器.行号": {
        name: "行号",
        el: () => xSwitch(),
    },
    "历史记录设置.保留历史记录": {
        name: "保留历史记录",
        el: () => xSwitch(),
    },
    "历史记录设置.自动清除历史记录": {
        name: "自动清除历史记录",
        el: () => xSwitch(),
    }, // todo 隐藏设置
    "历史记录设置.d": {
        name: "历史记录保存天数",
        el: () => xNumber(t("天"), { step: 0.5 }), // todo 移除小时设置
    },
    // todo 清空所有文字记录
    时间格式: {
        name: "时间格式",
        el: () => input(),
    },
    "主页面.高级窗口按钮": {
        name: "高级窗口按钮",
        el: () => xSwitch(),
    },
    "主页面.显示图片区": {
        name: "显示图片区",
        desc: "OCR结果行数大于等于该值，自动显示图片区。0为不显示", // todo 再多一个设置
        el: () => xRange({ min: 0, max: 35, step: 1 }),
    },
    "主页面.自动复制OCR": {
        name: "自动复制OCR结果",
        el: () => xSwitch(),
    },
    自动搜索: {
        name: "自动搜索",
        desc: "识屏或直接打开主页面，若文字为一行，则自动搜索",
        el: () => xSwitch(),
    },
    自动打开链接: {
        name: "自动打开链接",
        el: () => xSwitch(),
    },
    自动搜索中文占比: {
        name: "自动搜索中文占比",
        desc: "在中英混合中，数值越小，则整段文字越容易被程序认为是中文主要", // todo 用语言库 区分母语
        el: () => xRange({ min: 0.002, max: 1, step: 0.01 }),
    },
    // todo 搜索引擎与翻译引擎
    // todo 移除识图引擎
    浏览器中打开: {
        name: "浏览器中打开",
        desc: "点击搜索或翻译按钮后，将在系统默认浏览器打开搜索结果，否则在一个新的软件窗口打开",
        el: () => xSwitch(),
    },
    "浏览器.标签页.自动关闭": {
        name: "搜索窗口自动关闭",
        desc: "浏览器打开后自动关闭标签页",
        el: () => xSwitch(),
    },
    "浏览器.标签页.小": {
        name: "标签缩小",
        desc: "标签将只显示图标，悬浮查看标题，中键或右键关闭",
        el: () => xSwitch(),
    },
    "浏览器.标签页.灰度": {
        name: "标签图标灰度",
        desc: "标签图标将以灰度图片展示，减少多余颜色的干扰",
        el: () => xSwitch(),
    },
    // todo 清除数据
    // todo 快捷键😱
    // todo auto start
    启动提示: {
        name: "启动提示",
        desc: "将通过系统通知提示启动",
        el: () => xSwitch(),
    },
    // todo 语言
    // todo 自动搜索排除
    "主搜索功能.剪贴板选区搜索": {
        name: "剪贴板选区搜索",
        desc: "使用选区内容",
        el: () => xSwitch(),
    },
    // todo 主题
    // todo 模糊和透明
    "全局.深色模式": {
        name: "深色模式",
        el: (v) =>
            xSelect<typeof v>(
                [
                    { value: "system", name: "跟随系统" },
                    { value: "light", name: "浅色" },
                    { value: "dark", name: "深色" },
                ],
                "深色模式",
            ),
    },
    "全局.缩放": {
        name: "全局缩放",
        el: () => xRange({ min: 0.1, max: 3, step: 0.05 }),
    },
    "字体.主要字体": {
        name: "主要字体",
        desc: "适用于大部分文字字体",
        el: () => input(), // todo api选择
    },
    "字体.等宽字体": {
        name: "等宽字体",
        desc: "适用于数字、颜色代码等字体",
        el: () => input(),
    },
    "代理.mode": {
        name: "代理",
        el: (v) =>
            // @ts-ignore
            xSelect<typeof v>(
                [
                    { value: "system", name: "系统代理" },
                    { value: "fixed_servers", name: "固定服务器" },
                    { value: "pac_script", name: "PAC脚本" },
                    { value: "auto_detect", name: "自动检测" },
                    { value: "direct", name: "无代理" },
                ],
                "代理",
            ),
    },
    "代理.pacScript": {
        name: "PAC URL",
        el: () => input(), // todo 跟随上面设置
    },
    // todo rule
    "代理.proxyBypassRules": {
        name: "排除规则",
        el: () => input(),
    },
    // todo 高级设置
    硬件加速: {
        name: "硬件加速",
        desc: "如果可用，且更改需要重启软件生效",
        el: () => xSwitch(),
    },
    "额外截屏器.命令": {
        name: "命令",
        el: () => input(),
    },
    "额外截屏器.位置": {
        name: "位置",
        el: () => xPath(),
    },
    保留截屏窗口: {
        name: "保留截屏窗口",
        desc: "内存占用多，截屏快；反之内存占用少，但截屏慢",
        el: () => xSwitch(),
    },
    "更新.频率": {
        name: "检查更新频率",
        el: (v) =>
            xSelect<typeof v>(
                [
                    { value: "manual", name: "手动" },
                    { value: "start", name: "启动时检查" },
                ],
                "检查更新频率",
            ),
    },
    "更新.模式": {
        name: "更新模式",
        el: (v) =>
            xSelect<typeof v>(
                [
                    { value: "大版本", name: "大版本" },
                    { value: "小版本", name: "小版本" },
                    { value: "dev", name: "开发版" },
                ],
                "更新模式",
            ),
    },
    "更新.忽略版本": {
        name: "忽略版本",
        desc: "忽略版本号以跳过更新",
        el: () => input(),
    },
    // todo 位置信息
    dev: {
        name: "开发者模式",
        el: () => xSwitch(),
    },
    // todo 版本信息
};

// todo log没创建的key

const main: {
    pageName: string;
    settings?: SettingPath[];
    desc?: string;
    items?: { title: string; settings: SettingPath[] }[];
}[] = [
    {
        pageName: "截屏",
        items: [
            {
                title: "工具栏",
                settings: [
                    "工具栏跟随",
                    "工具栏.按钮大小",
                    "工具栏.按钮图标比例",
                    "工具栏.初始位置",
                    "工具栏.稍后出现",
                ],
            },
            { title: "鼠标跟随栏", settings: ["鼠标跟随栏.显示"] },
            {
                title: "取色器",
                settings: [
                    "取色器.显示",
                    "取色器.大小",
                    "取色器.像素大小",
                    "取色器.默认格式",
                ],
            },
            {
                title: "框选",
                settings: [
                    "框选.颜色.遮罩",
                    "显示四角坐标",
                    "框选后默认操作",
                    "框选.自动框选.图像识别",
                    "框选.记忆.开启",
                    "框选.参考线.选区",
                    "框选.颜色.选区参考线",
                ],
            },
            {
                title: "光标",
                settings: ["框选.参考线.光标", "框选.颜色.光标参考线"],
            },
            {
                title: "快速截屏",
                settings: ["快速截屏.模式", "快速截屏.路径"],
            },
            { title: "连拍", settings: ["连拍.数", "连拍.间隔"] },
            { title: "广截屏", settings: ["广截屏.模式", "广截屏.t"] },
        ],
    },
    {
        pageName: "图像编辑",
        items: [
            {
                title: "默认属性",
                settings: [
                    "图像编辑.默认属性.填充颜色",
                    "图像编辑.默认属性.边框颜色",
                    "图像编辑.默认属性.边框宽度",
                    "图像编辑.默认属性.画笔颜色",
                    "图像编辑.默认属性.画笔粗细",
                ],
            },
            {
                title: "复制偏移",
                settings: ["图像编辑.复制偏移.x", "图像编辑.复制偏移.y"],
            },
            {
                title: "箭头样式",
                settings: [
                    "图像编辑.arrow.type",
                    "图像编辑.arrow.w",
                    "图像编辑.arrow.h",
                ],
            },
        ],
    },
    {
        pageName: "OCR",
        settings: ["OCR.离线切换", "主页面.自动复制OCR"],
        items: [
            { title: "离线OCR", settings: ["OCR.识别段落"] },
            {
                title: "百度OCR",
                settings: [
                    "在线OCR.baidu.url",
                    "在线OCR.baidu.id",
                    "在线OCR.baidu.secret",
                ],
            },
            {
                title: "有道OCR",
                settings: ["在线OCR.youdao.id", "在线OCR.youdao.secret"],
            },
        ],
    },
    {
        pageName: "人工智能",
        desc: "配置OCR、录屏背景移除等人工智能",
        settings: ["AI.运行后端"],
    },
    {
        pageName: "录屏",
        desc: "分为标准录屏和超级录屏，标准录屏适合长时间录制，超级录屏适合录制操作演示，提供自动运镜效果",
        items: [
            {
                title: "自动录制",
                settings: ["录屏.自动录制", "录屏.自动录制延时"],
            },
            { title: "录制", settings: ["录屏.视频比特率"] },
            {
                title: "提示",
                settings: [
                    "录屏.提示.键盘.开启",
                    "录屏.提示.键盘.位置.offsetX",
                    "录屏.提示.键盘.位置.offsetY",
                    "录屏.提示.键盘.大小",
                    "录屏.提示.鼠标.开启",
                    "录屏.提示.光标.开启",
                    "录屏.提示.光标.样式",
                ],
            },
            {
                title: "摄像头",
                settings: [
                    "录屏.摄像头.默认开启",
                    "录屏.摄像头.记住开启状态",
                    "录屏.摄像头.镜像",
                    "录屏.摄像头.背景.模式",
                    "录屏.摄像头.背景.模糊",
                    "录屏.摄像头.背景.imgUrl",
                    "录屏.摄像头.背景.videoUrl",
                    "录屏.摄像头.背景.fit",
                ],
            },
            {
                title: "音频",
                settings: ["录屏.音频.默认开启", "录屏.音频.记住开启状态"],
            },
            {
                title: "转换",
                settings: [
                    "录屏.转换.自动转换",
                    "录屏.转换.分段",
                    "录屏.转换.格式",
                    "录屏.转换.码率",
                    "录屏.转换.帧率",
                    "录屏.转换.其他",
                    "录屏.转换.高质量gif",
                ],
            },
            {
                title: "超级录屏",
                settings: [
                    "录屏.超级录屏.编码选择",
                    "录屏.超级录屏.关键帧间隔",
                    "录屏.超级录屏.自动停止录制",
                    "录屏.超级录屏.导出后关闭",
                ],
            },
        ],
    },
    {
        pageName: "保存",
        settings: [
            "保存名称.前缀",
            "保存名称.时间",
            "保存名称.后缀",
            "保存.保存并复制",
            "保存.快速保存",
        ],
    },
    { pageName: "贴图", settings: ["贴图.窗口.双击", "贴图.窗口.提示"] },
    {
        pageName: "翻译",
        settings: [],
        items: [
            { title: "屏幕翻译", settings: ["屏幕翻译.dTime"] },
            { title: "生词本", settings: [] },
        ],
    },
    {
        pageName: "编辑器",
        items: [
            {
                title: "编辑器",
                settings: ["编辑器.自动换行", "编辑器.拼写检查", "编辑器.行号"],
            },
            {
                title: "历史记录",
                settings: [
                    "历史记录设置.保留历史记录",
                    "历史记录设置.自动清除历史记录",
                    "历史记录设置.d",
                    "时间格式",
                ],
            },
            {
                title: "界面",
                settings: ["主页面.高级窗口按钮", "主页面.显示图片区"],
            },
        ],
    },
    {
        pageName: "搜索与浏览",
        items: [
            {
                title: "自动",
                settings: ["自动搜索", "自动打开链接", "自动搜索中文占比"],
            },
            { title: "引擎", settings: [] },
            {
                title: "浏览",
                settings: [
                    "浏览器中打开",
                    "浏览器.标签页.自动关闭",
                    "浏览器.标签页.小",
                    "浏览器.标签页.灰度",
                ],
            },
        ],
    },
    {
        pageName: "全局",
        items: [
            { title: "启动", settings: ["启动提示"] },
            { title: "语言", settings: [] },
            { title: "主搜索功能", settings: ["主搜索功能.剪贴板选区搜索"] },
            {
                title: "全局样式",
                settings: [
                    "全局.深色模式",
                    "全局.缩放",
                    "字体.主要字体",
                    "字体.等宽字体",
                ],
            },
            {
                title: "代理",
                settings: [
                    "代理.mode",
                    "代理.pacScript",
                    "代理.proxyBypassRules",
                ],
            },
        ],
    },
    {
        pageName: "高级",
        items: [
            { title: "高级设置", settings: [] },
            {
                title: "外部截屏器",
                settings: ["额外截屏器.命令", "额外截屏器.位置"],
            },
            { title: "后台", settings: ["保留截屏窗口"] },
            {
                title: "检查更新",
                settings: ["更新.频率", "更新.模式", "更新.忽略版本"],
            },
            { title: "开发者模式", settings: ["dev"] },
        ],
    },
    // 关于
];

const sKeys = new Set(Object.keys(s));
const mKeys = new Set();

const getTitles = new Map<string, string[]>();
for (const p of main) {
    if (p.items)
        for (const i of p.items) {
            for (const s of i.settings) {
                getTitles.set(s, [p.pageName, i.title]);
                mKeys.add(s);
            }
        }
    if (p.settings)
        for (const s of p.settings) {
            getTitles.set(s, [p.pageName]);
            mKeys.add(s);
        }
}

console.log("s-m", sKeys.difference(mKeys), "m-s", mKeys.difference(sKeys));

const tools: { key: 功能; icon: string; title: string }[] = [
    { key: "close", icon: getImgUrl("close.svg"), title: t("关闭") },
    { key: "screens", icon: getImgUrl("screen.svg"), title: t("屏幕管理") },
    { key: "ocr", icon: getImgUrl("ocr.svg"), title: t("文字识别") },
    { key: "search", icon: getImgUrl("search.svg"), title: t("以图搜图") },
    { key: "QR", icon: getImgUrl("scan.svg"), title: t("二维码") },
    { key: "open", icon: getImgUrl("open.svg"), title: t("其他应用打开") },
    { key: "ding", icon: getImgUrl("ding.svg"), title: t("屏幕贴图") },
    { key: "record", icon: getImgUrl("record.svg"), title: t("录屏") },
    { key: "long", icon: getImgUrl("long_clip.svg"), title: t("广截屏") },
    {
        key: "translate",
        icon: getImgUrl("translate.svg"),
        title: t("屏幕翻译"),
    },
    {
        key: "editor",
        icon: getImgUrl("super_edit.svg"),
        title: t("高级图片编辑"),
    },
    { key: "copy", icon: getImgUrl("copy.svg"), title: t("复制") },
    { key: "save", icon: getImgUrl("save.svg"), title: t("保存") },
];

const xselectClass = addClass(
    {
        borderRadius: "8px",
        padding: "8px",
        margin: "2px",
        transition:
            "outline-color var(--transition), box-shadow var(--transition)",
        display: "inline-block",
        outlineColor: "transparent",
    },
    {
        "&:hover": {
            boxShadow: "var(--shadow)",
        },
        '&:has(input[type="radio"]:checked)': {
            outline: "2px dashed var(--m-color1)",
        },
    },
);

function renderSetting(settingPath: SettingPath) {
    const setting = s[settingPath];
    if (!setting) {
        const err = new Error(`Setting ${settingPath} not found`);
        console.error(err);
        return;
    }
    const el = setting
        // @ts-ignore
        .el(store.get(settingPath))
        .sv(store.get(settingPath))
        .on("input", () => {
            if (el.gv) {
                store.set(settingPath, el.gv);
                console.log(`Setting ${settingPath} updated to "${el.gv}"`);
            }
        });
    return view().add([p(setting.name, true), comment(setting.desc || ""), el]);
}

function iconEl(img: string) {
    return image(img, "icon").class("icon");
}

function comment(str: string) {
    return p(str, true).style({ color: "#0006" });
}

function xSelect<T extends string>(
    options: { value: T; name?: string | ElType<HTMLElement> }[],
    name: string,
) {
    const el = view("x", "wrap");
    const r = radioGroup(name);
    for (const option of options) {
        el.add(r.new(option.value, option.name).class(xselectClass));
    }
    r.on(() => el.el.dispatchEvent(new CustomEvent("input")));
    return el.bindGet(() => r.get()).bindSet((value: T) => r.set(value));
}

function xRange(
    op?: Partial<{ min: number; max: number; step: number; text: string }>,
) {
    // todo 非整数时精度
    const min = op?.min ?? 0;
    const max = op?.max ?? 100;
    const step = op?.step ?? 1;
    let value = min;
    function sv(v: number) {
        const nv = Math.round((v - min) / step) * step + min;
        const nv1 = Math.max(min, Math.min(max, nv));
        return nv1;
    }
    const el = view("x").style({ alignItems: "center" });
    const track = view()
        .style({
            width: "200px",
            height: "16px",
            borderRadius: "6px",
            overflow: "hidden",
            background: "var(--m-color2)",
        })
        .addInto(el);
    const thumb = view()
        .style({
            "background-color": "var(--m-color1)",
            borderRadius: "6px",
            height: "100%",
        })
        .addInto(track)
        .bindSet((v: number, el) => {
            el.style.width = `${((v - min) / (max - min)) * 100}%`;
        });
    const text = txt()
        .bindSet((v: number, el) => {
            el.textContent = `${sv(v)}${op?.text || ""}`;
        })
        .addInto(el);
    trackPoint(track, {
        ing: (_p, e) => {
            const x =
                (e.clientX - track.el.getBoundingClientRect().left) /
                track.el.offsetWidth;
            const v = sv(min + x * (max - min));
            thumb.sv(v);
            text.sv(v);
            value = v;
        },
        end: () => {
            el.el.dispatchEvent(new CustomEvent("input"));
        },
    });
    return el
        .bindGet(() => value)
        .bindSet((_v: number) => {
            const v = sv(_v);
            thumb.sv(v);
            text.sv(v);
            value = v;
        });
}

function xNumber(
    dw: string,
    op?: Partial<{ min: number; max: number; step: number }>,
) {
    const el = input("number");
    if (op?.max !== undefined) el.attr({ max: String(op.max) });
    if (op?.min !== undefined) el.attr({ min: String(op.min) });
    if (op?.step !== undefined) el.attr({ step: String(op.step) });
    return view()
        .add([el, dw ?? ""])
        .bindGet(() => Number(el.gv))
        .bindSet((v: number) => {
            el.sv(String(v));
        });
}

function xSwitch(name = "启用") {
    const i = input("checkbox");
    return label([i, name])
        .bindGet(() => i.el.checked)
        .bindSet((v: boolean) => {
            i.el.checked = v;
        });
}

function xColor() {
    return input();
}

function xPath() {
    return input();
}

function xSecret() {
    return input();
}

function showPage(page: (typeof main)[0]) {
    mainView.clear();
    mainView.add(ele("h1").add(noI18n(page.pageName)));
    if (page.desc) mainView.add(comment(page.desc));
    if (page.settings) {
        for (const setting of page.settings) {
            mainView.add(renderSetting(setting));
        }
    }
    if (page.items) {
        for (const item of page.items) {
            mainView.add(ele("h2").add(noI18n(item.title)));
            for (const setting of item.settings) {
                mainView.add(renderSetting(setting));
            }
        }
    }
}

lan(store.get("语言.语言") as string);
setTranslate((text) => t(text));

pureStyle();
initStyle(store);

addStyle({
    ":has(>.icon)": {
        position: "relative",
    },
});

for (const v of Object.values(s)) {
    if (!v) continue;
    v.name = t(v.name);
    if (v.desc) v.desc = t(v.desc);
}
for (const p of main) {
    p.pageName = t(p.pageName);
    if (p.desc) p.desc = t(p.desc);
    if (p.items)
        for (const i of p.items) {
            i.title = t(i.title);
        }
}

pack(document.body).style({ display: "flex" });

addStyle({
    h1: {
        fontSize: "3rem",
        fontWeight: 100,
    },
    h2: {
        fontSize: "1.8rem",
        position: "sticky",
        top: 0,
        background: "var(--bg)",
    },
    'input[type="text"]': {
        border: "none",
        borderBottom: "1px solid var(--hover-color)",
        transition: "var(--transition)",
        fontSize: "1rem",
        width: "300px",
        fontFamily: "var(--monospace)",
    },
    'input[type="number"]': {
        // @ts-ignore
        fieldSizing: "content",
        border: "none",
        borderBottom: "1px solid var(--hover-color)",
        fontSize: "1rem",
        transition: "var(--transition)",
        fontFamily: "var(--monospace)",
    },
    button: {
        padding: "4px",
        backgroundColor: "var(--m-color2)",
    },
});

const sideBar = view().addInto().style({ padding: "1em", flexShrink: 0 });
const sideBarG = radioGroup("侧栏");
const searchBar = view()
    .addInto()
    .style({ position: "fixed", right: 0, top: 0, zIndex: 1 });
const searchI = input()
    .addInto(searchBar)
    .on("input", () => {
        if (!searchI.gv) {
            showPage(main[sideBarG.get()]);
            return;
        }
        const l = Object.entries(s)
            .filter(
                (i) =>
                    i?.[1] &&
                    (i[1].name.includes(searchI.gv) ||
                        i[1].desc?.includes(searchI.gv)),
            )
            .map((i) => i[0]);
        mainView.clear();
        for (const i of l) {
            const title = getTitles.get(i);
            mainView.add(
                view().add([
                    txt("", true)
                        .sv(title ? title.join(" > ") : t("未知路径"))
                        .style({
                            color: "#0004",
                        }),
                    // @ts-ignore
                    renderSetting(i),
                ]),
            );
        }
    });
const mainViewP = view().addInto().style({
    overflow: "scroll",
    height: "100vh",
    flexGrow: "1",
});
const mainView = view()
    .addInto(mainViewP)
    .style({
        maxWidth: "680px",
        margin: "auto",
    })
    .class(
        addClass(
            {},
            {
                "&>div": {
                    marginBlock: "16px",
                },
            },
        ),
    );

for (const [i, page] of main.entries()) {
    const sideEl = view().add(
        sideBarG.new(String(i), txt(page.pageName, true)),
    );
    sideBar.add(sideEl);
}

sideBarG.on(() => {
    showPage(main[sideBarG.get()]);
});

showPage(main[0]);

button(t("使用旧版设置"))
    .style({ position: "fixed", bottom: "16px", right: "16px" })
    .on("click", () => {
        store.set("新版设置", false);
        ipcRenderer.send("window", "close");
    })
    .addInto();

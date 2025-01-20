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
    textarea,
    a,
    select,
} from "dkh-ui";
import store from "../../../lib/store/renderStore";
import { initStyle, getImgUrl } from "../root/root";
import { t, lan, getLanName, getLans } from "../../../lib/translate/translate";
const { ipcRenderer, shell } = require("electron") as typeof import("electron");
const path = require("node:path") as typeof import("path");
const os = require("node:os") as typeof import("os");
import Sortable from "sortablejs";

import logo from "../assets/icon.svg";

import translator from "xtranslator";

import { hexToCSSFilter } from "hex-to-css-filter";

import _package from "../../../package.json?raw";
const packageJson = JSON.parse(_package);

type Engines = keyof typeof translator.e;

type settingItem<t extends SettingPath> = {
    [key in t]: {
        name: string;
        desc?: string;
        el: (value: GetValue<setting, key>) => ElType<HTMLElement>;
    };
};

const mainLan = store.get("语言.语言");
const displayLan = new Intl.DisplayNames(mainLan, {
    type: "language",
});

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
    "工具栏.功能": {
        name: "按钮显示和排序",
        el: () => sortTool(),
    },
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
                            name: tIconEl(i.icon).style({
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
    "框选.自动框选.最小阈值": {
        name: "最小阈值",
        el: () => xRange({ min: 0, max: 255 }),
    },
    "框选.自动框选.最大阈值": {
        name: "最大阈值",
        el: () => xRange({ min: 0, max: 255 }),
    },
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
    "OCR.类型": {
        name: "OCR类型",
        el: () =>
            xSelect(
                [
                    ...getSet("离线OCR").map((i) => ({
                        value: i[0],
                        name: i[0],
                    })),
                    { value: "youdao", name: "有道" },
                    { value: "baidu", name: "百度" },
                ],
                "OCR类型",
            ),
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
    "贴图.窗口.变换": {
        name: "窗口变换",
        desc: "变换使用 CSS 代码",
        el: (v) =>
            sortList<(typeof v)[0]>(
                (v) => v.split("\n").at(0) ?? "",
                (v, m) => {
                    const { promise, resolve } =
                        Promise.withResolvers<typeof v>();

                    function setStyle() {
                        const style = t.gv;
                        preview.el.setAttribute("style", style);
                    }

                    const t = textarea()
                        .sv(v ?? "")
                        .on("input", () => {
                            setStyle();
                        });
                    const preview = view().add(
                        image(logo, "logo").style({ width: "200px" }),
                    );

                    m.add([
                        t,
                        preview,
                        button("关闭").on("click", () => {
                            resolve(null);
                            m.el.close();
                        }),
                        button("完成").on("click", () => {
                            resolve(t.gv);
                            m.el.close();
                        }),
                    ]);
                    setStyle();

                    return promise;
                },
            ),
    },
    "贴图.窗口.提示": {
        name: "提示",
        desc: "使用阴影提示贴图窗口",
        el: () => xSwitch(),
    },
    "翻译.翻译器": {
        name: "翻译引擎",
        el: (v) =>
            sortList<(typeof v)[0]>(
                (v) => v.name,
                // @ts-ignore
                (el, d) => translatorD(el, d),
            ),
    },
    "屏幕翻译.语言.from": {
        name: "屏幕翻译语言来源",
        el: () => {
            const firstItem = getSet("翻译.翻译器").at(0);
            const e = translator.e[firstItem?.type ?? ""];
            if (!e) return select([]);
            const list = select(
                getLansName(e.lan).map((i) => ({
                    value: i.lan,
                    name: noI18n(i.text),
                })),
            );
            return list;
        },
    },
    "屏幕翻译.语言.to": {
        name: "屏幕翻译语言目标",
        el: () => {
            const firstItem = getSet("翻译.翻译器").at(0);
            const e = translator.e[firstItem?.type ?? ""];
            if (!e) return select([]);
            const list = select(
                getLansName(e.targetLan).map((i) => ({
                    value: i.lan,
                    name: noI18n(i.text),
                })),
            );
            return list;
        },
    },
    "屏幕翻译.dTime": {
        name: "自动屏幕翻译定时",
        el: () => xNumber("ms"),
    },
    "翻译.收藏.文件": {
        name: "文件生词本",
        el: (v) =>
            sortList<(typeof v)[0]>(
                (v) => path.basename(v.path),
                (el, d) => w文件生词本Dialog(el, d),
            ),
    },
    "翻译.收藏.fetch": {
        name: "在线生词本",
        el: (v) =>
            sortList<(typeof v)[0]>(
                (v) => v.name || new URL(v.url).host,
                (el, d) => z在线生词本Dialog(el, d),
            ),
    },
    // todo 记住字体大小类型
    "字体.大小": {
        name: "字体大小",
        el: () => xRange({ min: 1, max: 100 }),
    },
    "字体.记住": {
        name: "记住主页面字体大小",
        el: () => xSwitch(),
    },
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
    "引擎.搜索": {
        name: "搜索引擎",
        el: (v) =>
            sortList<(typeof v)[0]>(
                (v) => v.name,
                (_v, d) => searchEngineDialog(_v, d),
            ),
    },
    "引擎.翻译": {
        name: "翻译引擎",
        el: (v) =>
            sortList<(typeof v)[0]>(
                (v) => v.name,
                (_v, d) => searchEngineDialog(_v, d),
            ),
    },
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
    "语言.语言": {
        name: "语言",
        el: () => {
            let lans: string[] = getLans();
            const systemLan = ipcRenderer.sendSync("app", "systemLan");
            // 提前系统语言
            lans = [systemLan].concat(lans.filter((v) => v !== systemLan));
            const el = view();
            const b = button()
                .style({ display: "none" })
                .on("click", () => {
                    ipcRenderer.send("setting", "reload");
                });
            const list = xSelect(
                lans.map((i) => ({ value: i, name: getLanName(i) })), // todo noi18n
                "语言",
            ).on("input", () => {
                lan(list.gv);
                b.style({ display: "" }).el.innerText = t("重启软件以生效");
                el.el.dispatchEvent(new CustomEvent("input"));
            });
            return el
                .add([b, list])
                .bindGet(() => list.gv)
                .bindSet((v) => list.sv(v));
        },
    },
    "主搜索功能.自动搜索排除": {
        name: "自动搜索排除",
        desc: "若选中的文字符合文本框的规则，将使用截屏搜索而不是选择搜索",
        el: (_v) =>
            textarea()
                .bindGet((el) => el.value.split("\n").filter((i) => i !== ""))
                .bindSet((v: typeof _v, el) => {
                    el.value = v.join("\n");
                }),
    },
    "主搜索功能.剪贴板选区搜索": {
        name: "剪贴板选区搜索",
        desc: "使用选区内容",
        el: () => xSwitch(),
    },
    "全局.主题": {
        name: "主题色",
        el: () => {
            function change() {
                el.el.dispatchEvent(new CustomEvent("input"));
                function setCSSVar(name: string, value: string) {
                    if (value)
                        document.documentElement.style.setProperty(name, value);
                }
                const theme = el.gv;
                setCSSVar("--bar-bg0", theme.light.barbg);
                setCSSVar("--bg", theme.light.bg);
                setCSSVar("--hover-color", theme.light.emphasis);
                setCSSVar("--d-bar-bg0", theme.dark.barbg);
                setCSSVar("--d-bg", theme.dark.bg);
                setCSSVar("--d-hover-color", theme.dark.emphasis);
                setCSSVar("--font-color", theme.light.fontColor);
                setCSSVar("--d-font-color", theme.dark.fontColor);
                setCSSVar("--icon-color", theme.light.iconColor);
                setCSSVar("--d-icon-color", theme.dark.iconColor);
            }
            const themeSelect = view("x").add(
                themes.map((i) =>
                    button()
                        .style({
                            width: "var(--base-size2)",
                            height: "var(--base-size2)",
                            backgroundColor: `light-dark(${i.light.emphasis}, ${i.dark.emphasis})`,
                        })
                        .on("click", () => {
                            el.sv(i);
                            change();
                        }),
                ),
            );
            const emL = xColor();
            const emD = xColor();
            const brL = xColor();
            const brD = xColor();
            const bL = xColor();
            const bD = xColor();
            const fL = xColor();
            const fD = xColor();
            type Theme = setting["全局"]["主题"];
            const el = view()
                .add([
                    view().add([
                        view().add(["强调色", view().add([emL, emD])]),
                        view().add(["透明背景", view().add([brL, brD])]),
                        view().add(["普通背景", view().add([bL, bD])]),
                        view().add(["文字和图标颜色", view().add([fL, fD])]),
                    ]),
                    themeSelect,
                ])
                .bindGet(() => {
                    const x = {
                        light: {
                            emphasis: emL.gv,
                            barbg: brL.gv,
                            bg: bL.gv,
                            fontColor: fL.gv,
                            iconColor: "",
                        },
                        dark: {
                            emphasis: emD.gv,
                            barbg: brD.gv,
                            bg: bD.gv,
                            fontColor: fD.gv,
                            iconColor: "",
                        },
                    } as Theme;
                    x.light.iconColor = getIconColor(x.light.fontColor);
                    x.dark.iconColor = getIconColor(x.dark.fontColor);
                    return x;
                })
                .bindSet((v: Theme) => {
                    emL.sv(v.light.emphasis);
                    emD.sv(v.dark.emphasis);
                    brL.sv(v.light.barbg);
                    brD.sv(v.dark.barbg);
                    bL.sv(v.light.bg);
                    bD.sv(v.dark.bg);
                    fL.sv(v.light.fontColor);
                    fD.sv(v.dark.fontColor);
                });

            for (const i of [emL, emD, brL, brD, bL, bD, fL, fD]) {
                i.on("input", () => change());
            }

            return el;
        },
    },
    "全局.模糊": {
        name: "模糊",
        el: () => xRange({ min: 0, max: 50, text: "px" }),
    },
    "全局.不透明度": {
        name: "不透明度",
        el: () => xRange({ min: 0, max: 1, step: 0.05 }),
    },
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
            ).on("input", (_, el) => {
                ipcRenderer.send("setting", "theme", el.gv);
            }),
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
    "代理.proxyRules": {
        name: "规则",
        el: () => {
            const els = {
                http: label([input(), noI18n("HTTP")], 1),
                https: label([input(), noI18n("HTTPS")], 1),
                ftp: label([input(), noI18n("FTP")], 1),
                socks: label([input(), noI18n("SOCKS")], 1),
            } as const;

            const el = view("y")
                .add(Object.values(els))
                .bindGet(() => {
                    return Object.entries(els)
                        .flatMap(([k, el]) => (el.gv ? `${k}=${el.gv}` : []))
                        .join(";");
                })
                .bindSet((v: string) => {
                    for (const rule of v.split(";")) {
                        for (const [x, el] of Object.entries(els)) {
                            if (rule.includes(`${x}=`)) {
                                el.sv(rule.replace(`${x}=`, ""));
                            }
                        }
                    }
                });
            for (const e of Object.values(els)) {
                e.on("input", () =>
                    el.el.dispatchEvent(new CustomEvent("input")),
                );
            }
            return el;
        },
    },
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
                    "工具栏.功能",
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
                    "框选.自动框选.最小阈值",
                    "框选.自动框选.最大阈值",
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
        settings: ["OCR.类型", "OCR.离线切换", "主页面.自动复制OCR"],
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
    {
        pageName: "贴图",
        settings: ["贴图.窗口.双击", "贴图.窗口.变换", "贴图.窗口.提示"],
    },
    {
        pageName: "翻译",
        settings: ["翻译.翻译器"],
        items: [
            {
                title: "屏幕翻译",
                settings: [
                    "屏幕翻译.语言.from",
                    "屏幕翻译.语言.to",
                    "屏幕翻译.dTime",
                ],
            },
            {
                title: "生词本",
                settings: ["翻译.收藏.文件", "翻译.收藏.fetch"],
            },
        ],
    },
    {
        pageName: "编辑器",
        items: [
            {
                title: "编辑器",
                settings: [
                    "字体.大小",
                    "字体.记住",
                    "编辑器.自动换行",
                    "编辑器.拼写检查",
                    "编辑器.行号",
                ],
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
            { title: "引擎", settings: ["引擎.搜索", "引擎.翻译"] },
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
            { title: "语言", settings: ["语言.语言"] },
            {
                title: "主搜索功能",
                settings: [
                    "主搜索功能.自动搜索排除",
                    "主搜索功能.剪贴板选区搜索",
                ],
            },
            {
                title: "代理",
                settings: [
                    "代理.mode",
                    "代理.pacScript",
                    "代理.proxyRules",
                    "代理.proxyBypassRules",
                ],
            },
        ],
    },
    {
        pageName: "样式",
        settings: ["全局.缩放"],
        items: [
            {
                title: "颜色",
                settings: ["全局.主题", "全局.深色模式"],
            },
            {
                title: "毛玻璃效果",
                settings: ["全局.模糊", "全局.不透明度"],
            },
            {
                title: "字体",
                settings: ["字体.主要字体", "字体.等宽字体"],
            },
        ],
    },
    {
        pageName: "高级",
        items: [
            { title: "高级设置", settings: ["硬件加速"] },
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

const bind: { [k in SettingPath]?: SettingPath[] } = {
    "翻译.翻译器": ["屏幕翻译.语言.from", "屏幕翻译.语言.to"],
};

function getSet<t extends SettingPath>(k: t): GetValue<setting, t> {
    return store.get(k);
}

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

const themes: setting["全局"]["主题"][] = [
    {
        light: {
            barbg: "#FFFFFF",
            bg: "#FFFFFF",
            emphasis: "#DFDFDF",
            fontColor: "#000",
            iconColor: "none",
        },
        dark: {
            barbg: "#333333",
            bg: "#000000",
            emphasis: "#333333",
            fontColor: "#fff",
            iconColor: "invert(1)",
        },
    },
    {
        light: {
            barbg: "#D7E3F8",
            bg: "#FAFAFF",
            emphasis: "#D7E3F8",
            fontColor: "#1A1C1E",
            iconColor: getIconColor("#1A1C1E"),
        },
        dark: {
            barbg: "#3B4858",
            bg: "#1A1C1E",
            emphasis: "#3B4858",
            fontColor: "#FAFAFF",
            iconColor: getIconColor("#FAFAFF"),
        },
    },
    {
        light: {
            barbg: "#D5E8CF",
            bg: "#FCFDF6",
            emphasis: "#D5E8CF",
            fontColor: "#1A1C19",
            iconColor: getIconColor("#1A1C19"),
        },
        dark: {
            barbg: "#3B4B38",
            bg: "#1A1C19",
            emphasis: "#3B4B38",
            fontColor: "#FCFDF6",
            iconColor: getIconColor("#FCFDF6"),
        },
    },
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
        .on("input", (e) => {
            if (e.target === e.currentTarget) {
                const value = el.gv;
                if (value !== null && value !== undefined) {
                    store.set(settingPath, value);
                    console.log(
                        `Setting ${settingPath} updated to`,
                        structuredClone(value),
                    );
                    for (const p of bind[settingPath] ?? []) {
                        reRenderSetting(p);
                    }
                }
            }
        });
    return view()
        .data({ name: settingPath })
        .add([p(setting.name, true), comment(setting.desc || ""), el]);
}

function reRenderSetting(settingPath: SettingPath) {
    const el = document.querySelector(`[data-name="${settingPath}"`);
    if (!el) return;
    console.log("rerender", settingPath);
    const nel = renderSetting(settingPath);
    if (nel) el.replaceWith(nel.el);
}

function tIconEl(img: string) {
    return image(img, "icon").class("icon");
}

function iconEl(img: string) {
    return image(getImgUrl(`${img}.svg`), "icon").class("icon");
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
    const min = op?.min ?? 0;
    const max = op?.max ?? 100;
    const step = op?.step ?? 1;
    const p = Math.max(
        ...[min, max, step]
            .map((i) => (i === 0 ? 1 : i < 0 ? Math.abs(i) : i))
            .map((i) => Math.abs(Math.log10(i))),
    );
    let value = min;
    function sv(v: number) {
        const nv = (Math.round((v - min) / step) * step + min).toFixed(p);
        const nv1 = Math.max(min, Math.min(max, Number.parseFloat(nv)));
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
    const i = input("checkbox").on("input", () => {
        el.el.dispatchEvent(new CustomEvent("input"));
    });
    const el = label([i, name])
        .bindGet(() => i.el.checked)
        .bindSet((v: boolean) => {
            i.el.checked = v;
        });
    return el;
}

function xColor() {
    return input();
}

function xPath() {
    return input();
}

function xSecret() {
    const el = input("password")
        .on("focus", () => {
            el.attr({ type: "text" });
        })
        .on("blur", () => {
            el.attr({ type: "password" });
        });
    return el;
}

function sortTool() {
    const pel = view("x");
    const toolShowEl = view().class("bar").style({
        minWidth: "var(--b-button)",
        minHeight: "var(--b-button)",
    });
    const toolHideEl = view().class("bar").style({
        minWidth: "var(--b-button)",
        minHeight: "var(--b-button)",
    });
    new Sortable(toolShowEl.el, {
        group: "tools",
        onChange: () => {
            pel.el.dispatchEvent(new CustomEvent("input"));
        },
    });
    new Sortable(toolHideEl.el, {
        group: "tools",
    });
    pel.add([toolShowEl, view().add([view().add(iconEl("hide")), toolHideEl])]);
    function getItems(v: string[]) {
        return v.flatMap((i) => {
            const x = tools.find((x) => x.key === i);
            if (!x) {
                console.log(`${i} is udf`);
                return [];
            }
            return view().data({ n: i }).add(tIconEl(x.icon));
        });
    }
    return pel
        .bindGet(() => {
            const l = toolShowEl
                .queryAll("&>div")
                .map((i) => i.el.getAttribute("data-n"));
            return l;
        })
        .bindSet((v: string[]) => {
            toolShowEl.clear().add(getItems(v));
            toolHideEl
                .clear()
                .add(
                    getItems(
                        tools.map((i) => i.key).filter((i) => !v.includes(i)),
                    ),
                );
        });
}

function sortList<t>(
    name: (el: t) => string,
    item: (
        el: t | null,
        dialog: ElType<HTMLDialogElement>,
    ) => Promise<t | null>,
) {
    function onChange() {
        el.el.dispatchEvent(new CustomEvent("input"));
    }
    const el = view();
    const listEl = view("x", "wrap");
    new Sortable(listEl.el, {
        handle: ".sort_handle",
        onEnd: () => {
            onChange();
        },
    });
    const newData: Map<string, { "sort-name": string; data: t }> = new Map();

    function getItem(id: string | null) {
        dialog.clear().el.showModal();
        return item(id ? (newData.get(id)?.data ?? null) : null, dialog);
    }

    function addItem(id: string) {
        const itemEl = view("x")
            .style({ alignItems: "center" })
            .data({ id: id });
        const nameEl = txt(newData.get(id)?.["sort-name"] ?? "", true).on(
            "click",
            async () => {
                const nv = await getItem(id);
                const oldData = newData.get(id);
                if (!nv || !oldData) return;
                oldData.data = nv;
                nameEl.sv(name(nv));
                onChange();
            },
        );
        const sortHandle = button().class("sort_handle").add(iconEl("handle"));
        const rm = button()
            .class("rm")
            .add(iconEl("delete"))
            .on("click", () => {
                itemEl.remove();
                onChange();
            });
        itemEl.add([sortHandle, nameEl, rm]);
        listEl.add(itemEl);
    }

    const addBtn = button(iconEl("add")).on("click", async () => {
        const nv = await getItem(null);
        if (!nv) return;
        const uid = crypto.randomUUID().slice(0, 7);
        newData.set(uid, {
            "sort-name": name(nv),
            data: nv,
        });
        addItem(uid);
        onChange();
    });

    const dialog = ele("dialog");

    return el
        .add([listEl, addBtn, dialog])
        .bindGet(() => {
            const list = listEl
                .queryAll("[data-id]")
                .flatMap((i) => newData.get(i.el.dataset.id ?? "")?.data || []);
            return list;
        })
        .bindSet((list: t[]) => {
            listEl.clear();
            newData.clear();
            for (const el of list) {
                const uid = crypto.randomUUID().slice(0, 7);
                newData.set(uid, {
                    "sort-name": name(el),
                    data: el,
                });
            }
            for (const id of newData.keys()) {
                addItem(id);
            }
        });
}

function translatorD(
    _v: setting["翻译"]["翻译器"][0] | null,
    addTranslatorM: ElType<HTMLDialogElement>,
) {
    const v = _v ?? {
        id: crypto.randomUUID().slice(0, 7),
        name: "",
        keys: {},
        type: "",
    };

    const engineConfig: Partial<
        Record<
            Engines,
            {
                t: string | ReturnType<typeof noI18n>;
                key: {
                    name: string;
                    text?: string;
                    type?: "json";
                    area?: boolean;
                    optional?: boolean;
                }[];
                help?: { src: string };
            }
        >
    > = {
        tencentTransmart: {
            t: "腾讯交互式翻译",
            key: [],
        },
        google: {
            t: "谷歌翻译",
            key: [],
        },
        yandex: {
            t: noI18n("Yandex"),
            key: [],
        },
        youdao: {
            t: "有道",
            key: [{ name: "appid" }, { name: "key" }],
            help: { src: "https://ai.youdao.com/product-fanyi-text.s" },
        },
        baidu: {
            t: "百度",
            key: [{ name: "appid" }, { name: "key" }],
            help: { src: "https://fanyi-api.baidu.com/product/11" },
        },
        deepl: {
            t: noI18n("Deepl"),
            key: [{ name: "key" }],
            help: { src: "https://www.deepl.com/pro-api?cta=header-pro-api" },
        },
        deeplx: {
            t: noI18n("DeeplX"),
            key: [{ name: "url" }],
        },
        caiyun: {
            t: "彩云",
            key: [{ name: "token" }],
            help: {
                src: "https://docs.caiyunapp.com/blog/2018/09/03/lingocloud-api/",
            },
        },
        bing: {
            t: "必应",
            key: [{ name: "key" }],
            help: {
                src: "https://learn.microsoft.com/zh-cn/azure/cognitive-services/translator/how-to-create-translator-resource#authentication-keys-and-endpoint-url",
            },
        },
        chatgpt: {
            t: noI18n("ChatGPT"),
            key: [
                { name: "key", optional: true },
                { name: "url", optional: true },
                {
                    name: "config",
                    text: t("请求体自定义"),
                    type: "json",
                    area: true,
                    optional: true,
                },
                {
                    name: "sysPrompt",
                    text: t("系统提示词，${t}为文字，${to}，${from}"),
                    optional: true,
                },
                {
                    name: "userPrompt",
                    text: t("用户提示词，${t}为文字，${to}，${from}"),
                    optional: true,
                },
            ],
            help: { src: "https://platform.openai.com/account/api-keys" },
        },
        gemini: {
            t: noI18n("Gemini"),
            key: [
                { name: "key" },
                { name: "url", optional: true },
                { name: "config", text: t("请求体自定义"), area: true },
                {
                    name: "userPrompt",
                    text: t("用户提示词，${t}为文字，${to}，${from}"),
                    optional: true,
                },
            ],
            help: { src: "https://ai.google.dev/" },
        },
        niu: {
            t: "小牛翻译",
            key: [{ name: "key" }],
            help: {
                src: "https://niutrans.com/documents/contents/beginning_guide/6",
            },
        },
    };

    const idEl = input()
        .sv(v.name)
        .attr({ placeholder: t("请为翻译器命名") });
    const selectEl = select<Engines | "">(
        [{ value: "", name: "选择引擎类型" }].concat(
            // @ts-ignore
            Object.entries(engineConfig).map((v) => ({
                name: v[1].t,
                value: v[0],
            })),
        ) as { value: Engines }[],
    )
        .sv(v.type || "")
        .on("input", () => {
            set(selectEl.gv);
        });
    const keys = view("y").style({ gap: "8px" });
    const help = p("");

    function set(type: Engines | "") {
        keys.clear();
        help.clear();
        testR.clear();
        if (!type) return;
        const fig = engineConfig[type];
        if (!fig) return;
        for (const x of fig.key) {
            const value = v.keys[x.name] as string;

            keys.add(
                view().add([
                    txt(`${x.name}`, true),
                    ele("br"),
                    (x.area ? textarea() : input())
                        .attr({ placeholder: x.text || "", spellcheck: false })
                        .data({ key: x.name })
                        .sv(
                            (x.type === "json"
                                ? JSON.stringify(value, null, 2)
                                : value) || "",
                        )
                        .style({ width: "100%" }),
                ]),
            );
        }
        if (fig.help) help.add(a(fig.help.src).add(txt("API申请")));
    }

    const testEl = view();
    const testR = p("");
    const testB = button(txt("测试"));
    testEl.add([testB, testR]);
    testB.on("click", async () => {
        testR.el.innerText = t("正在测试...");
        const v = getV();
        if (!v) return;
        // @ts-ignore
        translator.e[v.type].setKeys(v.keys);
        try {
            const r = await translator.e[v.type].test();
            console.log(r);
            if (r) testR.el.innerText = t("测试成功");
        } catch (error) {
            testR.el.innerText = String(error);
            throw error;
        }
    });

    addTranslatorM
        .add([idEl, selectEl, keys, help, testEl])
        .class("add_translator");

    function getV() {
        if (!selectEl.gv) return null;
        const key = {};
        const ee = engineConfig[selectEl.gv];
        if (!ee) return null;
        const e = ee.key;
        for (const el of keys.queryAll("input, textarea")) {
            const type = e.find((i) => i.name === el.el.dataset.key)?.type;
            key[el.el.dataset?.key ?? ""] =
                type === "json" ? JSON.parse(el.el.value) : el.el.value;
        }
        const nv: typeof v = {
            id: v.id,
            name: idEl.gv,
            keys: key,
            type: selectEl.gv,
        };
        return nv;
    }

    set(v.type);

    return new Promise((re: (nv: typeof v | null) => void) => {
        addTranslatorM.add([
            button(txt("关闭")).on("click", () => {
                addTranslatorM.el.close();
                re(null);
            }),
            button(txt("完成")).on("click", () => {
                const nv = getV();
                if (
                    nv?.type &&
                    Object.entries(nv.keys).every(
                        (i) =>
                            engineConfig[nv.type]?.key.find(
                                (j) => j.name === i[0],
                            )?.optional || i[1],
                    )
                ) {
                    re(nv);
                    addTranslatorM.el.close();
                }
            }),
        ]);
    });
}

function transSaveHelp() {
    return a(
        `https://github.com/xushengfeng/eSearch/blob/${packageJson.version}/docs/use/translate.md#生词本`,
    ).add("教程帮助");
}

function textStyle(mh: number) {
    return {
        "field-sizing": "content",
        height: "auto",
        "max-height": `${mh}lh`,
        resize: "none",
    } as const;
}

function w文件生词本Dialog(
    _v: setting["翻译"]["收藏"]["文件"][0] | null,
    addDialog: ElType<HTMLDialogElement>,
) {
    let v = _v;
    if (!v) {
        v = { path: "", template: "" };
    }
    const filePath = input().sv(v.path);
    const template = textarea().sv(v.template).style(textStyle(6));

    const { promise, resolve } = Promise.withResolvers<typeof v | null>();

    addDialog.add([
        view("y")
            .style({ gap: "8px" })
            .add([
                view().add(["路径", ele("br"), filePath]),
                transSaveHelp(),
                view().add(["模板", ele("br"), template]),
            ]),
        button(txt("关闭")).on("click", () => {
            addDialog.el.close();
            resolve(null);
        }),
        button(txt("完成")).on("click", () => {
            const nv = {
                path: filePath.gv,
                template: template.gv,
            };
            resolve(nv);
            addDialog.el.close();
        }),
    ]);

    return promise;
}

function z在线生词本Dialog(
    _v: setting["翻译"]["收藏"]["fetch"][0] | null,
    addDialog: ElType<HTMLDialogElement>,
) {
    const v = _v ?? {
        name: "",
        body: "",
        url: "",
        method: "get",
        headers: {},
        getter: [],
    };
    const name = input().attr({ placeholder: "名称" }).sv(v.name);
    const url = input().sv(v.url);
    const method = select([
        { value: "get", name: noI18n("GET") },
        { value: "post", name: noI18n("POST") },
    ]).sv(v.method);

    const headers = textarea("按行输入，每行一个header，格式为key:value")
        .style(textStyle(6))
        .bindSet((v: Record<string, string>, el) => {
            el.value = Object.entries(v)
                .map(([k, v]) => `${k} : ${v}`)
                .join("\n");
        })
        .bindGet((el) => {
            const v = el.value;
            const obj: Record<string, string> = {};
            for (const line of v.split("\n")) {
                if (line.trim() === "") continue;
                const [k, v] = line.split(":").map((i) => i.trim());
                obj[k] = v;
            }
            return obj;
        })
        .sv(v.headers);

    const body = textarea().style(textStyle(6)).sv(v.body);

    const { promise, resolve } = Promise.withResolvers<typeof v | null>();

    addDialog.add([
        name,
        transSaveHelp(),
        view("y")
            .style({ gap: "8px" })
            .add([
                view().add([noI18n("URL"), url, ele("br"), url]),
                view().add(["请求方式", method, ele("br"), method]),
                view().add(["请求头", headers, ele("br"), headers]),
                view().add(["请求体", body, ele("br"), body]),
            ]),
        button(txt("关闭")).on("click", () => {
            addDialog.el.close();
            resolve(null);
        }),
        button(txt("完成")).on("click", () => {
            const nv = {
                name: name.gv,
                body: body.gv,
                url: url.gv,
                method: method.gv,
                headers: headers.gv,
                getter: [],
            };
            resolve(nv);
            addDialog.el.close();
        }),
    ]);

    return promise;
}

function searchEngineDialog(
    _v: { url: string; name: string } | null,
    d: ElType<HTMLDialogElement>,
) {
    const v = _v ?? { name: "", url: "" };
    const nameEl = input().sv(v.name);
    const urlEl = input().sv(v.url);

    const { promise, resolve } = Promise.withResolvers<typeof v | null>();

    d.add([
        view("y")
            .style({ gap: "8px" })
            .add([
                view().add(["引擎名称", ele("br"), nameEl]),
                view().add(["引擎URL", ele("br"), urlEl]),
            ]),
        button(txt("关闭")).on("click", () => {
            d.el.close();
            resolve(null);
        }),
        button(txt("完成")).on("click", () => {
            const nv = {
                name: nameEl.gv,
                url: urlEl.gv,
            };
            resolve(nv);
            d.el.close();
        }),
    ]);

    return promise;
}

function getLansName(l: string[]) {
    const lansName = l.map((i) => ({
        text: i === "auto" ? t("自动") : (displayLan.of(i) ?? i),
        lan: i,
    }));
    // todo 额外翻译其他少见的语言
    return lansName.toSorted((a, b) => a.text.localeCompare(b.text, mainLan));
}

function getIconColor(hex: string) {
    try {
        return hexToCSSFilter(hex).filter.replace(";", "");
    } catch (error) {
        return "none";
    }
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

function about() {
    const el = view("y").style({ alignItems: "center", marginTop: "120px" });
    const logoEl = image(logo, "logo").style({ width: "200px" });
    const nameEl = p(packageJson.name, true).style({ fontSize: "2rem" });
    const version = button(noI18n(packageJson.version));
    const desc = p(packageJson.description);

    const infoEl = view("y").style({ alignItems: "center" });

    infoEl.add([
        view().add([
            "项目主页:",
            " ",
            a(packageJson.homepage).add(noI18n(packageJson.homepage)),
        ]),
        view().add([
            "支持该项目:",
            " ",
            a(packageJson.homepage).add("为项目点亮星标🌟"),
            " ",
            a("https://github.com/xushengfeng").add("赞赏"),
        ]),
        view().add(
            a(
                `https://github.com/xushengfeng/eSearch/releases/tag/${packageJson.version}`,
            ).add("更新日志"),
        ),
        view().add([
            a(ipcRenderer.sendSync("setting", "feedback")).add("反馈问题"),
            " ",
            a(
                `https://github.com/xushengfeng/eSearch/issues/new?assignees=&labels=新需求&template=feature_request.yaml&title=建议在……添加……功能/改进&v=${packageJson.version}&os=${process.platform} ${os.release()} (${process.arch})`,
            ).add("提供建议"),
        ]),
        view().add(
            a(
                "https://github.com/xushengfeng/eSearch/tree/master/lib/translate",
            ).add("改进翻译"),
        ),
        view().add([
            "本软件遵循",
            " ",
            a("https://www.gnu.org/licenses/gpl-3.0.html").add(
                noI18n(packageJson.license),
            ),
        ]),
        view().add([
            "本软件基于",
            " ",
            a(
                "https://github.com/xushengfeng/eSearch-website/blob/master/public/readme/all_license.json",
            ).add("这些软件"),
        ]),
        view().add(
            noI18n(
                `Copyright (C) 2021 ${packageJson.author.name} ${packageJson.author.email}`,
            ),
        ),
    ]);

    return el.add([logoEl, nameEl, version, desc, infoEl]);
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
    'input[type="text"],input[type="password"]': {
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

mainViewP.add(about());

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

document.body.onclick = (e) => {
    if ((<HTMLElement>e.target).tagName === "A") {
        const el = <HTMLAnchorElement>e.target;
        if (el.href.startsWith("http") || el.href.startsWith("https")) {
            e.preventDefault();
            shell.openExternal(el.href);
        }
    }
};

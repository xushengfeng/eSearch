import type { setting, 功能 } from "../../ShareTypes";
import type { SettingPath, GetValue } from "../../../lib/store/renderStore";
import {
    ele,
    type ElType,
    input,
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
    setProperty,
    check,
    confirm,
    alert,
    setProperties,
    spacer,
    dynamicSelect,
    dynamicList,
} from "dkh-ui";
import store from "../../../lib/store/renderStore";
import { initStyle, getImgUrl, setTitle } from "../root/root";
import { t, lan, getLanName, getLans } from "../../../lib/translate/translate";
// biome-ignore format:
const { shell, webUtils } = require("electron") as typeof import("electron");
const path = require("node:path") as typeof import("path");
const os = require("node:os") as typeof import("os");
const fs = require("node:fs") as typeof import("fs");

import Sortable from "sortablejs";

import logo from "../assets/icon.svg";
import testPhoto from "../assets/sample_picture.svg";

import translator from "xtranslator";

import { hexToCSSFilter } from "hex-to-css-filter";

import Fuse from "fuse.js";

import _package from "../../../package.json?raw";
const packageJson = JSON.parse(_package);

import {
    macKeyFomat,
    jsKey2ele,
    jsKeyCodeDisplay,
    ele2jsKeyCode,
} from "../../../lib/key.js";

import time_format from "../../../lib/time_format";
import xhistory from "../lib/history";
import { renderSend, renderSendSync } from "../../../lib/ipc";
import type { IconType } from "../../iconTypes";

const download = require("download");

type Engines = keyof typeof translator.e;

type JustElmentK =
    | "_autostart"
    | "_qsq"
    | "_theme"
    | "_filename"
    | "_clear_history"
    | "_clear_browswer"
    | "_setting_file"
    | "_default_setting"
    | "_location"
    | "_version";

type KeyPath = JustElmentK | SettingPath;

type settingItem<t extends SettingPath> = {
    [key in t]: {
        name: string;
        desc?: string;
        el: (value: GetValue<setting, key>) => ElType<HTMLElement>;
    };
};

type GithubUrlType = Omit<keyof setting["网络"]["github镜像"], "启用">;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const history = new xhistory<object, { k: string; v: any }>(
    [],
    store.getAll(),
    {
        diff: () => ({ k: "", v: "" }),
        apply: (data, { k, v }) => {
            let nowObj = data;
            for (const [i, ke] of k.split(".").entries()) {
                if (i === k.split(".").length - 1) nowObj[ke] = v;
                nowObj = nowObj[ke];
            }
            return data;
        },
    },
);

history.on("change", () => {
    updateHistory();
});

const mainLan = store.get("语言.语言");
const displayLan = new Intl.DisplayNames(mainLan, {
    type: "language",
});

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

function getToolsN(k: 功能) {
    return (tools.find((i) => i.key === k) as (typeof tools)[0]).title;
}

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
        desc: "拖拽以控制按键顺序和显示",
        el: () => sortTool(),
    },
    "工具栏.初始位置": {
        name: "工具栏位置",
        el: (v) => {
            const el = xGroup("y");
            const iEvent = () => el.el.dispatchEvent(new CustomEvent("input"));
            const l = input().addInto(el).on("input", iEvent);
            const t = input().addInto(el).on("input", iEvent);
            const b = xGroup("x").addInto(el);
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
        el: () => xRange({ min: 1, max: 20, text: "px" }),
    },
    "取色器.默认格式": {
        name: "取色器默认格式",
        el: () =>
            xSelect(
                [
                    { value: "HEX", name: noI18n("HEX") },
                    { value: "RGB", name: noI18n("rgb") },
                    { value: "HSL", name: noI18n("hsl") },
                    { value: "HSV", name: noI18n("hsv") },
                    { value: "HWB", name: noI18n("hwb") },
                    { value: "LAB", name: noI18n("lab") },
                    { value: "LCH", name: noI18n("lch") },
                    { value: "OKLAB", name: noI18n("Oklab") },
                    { value: "OKLCH", name: noI18n("Oklch") },
                    { value: "CMYK", name: noI18n("CMYK") },
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
                    { value: "no", name: "无" },
                    ...tools
                        .filter((i) => i.key !== "close" && i.key !== "screens")
                        .map((i) => ({
                            value: i.key,
                            name: tIconEl(i.icon),
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
            const el = xGroup("y")
                .add([
                    xEl,
                    yEl,
                    xGroup("x").add([
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
                        name: noI18n(i[0]),
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
    离线OCR: {
        name: "离线OCR",
        el: () => ocrEl(),
    },
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
        name: "Secret Key",
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
                    { value: "cpu", name: noI18n("CPU") },
                    { value: "cuda", name: noI18n("CUDA") },
                    { value: "coreml", name: noI18n("coreML") },
                    { value: "directml", name: noI18n("DirectML") },
                ],
                "运行后端",
            ),
    },
    "AI.在线模型": {
        name: "在线模型",
        el: (v) =>
            sortList<(typeof v)[0]>(
                (v) => v.name,
                (_item, dialog) => {
                    const { promise, resolve } =
                        Promise.withResolvers<typeof _item>();
                    const item = _item || {
                        name: "",
                        url: "",
                        key: "",
                        supportVision: false,
                        type: "chatgpt",
                        config: {},
                    };

                    const nameEl = input().sv(item.name);
                    const urlEl = input().sv(item.url);
                    const keyEl = input().sv(item.key);
                    const configEl = textarea()
                        .bindSet((v, el) => {
                            try {
                                el.value = JSON.stringify(v, null, 2);
                            } catch (e) {
                                el.value = "{}";
                            }
                        })
                        .bindGet((el) => {
                            try {
                                return JSON.parse(el.value) as Record<
                                    string,
                                    unknown
                                >;
                            } catch (e) {
                                return {};
                            }
                        })
                        .sv(item.config)
                        .style(textStyle(6));
                    const supportVision = check("vision").sv(
                        item.supportVision,
                    );

                    dialogB(
                        dialog,
                        [
                            nameEl,
                            xGroup("y").add([
                                view().add([noI18n("URL"), ele("br"), urlEl]),
                                view().add([noI18n("key"), ele("br"), keyEl]),
                                view().add([
                                    "请求体自定义",
                                    ele("br"),
                                    configEl,
                                ]),
                                label([supportVision, "支持图像识别"]),
                            ]),
                        ],
                        () => resolve(null),
                        () =>
                            resolve({
                                name: nameEl.gv,
                                type: "chatgpt",
                                url: urlEl.gv,
                                key: keyEl.gv,
                                config: configEl.gv,
                                supportVision: supportVision.gv,
                            }),
                    );

                    return promise;
                },
            ),
    },
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
    "录屏.提示.键盘.位置": {
        name: "键盘提示位置",
        el: (v) => {
            let nv: typeof v = { x: "+", y: "-", offsetX: 0, offsetY: 0 };
            const screenKeyTipEl = view().style({
                width: "500px",
                height: "200px",
                outline: "1px dashed var(--m-color-b)",
                position: "relative",
            });
            const screenKeyTipKBD = view()
                .style({ position: "absolute", cursor: "move" })
                .add([
                    ele("kbd").add(noI18n("Ctrl")),
                    ele("kbd").add(noI18n("Shift")),
                    ele("kbd").add(noI18n("I")),
                ])
                .addInto(screenKeyTipEl);

            function setKeyTip() {
                const posi = nv;
                const px = posi.x === "+" ? "right" : "left";
                const py = posi.y === "+" ? "bottom" : "top";
                for (const x of ["left", "right", "top", "bottom"]) {
                    screenKeyTipKBD.el.style[x] = "";
                }
                screenKeyTipKBD.style({
                    [px]: `${posi.offsetX}px`,
                    [py]: `${posi.offsetY}px`,
                    fontSize: `${getSet("录屏.提示.键盘.大小") * 16}px`,
                });
            }

            trackPoint(screenKeyTipKBD, {
                start: () => {
                    return {
                        x: 0,
                        y: 0,
                        data: screenKeyTipEl.el.getBoundingClientRect(),
                    };
                },
                ing: (_p, e, { startData: pr }) => {
                    const x = (e.clientX - pr.left) / pr.width;
                    const y = (e.clientY - pr.top) / pr.height;
                    nv.x = x < 0.5 ? "-" : "+";
                    nv.y = y < 0.5 ? "-" : "+";
                    setKeyTip();
                },
                end: () => {
                    screenKeyTipEl.el.dispatchEvent(new CustomEvent("input"));
                },
            });

            return screenKeyTipEl
                .bindGet(() => nv)
                .bindSet((v) => {
                    nv = v;
                    setKeyTip();
                });
        },
    },
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
        name: "鼠标按键提示",
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
    "录屏.摄像头.开启": {
        name: "开启摄像头",
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
    "录屏.摄像头.背景.imgUrl": { name: "背景图片路径", el: () => xPath(false) },
    "录屏.摄像头.背景.videoUrl": {
        name: "背景视频路径",
        el: () => xPath(false),
    },
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
    "录屏.音频.启用系统内录": {
        name: "系统内录",
        desc: "开启才可以在界面进一步选择是否内录",
        el: () => xSwitch(),
    },
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
        name: "FFmpeg其他参数",
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
                        image(logo, noI18n("logo")).style({ width: "200px" }),
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
        desc: "适用于屏幕翻译和搜索翻译，第一个为默认引擎",
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
    "字体.大小": {
        name: "字体大小",
        el: () => xRange({ min: 1, max: 100 }),
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
        el: () => xNumber(t("天"), { step: 0.5 }),
    },
    时间格式: {
        name: "时间格式",
        el: () => input(),
    },
    "主页面.高级窗口按钮": {
        name: "高级窗口按钮",
        desc: "如置于最顶层、失去焦点自动关闭按钮等",
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
    "快捷键.自动识别.key": {
        name: "自动识别",
        el: () => hotkeyX("自动识别", "快捷键"),
    },
    "快捷键.截屏搜索.key": {
        name: "截屏搜索",
        el: () => hotkeyX("截屏搜索", "快捷键"),
    },
    "快捷键.选中搜索.key": {
        name: "选中搜索",
        el: () => hotkeyX("选中搜索", "快捷键"),
    },
    "快捷键.剪贴板搜索.key": {
        name: "剪贴板搜索",
        el: () => hotkeyX("剪贴板搜索", "快捷键"),
    },
    "快捷键.快速截屏.key": {
        name: "快速截屏",
        el: () => hotkeyX("快速截屏", "快捷键"),
    },
    "快捷键.连拍.key": {
        name: "连拍",
        el: () => hotkeyX("连拍", "快捷键"),
    },
    "快捷键.结束广截屏.key": {
        name: "结束广截屏",
        el: () => hotkeyX("结束广截屏", "快捷键"),
    },
    "快捷键.剪贴板贴图.key": {
        name: "剪贴板贴图",
        el: () => hotkeyX("剪贴板贴图", "快捷键"),
    },
    "快捷键.主页面.key": {
        name: "主页面",
        el: () => hotkeyX("主页面", "快捷键"),
    },
    "全局工具快捷键.ocr": {
        name: getToolsN("ocr"),
        el: () => hotkeyX("ocr", "快捷键2", "ocr"),
    },
    "全局工具快捷键.search": {
        name: getToolsN("search"),
        el: () => hotkeyX("search", "快捷键2", "search"),
    },
    "全局工具快捷键.QR": {
        name: getToolsN("QR"),
        el: () => hotkeyX("QR", "快捷键2", "scan"),
    },
    "全局工具快捷键.open": {
        name: getToolsN("open"),
        el: () => hotkeyX("open", "快捷键2", "open"),
    },
    "全局工具快捷键.ding": {
        name: getToolsN("ding"),
        el: () => hotkeyX("ding", "快捷键2", "ding"),
    },
    "全局工具快捷键.record": {
        name: getToolsN("record"),
        el: () => hotkeyX("record", "快捷键2", "record"),
    },
    "全局工具快捷键.long": {
        name: getToolsN("long"),
        el: () => hotkeyX("long", "快捷键2", "long_clip"),
    },
    "全局工具快捷键.copy": {
        name: getToolsN("copy"),
        el: () => hotkeyX("copy", "快捷键2", "copy"),
    },
    "全局工具快捷键.save": {
        name: getToolsN("save"),
        el: () => hotkeyX("save", "快捷键2", "save"),
    },
    "全局工具快捷键.translate": {
        name: getToolsN("translate"),
        el: () => hotkeyX("translate", "快捷键2", "translate"),
    },
    "全局工具快捷键.editor": {
        name: getToolsN("editor"),
        el: () => hotkeyX("editor", "快捷键2", "super_edit"),
    },
    "工具快捷键.close": {
        name: getToolsN("close"),
        el: () => hotkeyP("close"),
    },
    "工具快捷键.ocr": {
        name: getToolsN("ocr"),
        el: () => hotkeyP("ocr"),
    },
    "工具快捷键.search": {
        name: getToolsN("search"),
        el: () => hotkeyP("search"),
    },
    "工具快捷键.QR": {
        name: getToolsN("QR"),
        el: () => hotkeyP("scan"),
    },
    "工具快捷键.open": {
        name: getToolsN("open"),
        el: () => hotkeyP("open"),
    },
    "工具快捷键.ding": {
        name: getToolsN("ding"),
        el: () => hotkeyP("ding"),
    },
    "工具快捷键.record": {
        name: getToolsN("record"),
        el: () => hotkeyP("record"),
    },
    "工具快捷键.long": {
        name: getToolsN("long"),
        el: () => hotkeyP("long_clip"),
    },
    "工具快捷键.copy": {
        name: getToolsN("copy"),
        el: () => hotkeyP("copy"),
    },
    "工具快捷键.save": {
        name: getToolsN("save"),
        el: () => hotkeyP("save"),
    },
    "工具快捷键.translate": {
        name: getToolsN("translate"),
        el: () => hotkeyP("translate"),
    },
    "工具快捷键.editor": {
        name: getToolsN("editor"),
        el: () => hotkeyP("super_edit"),
    },
    "截屏编辑快捷键.select.键": {
        name: "选择与控制",
        el: () => hotkeyP("rect_select"),
    },
    "截屏编辑快捷键.draw.键": {
        name: "自由绘画",
        el: () => hotkeyP("free_draw"),
    },
    "截屏编辑快捷键.shape.键": {
        name: "形状和文字",
        el: () => hotkeyP("shapes"),
    },
    "截屏编辑快捷键.filter.键": {
        name: "滤镜",
        el: () => hotkeyP("filters"),
    },
    "截屏编辑快捷键.select.副.rect": {
        name: "矩形选择",
        el: () => hotkeyP("rect_select"),
    },
    "截屏编辑快捷键.select.副.free": {
        name: "自由选择",
        el: () => hotkeyP("free_select"),
    },
    "截屏编辑快捷键.select.副.draw": {
        name: "绘制",
        el: () => hotkeyP("draw_select"),
    },
    "截屏编辑快捷键.draw.副.free": {
        name: "画笔",
        el: () => hotkeyP("draw"),
    },
    "截屏编辑快捷键.draw.副.eraser": {
        name: "橡皮",
        el: () => hotkeyP("eraser"),
    },
    // "截屏编辑快捷键.draw.副.spary": {
    //     name: "喷刷",
    //     el: () => hotkeyP(),
    // },
    "截屏编辑快捷键.shape.副.line": {
        name: "线条",
        el: () => hotkeyP("line"),
    },
    "截屏编辑快捷键.shape.副.circle": {
        name: "圆",
        el: () => hotkeyP("circle"),
    },
    "截屏编辑快捷键.shape.副.rect": {
        name: "矩形",
        el: () => hotkeyP("rect"),
    },
    "截屏编辑快捷键.shape.副.polyline": {
        name: "折线",
        el: () => hotkeyP("polyline"),
    },
    "截屏编辑快捷键.shape.副.polygon": {
        name: "多边形",
        el: () => hotkeyP("polygon"),
    },
    "截屏编辑快捷键.shape.副.text": {
        name: "文字",
        el: () => hotkeyP("text"),
    },
    "截屏编辑快捷键.shape.副.number": {
        name: "序号",
        el: () => hotkeyP("number"),
    },
    "截屏编辑快捷键.shape.副.arrow": {
        name: "箭头",
        el: () => hotkeyP("arrow"),
    },
    "大小栏快捷键.左上x": {
        name: "左上x",
        el: () => hotkeyP(),
    },
    "大小栏快捷键.左上y": {
        name: "左上y",
        el: () => hotkeyP(),
    },
    "大小栏快捷键.右下x": {
        name: "右下x",
        el: () => hotkeyP(),
    },
    "大小栏快捷键.右下y": {
        name: "右下y",
        el: () => hotkeyP(),
    },
    "大小栏快捷键.宽": {
        name: "宽",
        el: () => hotkeyP(),
    },
    "大小栏快捷键.高": {
        name: "高",
        el: () => hotkeyP(),
    },
    "其他快捷键.复制颜色": {
        name: "复制颜色",
        el: () => hotkeyP(),
    },
    "其他快捷键.隐藏或显示栏": {
        name: "显示/隐藏工具栏、绘制栏",
        el: () => hotkeyP(),
    },
    "主页面快捷键.搜索": {
        name: "搜索",
        el: () => hotkeyP("search"),
    },
    "主页面快捷键.翻译": {
        name: "翻译",
        el: () => hotkeyP("translate"),
    },
    "主页面快捷键.打开链接": {
        name: "打开链接",
        el: () => hotkeyP("link"),
    },
    "主页面快捷键.删除换行": {
        name: "删除换行",
        el: () => hotkeyP("delete_enter"),
    },
    "主页面快捷键.图片区": {
        name: "图片区",
        el: () => hotkeyP("img"),
    },
    "主页面快捷键.关闭": {
        name: "关闭",
        el: () => hotkeyP("close"),
    },
    启动提示: {
        name: "启动提示",
        desc: "将通过系统通知提示启动",
        el: () => xSwitch(),
    },
    "语言.语言": {
        name: "语言",
        el: () => {
            let lans: string[] = getLans();
            const systemLan = renderSendSync("systemLan", []);
            // 提前系统语言
            lans = [systemLan].concat(lans.filter((v) => v !== systemLan));
            const el = xGroup("y");
            const b = button()
                .style({ display: "none" })
                .on("click", () => {
                    renderSend("reload", []);
                });
            const list = xSelect(
                lans.map((i) => ({
                    value: i,
                    name: noI18n(getLanName(i) ?? i),
                })),
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
                .bindSet((v: Theme2) => {
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
                renderSend("theme", [el.gv]);
            }),
    },
    "全局.缩放": {
        name: "全局缩放",
        el: () => xRange({ min: 0.1, max: 3, step: 0.05 }),
    },
    "字体.主要字体": {
        name: "主要字体",
        desc: "适用于大部分文字字体",
        el: () => xFont(),
    },
    "字体.等宽字体": {
        name: "等宽字体",
        desc: "适用于数字、颜色代码等字体",
        el: () => xFont(),
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
                http: xGroup("y").add([noI18n("HTTP"), input()]),
                https: xGroup("y").add([noI18n("HTTPS"), input()]),
                ftp: xGroup("y").add([noI18n("FTP"), input()]),
                socks: xGroup("y").add([noI18n("SOCKS"), input()]),
            } as const;

            const el = xGroup("y")
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
    "网络.github镜像.启用": {
        name: "GitHub镜像",
        desc: "加速Github有关网络访问",
        el: () => xSwitch(),
    },
    "网络.github镜像.base": {
        name: "基本",
        desc: "软件资源下载",
        el: () => input(),
    },
    "网络.github镜像.api": { name: "api", desc: "检查更新", el: () => input() },
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
        el: () => xPath(false),
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
                    { value: "manual", name: "手动检查" },
                    { value: "start", name: "启动时检查" },
                ],
                "检查更新频率",
            ),
    },
    "更新.模式": {
        name: "更新模式",
        desc: "适用于启动时检查",
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
    dev: {
        name: "开发者模式",
        el: () => xSwitch(),
    },
};

const xs: Record<
    JustElmentK,
    { name: string; desc?: string; el: () => ElType<HTMLElement> }
> = {
    _autostart: {
        name: "开机自启动",
        el: () =>
            xSwitch()
                .on("input", (_e, el) => {
                    renderSend("setAutoStart", [el.gv]);
                })
                .sv(renderSendSync("getAutoStart", [])),
    },
    _qsq: {
        name: "取色器预览",
        el: () => {
            const colorSize = getSet("取色器.大小");
            const iSize = getSet("取色器.像素大小");
            const el = view("x", "wrap")
                .add(
                    Array.from({ length: colorSize ** 2 }).map(() => {
                        const l = Math.random() * 40 + 50;
                        return view().style({
                            backgroundColor: `hsl(0,0%,${l}%)`,
                            width: `${iSize}px`,
                            height: `${iSize}px`,
                        });
                    }),
                )
                .style({
                    width: `${iSize * colorSize}px`,
                    height: `${iSize * colorSize}px`,
                });
            return el;
        },
    },
    _theme: {
        name: "样式预览",
        el: () =>
            view("x")
                .style({
                    boxShadow: "var(--shadow)",
                    width: "max-content",
                    borderRadius: "var(--border-radius)",
                    overflow: "hidden",
                })
                .add([
                    view()
                        .style({
                            height: "80px",
                            backgroundColor: "var(--bg)",
                        })
                        .add([
                            view().style({
                                width: "20px",
                                height: "20px",
                                backgroundColor: "var(--emphasis-color)",
                            }),
                            view()
                                .add(iconEl("search"))
                                .style({ background: "transparent" }),
                            txt("测试文字"),
                            txt("42", true).style({
                                fontFamily: "var(--monospace)",
                            }),
                        ]),
                    view()
                        .add([
                            image(testPhoto, "").style({ width: "80px" }),
                            view().class("bar").style({
                                width: "80px",
                                height: "80px",
                                position: "absolute",
                                top: 0,
                            }),
                        ])
                        .style({ position: "relative" }),
                ]),
    },
    _filename: {
        name: "文件名预览",
        el: () => {
            const saveTime = new Date();
            return txt(
                `${getSet("保存名称.前缀")}${time_format(getSet("保存名称.时间"), saveTime)}${getSet("保存名称.后缀")}`,
                true,
            ).style({ fontFamily: "var(--monospace)" });
        },
    },
    _clear_history: {
        name: "清空所有文字记录",
        el: () =>
            button("清空").on("click", async () => {
                const c = await confirm(
                    "这将清除所有的历史记录\n且不能复原\n确定清除？",
                );
                const configPath = renderSendSync("userDataPath", []);
                if (c)
                    fs.writeFileSync(
                        path.join(configPath, "history.json"),
                        JSON.stringify({ 历史记录: {} }, null, 2),
                    );
            }),
    },
    _clear_browswer: {
        name: "清除数据",
        el: () =>
            xGroup("x").add([
                button("Cookie 等存储数据").on("click", () => {
                    renderSend("clearStorage", []);
                }),
                button("缓存").on("click", () => {
                    renderSend("clearCache", []);
                }),
            ]),
    },
    _setting_file: {
        name: "设置源文件",
        desc: "直接编辑设置源文件，更多自定义设置",
        el: () => button("打开设置源文件").on("click", () => {}),
    },
    _default_setting: {
        name: "恢复默认设置",
        el: () => button("恢复"),
    },
    _location: {
        name: "位置信息",
        el: () => {
            const configPath = renderSendSync("userDataPath", []);
            const runPath = renderSendSync("runPath", []);
            const portablePath = path.join(runPath, "portable");

            const portableConfigBtn = button("改为便携版");
            const pathInfo = view().add([
                view().add([
                    "配置目录：",
                    "",
                    pathEl(configPath),
                    fs.existsSync(portablePath) ? "便携版" : portableConfigBtn,
                ]),
                view().add([
                    "文字记录：",
                    " ",
                    pathEl(path.join(configPath, "history.json")),
                ]),
                view().add([
                    "临时目录：",
                    " ",
                    pathEl(path.join(os.tmpdir(), "eSearch")),
                ]),
                view().add(["运行目录：", " ", pathEl(runPath)]),
            ]);
            portableConfigBtn.on("click", async () => {
                const c = await confirm("将转为便携版，并迁移数据，重启软件");
                if (!c) return;
                console.log(portablePath);
                try {
                    fs.mkdirSync(portablePath, { recursive: true });
                    renderSendSync("move_user_data", [portablePath]);
                    renderSend("reload", []);
                } catch (error) {
                    // @ts-ignore
                    if (error.code !== "EEXIST") {
                        throw error;
                    }
                    // @ts-ignore
                    alert(`${t("错误")}\n${error.toString()}`);
                }
            });
            return pathInfo;
        },
    },
    _version: {
        name: "版本信息",
        el: () => {
            const versionL = ["electron", "node", "chrome", "v8"];
            const moreVersion = view()
                .style({ "font-family": "var(--monospace)" })
                .add([
                    p(
                        `${t("本机系统内核：")} ${os.type()} ${os.release()}`,
                        true,
                    ),
                    ...versionL.map((i) =>
                        p(`${i}: ${process.versions[i]}`, true),
                    ),
                ]);
            return moreVersion;
        },
    },
};

// todo log没创建的key

const main: {
    pageName: string;
    settings?: KeyPath[];
    desc?: string;
    items?: { title: string; desc?: string; settings: KeyPath[] }[];
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
                    "_qsq",
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
                desc: "复制完一个元素后，为了分辨，可以让其偏移",
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
        pageName: "文字识别（OCR）",
        settings: ["OCR.类型", "OCR.离线切换", "主页面.自动复制OCR"],
        items: [
            { title: "离线OCR", settings: ["离线OCR", "OCR.识别段落"] },
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
        settings: ["AI.运行后端", "AI.在线模型"],
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
                    "录屏.提示.键盘.位置",
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
                    "录屏.摄像头.开启",
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
                settings: ["录屏.音频.启用系统内录"],
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
            "_filename",
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
                    "_clear_history",
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
                    "_clear_browswer",
                ],
            },
        ],
    },
    {
        pageName: "快捷键",
        items: [
            {
                title: "全局功能",
                settings: [
                    "快捷键.自动识别.key",
                    "快捷键.截屏搜索.key",
                    "快捷键.选中搜索.key",
                    "快捷键.剪贴板搜索.key",
                    "快捷键.快速截屏.key",
                    "快捷键.连拍.key",
                    "快捷键.结束广截屏.key",
                    "快捷键.剪贴板贴图.key",
                    "快捷键.主页面.key",
                ],
            },
            {
                title: "截屏工具栏",
                settings: [
                    "工具快捷键.close",
                    "工具快捷键.ocr",
                    "工具快捷键.search",
                    "工具快捷键.QR",
                    "工具快捷键.open",
                    "工具快捷键.ding",
                    "工具快捷键.record",
                    "工具快捷键.long",
                    "工具快捷键.copy",
                    "工具快捷键.save",
                    "工具快捷键.translate",
                    "工具快捷键.editor",
                ],
            },
            {
                title: "截屏编辑栏",
                settings: [
                    "截屏编辑快捷键.select.键",
                    "截屏编辑快捷键.draw.键",
                    "截屏编辑快捷键.shape.键",
                    "截屏编辑快捷键.filter.键",
                ],
            },
            {
                title: "截屏选择与控制",
                settings: [
                    "截屏编辑快捷键.select.副.rect",
                    "截屏编辑快捷键.select.副.free",
                    "截屏编辑快捷键.select.副.draw",
                ],
            },
            {
                title: "截屏自由绘画",
                settings: [
                    "截屏编辑快捷键.draw.副.free",
                    "截屏编辑快捷键.draw.副.eraser",
                ],
            },
            {
                title: "截屏形状和文字",
                settings: [
                    "截屏编辑快捷键.shape.副.line",
                    "截屏编辑快捷键.shape.副.circle",
                    "截屏编辑快捷键.shape.副.rect",
                    "截屏编辑快捷键.shape.副.polyline",
                    "截屏编辑快捷键.shape.副.polygon",
                    "截屏编辑快捷键.shape.副.text",
                    "截屏编辑快捷键.shape.副.number",
                    "截屏编辑快捷键.shape.副.arrow",
                ],
            },
            {
                title: "截屏大小栏",
                settings: [
                    "大小栏快捷键.左上x",
                    "大小栏快捷键.左上y",
                    "大小栏快捷键.右下x",
                    "大小栏快捷键.右下y",
                    "大小栏快捷键.宽",
                    "大小栏快捷键.高",
                ],
            },
            {
                title: "截屏其他",
                settings: ["其他快捷键.复制颜色", "其他快捷键.隐藏或显示栏"],
            },
            {
                title: "框选后默认操作",
                desc: "与工具栏快捷键不同，此快捷键全局生效",
                settings: [
                    "全局工具快捷键.ocr",
                    "全局工具快捷键.search",
                    "全局工具快捷键.QR",
                    "全局工具快捷键.open",
                    "全局工具快捷键.ding",
                    "全局工具快捷键.record",
                    "全局工具快捷键.long",
                    "全局工具快捷键.copy",
                    "全局工具快捷键.save",
                    "全局工具快捷键.translate",
                    "全局工具快捷键.editor",
                ],
            },
            {
                title: "主页面",
                settings: [
                    "主页面快捷键.搜索",
                    "主页面快捷键.翻译",
                    "主页面快捷键.打开链接",
                    "主页面快捷键.删除换行",
                    "主页面快捷键.图片区",
                    "主页面快捷键.关闭",
                ],
            },
        ],
    },
    {
        pageName: "全局",
        items: [
            { title: "启动", settings: ["_autostart", "启动提示"] },
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
        settings: ["全局.缩放", "_theme"],
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
            {
                title: "高级设置",
                settings: ["_setting_file", "_default_setting", "硬件加速"],
            },
            {
                title: "外部截屏器",
                settings: ["额外截屏器.命令", "额外截屏器.位置"],
            },
            { title: "后台", settings: ["保留截屏窗口"] },
            {
                title: "GitHub镜像",
                settings: [
                    "网络.github镜像.启用",
                    "网络.github镜像.base",
                    "网络.github镜像.api",
                ],
            },
            {
                title: "检查更新",
                settings: ["更新.频率", "更新.模式", "更新.忽略版本"],
            },
            { title: "开发者模式", settings: ["dev"] },
            { title: "位置信息", settings: ["_location"] },
            { title: "版本信息", settings: ["_version"] },
        ],
    },
];

const sKeys = new Set([...Object.keys(s), ...Object.keys(xs)]);
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

const bind: { [k in KeyPath]?: KeyPath[] } = {
    离线OCR: ["OCR.类型"],
    "翻译.翻译器": ["屏幕翻译.语言.from", "屏幕翻译.语言.to"],
    "录屏.提示.键盘.位置.offsetX": ["录屏.提示.键盘.位置"],
    "录屏.提示.键盘.位置.offsetY": ["录屏.提示.键盘.位置"],
    "录屏.提示.键盘.大小": ["录屏.提示.键盘.位置"],
    "保存名称.前缀": ["_filename"],
    "保存名称.时间": ["_filename"],
    "保存名称.后缀": ["_filename"],
    "取色器.大小": ["_qsq"],
    "取色器.像素大小": ["_qsq"],
};

const bindF: { [k in SettingPath]?: (v: GetValue<setting, k>) => void } = {
    "工具栏.按钮大小": (v) => setProperty("--bar-size", `${v}px`),
    "工具栏.按钮图标比例": (v) => setProperty("--bar-icon", String(v)),
    "全局.主题": (theme) => {
        setProperties({
            "--bar-bg0": theme.light.barbg,
            "--bg": theme.light.bg,
            "--emphasis-color": theme.light.emphasis,
            "--d-bar-bg0": theme.dark.barbg,
            "--d-bg": theme.dark.bg,
            "--d-emphasis-color": theme.dark.emphasis,
            "--font-color": theme.light.fontColor,
            "--d-font-color": theme.dark.fontColor,
            "--icon-color": theme.light.iconColor,
            "--d-icon-color": theme.dark.iconColor,
        });
    },
    "全局.模糊": (v) => setProperty("--blur", `blur(${v}px)`),
    "全局.不透明度": (v) => setProperty("--alpha", String(v)),
    "字体.主要字体": (v) => setProperty("--main-font", v),
    "字体.等宽字体": (v) => setProperty("--monospace", v),
};

function getSet<t extends SettingPath>(k: t): GetValue<setting, t> {
    return store.get(k);
}

function setSet<t extends SettingPath>(k: t, v: GetValue<setting, t>) {
    const old = store.get(k);
    if (old === v) return;
    store.set(k, v);
    history.setDiff({ k, v });
    history.apply(s[k]?.name || k);
}

function bindRun(): void;
function bindRun<t extends SettingPath>(k: t, v: GetValue<setting, t>): void;
function bindRun<t extends SettingPath>(k?: t, v?: GetValue<setting, t>) {
    if (k !== undefined && v !== undefined) {
        bindF[k]?.(v);
    } else {
        for (const [k, f] of Object.entries(bindF)) {
            // @ts-ignore
            const v = store.get(k);
            // @ts-ignore
            if (v !== undefined) f?.(v);
        }
    }
}

type Theme = setting["全局"]["主题"];

type Theme2 = {
    [k in keyof Theme]: Omit<Theme[k], "iconColor">;
};

const themes: Theme2[] = [
    {
        light: {
            barbg: "#FFFFFF",
            bg: "#FFFFFF",
            emphasis: "#DFDFDF",
            fontColor: "#000",
        },
        dark: {
            barbg: "#333333",
            bg: "#000000",
            emphasis: "#333333",
            fontColor: "#fff",
        },
    },
    {
        light: {
            barbg: "#D7E3F8",
            bg: "#FAFAFF",
            emphasis: "#D7E3F8",
            fontColor: "#1A1C1E",
        },
        dark: {
            barbg: "#3B4858",
            bg: "#1A1C1E",
            emphasis: "#3B4858",
            fontColor: "#FAFAFF",
        },
    },
    {
        light: {
            barbg: "#D5E8CF",
            bg: "#FCFDF6",
            emphasis: "#D5E8CF",
            fontColor: "#1A1C19",
        },
        dark: {
            barbg: "#3B4B38",
            bg: "#1A1C19",
            emphasis: "#3B4B38",
            fontColor: "#FCFDF6",
        },
    },
];

const xselectClass = addClass(
    {
        borderRadius: "var(--border-radius)",
        transition: "outline-color var(--transition)",
        display: "inline-block",
        outlineColor: "transparent",
        cursor: "pointer",
    },
    {
        "&:not(:has(.icon))": {
            paddingInline: "var(--o-padding)",
        },
        '&:has(input[type="radio"]:checked)': {
            outline: "2px dashed var(--m-color-f)",
        },
    },
);

const toolBarClass = addClass(
    {
        borderRadius: "calc(var(--bar-size) / 6)",
        boxShadow: "var(--shadow)",
    },
    {
        "&>div": {
            width: "var(--bar-size)",
            height: "var(--bar-size)",
            borderRadius: "calc(var(--bar-size) / 6)",
        },
        "&>div>.icon": {
            width: "calc(var(--bar-size) * var(--bar-icon))",
            transition: "var(--transition)",
        },
    },
);

const dialogFlexClass = addClass(
    {},
    {
        "&[open]": {
            display: "flex",
            gap: "var(--o-padding)",
        },
    },
);

function renderSetting(settingPath: KeyPath) {
    const setting = s[settingPath] || xs[settingPath];
    if (!setting) {
        const err = new Error(`Setting ${settingPath} not found`);
        console.error(err);
        return null;
    }
    // @ts-ignore
    const el = setting.el();
    // @ts-ignore
    scheduler.postTask(() =>
        s[settingPath]
            ? el // biome-ignore lint/suspicious/noExplicitAny: <explanation>
                  .sv(store.get(settingPath as any))
                  .on("input", (e) => {
                      if (e.target === e.currentTarget) {
                          const value = el.gv;
                          if (value !== null && value !== undefined) {
                              setSet(settingPath as SettingPath, value);
                              console.log(
                                  `Setting ${settingPath} updated to`,
                                  structuredClone(value),
                              );
                              for (const p of bind[settingPath] ?? []) {
                                  reRenderSetting(p);
                              }

                              // @ts-ignore
                              bindRun(settingPath, value);
                          }
                      }
                  })
            : null,
    );
    return view()
        .data({ name: settingPath })
        .add([
            p(setting.name, true).style({ marginBlock: "8px" }),
            setting.desc
                ? comment(setting.desc).style({ marginBlock: "8px" })
                : "",
            el,
        ]);
}

function reRenderSetting(settingPath: KeyPath) {
    const el = document.querySelector(`[data-name="${settingPath}"`);
    if (!el) return;
    // todo sv
    console.log("rerender", settingPath);
    const nel = renderSetting(settingPath);
    if (nel) el.replaceWith(nel.el);
}

function tIconEl(img: string) {
    return image(img, noI18n("icon")).class("icon");
}

function iconEl(img: IconType) {
    return image(getImgUrl(`${img}.svg`), noI18n(img)).class("icon");
}

function comment(str: string) {
    return p(str, true).style({ color: "var(--font-color-l)" });
}

function xGroup(r: "x" | "y" = "x") {
    return view(r, "wrap").style({ gap: "var(--o-padding)" });
}

function xSelect<T extends string>(
    options: {
        value: T;
        name?: string | ElType<HTMLElement> | ReturnType<typeof noI18n>;
    }[],
    name: string,
) {
    const el = xGroup("x").style({ marginLeft: "2px" });
    const r = radioGroup<T>(name);
    for (const option of options) {
        el.add(
            r
                .new(option.value, option.name)
                .class(xselectClass)
                .class("x-like"),
        );
    }
    r.on(() => el.el.dispatchEvent(new CustomEvent("input")));
    return el.bindGet(() => r.get()).bindSet((value: T) => r.set(value));
}

// todo 右键撤回 精度
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
            height: "24px",
            overflow: "hidden",
            cursor: "ew-resize",
        })
        .class("x-like")
        .addInto(el);
    const thumb = view()
        .style({
            backgroundColor: "var(--m-color-f)",
            borderRadius: "inherit",
            height: "100%",
        })
        .addInto(track)
        .bindSet((v: number, el) => {
            el.style.width = `${((v - min) / (max - min)) * 100}%`;
        });
    const text = txt()
        .style({ userSelect: "none", fontFamily: "var(--monospace)" })
        .attr({ tabIndex: 0 })
        .bindSet((v: number, el) => {
            el.textContent = `${sv(v)}${op?.text || ""}`;
        })
        .on("keydown", (e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
        })
        .on("keyup", (e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const v = sv(value + (e.key === "ArrowUp" ? step : -step));
            thumb.sv(v);
            text.sv(v);
            value = v;
            el.el.dispatchEvent(new CustomEvent("input"));
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
        .add([el, noI18n(dw) ?? ""])
        .bindGet(() => Number(el.gv))
        .bindSet((v: number) => {
            el.sv(String(v));
        });
}

function xSwitch() {
    const i = input("checkbox").on("input", () => {
        el.el.dispatchEvent(new CustomEvent("input"));
    });
    const el = label([i, "启用"])
        .bindGet(() => i.el.checked)
        .bindSet((v: boolean) => {
            i.el.checked = v;
        });
    return el;
}

function xColor() {
    function msk(t: string) {
        return `linear-gradient(${t},${t}),
        conic-gradient(
                rgb(204, 204, 204) 25%,
                rgb(255, 255, 255) 0deg,
                rgb(255, 255, 255) 50%,
                rgb(204, 204, 204) 0deg,
                rgb(204, 204, 204) 75%,
                rgb(255, 255, 255) 0deg
            )
            0% 0% / 8px 8px`;
    }
    const i = input()
        .on("input", () => {
            p.sv(i.gv);
            el.el.dispatchEvent(new CustomEvent("input"));
        })
        .style({
            // @ts-ignore
            "field-sizing": "content",
            width: "auto",
        });
    const p = view()
        .style({
            width: "var(--b-button)",
            height: "var(--b-button)",
            borderRadius: "var(--border-radius)",
        })
        .class("x-like")
        .bindSet((v: string) => p.style({ background: msk(v) }));
    const el = view("x").class("group");
    return el
        .add([p, i])
        .bindGet(() => i.gv)
        .bindSet((v: string) => {
            i.sv(v);
            p.sv(v);
        });
}

function xPath(dir = true) {
    const el = view("x").class("group");
    const i = input();
    const b = button(iconEl("file")).on("click", () => {
        const path = renderSendSync("selectPath", [
            i.gv,
            dir ? ["openDirectory"] : ["openFile"],
        ]);
        if (path) {
            i.sv(path);
            el.el.dispatchEvent(new CustomEvent("input"));
        }
    });
    return el
        .add([i, b])
        .bindGet(() => i.gv)
        .bindSet((v: string) => i.sv(v));
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

function xFont() {
    const el = view("x").class("group");
    const i = input().on("input", () =>
        el.el.dispatchEvent(new CustomEvent("input")),
    );
    const q = button(iconEl("search")).on("click", async () => {
        // @ts-ignore
        const fonts = await window.queryLocalFonts();
        const list = Array.from(
            new Set([
                ...fonts.map((i) => i.fullName),
                ...fonts.map((i) => i.family),
            ]),
        ).sort() as string[];

        const pageN = 15;
        let thePage = 0;

        function showPage(page: number) {
            thePage = page;
            const start = page * pageN;
            const end = start + pageN;
            const nowV = i.gv;
            const prev = preview.gv;
            listEl.clear();
            for (let n = start; n < end && n < list.length; n++) {
                listEl.add(
                    view("x")
                        .add(
                            prev
                                ? [noI18n(prev), spacer(), noI18n(list[n])]
                                : noI18n(list[n]),
                        )
                        .style({
                            fontFamily: list[n],
                            paddingInline: "4px",
                            borderRadius: "var(--border-radius)",
                            backgroundColor:
                                nowV === list[n] ? "var(--m-color-b)" : "",
                        })
                        .on("click", () => {
                            i.sv(list[n]);
                            el.el.dispatchEvent(new CustomEvent("input"));
                            close();
                        })
                        .class("inter-like"),
                );
            }
        }

        function close() {
            listPEl.remove();
        }

        const listPEl = ele("dialog");
        const listP = view("y")
            .style({ gap: "var(--o-padding)" })
            .addInto(listPEl);
        const preview = input()
            .style({ width: "auto" })
            .attr({ placeholder: t("预览字体") })
            .on("input", () => {
                showPage(thePage);
            })
            .addInto(listP);
        const listEl = view().addInto(listP);
        const nav = view("x").style({ overflowX: "scroll" });

        const nowPage = list.includes(i.gv)
            ? Math.floor(list.indexOf(i.gv) / pageN)
            : 0;

        showPage(nowPage);

        nav.add(
            Array.from({ length: Math.ceil(list.length / pageN) }, (_, i) =>
                button(String(i + 1))
                    .on("click", () => {
                        showPage(i);
                    })
                    .style({
                        backgroundColor:
                            i === nowPage ? "var(--m-color-b)" : "",
                    }),
            ),
        );
        listP.add(
            view("x").add([
                nav,
                button(iconEl("close")).on("click", () => {
                    close();
                }),
            ]),
        );

        listPEl.addInto().el.showModal();
    });
    return el
        .add([i, q])
        .bindGet(() => i.gv)
        .bindSet((v: string) => {
            i.sv(v);
        });
}

function pathEl(path: string) {
    return txt(path, true)
        .style({ "font-family": "var(--monospace)", cursor: "pointer" })
        .on("click", () => shell.openPath(path));
}

function sortTool() {
    const pel = xGroup("x");
    const toolShowEl = view().class("bar").class(toolBarClass).style({
        minWidth: "var(--b-button)",
        minHeight: "var(--b-button)",
    });
    const toolHideEl = view().class("bar").class(toolBarClass).style({
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
    pel.add([
        toolShowEl,
        xGroup("y").add([view().add(iconEl("hide")), toolHideEl]),
    ]);
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
    const el = xGroup("y");
    const listEl = xGroup("x");
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
            .class("small-size")
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
        ); // todo 必须命名
        const sortHandle = button().add(iconEl("handle"));
        const rm = button()
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

function dialogB(
    d: ElType<HTMLDialogElement>,
    els: ElType<HTMLElement>[],
    onClose: () => void,
    // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
    onOk: () => boolean | undefined | void,
) {
    d.add(
        xGroup("y").add([
            ...els,
            xGroup("x").add([
                spacer(),
                button(txt("关闭")).on("click", () => {
                    onClose();
                    d.el.close();
                }),
                button(txt("完成")).on("click", () => {
                    if (onOk() !== false) d.el.close();
                }),
            ]),
        ]),
    );
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
        .attr({ placeholder: t("请为翻译器命名") })
        .style({ width: "240px" });
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
    const keys = xGroup("y");
    const help = p("");

    function set(type: Engines | "") {
        keys.clear().style({ display: "none" });
        help.clear().style({ display: "none" });
        testR.clear();
        if (!type) return;
        const fig = engineConfig[type];
        if (!fig) return;
        for (const x of fig.key) {
            const value = v.keys[x.name] as string;

            keys.style({ display: "flex" }).add(
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
        if (fig.help)
            help.style({ display: "" }).add(
                a(fig.help.src).add(txt("API申请")),
            );
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

    const { promise, resolve } = Promise.withResolvers<typeof v | null>();

    dialogB(
        addTranslatorM,
        [
            view("x").add([idEl, selectEl]).style({
                gap: "var(--o-padding)",
            }),
            keys,
            help,
            testEl,
        ],
        () => resolve(null),
        () => {
            const nv = getV();
            if (
                nv?.type &&
                Object.entries(nv.keys).every(
                    (i) =>
                        engineConfig[nv.type]?.key.find((j) => j.name === i[0])
                            ?.optional || i[1],
                )
            ) {
                resolve(nv);
                return true;
            }
            return false;
        },
    );

    return promise;
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

    dialogB(
        addDialog,
        [
            view().add(["路径", ele("br"), filePath]),
            transSaveHelp(),
            view().add(["模板", ele("br"), template]),
        ],
        () => resolve(null),
        () =>
            resolve({
                path: filePath.gv,
                template: template.gv,
            }),
    );

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
    const name = input()
        .attr({ placeholder: t("名称") })
        .sv(v.name);
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

    dialogB(
        addDialog,
        [
            name,
            transSaveHelp(),
            xGroup("y").add([
                view().add([noI18n("URL"), url, ele("br"), url]),
                view().add(["请求方式", method, ele("br"), method]),
                view().add(["请求头", headers, ele("br"), headers]),
                view().add(["请求体", body, ele("br"), body]),
            ]),
        ],
        () => resolve(null),
        () =>
            resolve({
                name: name.gv,
                body: body.gv,
                url: url.gv,
                method: method.gv,
                headers: headers.gv,
                getter: [],
            }),
    );

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

    dialogB(
        d,
        [
            view().add(["引擎名称", ele("br"), nameEl]),
            view().add(["引擎URL", ele("br"), urlEl]),
        ],
        () => resolve(null),
        () =>
            resolve({
                name: nameEl.gv,
                url: urlEl.gv,
            }),
    );

    return promise;
}

function hotkey() {
    const isMac = process.platform === "darwin";
    const keyList = new Set<string>();
    let mainKey = "";
    let typing = 0;
    let isFocus = false;
    function cvalue(l: string[]) {
        const nl = l
            .filter((i) => i !== "")
            .map((k) => {
                const key = jsKeyCodeDisplay(ele2jsKeyCode(k));
                return isMac ? (key.symble ?? key.primary) : key.primary;
            });
        nl.length
            ? i.clear().add(nl.map((i) => view().add(noI18n(i))))
            : i.clear().add("点击录入");
        mainKey = l.join("+");
    }

    function ev() {
        el.el.dispatchEvent(new CustomEvent("input"));
    }
    const el = view("x").class("group");
    const i = view("x")
        .class("b-like")
        .style({
            alignItems: "center",
            gap: "var(--o-padding)",
            fontFamily: "var(--monospace)",
        })
        .attr({ tabIndex: 0 })
        .on("focus", () => {
            isFocus = true;
            i.clear().add("按下快捷键");
        })
        .on("blur", () => {
            isFocus = false;
            cvalue((mainKey ?? "").split("+"));
        })
        .on("keydown", (e) => {
            if (!isFocus) return;
            e.preventDefault();
            if (typing === 0) {
                i.clear();
                keyList.clear();
                ev();
            }
            typing++;

            const key = jsKey2ele(macKeyFomat(e.key));
            if (!keyList.has(key)) keyList.add(key);
            cvalue(Array.from(keyList));
        })
        .on("keyup", (e) => {
            e.preventDefault();
            const key = jsKey2ele(macKeyFomat(e.key));
            if (!keyList.has(key)) {
                // 针对 PrintScreen 这样的只在keyup触发的按键
                keyList.add(key);
                cvalue(Array.from(keyList));
            } else {
                typing--;
            }
            if (typing === 0) {
                ev();
            }
        });
    const b = button(iconEl("delete")).on("click", () => {
        i.clear();
        mainKey = "";
        keyList.clear();
        ev();
    });
    return el
        .add([i, b])
        .bindSet((v: string) => cvalue((v ?? "").split("+")))
        .bindGet(() => mainKey)
        .sv("");
}

function ocrEl() {
    let ocrValue: setting["离线OCR"] = [];

    const ocrModels: Record<
        string,
        { url: string; name: string; supportLang: string[] }
    > = {
        ch: { url: "ch.zip", name: "中英混合", supportLang: ["zh-HANS", "en"] },
        en: { url: "en.zip", name: "英文", supportLang: ["en"] },
        chinese_cht: {
            url: "chinese_cht.zip",
            name: "中文繁体",
            supportLang: ["zh-HANT"],
        },
        korean: { url: "korean.zip", name: "韩文", supportLang: ["ko"] },
        japan: { url: "japan.zip", name: "日文", supportLang: ["ja"] },
        te: { url: "te.zip", name: "泰卢固文", supportLang: ["te"] },
        ka: { url: "ka.zip", name: "卡纳达文", supportLang: ["ka"] },
        ta: { url: "ta.zip", name: "泰米尔文", supportLang: ["ta"] },
        latin: {
            url: "latin.zip",
            name: "拉丁文",
            supportLang: [
                "af",
                "az",
                "bs",
                "cs",
                "cy",
                "da",
                "de",
                "es",
                "et",
                "fr",
                "ga",
                "hr",
                "hu",
                "id",
                "is",
                "it",
                "ku",
                "la",
                "lt",
                "lv",
                "mi",
                "ms",
                "mt",
                "nl",
                "no",
                "oc",
                "pi",
                "pl",
                "pt",
                "ro",
                "sr-Latn",
                "sk",
                "sl",
                "sq",
                "sv",
                "sw",
                "tl",
                "tr",
                "uz",
                "vi",
                "fr",
                "de",
            ],
        },
        arabic: {
            url: "arabic.zip",
            name: "阿拉伯字母",
            supportLang: ["ar", "fa", "ug", "ur"],
        },
        cyrillic: {
            url: "cyrillic.zip",
            name: "斯拉夫字母",
            supportLang: [
                "ru",
                "sr-Cyrl",
                "be",
                "bg",
                "uk",
                "mn",
                "abq",
                "ady",
                "kbd",
                "ava",
                "dar",
                "inh",
                "che",
                "lbe",
                "lez",
                "tab",
            ],
        },
        devanagari: {
            url: "devanagari.zip",
            name: "梵文字母",
            supportLang: [
                "hi",
                "mr",
                "ne",
                "bh",
                "mai",
                "ang",
                "bho",
                "mah",
                "sck",
                "new",
                "gom",
                "sa",
                "bgc",
            ],
        },
    };

    const langMap = {
        pi: "巴利语",
        abq: "阿布哈兹语",
        ady: "阿迪格语",
        kbd: "卡巴尔达语",
        ava: "阿瓦尔语",
        dar: "达尔格瓦语",
        inh: "印古什语",
        che: "车臣语",
        lbe: "列兹金语",
        lez: "雷兹语",
        tab: "塔巴萨兰语",
        bh: "比哈里语",
        ang: "古英语",
        mah: "马拉提语",
        sck: "西卡语",
        new: "尼瓦尔语",
        gom: "孔卡尼语",
        bgc: "哈尔穆克语",
    };

    const configPath = renderSendSync("userDataPath", []);

    function addOCR(p: string) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
            const files = fs.readdirSync(p);
            const downPath = path.join(p, files[0]);
            if (fs.statSync(downPath).isDirectory()) {
                addOCRFromPaths(
                    fs.readdirSync(downPath).map((i) => path.join(downPath, i)),
                );
            } else {
                addOCRFromPaths(files.map((i) => path.join(p, i)));
            }
        } else {
            const files = fs.readdirSync(path.join(p, "../"));
            addOCRFromPaths(files.map((i) => path.join(p, "../", i)));
        }
    }
    function addOCRFromPaths(paths: string[]) {
        const l: [string, string, string, string] = [
            `新模型${crypto.randomUUID().slice(0, 7)}`,
            "默认/ppocr_det.onnx",
            "默认/ppocr_rec.onnx",
            "默认/ppocr_keys_v1.txt",
        ];
        for (const path of paths) {
            if (path.split("/").at(-1)?.includes("det")) {
                l[1] = path;
            } else if (path.split("/").at(-1)?.includes("rec")) {
                l[2] = path;
            } else {
                l[3] = path;
            }
        }
        ocrValue.push(l);
        el.el.dispatchEvent(new CustomEvent("input"));
    }
    const el = xGroup("y");
    const dragEl = view("y")
        .class("b-like")
        .style({
            width: "300px",
            height: "100px",
            alignItems: "center",
            justifyContent: "center",
        })
        .add(txt("拖拽det模型、rec模型和字典文件到此处"))
        .on("dragover", (e) => {
            e.preventDefault();
        })
        .on("dragleave", () => {})
        .on("drop", (e) => {
            e.preventDefault();
            console.log(e);
            const fs = e.dataTransfer?.files || [];
            addOCRFromPaths(
                Array.from(fs).map((i) => webUtils.getPathForFile(i)),
            );
        });
    const ocrListEl = view("y").style({ overflow: "auto", gap: "8px" });
    for (const i in ocrModels) {
        const pro = ele("progress")
            .style({ display: "none" })
            .bindSet((v: number, el) => {
                el.value = v;
                if (v === 1) pro.remove();
            });
        const lans = view("x").style({
            "column-gap": "16px",
            "flex-wrap": "wrap",
        });
        const p = path.join(configPath, "models", i);
        const exists = fs.existsSync(p);
        const downloadButton = button(exists ? "重新下载" : "下载").on(
            "click",
            () => {
                pro.el.style.display = "block";
                const url = githubUrl(
                    `xushengfeng/eSearch-OCR/releases/download/4.0.0/${ocrModels[i].url}`,
                    "base",
                );
                download(url, p, {
                    extract: true,
                    rejectUnauthorized: false,
                })
                    .on("response", (res) => {
                        const total = Number(res.headers["content-length"]);
                        let now = 0;
                        res.on("data", (data) => {
                            now += Number(data.length);
                            const percent = now / total;
                            console.log(percent);
                            pro.sv(percent); // todo 难绷的样式
                        });
                        res.on("end", () => {});
                    })
                    .then(() => {
                        console.log("end");
                        addOCR(p);
                    });
            },
        );
        ocrListEl.add(
            view("y").add([
                view("x")
                    .add([
                        button(ocrModels[i].name).on("click", () => {
                            lans.clear().add(
                                ocrModels[i].supportLang.map((i) =>
                                    langMap[i]
                                        ? txt(langMap[i])
                                        : txt(displayLan.of(i), true),
                                ),
                            );
                        }),
                        downloadButton,
                        pro,
                    ])
                    .style({ "align-items": "center" }),
                lans,
            ]),
        );
    }

    const addOCRModel = ele("dialog")
        .style({ flexDirection: "column" })
        .class(dialogFlexClass)
        .add([
            ocrListEl,
            view().add([
                "将保存到：",
                " ",
                pathEl(path.join(configPath, "models")),
            ]),
            button(txt("关闭")).on("click", () => addOCRModel.el.close()),
        ]);
    const showB = button(iconEl("down")).on("click", () =>
        addOCRModel.el.showModal(),
    );
    return el
        .add([dragEl, showB, addOCRModel])
        .bindGet(() => ocrValue)
        .bindSet((v: setting["离线OCR"]) => {
            ocrValue = v;
        });
}

function hotkeyP(icon: IconType | "" = "") {
    const h = hotkey();
    const el = xGroup()
        .add([icon ? view().add(iconEl(icon)) : "", h])
        .bindGet(() => h.gv)
        .bindSet((v: string) => h.sv(v));
    h.on("input", () => el.el.dispatchEvent(new CustomEvent("input")));
    return el;
}
function hotkeyX(
    name: string,
    p: "快捷键" | "快捷键2",
    icon: IconType | "" = "",
) {
    const h = hotkey();
    const el = xGroup()
        .add([icon ? view().add(iconEl(icon)) : "", h])
        .bindGet(() => h.gv)
        .bindSet((v: string) => h.sv(v));
    h.on("input", () => {
        const arg = renderSendSync("hotkey", [p, name, h.gv]);
        if (arg) {
        } else {
            h.sv("");
        }
        el.el.dispatchEvent(new CustomEvent("input"));
    });
    return el;
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

function githubPath(url: string): {
    type: GithubUrlType;
    path: string;
} {
    const u = url.replace("https://", "");
    if (u.startsWith("api.github.com"))
        return {
            path: u.replace("api.github.com", ""),
            type: "api",
        };
    if (u.startsWith("github.com"))
        return { path: u.replace("github.com", ""), type: "base" };
    return { path: url, type: "base" };
}

// todo 主进程也用

function githubUrl(_path: string, _type: GithubUrlType | "auto" = "auto") {
    const s = store.get("网络.github镜像");
    function ap(x: string) {
        return x.replace(/\/$/, "");
    }
    function bp(x: string) {
        return x.replace(/^\//, "");
    }
    if (!s.启用 && _type === "auto") return _path;
    const { path, type } =
        _type === "auto" ? githubPath(_path) : { path: _path, type: _type };
    if (type === "api") {
        return `${ap(s.api)}/${bp(path)}`;
    }
    if (type === "base") {
        return `${ap(s.base)}/${bp(path)}`;
    }
    return path;
}

async function showPage(page: (typeof main)[0]) {
    mainView.clear();
    mainViewP.el.scrollTop = 0;
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
            if (item.desc) mainView.add(comment(item.desc));
            for (const setting of item.settings) {
                mainView.add(renderSetting(setting));
            }
            // @ts-ignore
            await scheduler.yield();
        }
    }
}

window.CSS.registerProperty({
    name: "--logo-blur",
    syntax: "<color>",
    inherits: false,
    initialValue: "transparent",
});

function about() {
    const el = view("y").style({ alignItems: "center", margin: "120px 0" });
    const logoEl = image(logo, noI18n("logo"))
        .style({
            width: "200px",
            transition: "scale 1s, --logo-blur 1s",
            filter: "drop-shadow(var(--x) var(--y) 8px var(--logo-blur))",
        })
        .class(
            addClass(
                {},
                {
                    "&:hover": {
                        "--logo-blur": "#00f4",
                        scale: 1.1,
                    },
                },
            ),
        )
        .on("mousemove", (e, el) => {
            const xx = (e.offsetX / el.el.offsetWidth - 0.5) * -2;
            const yy = (e.offsetY / el.el.offsetWidth - 0.5) * -2;
            el.style({ "--x": `${xx * 8}px`, "--y": `${yy * 8}px` });
        });
    const nameEl = p(packageJson.name, true).style({ fontSize: "2rem" });
    const version = button(noI18n(packageJson.version))
        .style({
            fontFamily: "var(--monospace)",
        })
        .on("click", () => {
            fetch(githubUrl("repos/xushengfeng/eSearch/releases", "api"), {
                method: "GET",
                redirect: "follow",
            })
                .then((response) => response.json())
                .then((re) => {
                    console.log(re);
                    const l: {
                        html_url: string;
                        name: string;
                        body: string;
                        assets: {
                            browser_download_url: string;
                            name: string;
                        }[];
                    }[] = re.filter((i) => !i.draft);
                    update.clear();
                    for (const [i, r] of l.entries()) {
                        const div = xGroup("y");
                        const tags = xGroup("x").style({
                            alignItems: "center",
                        });
                        const b = r.body.split("\n---").at(0) as string;
                        const p = document.createElement("p");
                        p.innerHTML = b.replace(/\r\n/g, "<br>");
                        function md(b: string) {
                            fetch(githubUrl("markdown", "api"), {
                                body: JSON.stringify({ text: b, mode: "gfm" }),
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                            })
                                .then((r) => r.text())
                                .then((data) => {
                                    p.innerHTML = data;
                                });
                        }
                        md(b);
                        const trans = button("翻译").on("click", async () => {
                            const transE = getSet("翻译.翻译器");
                            if (transE.length === 0) {
                                trans.remove();
                                return;
                            }
                            // biome-ignore format:
                            const x = transE.at(0) as setting["翻译"]["翻译器"][0];
                            // @ts-ignore
                            translator.e[x.type].setKeys(x.keys);
                            // @ts-ignore
                            const t = await translator.e[x.type].run(
                                b,
                                "zh",
                                getSet("语言.语言"),
                            );
                            md(t);
                        });
                        div.add([
                            ele("h1").add(noI18n(r.name)).style({
                                fontFamily: "var(--monospace)",
                            }),
                            tags,
                            getSet("语言.语言") !== "zh-HANS" ? trans : "",
                            p,
                        ]);
                        update.add(div);

                        if (r.name === packageJson.version) {
                            tags.add(txt("当前版本"));
                            break;
                        }
                        if (i === 0) {
                            tags.add(txt("最新版本"));
                        }
                        const baseName = `eSearch-${r.name}-${process.platform}-${process.arch}`;
                        const assets = r.assets.filter((i) =>
                            i.name.startsWith(baseName),
                        );
                        tags.add(
                            assets.map((i) =>
                                button(
                                    noI18n(
                                        `${t("点击下载")} ${i.name.replace(baseName, "")}`,
                                    ),
                                ).on("click", () => {
                                    shell.openExternal(
                                        githubUrl(i.browser_download_url),
                                    );
                                }),
                            ),
                        );
                        tags.add(
                            button("忽略此版本").on("click", () => {
                                setSet("更新.忽略版本", r.name);
                                reRenderSetting("更新.忽略版本");
                            }),
                        );
                    }
                })
                .catch((error) => console.log("error", error));
        });
    const update = view("y").style({ gap: "16px" });
    const desc = p(packageJson.description);

    const infoEl = view("y").style({ alignItems: "center" });

    infoEl.add([
        view().add([
            "项目主页：",
            " ",
            a(packageJson.homepage).add(noI18n(packageJson.homepage)),
        ]),
        view().add([
            "支持该项目：",
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
            a(renderSendSync("feedbackBug", [])).add("反馈问题"),
            " ",
            a(
                renderSendSync("feedbackFeature", [
                    { title: "建议在……添加……功能/改进" },
                ]),
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

    return el.add([logoEl, nameEl, version, update, desc, infoEl]);
}

setTranslate((text) => t(text));

initStyle(store);

for (const v of Object.values(s)) {
    if (!v) continue;
    v.name = t(v.name);
    if (v.desc) v.desc = t(v.desc);
}
for (const v of Object.values(xs)) {
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

setTitle(t("设置"));

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
        zIndex: 1,
    },
    'input[type="text"],input[type="password"]': {
        transition: "var(--transition)",
        width: "300px",
        fontFamily: "var(--monospace)",
    },
    'input[type="number"]': {
        // @ts-ignore
        fieldSizing: "content",
        transition: "var(--transition)",
        fontFamily: "var(--monospace)",
    },
});

const sideBar = view("y")
    .addInto()
    .style({
        padding: "var(--o-padding)",
        flexShrink: 0,
        gap: "var(--o-padding)",
    })
    .class(
        addClass(
            {},
            {
                "&>*:not(:has(input:checked))": {
                    color: "var(--font-color-l)",
                },
            },
        ),
    );
const sideBarG = radioGroup("侧栏");
const searchBar = view()
    .addInto()
    .style({ position: "fixed", right: "8px", top: "-1px", zIndex: 2 });
const searchI = input()
    .style({
        borderRight: "nocne",
        borderTop: "none",
        borderRadius: "0 0 0 var(--border-radius)",
    })
    .addInto(searchBar)
    .on("input", () => {
        if (!searchI.gv) {
            showPage(main[sideBarG.get()]);
            return;
        }
        const fuse = new Fuse(Object.entries(s), {
            keys: ["1.name", "1.desc"],
        });

        const l = fuse.search(searchI.gv).map((i) => i.item[0]);
        mainView.clear();
        if (l.length === 0)
            mainView.add(
                xGroup("y")
                    .style({
                        alignItems: "center",
                        justifyContent: "center",
                        height: "80vh",
                    })
                    .add([
                        p("无结果，尝试其他关键词"),
                        a(
                            renderSendSync("feedbackFeature", [
                                { title: t("添加设置项") },
                            ]),
                        ).add(button("提交新功能")),
                    ]),
            );
        for (const i of l) {
            const title = getTitles.get(i);
            mainView.add(
                view().add([
                    txt("", true)
                        .sv(
                            title
                                ? title.map((i) => t(i)).join(" > ")
                                : t("未知路径"),
                        )
                        .style({
                            color: "var(--font-color-ll)",
                        }),
                    // @ts-ignore
                    renderSetting(i),
                ]),
            );
        }
    });
const mainViewP = view().addInto().style({
    overflowY: "scroll",
    height: "100vh",
    flexGrow: "1",
});
const mainView = view()
    .addInto(mainViewP)
    .style({
        maxWidth: "680px",
        margin: "auto",
        padding: "var(--o-padding)",
        minHeight: "100vh",
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

sideBar.add(spacer());
const historyEl = dynamicSelect();
historyEl.el
    .addInto(sideBar)
    .on("input", () => {
        history.jump(Number(historyEl.el.gv));
        const data = history.getData();
        // todo diff 优化性能
        // @ts-ignore
        store.setAll(data);
        showPage(main[sideBarG.get()]);
        bindRun();
    })
    .attr({
        title: "修改历史",
    });
function updateHistory() {
    historyEl.setList(
        history.list.map((des, i) => ({ value: String(i), name: noI18n(des) })),
    );
    historyEl.el.sv(String(history.list.length - 1));
}
updateHistory();

bindRun();

showPage(main[0]);

document.body.onclick = (e) => {
    const el = (event?.target as HTMLElement)?.closest(
        "a",
    ) as HTMLAnchorElement;
    if (el) {
        e.preventDefault();
        if (el.href.startsWith("http") || el.href.startsWith("https")) {
            e.preventDefault();
            shell.openExternal(el.href);
        }
    }
};

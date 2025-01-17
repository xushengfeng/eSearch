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
};

// todo log没创建的key

const main: {
    pageName: string;
    settings?: SettingPath[];
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
    return view().add([p(setting.name, true), p(setting.desc || "", true), el]);
}

function iconEl(img: string) {
    return image(img, "icon").class("icon");
}

function xSelect<T extends string>(
    options: { value: T; name?: string | ElType<HTMLElement> }[],
    name: string,
) {
    const el = view("x", "wrap");
    const r = radioGroup(name);
    for (const option of options) {
        el.add(r.new(option.value, option.name));
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
    const el = view();
    const track = view().addInto(el);
    const thumb = view()
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

const sideBar = view().addInto();
const searchBar = view().addInto();
const searchI = input()
    .addInto(searchBar)
    .on("input", () => {
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
                    title ? txt("", true).sv(title.join(" > ")) : "未知路径",
                    // @ts-ignore
                    renderSetting(i),
                ]),
            );
        }
    });
const mainView = view().addInto();

for (const [i, page] of main.entries()) {
    const sideEl = view()
        .add(txt(page.pageName))
        .on("click", () => {
            mainView.clear();
            mainView.add(ele("h1").add(page.pageName));
            if (page.settings) {
                for (const setting of page.settings) {
                    mainView.add(renderSetting(setting));
                }
            }
            if (page.items) {
                for (const item of page.items) {
                    mainView.add(ele("h2").add(item.title));
                    for (const setting of item.settings) {
                        mainView.add(renderSetting(setting));
                    }
                }
            }
        });
    if (i === 0) {
        sideEl.el.click();
    }
    sideBar.add(sideEl);
}

button(t("使用旧版设置"))
    .style({ position: "fixed", bottom: "16px", right: "16px" })
    .on("click", () => {
        store.set("新版设置", false);
        ipcRenderer.send("window", "close");
    })
    .addInto();

import {
    addClass,
    button,
    type ElType,
    image,
    spacer,
    trackPoint,
    txt,
    view,
} from "dkh-ui";
import { renderSend, renderSendSync } from "../../../lib/ipc";
import store from "../../../lib/store/renderStore";
import type { IconType } from "../../iconTypes";
import { writeImage } from "../lib/clipboard";
import { Class, getImgUrl } from "../root/root";
import { dxdy, type Frame } from "./layout";
import { drawTranslation, preTranAndOcr, UnConfigTranslateError } from "./ocr";

const fs = require("node:fs") as typeof import("fs");

export type DingItemData = {
    id: string;
    /** 初始位置和大小，屏幕坐标 */
    rect: [number, number, number, number];
    url: string;
    translation: string;
    isTranslate: boolean;
};

export type DingItemOptions = {
    data: DingItemData;
    /** 独立系统窗口：没有覆盖层里的 dock、最小化等 */
    single: boolean;
    /** 无法用程序移动窗口时（Wayland），用系统原生拖动 */
    nativeDrag?: boolean;
    /** 请求缩放（滚轮、大小控件） */
    zoom: (zoom: number, dx: number, dy: number, clip: boolean) => void;
    close: () => void;
    back: () => void;
    minimize?: (el: HTMLElement) => void;
    front?: () => void;
};

export type DingItem = {
    data: DingItemData;
    el: ElType<HTMLElement>;
    imageEl: ElType<HTMLElement>;
    translate: () => Promise<void>;
    /** @param zoom 1 为 100% */
    setSize: (zoom: number) => void;
    /** 宽度不足时缩小工具栏 */
    setToolbarZoom: (width: number) => void;
    /** 裁剪图片，null 表示图片填满 */
    setImageFrame: (frame: Frame | null) => void;
    setImageRendering: (zoom: number) => void;
    setOpacity: (v: number) => void;
    /** 数字键对应的变换 */
    transform: (index: number) => void;
};

const dingPhotoClass = addClass(
    {},
    {
        "&:hover": {
            boxShadow: "var(--shadow)",
        },
        "&:focus": {
            outline: "none",
        },
    },
);

const dingPhotoHightClass = addClass({ boxShadow: "var(--shadow)" }, {});

const toolBarButtonsClass = addClass(
    {},
    {
        "&>button": {
            height: "32px",
        },
    },
);

const toolBarIClass = addClass(
    {},
    {
        "&>div": {
            display: "flex",
            alignItems: "center",
            width: "auto",
        },
    },
);

const imageClass = addClass(
    { position: "relative", width: "100%", userSelect: "none" },
    { "&>*": { width: "100%", top: 0, left: 0 } },
);

const appDragClass = addClass(
    {
        // @ts-ignore
        "-webkit-app-region": "drag",
    },
    {},
);

const appNoDragClass = addClass(
    {
        // @ts-ignore
        "-webkit-app-region": "no-drag",
    },
    {},
);

const SMALL_TOOLBAR_WIDTH = 390;

const transformList = store.get("贴图.窗口.变换");
const tranStyle = document.createElement("style");
for (const [i, t] of transformList.entries()) {
    tranStyle.innerHTML += `.tran${i}{${t}}`;
}
document.body.appendChild(tranStyle);

export function iconEl(src: IconType): ElType<HTMLImageElement> {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}

export function getUrl(data: DingItemData) {
    return data.isTranslate ? data.translation : data.url;
}

export async function copyDing(data: DingItemData) {
    const response = await fetch(getUrl(data));
    const blob = await response.blob();
    await writeImage(blob);
}

export function saveDing(data: DingItemData) {
    const b = Buffer.from(
        getUrl(data).replace(/^data:image\/\w+;base64,/, ""),
        "base64",
    );
    renderSend("windowTopest", [false]);
    const save = renderSendSync("save_file_path", ["png"]);
    renderSend("windowTopest", [true]);
    if (!save) return;
    fs.writeFileSync(save, b);
    renderSend("ok_save", [save]);
}

export function editDing(data: DingItemData) {
    const b = Buffer.from(
        getUrl(data).replace(/^data:image\/\w+;base64,/, ""),
        "base64",
    );
    renderSend("edit_pic", [b]);
}

export function createDingItem(opts: DingItemOptions): DingItem {
    const { data, single } = opts;
    const wid = data.id;

    const div = view()
        .attr({ id: wid, tabIndex: 0 })
        .style({ position: "fixed", overflow: "hidden" })
        .class(dingPhotoClass);
    if (store.get("贴图.窗口.提示")) div.class(dingPhotoHightClass);

    const img = image(data.url, "").attr({ draggable: false });
    const imageP = view()
        .class("img")
        .add(img)
        .class(imageClass)
        .class(Class.transition);

    const toolBar = view().style({
        overflow: "hidden",
        width: "100%",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 2,
    });
    const toolBarC = view("x")
        .attr({ id: "tool_bar_c" })
        .style({
            padding: "4px",
            gap: "4px",
            boxSizing: "border-box",
            width: "100%",
            alignItems: "center",
            userSelect: "none",
        })
        .class(Class.glassBar)
        .class(toolBarIClass)
        .bindSet((v: { forceShow?: boolean; show?: boolean }, el) => {
            if (v.forceShow !== undefined)
                el.setAttribute("data-force-show", String(v.forceShow));
            if (v.show !== undefined)
                el.setAttribute("data-show", String(v.show));
            if (el.getAttribute("data-force-show") === "true") {
                el.style.transform = "translateY(0)";
            } else {
                el.style.transform =
                    el.getAttribute("data-show") === "true"
                        ? "translateY(0)"
                        : "translateY(-105%)";
            }
        })
        .sv({ show: false })
        .class(Class.transition);
    toolBar.add(toolBarC);

    // 原生拖动：整个贴图可以拖动，顶栏不拖动，保证按钮可点、鼠标移到顶部能唤出顶栏
    if (opts.nativeDrag) {
        div.class(appDragClass);
        toolBar.class(appNoDragClass);
        toolBarC.class(appNoDragClass);
    }

    div.el.onmouseenter = () => {
        toolBarC.sv({ show: true });
    };
    div.el.onmouseleave = () => {
        toolBarC.sv({ show: false });
    };

    const concorlClass = addClass(
        {
            cursor: "ew-resize",
        },
        {
            "& .icon": {
                width: "32px",
                position: "initial",
            },
        },
    );

    // 透明
    const opacityEl = txt()
        .bindSet((v: string, el) => {
            el.innerText = `${v}%`;
            img.el.style.opacity = `${Number(v) / 100}`;
        })
        .sv("100");
    const opacityElP = view("x")
        .class(concorlClass)
        .class(appNoDragClass)
        .attr({ title: "不透明度" })
        .add([iconEl("opacity"), opacityEl]);

    trackPoint(opacityElP, {
        start: () => {
            toolBarC.sv({ forceShow: true });
            return { x: 0, y: 0, data: Number.parseInt(opacityEl.gv, 10) };
        },
        ing: (p, _e, { startData }) => {
            const d = Math.round(p.x / 2);
            const newOp = Math.max(0, Math.min(100, startData + d));
            opacityEl.sv(newOp.toString());
        },
        end: () => {
            toolBarC.sv({ forceShow: false });
        },
    });

    toolBarC.add(opacityElP);

    // 大小
    const sizeInput = txt()
        .bindSet((v: string, el) => {
            el.innerText = `${v}%`;
        })
        .bindGet((el) => {
            return Number.parseInt(el.innerText, 10);
        })
        .sv("100");
    const sizeEl = view("x")
        .class(concorlClass)
        .class(appNoDragClass)
        .attr({ title: "大小" })
        .add([iconEl("size"), sizeInput]);

    trackPoint(sizeEl, {
        start: () => {
            toolBarC.sv({ forceShow: true });
            return { x: 0, y: 0, data: sizeInput.gv };
        },
        ing: (p, _e, { startData }) => {
            const d = Math.round(p.x / 2);
            const newS = Math.max(0, startData + d);
            sizeInput.sv(newS.toString());
            const zoom = Math.max(newS / 100, 0.05);
            if (Number.isFinite(zoom)) opts.zoom(zoom, 0, 0, false);
        },
        end: () => {
            toolBarC.sv({ forceShow: false });
        },
    });

    toolBarC.add(sizeEl);

    // 滚轮缩放
    div.el.onwheel = (e) => {
        if (e.deltaY !== 0) {
            let zoom = Number(sizeInput.gv) / 100;
            const zz = 1 + Math.abs(e.deltaY) / 300;
            zoom = e.deltaY > 0 ? zoom / zz : zoom * zz;
            if (zoom < 0.05) zoom = 0.05;
            const clip = !single && e.ctrlKey;
            const d = dxdy(e, clip ? imageP : div);
            opts.zoom(zoom, d.dx, d.dy, clip);
        }
    };

    const ocrTransStateBarText = txt();
    const ocrTransStateBar = view("x")
        .class(Class.glassBar)
        .class(Class.hide)
        .style({
            padding: "4px",
            gap: "4px",
            bottom: "4px",
            borderRadius: "4px",
            alignItems: "center",
            position: "absolute",
            zIndex: 2,
            left: "50%",
            transform: "translateX(-50%)",
        })
        .add([
            ocrTransStateBarText,
            button(iconEl("close"))
                .attr({ title: "关闭" })
                .on("click", () => {
                    ocrTransStateBar.class(Class.hide);
                }),
        ])
        .bindSet((v: string) => {
            ocrTransStateBarText.sv(v);
        });
    if (opts.nativeDrag) ocrTransStateBar.class(appNoDragClass);

    async function translate() {
        ocrTransStateBar.el.classList.remove(Class.hide);
        ocrTransStateBar.sv("正在OCR识别...");
        const p = await preTranAndOcr(data.url);
        ocrTransStateBar.sv("正在翻译...");
        try {
            await drawTranslation(imageP, data, p);
            ocrTransStateBar.class(Class.hide);
        } catch (error) {
            if (error instanceof UnConfigTranslateError) {
                ocrTransStateBar.sv("未配置翻译引擎");
            } else ocrTransStateBar.sv("翻译失败");
        }
    }

    const transB = button(iconEl("translate"))
        .attr({ title: "翻译" })
        .on("click", async () => {
            const t = data.isTranslate;
            data.isTranslate = !t;
            if (t) {
                div.query("canvas")?.style({ display: "none" });
            } else {
                if (!data.translation) await translate();
                div.query("canvas")?.style({ display: "" });
            }
        });

    const toolButtons = [
        transB,
        button(iconEl("free_draw"))
            .attr({ title: "编辑" })
            .on("click", () => editDing(data)),
        button(iconEl("save"))
            .attr({ title: "保存" })
            .on("click", () => saveDing(data)),
        button(iconEl("copy"))
            .attr({ title: "复制" })
            .on("click", () => copyDing(data)),
    ];
    if (!single) {
        toolButtons.push(
            button(iconEl("minimize"))
                .attr({ title: "最小化" })
                .on("click", () => opts.minimize?.(div.el)),
        );
    }
    toolButtons.push(
        button(iconEl("back"))
            .attr({ title: "归位" })
            .on("click", () => opts.back()),
        button(iconEl("close"))
            .attr({ title: "关闭" })
            .on("click", () => opts.close()),
    );

    toolBarC.add([
        spacer(),
        view()
            .class(Class.transition, toolBarButtonsClass)
            .class(appNoDragClass)
            .add(toolButtons),
    ]);

    // 双击行为
    div.el.ondblclick = () => {
        if (store.get("贴图.窗口.双击") === "归位") opts.back();
        else opts.close();
    };
    // 放到前面
    div.el.onclick = () => {
        opts.front?.();
    };
    // 快捷键
    div.on("keydown", (e) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (e.key === "Escape") {
            opts.close();
        }
        if (!Number.isNaN(Number(e.key))) {
            transform(Number(e.key) - 1);
        }
    });
    // 图片在前、顶栏在后：-webkit-app-region 会继承，图片的拖动区会覆盖顶栏，必须在顶栏之后处理 no-drag
    div.add(imageP).add(toolBar).add(ocrTransStateBar);

    const setSize = (zoom: number) => {
        sizeInput.sv(String(Math.round(zoom * 100)));
    };
    const setToolbarZoom = (width: number) => {
        toolBarC.style({
            zoom:
                width <= SMALL_TOOLBAR_WIDTH
                    ? String(width / SMALL_TOOLBAR_WIDTH)
                    : "",
        });
    };
    const setImageFrame = (frame: Frame | null) => {
        if (frame) {
            imageP.style({
                left: `${frame.x}px`,
                top: `${frame.y}px`,
                width: `${frame.w}px`,
                height: `${frame.h}px`,
            });
        } else {
            imageP.style({
                left: "0",
                top: "0",
                width: "100%",
                height: "",
            });
        }
    };
    const setImageRendering = (zoom: number) => {
        for (const i of div.queryAll(".img>*")) {
            i.style({
                "image-rendering": zoom > 1.5 ? "pixelated" : "initial",
            });
        }
    };
    const transform = (index: number) => {
        const target = `tran${index}`;
        const classes = Array.from(img.el.classList.values()).filter((c) =>
            /^tran\d+$/.test(c),
        );
        const onlyTarget = classes.length === 1 && classes[0] === target;
        img.el.classList.remove(...classes);
        if (index >= 0 && index < transformList.length && !onlyTarget) {
            img.el.classList.add(target);
        }
    };
    const setOpacity = (v: number | string) => {
        opacityEl.sv(String(v));
    };

    return {
        data,
        el: div,
        imageEl: imageP,
        translate,
        setSize,
        setToolbarZoom,
        setImageFrame,
        setImageRendering,
        setOpacity,
        transform,
    };
}

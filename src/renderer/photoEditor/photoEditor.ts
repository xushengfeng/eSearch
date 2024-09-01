import {
    button,
    check,
    ele,
    frame,
    image,
    input,
    label,
    pureStyle,
    select,
    textarea,
    txt,
    view,
} from "dkh-ui";
import type { setting } from "../../ShareTypes";
import initStyle from "../root/root";
import store from "../../../lib/store/renderStore";
const { ipcRenderer, nativeImage, clipboard } = window.require(
    "electron",
) as typeof import("electron");
const { writeFileSync } = require("node:fs") as typeof import("fs");

import add_svg from "../assets/icons/add.svg";
import close_svg from "../assets/icons/close.svg";
import save_svg from "../assets/icons/save.svg";
import copy_svg from "../assets/icons/copy.svg";

function icon(src: string) {
    return image(src, "icon").class("icon");
}

initStyle(store);

const pz = store.get("高级图片编辑.配置");
const defaultConfig: typeof styleData = {
    name: "0",
    raduis: 0,
    outerRadius: false,
    bgType: "color",
    bgColor: "",
    bgUrl: "",
    "bg.gradient.angle": 0,
    "bg.gradient.repeat": false,
    "bg.gradient.repeatSize": 0,
    "bg.gradient.x": 0,
    "bg.gradient.y": 0,
    "bg.gradient": [],
    "shadow.x": 0,
    "shadow.y": 0,
    "shadow.blur": 0,
    "shadow.color": "",
    "padding.x": 0,
    "padding.y": 0,
    autoPadding: false,
};
let styleData: setting["高级图片编辑"]["配置"][0] = getStyleData(
    store.get("高级图片编辑.默认配置"),
);

function getStyleData(id: string) {
    const data = structuredClone(pz.find((i) => i.name === id));
    if (!data) return defaultConfig;
    for (const key in defaultConfig) {
        if (!(key in data)) {
            data[key] = defaultConfig[key];
        }
    }
    return data;
}

const preview = view().style({ margin: "auto" });
const controls = frame("sidebar", {
    _: view("y"),
    configs: {
        _: view("x").style({ "--b-button": "24px" }),
        select: select([]).on("input", (_, el) => {
            if (!el.gv) return;
            styleData = getStyleData(el.gv);
            setConfig();
            updatePreview();
            store.set("高级图片编辑.默认配置", el.gv);
        }),
        addConf: button(icon(add_svg)).on("click", () => {
            const id = `新配置${crypto.randomUUID().slice(0, 5)}`;
            const newData = structuredClone(styleData);
            newData.name = id;
            pz.push(newData);
            store.set("高级图片编辑.配置", pz);
            setSelect(id);
        }),
        delConf: button(icon(close_svg)).on("click", () => {
            const name = controls.els.select.gv;
            if (!name) return;
            pz.splice(
                pz.findIndex((i) => i.name === name),
                1,
            );
            store.set("高级图片编辑.配置", pz);
            setSelect();
        }),
    },
    controls: {
        _: view("y"),
        _0: txt("圆角"),
        raduis: input("number"),
        outerRadius: label([check(""), "外圆角"]),
        _1: txt("背景"),
        background: {
            _: view("y"),
            bgType: select<(typeof styleData)["bgType"]>([
                { value: "color", name: "纯色" },
                { value: "image", name: "图片" },
                { value: "linear-gradient", name: "线性渐变" },
                { value: "radial-gradient", name: "径向渐变" },
                { value: "conic-gradient", name: "圆锥渐变" },
            ]),
            bgColor: input(),
            bgUrl: input(),
            bgGradient: {
                _: view("y"),
                angle: input("number"),
                // repeat: input("checkbox"),
                // repeatSize: input("number"),
                gx: input("number").attr({ max: "1", min: "0", step: "0.01" }),
                gy: input("number").attr({ max: "1", min: "0", step: "0.01" }),
                gColors: textarea(), // todo
            },
        },
        _2: txt("阴影"),
        shardow: {
            _: view("x"),
            sx: input("number"),
            sy: input("number"),
            blur: input("number"),
            scolor: input(),
        },
        _3: txt("边距"),
        padding: {
            _: view("x"),
            px: input("number"),
            py: input("number"),
        },
    },
    export: {
        _: view("x").style({ gap: "var(--o-padding)" }),
        save: button(icon(save_svg)).on("click", () => {
            const path = ipcRenderer.sendSync("get_save_file_path", "png");
            if (!path) return;
            const img = getImg();
            writeFileSync(path, img.toPNG());
            ipcRenderer.send("window", "close");
        }),
        copy: button(icon(copy_svg)).on("click", () => {
            const img = getImg();
            clipboard.writeImage(img);
            ipcRenderer.send("window", "close");
        }),
    },
});
function setSelect(id?: string) {
    controls.els.select.clear();
    controls.els.select.add(
        [{ value: "", name: "添加" }]
            .concat(pz.map((i) => ({ value: i.name, name: i.name })))
            .map((i) => ele("option").attr({ value: i.value, text: i.name })),
    );
    const nid = id || "";

    controls.els.select.sv(nid);
    if (nid) store.set("高级图片编辑.默认配置", nid);
}

function getImg() {
    return nativeImage.createFromDataURL(canvas.el.toDataURL("image/png", 1));
}

const canvas = ele("canvas");

preview.add(canvas);

const configMap: Partial<
    Record<
        keyof typeof controls.els,
        {
            path: keyof typeof styleData;
            parse?: (v: string) => unknown;
            init?: (v: unknown) => string;
        }
    >
> = {
    raduis: { path: "raduis", parse: Number },
    outerRadius: { path: "outerRadius" },
    bgType: { path: "bgType" },
    bgColor: { path: "bgColor" },
    bgUrl: { path: "bgUrl" },
    angle: { path: "bg.gradient.angle", parse: Number },
    // repeat: { path: "bg.gradient.repeat" },
    // repeatSize: { path: "bg.gradient.repeatSize", parse: Number },
    gx: { path: "bg.gradient.x", parse: Number },
    gy: { path: "bg.gradient.y", parse: Number },
    gColors: {
        path: "bg.gradient",
        parse: (v) =>
            v
                .trim()
                .split("\n")
                .map((i) => ({
                    offset: Number(i.split(" ")[0]),
                    color: i.split(" ")[1],
                })),
        init: (v: (typeof styleData)["bg.gradient"]) =>
            v.map((i) => `${i.offset} ${i.color}`).join("\n"),
    },
    sx: { path: "shadow.x", parse: Number },
    sy: { path: "shadow.y", parse: Number },
    blur: { path: "shadow.blur", parse: Number },
    scolor: { path: "shadow.color" },
    px: { path: "padding.x", parse: Number },
    py: { path: "padding.y", parse: Number },
};

let photo: HTMLImageElement | null = null;

function setConfig() {
    for (const key in configMap) {
        const k = key as keyof typeof configMap;
        const el = controls.els[k];
        const value = configMap[k].init
            ? configMap[k].init(styleData[configMap[k].path])
            : styleData[configMap[k].path];
        // @ts-ignore
        el.sv(value);
    }
}

function updatePreview() {
    if (photo) {
        const ctx = canvas.el.getContext("2d");

        const { naturalWidth: photoWidth, naturalHeight: photoHeight } = photo;
        const raduis = styleData.raduis;
        const {
            bgType,
            bgColor,
            bgUrl,
            "bg.gradient.angle": gAngle,
            // "bg.gradient.repeat": repeat,
            // "bg.gradient.repeatSize": repeatSize,
            "bg.gradient.x": gx,
            "bg.gradient.y": gy,
            "bg.gradient": gradient,
        } = styleData;
        const {
            "shadow.x": x,
            "shadow.y": y,
            "shadow.blur": blur,
            "shadow.color": color,
        } = styleData;
        const { x: padX, y: padY } = styleData.autoPadding
            ? { x: 0, y: 0 }
            : { x: styleData["padding.x"], y: styleData["padding.y"] };

        const outerRadius = styleData.outerRadius
            ? raduis + Math.min(padX, padY)
            : 0;

        const finalWidth = photoWidth + 2 * padX;
        const finalHeight = photoHeight + 2 * padY;

        canvas.el.width = finalWidth;
        canvas.el.height = finalHeight;

        if (outerRadius) {
            ctx.beginPath();
            ctx.roundRect(0, 0, finalWidth, finalHeight, outerRadius);
            ctx.clip();
        }

        if (bgType === "color") {
            ctx.fillStyle = bgColor || "#0000";
            ctx.fillRect(0, 0, finalWidth, finalHeight);
        } else if (bgType === "image") {
            const bgImg = new Image();
            bgImg.onload = () => {
                let scale = finalWidth / bgImg.naturalWidth;
                if (bgImg.naturalHeight * scale < finalHeight) {
                    scale = finalHeight / bgImg.naturalHeight;
                }

                const w = bgImg.naturalWidth * scale;
                const h = bgImg.naturalHeight * scale;
                const x = (finalWidth - w) / 2;
                const y = (finalHeight - h) / 2;

                ctx.drawImage(bgImg, x, y, w, h);
                setPhoto();
            };
            bgImg.src = bgUrl;
        } else {
            let grd: CanvasGradient;
            const angle = (gAngle * Math.PI) / 180;
            if (bgType === "linear-gradient") {
                const r =
                    Math.sin(angle + Math.atan(finalHeight / finalWidth)) *
                    Math.sqrt(finalWidth ** 2 + finalHeight ** 2);
                grd = ctx.createLinearGradient(
                    0,
                    finalHeight,
                    r * Math.sin(angle),
                    finalHeight - r * Math.cos(angle), // angle 基于y轴
                );
            } else if (bgType === "radial-gradient") {
                grd = ctx.createRadialGradient(
                    gx,
                    gy,
                    0,
                    gx,
                    gy,
                    Math.max(finalWidth, finalHeight) / 2,
                );
            } else if (bgType === "conic-gradient") {
                grd = ctx.createConicGradient(angle, gx, gy);
            }
            try {
                for (const item of gradient) {
                    grd.addColorStop(item.offset, item.color);
                }
            } catch (error) {}
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, finalWidth, finalHeight);
        }

        function setPhoto() {
            ctx.globalCompositeOperation = "source-over";
            ctx.shadowOffsetX = x;
            ctx.shadowOffsetY = y;
            ctx.shadowBlur = blur;
            ctx.shadowColor = color;

            const matrix = new DOMMatrix();
            const f = ctx.createPattern(photo, "no-repeat");
            f.setTransform(matrix.translate(padX, padY));
            ctx.fillStyle = f;
            ctx.beginPath();
            ctx.roundRect(padX, padY, photoWidth, photoHeight, raduis);
            ctx.fill();

            canvas.style({ "border-radius": `${outerRadius}px` });
        }

        setPhoto();
    }
}

pureStyle();

document.body.appendChild(controls.el.el);
document.body.appendChild(preview.el);

for (const key in configMap) {
    const k = key as keyof typeof configMap;
    const el = controls.els[k];
    el.on("input", () => {
        const v = el.gv as string;
        if (configMap[k].parse) {
            styleData[configMap[k].path as string] = configMap[k].parse(v);
        } else {
            styleData[configMap[k].path as string] = v;
        }
        updatePreview();
        controls.els.select.sv("");
    });
}

setSelect(store.get("高级图片编辑.默认配置"));

setConfig();

ipcRenderer.on("img", (_e, data: string) => {
    const img = new Image();
    img.onload = () => {
        photo = img;
        updatePreview();
    };
    img.src = data;
});

updatePreview();

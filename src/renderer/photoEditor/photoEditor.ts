import {
    button,
    ele,
    frame,
    image,
    input,
    pureStyle,
    select,
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
import reload_svg from "../assets/icons/reload.svg";
import close_svg from "../assets/icons/close.svg";
import save_svg from "../assets/icons/save.svg";
import copy_svg from "../assets/icons/copy.svg";

function icon(src: string) {
    return image(src, "icon").class("icon");
}

initStyle(store);

const pz = store.get("高级图片编辑.配置");
let styleData: Omit<setting["高级图片编辑"]["配置"][0], "name"> = pz.find(
    (i) => i.name === store.get("高级图片编辑.默认配置"),
) || {
    raduis: 0,
    background: "",
    "shadow.x": 0,
    "shadow.y": 0,
    "shadow.blur": 0,
    "shadow.color": "",
    "padding.x": 0,
    "padding.y": 0,
    autoPadding: false,
};

const preview = view().style({ margin: "auto" });
const controls = frame("sidebar", {
    _: view("y"),
    configs: {
        _: view("x").style({ "--b-button": "24px" }),
        select: select([]).on("input", (_, el) => {
            if (!el.gv) return;
            styleData = pz.find((i) => i.name === el.gv);
            setConfig();
            updatePreview();
            store.set("高级图片编辑.默认配置", el.gv);
        }),
        addConf: button(icon(add_svg)).on("click", () => {
            const id = `新配置${crypto.randomUUID().slice(0, 5)}`;
            pz.push({
                name: id,
                ...styleData,
            });
            store.set("高级图片编辑.配置", pz);
            setSelect(id);
        }),
        updataConf: button(icon(reload_svg)).on("click", () => {
            const name = controls.els.select.gv;
            if (!name) return;
            const index = pz.findIndex((i) => i.name === name);
            if (index === -1) return;
            pz[index] = {
                name,
                ...styleData,
            };
            store.set("高级图片编辑.配置", pz);
            setSelect(name);
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
        _1: txt("背景颜色"),
        background: {
            _: view("x"),
            bgText: input(),
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
        { path: keyof typeof styleData; parse?: (v: string) => unknown }
    >
> = {
    raduis: { path: "raduis", parse: Number },
    bgText: { path: "background" },
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
        el.sv(String(styleData[configMap[k].path]));
    }
}

function updatePreview() {
    if (photo) {
        const ctx = canvas.el.getContext("2d");

        const { naturalWidth: photoWidth, naturalHeight: photoHeight } = photo;
        const { raduis, background } = styleData;
        const {
            "shadow.x": x,
            "shadow.y": y,
            "shadow.blur": blur,
            "shadow.color": color,
        } = styleData;
        const { x: padX, y: padY } = styleData.autoPadding
            ? { x: 0, y: 0 }
            : { x: styleData["padding.x"], y: styleData["padding.y"] };

        const finalWidth = photoWidth + 2 * padX;
        const finalHeight = photoHeight + 2 * padY;

        canvas.el.width = finalWidth;
        canvas.el.height = finalHeight;

        if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, finalWidth, finalHeight);
        }

        ctx.globalCompositeOperation = "source-over";
        ctx.shadowOffsetX = x;
        ctx.shadowOffsetY = y;
        ctx.shadowBlur = blur;
        ctx.shadowColor = color;

        const matrix = new DOMMatrix();
        const f = ctx.createPattern(photo, "repeat");
        f.setTransform(matrix.translate(padX, padY));
        ctx.roundRect(padX, padY, photoWidth, photoHeight, raduis);
        ctx.fillStyle = f;
        ctx.fill();
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

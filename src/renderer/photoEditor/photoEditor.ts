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
    trackPoint,
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
const { join } = require("node:path") as typeof import("path");
const ort = require("onnxruntime-node") as typeof import("onnxruntime-common");
import removeobj from "../lib/removeObj";

import add_svg from "../assets/icons/add.svg";
import close_svg from "../assets/icons/close.svg";
import save_svg from "../assets/icons/save.svg";
import copy_svg from "../assets/icons/copy.svg";

function icon(src: string) {
    return image(src, "icon").class("icon");
}

initStyle(store);

const maskPens: Map<string, { w: number; ps: { x: number; y: number }[] }> =
    new Map();

let maskOrt: Awaited<ReturnType<typeof ort.InferenceSession.create>> | null =
    null;

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

const preview = view().style({ margin: "auto", position: "relative" });
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
            ])
                .on("input", (_, el) => {
                    setBgUI(el.gv);
                })
                .bindSet((v: (typeof styleData)["bgType"], el) => {
                    setBgUI(v);
                    el.value = v;
                }),
            bgColor: input(),
            bgUrl: input(),
            bgGradient: {
                _: view("y"),
                angle: input("number"),
                // repeat: input("checkbox"),
                // repeatSize: input("number"),
                gx: input("number").attr({ max: "1", min: "0", step: "0.01" }),
                gy: input("number").attr({ max: "1", min: "0", step: "0.01" }),
                gColors: gColors(),
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
        _4: txt("魔法消除"),
        magic: {
            _: view("y"),
            magicPen: label([check(""), "魔法笔"]),
            magicPenList: view("y").style({
                "max-height": "200px",
                "overflow-y": "auto",
            }),
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

function setBgUI(type: (typeof styleData)["bgType"]) {
    if (type === "image") {
        controls.els.bgUrl.style({ display: "" });
        controls.els.bgGradient.style({ display: "none" });
        controls.els.bgColor.style({ display: "none" });
    } else if (type === "color") {
        controls.els.bgUrl.style({ display: "none" });
        controls.els.bgGradient.style({ display: "none" });
        controls.els.bgColor.style({ display: "" });
    } else {
        controls.els.bgUrl.style({ display: "none" });
        controls.els.bgGradient.style({ display: "" });
        controls.els.bgColor.style({ display: "none" });
    }
}

function getImg() {
    return nativeImage.createFromDataURL(canvas.el.toDataURL("image/png", 1));
}

function gColors() {
    const div = view("y");
    const list = view("y");
    const add = button("+");

    function createI(color: string, offset: number) {
        console.log(color, offset);

        const el = view("x").add([
            input().sv(color).on("input", binput).style({ width: "100%" }),
            input("number")
                .attr({ max: "1", min: "0", step: "0.01" })
                .sv(String(offset))
                .on("input", binput),
            button("-").on("click", () => {
                el.remove();
                binput();
            }),
        ]);
        return el;
    }

    add.on("click", () => {
        list.add(createI("#0000", 0.5));
    });

    function binput() {
        div.el.dispatchEvent(new Event("input"));
    }

    return div
        .add([list, add])
        .bindGet(() => {
            return list.queryAll("div").map((i) => {
                const l = i.queryAll("input");
                return { offset: Number(l[1].el.value), color: l[0].el.value };
            });
        })
        .bindSet((v: (typeof styleData)["bg.gradient"]) => {
            list.clear();
            for (const item of v) {
                list.add(createI(item.color, item.offset));
            }
        });
}

const canvas = ele("canvas");
const magicPenPreview = ele("canvas");
const magicPenPreviewCtx = magicPenPreview.el.getContext("2d");

preview.add([canvas, magicPenPreview]);

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
    gColors: { path: "bg.gradient" },
    sx: { path: "shadow.x", parse: Number },
    sy: { path: "shadow.y", parse: Number },
    blur: { path: "shadow.blur", parse: Number },
    scolor: { path: "shadow.color" },
    px: { path: "padding.x", parse: Number },
    py: { path: "padding.y", parse: Number },
};

let photoSrc: HTMLImageElement | null = null;
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

        magicPenPreview
            .style({
                top: 0,
                position: "absolute",
            })
            .attr({ width: finalWidth, height: finalHeight });

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
            const x = gx * finalWidth;
            const y = gy * finalHeight;
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
                    x,
                    y,
                    0,
                    x,
                    y,
                    Math.max(finalWidth, finalHeight) / 2,
                );
            } else if (bgType === "conic-gradient") {
                grd = ctx.createConicGradient(angle, x, y);
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

async function magicPen() {
    if (!maskOrt) {
        maskOrt = await ort.InferenceSession.create(
            join(
                __dirname,
                "../../assets/onnx/inpaint",
                "migan_pipeline_v2.onnx",
            ),
            {
                executionProviders: [
                    { name: store.get("AI.运行后端") || "cpu" },
                ],
            },
        );
    }
    const w = photo.naturalWidth;
    const h = photo.naturalHeight;

    const outW = magicPenPreview.el.width;
    const outH = magicPenPreview.el.height;
    const maskImg = new OffscreenCanvas(outW, outH);
    const maskCtx = maskImg.getContext("2d");
    maskCtx.clearRect(0, 0, outW, outH);
    maskCtx.fillStyle = "#fff";
    maskCtx.fillRect(0, 0, outW, outH);
    maskCtx.lineCap = "round";
    maskCtx.lineJoin = "round";
    maskCtx.strokeStyle = "#000";
    console.log("magicPen", maskPens);

    for (const x of maskPens.values()) {
        maskCtx.lineWidth = x.w;
        maskCtx.moveTo(x.ps[0].x, x.ps[0].y);
        for (const p of x.ps) {
            maskCtx.lineTo(p.x, p.y);
        }
        maskCtx.stroke();
    }
    const mask = maskCtx.getImageData(
        styleData["padding.x"],
        styleData["padding.y"],
        w,
        h,
    );
    const outputData = await removeobj({
        ort,
        session: maskOrt,
        img: photoSrc,
        mask: mask,
    });
    // imagedata to image element
    const outputImg = new Image();
    outputImg.onload = () => {
        photo = outputImg;
        updatePreview();
    };
    const outputCanvas = ele("canvas").attr({
        width: w,
        height: h,
    });
    const outputCtx = outputCanvas.el.getContext("2d");
    outputCtx.putImageData(outputData, 0, 0);
    outputImg.src = outputCanvas.el.toDataURL("image/png", 1);
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

trackPoint(magicPenPreview, {
    start: (e) => {
        if (!controls.els.magicPen.gv) return null;
        const id = crypto.randomUUID();
        maskPens.set(id, {
            ps: [],
            w: 10,
        });
        const ctx = magicPenPreviewCtx;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 10;
        ctx.strokeStyle = "#0005";
        const x =
            (e.offsetX / magicPenPreview.el.offsetWidth) *
            magicPenPreview.el.width;
        const y =
            (e.offsetY / magicPenPreview.el.offsetHeight) *
            magicPenPreview.el.height;
        ctx.moveTo(x, y);
        return {
            x: x,
            y: y,
            data: id,
        };
    },
    ing: (_, __, e, id) => {
        const x =
            (e.offsetX / magicPenPreview.el.offsetWidth) *
            magicPenPreview.el.width;
        const y =
            (e.offsetY / magicPenPreview.el.offsetHeight) *
            magicPenPreview.el.height;
        maskPens.get(id).ps.push({ x, y });
        magicPenPreviewCtx.lineTo(x, y);
        magicPenPreviewCtx.stroke();
        return id;
    },
    end: (_, __, id) => {
        magicPenPreviewCtx.clearRect(
            0,
            0,
            magicPenPreview.el.width,
            magicPenPreview.el.height,
        );
        const items = view("x").add([
            button("x").on("click", () => {
                maskPens.delete(id);
                items.remove();
                magicPen();
            }),
            // todo hover preview
        ]);
        controls.els.magicPenList.add(items);
        magicPen();
    },
});

ipcRenderer.on("img", (_e, data: string) => {
    const img = new Image();
    img.onload = () => {
        photo = img;
        photoSrc = img;
        updatePreview();
    };
    img.src = data;
});

updatePreview();

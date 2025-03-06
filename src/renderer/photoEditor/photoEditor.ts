import {
    addStyle,
    button,
    check,
    ele,
    frame,
    image,
    input,
    label,
    noI18n,
    select,
    setTranslate,
    trackPoint,
    txt,
    view,
} from "dkh-ui";
import type { setting } from "../../ShareTypes";
import { getImgUrl, initStyle, setTitle } from "../root/root";
import store from "../../../lib/store/renderStore";
const { ipcRenderer, nativeImage, clipboard } = window.require(
    "electron",
) as typeof import("electron");
const { writeFileSync } = require("node:fs") as typeof import("fs");
const { join } = require("node:path") as typeof import("path");
const ort = require("onnxruntime-node") as typeof import("onnxruntime-common");
import removeobj from "../lib/removeObj";
import { t } from "../../../lib/translate/translate";
import { renderSend, renderSendSync } from "../../../lib/ipc";

// @auto-path:../assets/icons/$.svg
function icon(src: string) {
    return image(getImgUrl(`${src}.svg`), noI18n("icon")).class("icon");
}

initStyle(store);

setTranslate(t);

setTitle(t("高级编辑"));

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

function subTitle(text: string) {
    return txt(text).class("sub-title");
}

addStyle({
    body: {
        display: "flex",
        height: "100vh",
    },
    canvas: {
        maxWidth: "100%",
        maxHeight: "100%",
        transition: "var(--transition)",
    },
    "canvas:hover": {
        boxShadow: "var(--shadow)",
    },
    ".sub-title": {
        fontSize: "1.2rem",
        fontWeight: 500,
    },
});

const preview = view().style({
    margin: "auto",
    position: "relative",
    height: "100%",
});
const controls = frame("sidebar", {
    _: view("y")
        .style({
            width: "200px",
            padding: "var(--o-padding)",
            gap: "var(--o-padding)",
            "overflow-y": "auto",
            "overflow-x": "hidden",
        })
        .class("small-size"),
    configs: {
        _: view("x"),
        select: select([]).on("input", (_, el) => {
            if (!el.gv) return;
            styleData = getStyleData(el.gv);
            setConfig();
            updatePreview();
            store.set("高级图片编辑.默认配置", el.gv);
        }),
        addConf: button(icon("add")).on("click", () => {
            const id = `${t("新配置")}${crypto.randomUUID().slice(0, 5)}`;
            const newData = structuredClone(styleData);
            newData.name = id;
            pz.push(newData);
            store.set("高级图片编辑.配置", pz);
            setSelect(id);
        }),
        delConf: button(icon("close")).on("click", () => {
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
        _: view("y").style({ gap: "var(--o-padding)" }),
        _raduis: {
            _: view("y"),
            _0: subTitle("圆角"),
            raduis: input("number"),
            outerRadius: label([check(""), "外圆角"]),
        },
        background: {
            _: view("y"),
            _1: subTitle("背景"),
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
        _shadow: {
            _: view("y"),
            _2: subTitle("阴影"),
            shadow: {
                _: view("x"),
                sx: input("number"),
                sy: input("number"),
                blur: input("number"),
                scolor: input(),
            },
        },
        _padding: {
            _: view("y"),
            _3: subTitle("边距"),
            padding: { _: view("x"), px: input("number"), py: input("number") },
        },
        magic: {
            _: view("y"),
            _4: subTitle("魔法消除"),
            magicPen: label([check(""), "魔法橡皮"]),
            magicPenList: view("x", "wrap").style({
                "max-height": "200px",
                "overflow-y": "auto",
                gap: "var(--o-padding)",
            }),
        },
    },
    export: {
        _: view("y").style({ gap: "var(--o-padding)" }),
        _ex_edit: {
            _: view("y").style({ gap: "var(--o-padding)" }),
            formart: select([
                { value: "png", name: noI18n("PNG") },
                { value: "jpg", name: noI18n("JPEG") },
                { value: "webp", name: noI18n("WebP") },
            ]).sv(
                (() => {
                    const format = store.get("保存.默认格式");
                    if (format === "svg") return "png";
                    return format;
                })(),
            ),
            quality: input("number")
                .attr({ max: "1", min: "0", step: "0.1" })
                .sv("1"),
            phScale: {
                _: view("x").style({
                    gap: "var(--o-padding)",
                    "flex-wrap": "wrap",
                }),
                _s0: button("原始").on("click", () => scale(1)),
                _s1: button(noI18n("3/4")).on("click", () => scale(0.75)),
                _s2: button(noI18n("1/2")).on("click", () => scale(0.5)),
                _s3: button(noI18n("1/3")).on("click", () => scale(0.333)),
                _s4: button(noI18n("1/4")).on("click", () => scale(0.25)),
                _s5: button(noI18n("1/5")).on("click", () => scale(0.2)),
                _autoW: button("自动宽度").on("click", () => {
                    autoScale("width");
                }),
                _autoH: button("自动高度").on("click", () => {
                    autoScale("height");
                }),
            },
            _phWH: {
                _: view("x").style({ gap: "var(--o-padding)" }),
                photoW: input("number"),
                photoH: input("number"),
            },
        },
        _ex_save: {
            _: view("x").style({ gap: "var(--o-padding)" }),
            save: button(icon("save")).on("click", () => {
                const path = renderSendSync("save_file_path", [
                    controls.els.formart.gv,
                ]);
                if (!path) return;
                const img = getImg(true).replace(
                    /^data:image\/\w+;base64,/,
                    "",
                );
                writeFileSync(path, Buffer.from(img, "base64"));
                renderSend("ok_save", [path]);
                ipcRenderer.send("window", "close");
            }),
            copy: button(icon("copy")).on("click", () => {
                const img = getImg();
                clipboard.writeImage(img);
                ipcRenderer.send("window", "close");
            }),
        },
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

function scale(num: number) {
    controls.els.photoH.sv(String(Math.round(canvas.el.height * num)));
    controls.els.photoW.sv(String(Math.round(canvas.el.width * num)));
}

function autoScale(type: "width" | "height") {
    const sw = canvas.el.width;
    const sh = canvas.el.height;
    const wEl = controls.els.photoW;
    const hEl = controls.els.photoH;
    if (type === "width") {
        wEl.sv(String(Math.round((Number(hEl.gv) / sh) * sw)));
    } else {
        hEl.sv(String(Math.round((Number(wEl.gv) / sw) * sh)));
    }
}

function getImg(): Electron.NativeImage;
function getImg(base64: true): string;
function getImg(base64 = false) {
    const x = ele("canvas").attr({
        width: Number(controls.els.photoW.gv),
        height: Number(controls.els.photoH.gv),
    }).el;
    const ctx = x.getContext("2d");
    if (!ctx) throw new Error("canvas context is null");
    ctx.drawImage(
        canvas.el,
        0,
        0,
        canvas.el.width,
        canvas.el.height,
        0,
        0,
        x.width,
        x.height,
    );
    const type = {
        png: "image/png",
        jpg: "image/jpeg",
        webp: "image/webp",
    };
    const url = x.toDataURL(
        type[controls.els.formart.gv],
        Number(controls.els.quality.gv),
    );
    if (base64) return url;
    return nativeImage.createFromDataURL(url);
}

function gColors() {
    const div = view("y");
    const list = view("y");
    const add = button(noI18n("+"));

    function createI(color: string, offset: number) {
        console.log(color, offset);

        const el = view("x").add([
            input().sv(color).on("input", binput).style({ width: "100%" }),
            input("number")
                .attr({ max: "1", min: "0", step: "0.01" })
                .sv(String(offset))
                .on("input", binput),
            button(noI18n("-")).on("click", () => {
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
const magicPenPreviewCtx = magicPenPreview.el.getContext(
    "2d",
) as CanvasRenderingContext2D;

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
        // @ts-ignore
        const value = configMap[k].init
            ? // @ts-ignore
              configMap[k].init(styleData[configMap[k].path])
            : // @ts-ignore
              styleData[configMap[k].path];
        // @ts-ignore
        el.sv(value);
    }
}

function updatePreview() {
    if (!photo) return;
    const ctx = canvas.el.getContext("2d");
    if (!ctx) throw new Error("canvas context is null");

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

    controls.els.photoW
        .sv(finalWidth.toString())
        .attr({ max: finalWidth.toString() });
    controls.els.photoH
        .sv(finalHeight.toString())
        .attr({ max: finalHeight.toString() });

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
        } else {
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
        if (!ctx) throw new Error("canvas context is null");
        if (!photo) return;
        ctx.globalCompositeOperation = "source-over";
        ctx.shadowOffsetX = x;
        ctx.shadowOffsetY = y;
        ctx.shadowBlur = blur;
        ctx.shadowColor = color;

        const matrix = new DOMMatrix();
        const f = ctx.createPattern(photo, "no-repeat");
        if (f) {
            f.setTransform(matrix.translate(padX, padY));
            ctx.fillStyle = f;
        }
        ctx.beginPath();
        ctx.roundRect(padX, padY, photoWidth, photoHeight, raduis);
        ctx.fill();

        canvas.style({ "border-radius": `${outerRadius}px` });
    }

    setPhoto();
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
    if (!photo || !photoSrc) return;
    const w = photo.naturalWidth;
    const h = photo.naturalHeight;

    const outW = magicPenPreview.el.width;
    const outH = magicPenPreview.el.height;
    const maskImg = new OffscreenCanvas(outW, outH);
    const maskCtx = maskImg.getContext(
        "2d",
    ) as OffscreenCanvasRenderingContext2D;
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
    const outputCtx = outputCanvas.el.getContext(
        "2d",
    ) as CanvasRenderingContext2D;
    outputCtx.putImageData(outputData, 0, 0);
    outputImg.src = outputCanvas.el.toDataURL("image/png", 1);
}

function previewPen(id: string) {
    const ctx = magicPenPreviewCtx;
    ctx.clearRect(0, 0, magicPenPreview.el.width, magicPenPreview.el.height);
    if (!id) return;
    const x = maskPens.get(id);
    if (!x) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = x.w;
    ctx.strokeStyle = "#0005";
    ctx.beginPath();
    ctx.moveTo(x.ps[0].x, x.ps[0].y);
    for (const p of x.ps) {
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
}

controls.el.addInto();
preview.addInto();

for (const key in configMap) {
    const k = key as keyof typeof configMap;
    const el = controls.els[k];
    el.on("input", () => {
        const v = el.gv as string;
        if (configMap[k])
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
    ing: (_, e, { startData: id }) => {
        const x =
            (e.offsetX / magicPenPreview.el.offsetWidth) *
            magicPenPreview.el.width;
        const y =
            (e.offsetY / magicPenPreview.el.offsetHeight) *
            magicPenPreview.el.height;
        // @ts-ignore
        maskPens.get(id).ps.push({ x, y });
        magicPenPreviewCtx.lineTo(x, y);
        magicPenPreviewCtx.stroke();
    },
    end: (_, { startData: id }) => {
        magicPenPreviewCtx.clearRect(
            0,
            0,
            magicPenPreview.el.width,
            magicPenPreview.el.height,
        );
        const items = button(icon("close"))
            .on("click", () => {
                maskPens.delete(id);
                items.remove();
                magicPen();
            })
            .on("pointerenter", () => previewPen(id))
            .on("pointerleave", () => previewPen(""));
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

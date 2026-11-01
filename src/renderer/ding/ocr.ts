import { ele } from "dkh-ui";
import store from "../../../lib/store/renderStore";
import { loadTranslator } from "../lib/translate";
import { defaultOcrId, loadOCR } from "../ocr/ocr";
import type { DingItemData } from "./item";

let lo: import("esearch-ocr").initType;
let translateE: ((input: string[]) => Promise<string[]>) | undefined;

export async function initOCR() {
    if (!lo) {
        const x = loadOCR(store, store.get("OCR.类型") || defaultOcrId);
        if (x) lo = await x.ocr.init(x.config);
    }
}

export type OcrResult = Awaited<ReturnType<typeof ocr>>;

async function ocr(img: string) {
    const p = await lo.ocr(img);
    return p.columns.flatMap((c) => c.parragraphs);
}

/** OCR 并准备翻译器 */
export async function preTranAndOcr(url: string) {
    translateE = loadTranslator(store);
    await initOCR();
    return ocr(url);
}

export class UnConfigTranslateError extends Error {}

/** 将翻译结果绘制到图片上 */
export async function drawTranslation(
    imgView: { el: HTMLElement },
    data: DingItemData,
    p: OcrResult,
) {
    const image = imgView.el.querySelector("img");
    if (!image) return;
    const canvas = ele("canvas")
        .attr({
            width: image.naturalWidth,
            height: image.naturalHeight,
        })
        .style({ position: "absolute", pointerEvents: "none" })
        .addInto(imgView.el).el;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    console.log(p);
    if (!translateE) throw new UnConfigTranslateError();
    const tr = await translateE(p.map((i) => i.parse.text));
    console.log(tr);

    for (const [i, t] of tr.entries()) {
        const x = p[i];
        if (t !== x.parse.text) drawText(t, ctx, x.parse.box, x.src);
    }
    data.translation = canvas.toDataURL("image/png", 1);
    data.isTranslate = true;
}

function distance(a: [number, number], b: [number, number]) {
    return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
}

function drawText(
    text: string,
    ctx: CanvasRenderingContext2D,
    box: OcrResult[0]["parse"]["box"],
    boxSrc: OcrResult[0]["src"],
) {
    const textList = Array.from(seg.segment(text));

    const firstline = boxSrc[0].box;
    const lineHeight = distance(firstline[3], firstline[0]);
    const lineNum = boxSrc.length;
    let fontSize = lineHeight;
    ctx.font = `${fontSize}px serif`;
    const textWidth = ctx.measureText(text).width;
    const boxWidth = distance(box[1], box[0]);
    const boxHeight = distance(box[3], box[0]);
    const oneLineWidth = boxWidth * lineNum;
    if (textWidth > oneLineWidth) {
        fontSize = Math.floor((fontSize * oneLineWidth) / textWidth);
        ctx.font = `${fontSize}px serif`;
    }

    const gap =
        lineNum === 1 ? 0 : (boxHeight - lineHeight * lineNum) / (lineNum - 1);
    const lines = splitText(textList, ctx, boxWidth);

    for (const b of boxSrc) {
        ctx.fillStyle = color2rgb(b.style.bg);
        ctx.strokeStyle = color2rgb(b.style.bg); // 拓展外边
        ctx.beginPath();
        ctx.moveTo(b.box[0][0], b.box[0][1]);
        ctx.lineTo(b.box[1][0], b.box[1][1]);
        ctx.lineTo(b.box[2][0], b.box[2][1]);
        ctx.lineTo(b.box[3][0], b.box[3][1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    const angle = Math.atan2(box[1][1] - box[0][1], box[1][0] - box[0][0]);
    const yBaseVector = [
        (box[3][0] - box[0][0]) / boxHeight,
        (box[3][1] - box[0][1]) / boxHeight,
    ];
    ctx.textBaseline = "top";
    ctx.fillStyle = color2rgb(boxSrc[0].style.text);
    for (const [i, line] of lines.entries()) {
        const yn = i * lineHeight + i * gap;
        const x = box[0][0] + yBaseVector[0] * yn;
        const y = box[0][1] + yBaseVector[1] * yn;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(line, 0, 0, boxWidth);
        ctx.restore();
    }
}

function color2rgb(color: number[]) {
    return `rgb(${color.join(",")})`;
}

function splitText(
    text: Intl.SegmentData[],
    ctx: CanvasRenderingContext2D,
    maxWidth: number,
) {
    // todo 性能
    // todo 符号不能在开头
    let line = "";
    const lines: string[] = [];
    for (let i = 0; i < text.length; i++) {
        const t = text[i].segment;
        if (ctx.measureText(line + t).width < maxWidth) {
            line += t;
        } else {
            lines.push(line);
            line = t;
        }
    }
    if (line) {
        lines.push(line);
    }

    return lines.map((l) => l.trimEnd());
}

let seg: Intl.Segmenter;
try {
    seg = new Intl.Segmenter(
        store.get("屏幕翻译.语言.to") ?? navigator.language ?? "zh-HANS",
        { granularity: "word" },
    );
} catch (error) {
    seg = new Intl.Segmenter("zh-HANS", { granularity: "word" });
}

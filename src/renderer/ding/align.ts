import { findOffset } from "picture_match";
import type { NormRect } from "../../ShareTypes";

export function loadImage(url: string) {
    return new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
    });
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadImageCached(url: string) {
    let p = imageCache.get(url);
    if (!p) {
        p = loadImage(url);
        imageCache.set(url, p);
    }
    return p;
}

export type PreviewMatch = {
    crop: NormRect;
    score: number;
};

const PREVIEW_WORK = 640;

function lum(data: ImageData, x: number, y: number) {
    const p = (y * data.width + x) * 4;
    return (
        data.data[p] * 0.299 +
        data.data[p + 1] * 0.587 +
        data.data[p + 2] * 0.114
    );
}

function ncc(poster: ImageData, frame: ImageData, x: number, y: number) {
    const cw = poster.width;
    const ch = poster.height;
    const l = Math.max(0, x);
    const t = Math.max(0, y);
    const r = Math.min(frame.width, x + cw);
    const b = Math.min(frame.height, y + ch);
    const ow = Math.max(0, r - l);
    const oh = Math.max(0, b - t);
    if (ow < cw * 0.6 || oh < ch * 0.6) return -1;
    let n = 0;
    let sa = 0;
    let sb = 0;
    let saa = 0;
    let sbb = 0;
    let sab = 0;
    for (let yy = t; yy < b; yy++) {
        for (let xx = l; xx < r; xx++) {
            const a = lum(poster, xx - x, yy - y);
            const bb = lum(frame, xx, yy);
            n++;
            sa += a;
            sb += bb;
            saa += a * a;
            sbb += bb * bb;
            sab += a * bb;
        }
    }
    const ma = sa / n;
    const mb = sb / n;
    const va = saa - n * ma * ma;
    const vb = sbb - n * mb * mb;
    if (va <= 1e-6 || vb <= 1e-6) return -1;
    return (sab - n * ma * mb) / Math.sqrt(va * vb);
}

function drawPoster(
    poster: HTMLImageElement,
    width: number,
    height: number,
    workWidth: number,
    workHeight: number,
) {
    const pc = document.createElement("canvas");
    pc.width = width;
    pc.height = height;
    const pctx = pc.getContext("2d");
    if (!pctx) return null;
    pctx.drawImage(poster, 0, 0, width, height);
    const pd = pctx.getImageData(0, 0, width, height);

    const padded = document.createElement("canvas");
    padded.width = workWidth;
    padded.height = workHeight;
    const ctx = padded.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, workWidth, workHeight);
    ctx.drawImage(pc, 0, 0);
    return {
        poster: pd,
        padded: ctx.getImageData(0, 0, workWidth, workHeight),
    };
}

/**
 * 在原截屏选区 poster 和窗口实时画面 video 之间做匹配。
 * poster 按假设的像素比例缩放后，放到工作画面左上角，用 picture_match 求偏移。
 * 返回选区的归一化裁剪和 NCC 分数。
 * scaleSearch 会尝试视频相对截屏被缩放的常见比例。
 */
export async function matchPosterInFrame(
    poster: HTMLImageElement,
    video: HTMLVideoElement,
    opts?: { scaleSearch?: boolean },
): Promise<PreviewMatch | null> {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!(vw > 0) || !(vh > 0)) return null;
    if (!poster.naturalWidth || !poster.naturalHeight) return null;
    const W = Math.min(PREVIEW_WORK, vw);
    const H = Math.max(1, Math.round((vh * W) / vw));
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = W;
    frameCanvas.height = H;
    const fctx = frameCanvas.getContext("2d");
    if (!fctx) return null;
    fctx.drawImage(video, 0, 0, W, H);
    const frame = fctx.getImageData(0, 0, W, H);

    const base = W / vw;
    const scales = opts?.scaleSearch
        ? [
              1,
              0.75,
              2 / 3,
              0.5,
              0.8,
              0.9,
              1.1,
              1.25,
              4 / 3,
              1.5,
              0.6,
              1.2,
              2,
              1.75,
              0.4,
          ]
        : [1];
    let best: {
        score: number;
        x: number;
        y: number;
        w: number;
        h: number;
    } | null = null;
    for (const scale of scales) {
        const pw = Math.round(poster.naturalWidth * base * scale);
        const ph = Math.round(poster.naturalHeight * base * scale);
        if (pw < 8 || ph < 4 || pw > W || ph > H) continue;
        const drawn = drawPoster(poster, pw, ph, W, H);
        if (!drawn) continue;
        const result = await findOffset(frame, drawn.padded);
        if (!Number.isFinite(result.dx) || !Number.isFinite(result.dy)) {
            continue;
        }
        const x = -result.dx;
        const y = -result.dy;
        const score = ncc(drawn.poster, frame, x, y);
        if (!best || score > best.score) {
            best = { score, x, y, w: pw, h: ph };
        }
        if (best.score >= 0.95) break;
    }
    if (!best || best.score < 0.8) return null;
    return {
        crop: {
            x: Math.max(0, Math.min(1 - best.w / W, best.x / W)),
            y: Math.max(0, Math.min(1 - best.h / H, best.y / H)),
            w: best.w / W,
            h: best.h / H,
        },
        score: best.score,
    };
}

import { findOffset } from "picture_match";
import { describe, expect, it } from "vitest";
import {
    type LongBounds,
    type LongFrame,
    type LongStep,
    LongStitcher,
} from "./longStitch";

const WIDTH = 160;
const HEIGHT = 240;

type Raster = LongFrame;

let seed = 1234567;
function rnd() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
}

function randomColor() {
    const r = 30 + Math.floor(rnd() * 200);
    const g = 30 + Math.floor(rnd() * 200);
    const b = 30 + Math.floor(rnd() * 200);
    return [r, g, b, 255] as const;
}

function fillRect(
    raster: Raster,
    x: number,
    y: number,
    w: number,
    h: number,
    color: readonly [number, number, number, number],
) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(raster.width, Math.ceil(x + w));
    const y1 = Math.min(raster.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
            const i = (yy * raster.width + xx) * 4;
            raster.data[i] = color[0];
            raster.data[i + 1] = color[1];
            raster.data[i + 2] = color[2];
            raster.data[i + 3] = color[3];
        }
    }
}

function copyRect(
    dst: Raster,
    src: Raster,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
) {
    for (let y = 0; y < sh; y++) {
        const srcY = sy + y;
        const dstY = dy + y;
        if (srcY < 0 || srcY >= src.height || dstY < 0 || dstY >= dst.height) {
            continue;
        }
        const srcStart = (srcY * src.width + sx) * 4;
        const dstStart = (dstY * dst.width + dx) * 4;
        dst.data.set(src.data.subarray(srcStart, srcStart + sw * 4), dstStart);
    }
}

/** 用软件光栅模拟一页文档，不依赖真实截图 */
function renderDocument(width: number, height: number): Raster {
    const raster: Raster = {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
    };
    fillRect(raster, 0, 0, width, height, [255, 255, 255, 255]);

    let y = 24;
    while (y < height - 40) {
        const kind = rnd();
        if (kind < 0.16) {
            const x = 10 + Math.floor(rnd() * 20);
            const w = width - x * 2 - Math.floor(rnd() * 20);
            const h = 50 + Math.floor(rnd() * 80);
            fillRect(raster, x, y, w, h, randomColor());
            fillRect(raster, x, y, w, 2, [40, 40, 40, 255]);
            y += h + 18 + Math.floor(rnd() * 16);
        } else if (kind < 0.28) {
            fillRect(
                raster,
                12,
                y,
                60 + Math.floor(rnd() * 50),
                10,
                [20, 20, 20, 255],
            );
            y += 24;
        } else {
            const lines = 3 + Math.floor(rnd() * 5);
            for (let i = 0; i < lines; i++) {
                const x = 12 + Math.floor(rnd() * 5);
                const w = 40 + Math.floor(rnd() * (width - x - 20));
                const color = randomColor();
                fillRect(raster, x, y, w, 3, color);
                y += 8;
            }
            y += 12 + Math.floor(rnd() * 10);
        }
    }

    // 页面纹理/抗锯齿式噪点，给相位相关提供足够独特的特征
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (rnd() >= 0.06) continue;
            const i = (y * width + x) * 4;
            const v = Math.floor(rnd() * 256);
            raster.data[i] = v;
            raster.data[i + 1] = Math.floor(rnd() * 256);
            raster.data[i + 2] = Math.floor(rnd() * 256);
            raster.data[i + 3] = 255;
        }
    }
    return raster;
}

const DOCUMENT = renderDocument(WIDTH, 2200);
const WIDE_DOCUMENT = renderDocument(1200, HEIGHT);

/** 横向滚动的模拟帧：左右固定红栏，中间从宽文档裁一段 */
function makeFrameX(scroll: number, left: number, right: number): LongFrame {
    const frame: Raster = {
        width: WIDTH,
        height: HEIGHT,
        data: new Uint8ClampedArray(WIDTH * HEIGHT * 4),
    };
    fillRect(frame, 0, 0, WIDTH, HEIGHT, [255, 255, 255, 255]);
    copyRect(
        frame,
        WIDE_DOCUMENT,
        scroll,
        0,
        WIDTH - left - right,
        HEIGHT,
        left,
        0,
    );
    fillRect(frame, 0, 0, left, HEIGHT, [255, 0, 0, 255]);
    fillRect(frame, WIDTH - right, 0, right, HEIGHT, [255, 0, 0, 255]);
    return frame;
}

/** 模拟一屏：上下固定红栏，中间从文档里裁一段 */
function makeFrame(
    scroll: number,
    top: number,
    bottom: number,
    width = WIDTH,
    height = HEIGHT,
    stickyMark = false,
): LongFrame {
    const frame: Raster = {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
    };
    fillRect(frame, 0, 0, width, height, [255, 255, 255, 255]);
    copyRect(frame, DOCUMENT, 0, scroll, width, height - top - bottom, 0, top);
    fillRect(frame, 0, 0, width, top, [255, 0, 0, 255]);
    fillRect(frame, 0, height - bottom, width, bottom, [255, 0, 0, 255]);
    if (stickyMark && top > 8) {
        fillRect(
            frame,
            (scroll * 7) % (width - 20),
            top - 8,
            12,
            6,
            [0, 0, 0, 255],
        );
    }
    return frame;
}

type StitchCanvas = {
    bounds: LongBounds;
    data: Uint8ClampedArray;
};

function applyStep(
    canvas: StitchCanvas,
    step: LongStep,
    frame: LongFrame,
): StitchCanvas {
    if (!step.patch) return canvas;
    const b = step.bounds;
    const next = new Uint8ClampedArray(b.width * b.height * 4);

    if (canvas.bounds.width > 0) {
        for (let y = 0; y < canvas.bounds.height; y++) {
            next.set(
                canvas.data.subarray(
                    y * canvas.bounds.width * 4,
                    (y + 1) * canvas.bounds.width * 4,
                ),
                ((y + canvas.bounds.y - b.y) * b.width +
                    (canvas.bounds.x - b.x)) *
                    4,
            );
        }
    }

    const p = step.patch;
    for (let y = 0; y < p.sh; y++) {
        const src = ((p.sy + y) * frame.width + p.sx) * 4;
        const dst = ((p.dy - b.y + y) * b.width + (p.dx - b.x)) * 4;
        next.set(frame.data.subarray(src, src + p.sw * 4), dst);
    }

    return { bounds: b, data: next };
}

function redRowGroups(canvas: StitchCanvas) {
    const { bounds, data } = canvas;
    const rows: number[] = [];
    for (let y = 0; y < bounds.height; y++) {
        let red = 0;
        for (let x = 0; x < bounds.width; x++) {
            const i = (y * bounds.width + x) * 4;
            if (data[i] > 240 && data[i + 1] < 20 && data[i + 2] < 20) {
                red++;
            }
        }
        if (red > bounds.width * 0.8) rows.push(bounds.y + y);
    }
    const groups: { start: number; end: number }[] = [];
    for (const row of rows) {
        const last = groups.at(-1);
        if (last && row === last.end + 1) last.end = row;
        else groups.push({ start: row, end: row });
    }
    return groups;
}

function redColGroups(canvas: StitchCanvas) {
    const { bounds, data } = canvas;
    const cols: number[] = [];
    for (let x = 0; x < bounds.width; x++) {
        let red = 0;
        for (let y = 0; y < bounds.height; y++) {
            const i = (y * bounds.width + x) * 4;
            if (data[i] > 240 && data[i + 1] < 20 && data[i + 2] < 20) {
                red++;
            }
        }
        if (red > bounds.height * 0.8) cols.push(bounds.x + x);
    }
    const groups: { start: number; end: number }[] = [];
    for (const col of cols) {
        const last = groups.at(-1);
        if (last && col === last.end + 1) last.end = col;
        else groups.push({ start: col, end: col });
    }
    return groups;
}

function expectRedOnlyAtHorizontalEdges(
    canvas: StitchCanvas,
    left: number,
    right: number,
) {
    const { bounds } = canvas;
    expect(redColGroups(canvas)).toEqual([
        { start: bounds.x, end: bounds.x + left - 1 },
        {
            start: bounds.x + bounds.width - right,
            end: bounds.x + bounds.width - 1,
        },
    ]);
}

function expectedLongImage(
    frames: LongFrame[],
    scrolls: number[],
    top: number,
    bottom: number,
): LongFrame {
    const min = Math.min(...scrolls);
    const max = Math.max(...scrolls);
    const contentHeight = HEIGHT - top - bottom;
    const height = top + (max - min + contentHeight) + bottom;
    const raster: LongFrame = {
        width: WIDTH,
        height,
        data: new Uint8ClampedArray(WIDTH * height * 4),
    };
    const topFrame = frames[scrolls.indexOf(min)];
    const bottomFrame = frames[scrolls.indexOf(max)];
    copyRect(raster, topFrame, 0, 0, WIDTH, top, 0, 0);
    copyRect(
        raster,
        DOCUMENT,
        0,
        min,
        WIDTH,
        max - min + contentHeight,
        0,
        top,
    );
    copyRect(
        raster,
        bottomFrame,
        0,
        HEIGHT - bottom,
        WIDTH,
        bottom,
        0,
        height - bottom,
    );
    return raster;
}

function expectedLongImageX(
    frames: LongFrame[],
    scrolls: number[],
    left: number,
    right: number,
): LongFrame {
    const min = Math.min(...scrolls);
    const max = Math.max(...scrolls);
    const contentWidth = WIDTH - left - right;
    const width = left + (max - min + contentWidth) + right;
    const raster: LongFrame = {
        width,
        height: HEIGHT,
        data: new Uint8ClampedArray(width * HEIGHT * 4),
    };
    const leftFrame = frames[scrolls.indexOf(min)];
    const rightFrame = frames[scrolls.indexOf(max)];
    copyRect(raster, leftFrame, 0, 0, left, HEIGHT, 0, 0);
    copyRect(
        raster,
        WIDE_DOCUMENT,
        min,
        0,
        max - min + contentWidth,
        HEIGHT,
        left,
        0,
    );
    copyRect(
        raster,
        rightFrame,
        WIDTH - right,
        0,
        right,
        HEIGHT,
        width - right,
        0,
    );
    return raster;
}

function expectSameImage(canvas: StitchCanvas, expected: LongFrame) {
    expect(canvas.bounds.width).toBe(expected.width);
    expect(canvas.bounds.height).toBe(expected.height);
    let mismatches = 0;
    let first = "";
    for (let i = 0; i < expected.data.length; i++) {
        if (canvas.data[i] !== expected.data[i]) {
            mismatches++;
            if (!first) {
                const pixel = Math.floor(i / 4);
                const x = pixel % expected.width;
                const y = Math.floor(pixel / expected.width);
                first = `首处差异 (${x}, ${y})`;
            }
        }
    }
    expect(mismatches, first).toBe(0);
}

async function stitch(
    scrolls: number[],
    margins: { top: number; bottom: number; left?: number; right?: number },
    stickyMark = false,
    finder = findOffset,
) {
    const stitcher = new LongStitcher({ findOffset: finder, margins });
    let canvas: StitchCanvas = {
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        data: new Uint8ClampedArray(0),
    };
    const frames: LongFrame[] = [];
    let lastFrame: LongFrame | null = null;
    for (const scroll of scrolls) {
        const frame = makeFrame(
            scroll,
            margins.top,
            margins.bottom,
            WIDTH,
            HEIGHT,
            stickyMark,
        );
        frames.push(frame);
        const step = await stitcher.addFrame(frame);
        canvas = applyStep(canvas, step, frame);
        lastFrame = frame;
    }
    if (lastFrame) {
        const step = await stitcher.addFrame(lastFrame, true);
        canvas = applyStep(canvas, step, lastFrame);
    }
    return {
        canvas,
        stitcher,
        expected: expectedLongImage(
            frames,
            scrolls,
            margins.top,
            margins.bottom,
        ),
    };
}

function expectRedOnlyAtEdges(
    canvas: StitchCanvas,
    top: number,
    bottom: number,
) {
    const { bounds } = canvas;
    const groups = redRowGroups(canvas);
    expect(groups).toEqual([
        { start: bounds.y, end: bounds.y + top - 1 },
        {
            start: bounds.y + bounds.height - bottom,
            end: bounds.y + bounds.height - 1,
        },
    ]);
}

describe("LongStitcher", () => {
    it("向下滚动时固定顶栏不会进入中间", async () => {
        const { canvas, expected } = await stitch([0, 60, 120, 180], {
            top: 24,
            bottom: 20,
        });
        expectSameImage(canvas, expected);
        expectRedOnlyAtEdges(canvas, 24, 20);
    });

    it("向上滚动时固定顶栏不会进入中间", async () => {
        const { canvas, expected } = await stitch([600, 540, 480, 420], {
            top: 24,
            bottom: 20,
        });
        expectSameImage(canvas, expected);
        expectRedOnlyAtEdges(canvas, 24, 20);
    });

    it("大步长滚动时固定顶栏不会进入中间", async () => {
        const { canvas, expected } = await stitch([0, 120, 240], {
            top: 24,
            bottom: 20,
        });
        expectSameImage(canvas, expected);
        expectRedOnlyAtEdges(canvas, 24, 20);
    });

    it("较高的顶栏也能完整裁掉", async () => {
        const { canvas, expected } = await stitch([0, 40, 80, 120, 160], {
            top: 100,
            bottom: 20,
        });
        expectSameImage(canvas, expected);
        expectRedOnlyAtEdges(canvas, 100, 20);
    });

    it("较高的底栏也能完整裁掉", async () => {
        const { canvas, expected } = await stitch([0, 40, 80, 120, 160], {
            top: 24,
            bottom: 100,
        });
        expectSameImage(canvas, expected);
        expectRedOnlyAtEdges(canvas, 24, 100);
    });

    it("上下栏都高且内容区很窄时也不串栏", async () => {
        const { canvas, expected } = await stitch([0, 20, 40, 60], {
            top: 100,
            bottom: 100,
        });
        expectSameImage(canvas, expected);
        expectRedOnlyAtEdges(canvas, 100, 100);
    });

    it("xy 横向滚动时固定左右栏不会进入中间", async () => {
        const stitcher = new LongStitcher({
            findOffset,
            direction: "xy",
            margins: { top: 0, bottom: 0, left: 24, right: 20 },
        });
        let canvas: StitchCanvas = {
            bounds: { x: 0, y: 0, width: 0, height: 0 },
            data: new Uint8ClampedArray(0),
        };
        const scrolls = [0, 60, 120];
        const frames: LongFrame[] = [];
        let lastFrame: LongFrame | null = null;
        for (const scroll of scrolls) {
            const frame = makeFrameX(scroll, 24, 20);
            frames.push(frame);
            const step = await stitcher.addFrame(frame);
            canvas = applyStep(canvas, step, frame);
            lastFrame = frame;
        }
        if (lastFrame) {
            const step = await stitcher.addFrame(lastFrame, true);
            canvas = applyStep(canvas, step, lastFrame);
        }
        expectSameImage(canvas, expectedLongImageX(frames, scrolls, 24, 20));
        expectRedOnlyAtHorizontalEdges(canvas, 24, 20);
    });
    it("sticky 顶栏内容变化时也不会拼到中间", async () => {
        const { canvas, expected } = await stitch(
            [0, 40, 80, 120, 160],
            { top: 100, bottom: 20 },
            true,
        );
        expectSameImage(canvas, expected);
        expectRedOnlyAtEdges(canvas, 100, 20);
    });
    it("匹配偏几像素时整数精修能纠正", async () => {
        const biased = async (a: LongFrame, b: LongFrame) => {
            const match = await findOffset(a, b);
            return { ...match, dy: match.dy - 4 };
        };
        const { canvas, expected } = await stitch(
            [0, 60, 120],
            { top: 24, bottom: 20 },
            false,
            biased,
        );
        expectSameImage(canvas, expected);
        expectRedOnlyAtEdges(canvas, 24, 20);
    });
});

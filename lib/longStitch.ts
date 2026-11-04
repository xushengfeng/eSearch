export type LongFrame = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
};

export type LongBounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};

/** 从当前帧裁出来的一块，放到拼接坐标的 dx/dy */
export type LongPatch = {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    dx: number;
    dy: number;
};

export type LongStep = {
    patch: LongPatch | null;
    bounds: LongBounds;
    final: boolean;
    /** findOffset 原始方向的偏移 */
    offset?: LongOffset;
    /** 实际用于绘制的滚动偏移 */
    applied?: LongOffset;
    margins?: LongMargins;
};

export type LongRaster = {
    bounds: LongBounds;
    data: Uint8ClampedArray;
};

/** 用纯像素缓冲执行一步拼接，供 CLI/测试复现使用 */
export function applyLongStep(
    raster: LongRaster | null,
    step: LongStep,
    frame: LongFrame,
): LongRaster {
    if (!step.patch) {
        return (
            raster ?? {
                bounds: { ...step.bounds },
                data: new Uint8ClampedArray(0),
            }
        );
    }
    const b = step.bounds;
    const next = new Uint8ClampedArray(b.width * b.height * 4);
    if (raster && raster.bounds.width > 0) {
        for (let y = 0; y < raster.bounds.height; y++) {
            next.set(
                raster.data.subarray(
                    y * raster.bounds.width * 4,
                    (y + 1) * raster.bounds.width * 4,
                ),
                ((y + raster.bounds.y - b.y) * b.width +
                    (raster.bounds.x - b.x)) *
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

export type LongMargins = {
    top: number;
    bottom: number;
    left: number;
    right: number;
};

export type LongOffset = {
    dx: number;
    dy: number;
    confidence: number;
};

export type LongOffsetFinder = (
    a: LongFrame,
    b: LongFrame,
) => Promise<LongOffset>;

/** 旧版按画面尺寸估算的边距 */
export function longClipSize(v: number) {
    const x = v - Math.max((v / 3) * 1, 50);
    return Math.floor(Math.max(x, 0) / 2);
}

function cropFrame(
    source: LongFrame,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
): LongFrame {
    const width = Math.max(1, Math.min(source.width - sx, sw));
    const height = Math.max(1, Math.min(source.height - sy, sh));
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        const src = ((sy + y) * source.width + sx) * 4;
        data.set(source.data.subarray(src, src + width * 4), y * width * 4);
    }
    return { width, height, data };
}

function expandBounds(bounds: LongBounds, patch: LongPatch): LongBounds {
    const x0 = Math.min(bounds.x, patch.dx);
    const y0 = Math.min(bounds.y, patch.dy);
    const x1 = Math.max(bounds.x + bounds.width, patch.dx + patch.sw);
    const y1 = Math.max(bounds.y + bounds.height, patch.dy + patch.sh);
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function refineOffset(
    a: LongFrame,
    b: LongFrame,
    initial: LongOffset,
    margins: LongMargins,
    direction: "y" | "xy",
    lastDX: number,
    lastDY: number,
    radius: number,
): LongOffset {
    let x0 = 0;
    let x1 = a.width;
    let y0 = 0;
    let y1 = a.height;
    if (lastDY > 0) {
        y1 = Math.max(1, a.height - margins.bottom);
    } else if (lastDY < 0) {
        y0 = Math.min(a.height - 1, margins.top);
    } else {
        y0 = Math.min(a.height - 1, margins.top);
        y1 = Math.max(y0 + 1, a.height - margins.bottom);
    }
    if (direction === "xy") {
        if (lastDX > 0) {
            x1 = Math.max(1, a.width - margins.right);
        } else if (lastDX < 0) {
            x0 = Math.min(a.width - 1, margins.left);
        } else {
            x0 = Math.min(a.width - 1, margins.left);
            x1 = Math.max(x0 + 1, a.width - margins.right);
        }
    }

    const stepX = 4;
    const stepY = 2;
    function score(dx: number, dy: number) {
        let sum = 0;
        let count = 0;
        for (let y = y0; y < y1; y += stepY) {
            const ay = y + dy;
            if (ay < y0 || ay >= y1 || ay >= a.height) continue;
            for (let x = x0; x < x1; x += stepX) {
                const ax = x + dx;
                if (ax < x0 || ax >= x1 || ax >= a.width) continue;
                const i = (ay * a.width + ax) * 4;
                const j = (y * b.width + x) * 4;
                sum +=
                    Math.abs(a.data[i] - b.data[j]) +
                    Math.abs(a.data[i + 1] - b.data[j + 1]) +
                    Math.abs(a.data[i + 2] - b.data[j + 2]);
                count++;
            }
        }
        return count ? sum / count : Number.POSITIVE_INFINITY;
    }

    const baseDy = initial.dy;
    let bestDy = baseDy;
    let best = score(initial.dx, bestDy);

    for (let d = -radius; d <= radius; d++) {
        const value = score(initial.dx, baseDy + d);
        if (value < best) {
            best = value;
            bestDy = baseDy + d;
        }
    }
    let bestDx = initial.dx;
    if (direction === "xy") {
        const baseDx = initial.dx;
        best = score(bestDx, bestDy);
        for (let d = -radius; d <= radius; d++) {
            const value = score(baseDx + d, bestDy);
            if (value < best) {
                best = value;
                bestDx = baseDx + d;
            }
        }
    }
    return {
        dx: bestDx,
        dy: bestDy,
        confidence: initial.confidence,
    };
}

/**
 * 把画面分成上边距、中间、下边距三块。
 * 识别时按滚动方向裁掉前导边距，避免固定栏参与匹配。
 *
 * 拼接区域不和识别共用边距，而是按实际滚动量只贴新露出来的部分：
 * 向下滚贴底部的新内容，向上滚贴顶部的新内容。
 * 拼接区域再向重叠方向多留 padding，滚动量很大时扩大到前导边距为止。
 * 固定/吸顶栏因此不会进入匹配模板，也不会被重复拼到中间。
 */
export class LongStitcher {
    private readonly findOffset: LongOffsetFinder;
    private readonly direction: "y" | "xy";
    private readonly configuredMargins: Partial<LongMargins>;
    private readonly refine: boolean;
    private readonly refineRadius: number;
    private readonly padding: number;
    private lastFrame: LongFrame | null = null;
    private lastPatch: LongPatch | null = null;
    private lastX = 0;
    private lastY = 0;
    private lastDX = 0;
    private lastDY = 0;
    private boundsValue: LongBounds = { x: 0, y: 0, width: 0, height: 0 };

    constructor(options: {
        findOffset: LongOffsetFinder;
        direction?: "y" | "xy";
        margins?: Partial<LongMargins>;
        /** 是否在 findOffset 结果附近做整数像素精修 */
        refine?: boolean;
        refineRadius?: number;
        /** 拼接时在滚动量算出的边界外多贴多少像素，容忍偏移误差 */
        padding?: number;
    }) {
        this.findOffset = options.findOffset;
        this.direction = options.direction ?? "y";
        this.configuredMargins = options.margins ?? {};
        this.refine = options.refine ?? true;
        this.refineRadius = options.refineRadius ?? 12;
        this.padding = options.padding ?? 8;
    }

    get bounds(): LongBounds {
        return { ...this.boundsValue };
    }

    private getMargins(frame: LongFrame): LongMargins {
        const def = longClipSize(frame.height);
        const defX = this.direction === "xy" ? longClipSize(frame.width) : 0;
        const clamp = (v: number, max: number) =>
            Math.max(0, Math.min(Math.floor(v), max));
        const top = clamp(this.configuredMargins.top ?? def, frame.height - 1);
        const bottom = clamp(
            this.configuredMargins.bottom ?? def,
            frame.height - 1 - top,
        );
        const left = clamp(
            this.configuredMargins.left ?? defX,
            frame.width - 1,
        );
        const right = clamp(
            this.configuredMargins.right ?? defX,
            frame.width - 1 - left,
        );
        return { top, bottom, left, right };
    }

    /** 匹配时按上一次滚动方向裁掉前导边距，避免固定栏参与匹配 */
    private matchFrame(frame: LongFrame, margins: LongMargins): LongFrame {
        let sx = 0;
        let sy = 0;
        let sw = frame.width;
        let sh = frame.height;
        if (this.lastDY > 0) {
            sy = margins.top;
            sh = frame.height - margins.top;
        } else if (this.lastDY < 0) {
            sh = frame.height - margins.bottom;
        }
        if (this.direction === "xy") {
            if (this.lastDX > 0) {
                sx = margins.left;
                sw = frame.width - margins.left;
            } else if (this.lastDX < 0) {
                sw = frame.width - margins.right;
            }
        }
        if (sw <= 0 || sh <= 0) return frame;
        if (sx === 0 && sy === 0 && sw === frame.width && sh === frame.height)
            return frame;
        return cropFrame(frame, sx, sy, sw, sh);
    }

    private makePatch(
        frame: LongFrame,
        dx: number,
        dy: number,
        margins: LongMargins,
    ): LongPatch {
        const { left, right, top, bottom } = margins;
        const pad = this.padding;
        const clamp = (v: number, min: number, max: number) =>
            Math.max(min, Math.min(v, max));

        let sx = 0;
        let sw = frame.width;
        let sy = 0;
        let sh = frame.height;

        if (dx > 0) {
            // 新内容从右边出来，贴新内容带并保留右栏
            sx = clamp(frame.width - right - dx - pad, left, frame.width - 1);
            sw = frame.width - sx;
        } else if (dx < 0) {
            // 新内容从左边出来，贴新内容带并保留左栏
            sw = clamp(left - dx + pad, 1, frame.width - right);
        }

        if (dy > 0) {
            // 新内容从底部出来，贴新内容带并保留底栏。
            // 滚动量太大时只能贴到顶边距，被固定栏挡住的内容补不回来
            sy = clamp(frame.height - bottom - dy - pad, top, frame.height - 1);
            sh = frame.height - sy;
        } else if (dy < 0) {
            // 新内容从顶部出来，贴新内容带并保留顶栏
            sh = clamp(top - dy + pad, 1, frame.height - bottom);
        }

        return {
            sx,
            sy,
            sw,
            sh,
            dx: this.lastX + dx + sx,
            dy: this.lastY + dy + sy,
        };
    }

    private defaultFinalPatch(
        frame: LongFrame,
        margins: LongMargins,
    ): LongPatch {
        return {
            sx: 0,
            sy: margins.top,
            sw: frame.width,
            sh: Math.max(1, frame.height - margins.top),
            dx: this.lastX,
            dy: this.lastY + margins.top,
        };
    }

    async addFrame(frame: LongFrame, forceLast = false): Promise<LongStep> {
        if (!this.lastFrame) {
            const patch: LongPatch = {
                sx: 0,
                sy: 0,
                sw: frame.width,
                sh: frame.height,
                dx: 0,
                dy: 0,
            };
            this.lastFrame = frame;
            this.boundsValue = {
                x: 0,
                y: 0,
                width: frame.width,
                height: frame.height,
            };
            return {
                patch,
                bounds: { ...this.boundsValue },
                final: false,
                offset: { dx: 0, dy: 0, confidence: 1 },
                applied: { dx: 0, dy: 0, confidence: 1 },
                margins: this.getMargins(frame),
            };
        }

        const margins = this.getMargins(frame);
        const matchA = this.matchFrame(this.lastFrame, margins);
        const matchB = this.matchFrame(frame, margins);
        const raw = await this.findOffset(matchA, matchB);
        // 长截屏按整数像素拼接，先把亚像素结果取整，再交给精修
        const found = {
            ...raw,
            dx: Math.round(raw.dx),
            dy: Math.round(raw.dy),
        };
        const match = this.refine
            ? refineOffset(
                  matchA,
                  matchB,
                  {
                      dx: -found.dx,
                      dy: -found.dy,
                      confidence: found.confidence,
                  },
                  margins,
                  this.direction,
                  this.lastDX,
                  this.lastDY,
                  this.refineRadius,
              )
            : {
                  dx: -found.dx,
                  dy: -found.dy,
                  confidence: found.confidence,
              };
        const dx = this.direction === "xy" ? match.dx : 0;
        const dy = match.dy;

        if (dx === 0 && dy === 0) {
            if (!forceLast) {
                return {
                    patch: null,
                    bounds: { ...this.boundsValue },
                    final: false,
                    offset: {
                        dx: -match.dx,
                        dy: -match.dy,
                        confidence: match.confidence,
                    },
                    applied: match,
                    margins,
                };
            }
            const patch = this.lastPatch
                ? { ...this.lastPatch }
                : this.defaultFinalPatch(frame, margins);
            this.boundsValue = expandBounds(this.boundsValue, patch);
            return {
                patch,
                bounds: { ...this.boundsValue },
                final: true,
                offset: {
                    dx: -match.dx,
                    dy: -match.dy,
                    confidence: match.confidence,
                },
                applied: match,
                margins,
            };
        }

        const patch = this.makePatch(frame, dx, dy, margins);
        this.boundsValue = expandBounds(this.boundsValue, patch);
        this.lastPatch = patch;
        this.lastFrame = frame;
        this.lastX += dx;
        this.lastY += dy;
        this.lastDX = dx;
        this.lastDY = dy;
        return {
            patch,
            bounds: { ...this.boundsValue },
            final: false,
            offset: {
                dx: -match.dx,
                dy: -match.dy,
                confidence: match.confidence,
            },
            applied: match,
            margins,
        };
    }
}

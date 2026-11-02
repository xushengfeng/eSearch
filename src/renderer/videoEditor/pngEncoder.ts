import { deflate } from "pako";

function paeth(a: number, b: number, c: number) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

/** RGBA → PNG 的 zlib 数据（IDAT 内容），color type 6 / 8bit / 非隔行 */
export function encodePngIdat(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
) {
    const bpp = 4;
    const stride = width * bpp;
    const out = new Uint8Array((stride + 1) * height);
    const candidates = [
        new Uint8Array(stride),
        new Uint8Array(stride),
        new Uint8Array(stride),
        new Uint8Array(stride),
        new Uint8Array(stride),
    ];
    let o = 0;
    let prev: Uint8ClampedArray | null = null;
    for (let y = 0; y < height; y++) {
        const row = rgba.subarray(y * stride, (y + 1) * stride);
        let best = 0;
        let bestScore = Infinity;
        for (let f = 0; f < 5; f++) {
            const dst = candidates[f];
            let score = 0;
            for (let i = 0; i < stride; i++) {
                const left = i >= bpp ? row[i - bpp] : 0;
                const up = prev ? prev[i] : 0;
                const upLeft = prev && i >= bpp ? prev[i - bpp] : 0;
                let v: number;
                if (f === 0) v = row[i];
                else if (f === 1) v = row[i] - left;
                else if (f === 2) v = row[i] - up;
                else if (f === 3) v = row[i] - ((left + up) >> 1);
                else v = row[i] - paeth(left, up, upLeft);
                v &= 0xff;
                dst[i] = v;
                score += v < 128 ? v : 256 - v;
            }
            if (score < bestScore) {
                bestScore = score;
                best = f;
            }
        }
        out[o++] = best;
        out.set(candidates[best], o);
        o += stride;
        prev = row;
    }
    return deflate(out, { level: 9 });
}

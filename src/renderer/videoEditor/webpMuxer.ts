// 动画 WebP 打包：输入静帧 WebP，输出动画 WebP
function u16le(v: number) {
    return Uint8Array.from([v & 0xff, (v >>> 8) & 0xff]);
}
function u24le(v: number) {
    return Uint8Array.from([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff]);
}
function u32le(v: number) {
    return Uint8Array.from([
        v & 0xff,
        (v >>> 8) & 0xff,
        (v >>> 16) & 0xff,
        (v >>> 24) & 0xff,
    ]);
}
const encoder = new TextEncoder();
function fcc(s: string) {
    return encoder.encode(s);
}
function concat(...arrs: Uint8Array[]) {
    let len = 0;
    for (const a of arrs) len += a.length;
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arrs) {
        out.set(a, o);
        o += a.length;
    }
    return out;
}
type WebpChunk = { type: string; data: Uint8Array };
function readChunks(webp: Uint8Array): WebpChunk[] {
    const out: WebpChunk[] = [];
    let o = 12;
    const decoder = new TextDecoder("latin1");
    while (o + 8 <= webp.length) {
        const type = decoder.decode(webp.subarray(o, o + 4));
        const len =
            (webp[o + 4] |
                (webp[o + 5] << 8) |
                (webp[o + 6] << 16) |
                (webp[o + 7] << 24)) >>>
            0;
        out.push({ type, data: webp.subarray(o + 8, o + 8 + len) });
        o += 8 + len + (len & 1);
    }
    return out;
}
function chunk(type: string, data: Uint8Array) {
    return concat(
        fcc(type),
        u32le(data.length),
        data,
        data.length & 1 ? new Uint8Array(1) : new Uint8Array(0),
    );
}
/** 从静帧 WebP 中取图像数据块（ALPH + VP8/VP8L） */
export function imageChunks(webp: Uint8Array) {
    return readChunks(webp).filter((c) =>
        ["ALPH", "VP8 ", "VP8L"].includes(c.type),
    );
}

export type WebpFrame = {
    webp: Uint8Array;
    w: number;
    h: number;
    x: number;
    y: number;
    delayMs: number;
    /** 0 = 不混合（直接替换），1 = alpha 混合 */
    blend: 0 | 1;
};

export function muxWebp(opts: {
    width: number;
    height: number;
    frames: WebpFrame[];
    loop?: number;
}) {
    const { width, height, frames, loop = 0 } = opts;
    if (!frames.length) throw new Error("no frames");
    let alpha = false;
    const frameChunks = frames.map((f) => {
        const chunks = imageChunks(f.webp);
        if (chunks.some((c) => c.type === "ALPH")) alpha = true;
        return chunks;
    });
    const vp8x = chunk(
        "VP8X",
        concat(
            Uint8Array.from([0x02 | (alpha ? 0x10 : 0), 0, 0, 0]),
            u24le(width - 1),
            u24le(height - 1),
        ),
    );
    const anim = chunk("ANIM", concat(new Uint8Array(4), u16le(loop)));
    const parts = frames.map((f, i) => {
        if (f.x & 1 || f.y & 1)
            throw new Error("webp frame offset must be even");
        const header = concat(
            u24le(f.x / 2),
            u24le(f.y / 2),
            u24le(f.w - 1),
            u24le(f.h - 1),
            u24le(Math.max(1, Math.round(f.delayMs))),
            // WebP 的 blend 位是反的：bit1 = 1 表示不混合
            Uint8Array.from([f.blend ? 0 : 2]),
        );
        return chunk(
            "ANMF",
            concat(header, ...frameChunks[i].map((c) => chunk(c.type, c.data))),
        );
    });
    const body = concat(fcc("WEBP"), vp8x, anim, ...parts);
    return concat(fcc("RIFF"), u32le(body.length), body);
}

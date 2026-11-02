// APNG 打包：输入每帧的 PNG zlib 数据（IDAT），输出 APNG
const SIG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function u16be(v: number) {
    return Uint8Array.from([(v >>> 8) & 0xff, v & 0xff]);
}
function u32be(v: number) {
    return Uint8Array.from([
        (v >>> 24) & 0xff,
        (v >>> 16) & 0xff,
        (v >>> 8) & 0xff,
        v & 0xff,
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
const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb8_8320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function crc32(bytes: Uint8Array) {
    let c = 0xffff_ffff;
    for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffff_ffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
    const typeBytes = fcc(type);
    return concat(
        u32be(data.length),
        typeBytes,
        data,
        u32be(crc32(concat(typeBytes, data))),
    );
}

export type ApngFrame = {
    idat: Uint8Array;
    w: number;
    h: number;
    x: number;
    y: number;
    delayMs: number;
    /** 0 = source，1 = over */
    blend: 0 | 1;
};

export function muxApng(opts: {
    width: number;
    height: number;
    frames: ApngFrame[];
    loop?: number;
}) {
    const { width, height, frames, loop = 0 } = opts;
    if (!frames.length) throw new Error("no frames");
    let seq = 0;
    const parts = [
        SIG,
        chunk(
            "IHDR",
            concat(
                u32be(width),
                u32be(height),
                Uint8Array.from([8, 6, 0, 0, 0]),
            ),
        ),
        chunk("acTL", concat(u32be(frames.length), u32be(loop))),
    ];
    const fctl = (f: ApngFrame) => {
        const num = Math.min(65535, Math.max(1, Math.round(f.delayMs)));
        return chunk(
            "fcTL",
            concat(
                u32be(seq++),
                u32be(f.w),
                u32be(f.h),
                u32be(f.x),
                u32be(f.y),
                u16be(num),
                u16be(1000),
                Uint8Array.from([0, f.blend]),
            ),
        );
    };
    for (const [i, f] of frames.entries()) {
        parts.push(fctl(f));
        if (i === 0) parts.push(chunk("IDAT", f.idat));
        else parts.push(chunk("fdAT", concat(u32be(seq++), f.idat)));
    }
    parts.push(chunk("IEND", new Uint8Array(0)));
    return concat(...parts);
}

/**
 * AVIFS（动画 AVIF）打包器。
 * 只负责把已经编码好的 AV1 样本封装成容器，不做解码/重编码。
 * 暂不支持 alpha（录屏画面不透明）。
 */

export type Av1SequenceInfo = {
    /** seq_profile */
    profile: number;
    /** seq_level_idx */
    level: number;
    /** seq_tier */
    tier: number;
    bitDepth: 8 | 10 | 12;
    monochrome: boolean;
    primaries: number;
    transfer: number;
    matrix: number;
    fullRange: boolean;
    subsamplingX: boolean;
    subsamplingY: boolean;
    chromaSamplePosition: number;
};

export type AvifSample = {
    data: Uint8Array;
    /** 显示时长，单位 1/timescale */
    duration: number;
    key: boolean;
};

export type MuxAvifOptions = {
    width: number;
    height: number;
    timescale: number;
    samples: AvifSample[];
    /** 不传则从第一个样本的 sequence header 解析 */
    info?: Av1SequenceInfo;
    /** 解析失败时用于兜底的 codec string，如 av01.1.04M.08 */
    fallbackCodec?: string;
};

const textEncoder = new TextEncoder();

function u8(...v: number[]) {
    return Uint8Array.from(v);
}
function u16(v: number) {
    return u8((v >>> 8) & 0xff, v & 0xff);
}
function u32(v: number) {
    return u8((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
}
function u64(v: number) {
    const hi = Math.floor(v / 0x1_0000_0000);
    const lo = v >>> 0;
    return concat(u32(hi), u32(lo));
}
function str(s: string) {
    return textEncoder.encode(s);
}
function zeros(n: number) {
    return new Uint8Array(n);
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
function box(type: string, ...parts: Uint8Array[]) {
    const body = parts.length ? concat(...parts) : new Uint8Array(0);
    return concat(u32(8 + body.length), str(type), body);
}
function fullbox(
    type: string,
    version: number,
    flags: number,
    ...parts: Uint8Array[]
) {
    const f = (flags >>> 16) & 0xff;
    return box(
        type,
        u8(version, f, (flags >>> 8) & 0xff, flags & 0xff),
        ...parts,
    );
}

class BitReader {
    private pos = 0;
    private readonly data: Uint8Array;
    constructor(data: Uint8Array) {
        this.data = data;
    }
    bit() {
        const byte = this.data[this.pos >> 3];
        const bit = (byte >> (7 - (this.pos & 7))) & 1;
        this.pos++;
        return bit;
    }
    f(n: number) {
        let v = 0;
        for (let i = 0; i < n; i++) v = (v << 1) | this.bit();
        return v;
    }
    uvlc() {
        let zeros = 0;
        while (this.bit() === 0) {
            zeros++;
            if (zeros > 32) throw new Error("uvlc overflow");
        }
        if (zeros === 0) return 0;
        return (1 << zeros) - 1 + this.f(zeros);
    }
}

/** 在 OBU 流里找 sequence header（type 1）的 payload */
export function findSequenceHeader(data: Uint8Array) {
    let o = 0;
    while (o + 1 < data.length) {
        const header = data[o++];
        if (header & 0x80) return null;
        const type = (header >> 3) & 0x0f;
        if (header & 0x04) o++; // obu_extension_flag
        let size = 0;
        if (header & 0x02) {
            let shift = 0;
            for (let i = 0; i < 8; i++) {
                const b = data[o++];
                size |= (b & 0x7f) << shift;
                if ((b & 0x80) === 0) break;
                shift += 7;
            }
        } else {
            size = data.length - o;
        }
        if (type === 1) return data.subarray(o, o + size);
        o += size;
    }
    return null;
}

/** 解析 AV1 sequence header（只取封装需要的字段） */
export function parseAv1SequenceHeader(
    sample: Uint8Array,
): Av1SequenceInfo | null {
    const payload = findSequenceHeader(sample);
    if (!payload) return null;
    const br = new BitReader(payload);
    const profile = br.f(3);
    br.f(1); // still_picture
    const reduced = br.f(1);
    let level = 0;
    let tier = 0;
    let bufferDelayLength = 0;
    if (reduced) {
        level = br.f(5);
    } else {
        let decoderModelInfo = 0;
        if (br.f(1)) {
            br.f(32); // num_units_in_display_tick
            br.f(32); // time_scale
            if (br.f(1)) br.uvlc(); // num_ticks_per_picture_minus_1
            decoderModelInfo = br.f(1);
            if (decoderModelInfo) {
                bufferDelayLength = br.f(5);
                br.f(32); // num_units_in_decoding_tick
                br.f(5);
                br.f(5);
            }
        }
        const initialDisplayDelay = br.f(1);
        const operatingPoints = br.f(5);
        for (let i = 0; i <= operatingPoints; i++) {
            br.f(12); // operating_point_idc
            const lvl = br.f(5);
            if (i === 0) level = lvl;
            if (lvl > 7) {
                const t = br.f(1);
                if (i === 0) tier = t;
            }
            if (decoderModelInfo && br.f(1)) {
                br.f(bufferDelayLength + 1);
                br.f(bufferDelayLength + 1);
                br.f(1);
            }
            if (initialDisplayDelay && br.f(1)) br.f(4);
        }
    }
    const widthBits = br.f(4) + 1;
    const heightBits = br.f(4) + 1;
    br.f(widthBits); // max_frame_width_minus_1
    br.f(heightBits); // max_frame_height_minus_1
    if (!reduced && br.f(1)) {
        br.f(4);
        br.f(3);
    }
    br.f(1); // use_128x128_superblock
    br.f(1); // enable_filter_intra
    br.f(1); // enable_intra_edge_filter
    if (!reduced) {
        br.f(1); // enable_interintra_compound
        br.f(1); // enable_masked_compound
        br.f(1); // enable_warped_motion
        br.f(1); // enable_dual_filter
        const orderHint = br.f(1);
        if (orderHint) {
            br.f(1); // enable_jnt_comp
            br.f(1); // enable_ref_frame_mvs
        }
        const chooseScreen = br.f(1);
        const forceScreen = chooseScreen ? 2 : br.f(1);
        if (forceScreen > 0 && !br.f(1)) br.f(1);
        if (orderHint) br.f(3);
        br.f(1); // enable_superres
        br.f(1); // enable_cdef
        br.f(1); // enable_restoration
    }
    const highBitdepth = br.f(1);
    let twelveBit = 0;
    if (profile === 2 && highBitdepth) twelveBit = br.f(1);
    const monochrome = profile === 1 ? 0 : br.f(1);
    const bitDepth = (twelveBit ? 12 : highBitdepth ? 10 : 8) as 8 | 10 | 12;
    const hasColorDescription = br.f(1);
    let primaries = 2;
    let transfer = 2;
    let matrix = 2;
    if (hasColorDescription) {
        primaries = br.f(8);
        transfer = br.f(8);
        matrix = br.f(8);
    }
    let fullRange = false;
    let sx = false;
    let sy = false;
    let csp = 0;
    if (monochrome) {
        fullRange = br.f(1) === 1;
        sx = true;
        sy = true;
    } else if (primaries === 1 && transfer === 13 && matrix === 0) {
        fullRange = true;
    } else {
        fullRange = br.f(1) === 1;
        if (profile === 0) {
            sx = true;
            sy = true;
        } else if (profile === 1) {
            sx = false;
            sy = false;
        } else if (bitDepth === 12) {
            sx = br.f(1) === 1;
            if (sx) sy = br.f(1) === 1;
        } else {
            sx = true;
            sy = false;
        }
        if (sx && sy) csp = br.f(2);
    }
    return {
        profile,
        level,
        tier,
        bitDepth,
        monochrome: monochrome === 1,
        primaries,
        transfer,
        matrix,
        fullRange,
        subsamplingX: sx,
        subsamplingY: sy,
        chromaSamplePosition: csp,
    };
}

/** 从 codec string 兜底生成 AV1SequenceInfo */
function infoFromCodec(codec: string): Av1SequenceInfo | null {
    const m = /^av01\.(\d)\.(\d{2})([MH])\.(\d{2})$/.exec(codec);
    if (!m) return null;
    const profile = Number(m[1]);
    const depth = Number(m[4]) as 8 | 10 | 12;
    return {
        profile,
        level: Number(m[2]),
        tier: m[3] === "H" ? 1 : 0,
        bitDepth: depth,
        monochrome: false,
        primaries: 2,
        transfer: 2,
        matrix: 2,
        fullRange: false,
        subsamplingX: profile === 0,
        subsamplingY: profile === 0,
        chromaSamplePosition: 0,
    };
}

function av1C(info: Av1SequenceInfo) {
    return box(
        "av1C",
        u8(
            0x81,
            (info.profile << 5) | (info.level & 0x1f),
            (info.tier << 7) |
                (info.bitDepth === 12
                    ? 0x20
                    : info.bitDepth === 10
                      ? 0x40
                      : 0) |
                (Number(info.monochrome) << 4) |
                (Number(info.subsamplingX) << 3) |
                (Number(info.subsamplingY) << 2) |
                (info.chromaSamplePosition & 0x03),
            0x00,
        ),
    );
}

function nclx(info: Av1SequenceInfo) {
    // 未指定时按编码器常见的 BT.601 limited 处理
    return box(
        "colr",
        str("nclx"),
        u16(info.primaries === 2 ? 6 : info.primaries),
        u16(info.transfer === 2 ? 6 : info.transfer),
        u16(info.matrix === 2 ? 6 : info.matrix),
        u8(info.fullRange ? 0x80 : 0x00),
    );
}

function ispe(width: number, height: number) {
    return fullbox("ispe", 0, 0, u32(width), u32(height));
}
function pixi(bitDepth: number) {
    return fullbox("pixi", 0, 0, u8(3, bitDepth, bitDepth, bitDepth));
}

function visualSampleEntry(
    info: Av1SequenceInfo,
    width: number,
    height: number,
) {
    const compressor = new Uint8Array(32);
    const name = str("AOM Coding");
    compressor[0] = name.length;
    compressor.set(name, 1);
    return box(
        "av01",
        zeros(6),
        u16(1),
        zeros(16),
        u16(width),
        u16(height),
        u32(0x0048_0000),
        u32(0x0048_0000),
        u32(0),
        u16(1),
        compressor,
        u16(0x0018),
        u16(0xffff),
        av1C(info),
        nclx(info),
        fullbox("ccst", 0, 0, u32(0x7c00_0000)),
    );
}

export function muxAvif(opts: MuxAvifOptions) {
    const { width, height, timescale, samples } = opts;
    if (!samples.length) throw new Error("no samples");
    if (!samples[0].key) throw new Error("first sample must be a keyframe");
    for (const s of samples) {
        if (!Number.isFinite(s.duration) || s.duration < 1)
            throw new Error("invalid sample duration");
    }
    const info =
        opts.info ??
        parseAv1SequenceHeader(samples[0].data) ??
        (opts.fallbackCodec ? infoFromCodec(opts.fallbackCodec) : null);
    if (!info) throw new Error("no AV1 sequence header");
    const brand = info.profile === 0 && info.bitDepth === 8 ? "MA1B" : "MA1A";
    const durations = samples.map((s) => Math.round(s.duration));
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const syncSamples: number[] = [];
    samples.forEach((s, i) => {
        if (s.key) syncSamples.push(i + 1);
    });

    const ftyp = box(
        "ftyp",
        str("avis"),
        u32(0),
        ...["avif", "avis", "msf1", "iso8", "mif1", "miaf", brand].map(str),
    );

    const build = (colorOffset: number) => {
        const iloc = fullbox(
            "iloc",
            0,
            0,
            u8(0x44, 0),
            u16(1),
            u16(1),
            u16(0),
            u16(1),
            u32(colorOffset),
            u32(samples[0].data.length),
        );
        const iinf = fullbox(
            "iinf",
            0,
            0,
            u16(1),
            fullbox(
                "infe",
                2,
                0,
                u16(1),
                u16(0),
                str("av01"),
                str("Color"),
                u8(0),
            ),
        );
        const ipco = box(
            "ipco",
            ispe(width, height),
            pixi(info.bitDepth),
            av1C(info),
            nclx(info),
        );
        const ipma = fullbox(
            "ipma",
            0,
            0,
            u32(1),
            u16(1),
            u8(4, 1, 2, 0x83, 4),
        );
        const meta = fullbox(
            "meta",
            0,
            0,
            fullbox("hdlr", 0, 0, u32(0), str("pict"), zeros(12), u8(0)),
            fullbox("pitm", 0, 0, u16(1)),
            iloc,
            iinf,
            box("iprp", ipco, ipma),
        );

        const mvhd = fullbox(
            "mvhd",
            1,
            0,
            u64(0),
            u64(0),
            u32(timescale),
            u64(totalDuration),
            u32(0x0001_0000),
            u16(0x0100),
            u16(0),
            zeros(8),
            u32(0x0001_0000),
            u32(0),
            u32(0),
            u32(0),
            u32(0x0001_0000),
            u32(0),
            u32(0),
            u32(0),
            u32(0x4000_0000),
            zeros(24),
            u32(2),
        );

        const tkhd = fullbox(
            "tkhd",
            1,
            1,
            u64(0),
            u64(0),
            u32(1),
            u32(0),
            u64(totalDuration),
            zeros(8),
            u16(0),
            u16(0),
            u16(0),
            u16(0),
            u32(0x0001_0000),
            u32(0),
            u32(0),
            u32(0),
            u32(0x0001_0000),
            u32(0),
            u32(0),
            u32(0),
            u32(0x4000_0000),
            u32(width * 0x1_0000),
            u32(height * 0x1_0000),
        );
        const edts = box(
            "edts",
            fullbox(
                "elst",
                1,
                0,
                u32(1),
                u64(totalDuration),
                u64(0),
                u32(0x0001_0000),
            ),
        );
        const mdhd = fullbox(
            "mdhd",
            1,
            0,
            u64(0),
            u64(0),
            u32(timescale),
            u64(totalDuration),
            u16(0x55c4),
            u16(0),
        );
        const hdlr = fullbox(
            "hdlr",
            0,
            0,
            u32(0),
            str("pict"),
            zeros(12),
            u8(0),
        );
        const vmhd = fullbox("vmhd", 0, 1, u16(0), u16(0), u16(0), u16(0));
        const dinf = box(
            "dinf",
            fullbox(
                "dref",
                0,
                0,
                u32(1),
                fullbox("url ", 0, 1, new Uint8Array(0)),
            ),
        );

        const sttsEntries: [number, number][] = [];
        for (const d of durations) {
            const last = sttsEntries.at(-1);
            if (last && last[1] === d) last[0]++;
            else sttsEntries.push([1, d]);
        }
        const stts = fullbox(
            "stts",
            0,
            0,
            u32(sttsEntries.length),
            ...sttsEntries.flatMap(([count, d]) => [u32(count), u32(d)]),
        );
        const stsc = fullbox(
            "stsc",
            0,
            0,
            u32(1),
            u32(1),
            u32(samples.length),
            u32(1),
        );
        const stsz = fullbox(
            "stsz",
            0,
            0,
            u32(0),
            u32(samples.length),
            ...samples.map((s) => u32(s.data.length)),
        );
        if (colorOffset > 0xffff_ffff) throw new Error("mdat too large");
        const stco = fullbox("stco", 0, 0, u32(1), u32(colorOffset));
        const stss = fullbox(
            "stss",
            0,
            0,
            u32(syncSamples.length),
            ...syncSamples.map(u32),
        );
        const stbl = box(
            "stbl",
            fullbox(
                "stsd",
                0,
                0,
                u32(1),
                visualSampleEntry(info, width, height),
            ),
            stts,
            stsc,
            stsz,
            stco,
            stss,
        );
        const minf = box("minf", vmhd, dinf, stbl);
        const mdia = box("mdia", mdhd, hdlr, minf);
        return { meta, moov: box("moov", mvhd, box("trak", tkhd, edts, mdia)) };
    };

    const first = build(0);
    const dataStart = ftyp.length + first.meta.length + first.moov.length + 8;
    const { meta, moov } = build(dataStart);

    const dataLength = samples.reduce((a, s) => a + s.data.length, 0);
    const mdat = concat(
        u32(8 + dataLength),
        str("mdat"),
        ...samples.map((s) => s.data),
    );
    return concat(ftyp, meta, moov, mdat);
}

export type MuxAvifStillOptions = {
    width: number;
    height: number;
    /** 单帧 AV1 码流（含 sequence header） */
    data: Uint8Array;
    /** 不传则从码流解析 */
    info?: Av1SequenceInfo;
    /** 解析失败时用于兜底的 codec string，如 av01.1.04M.08 */
    fallbackCodec?: string;
};

/** 静止图像 AVIF 封装；alpha 需要辅助 item，暂不支持 */
export function muxAvifStill(opts: MuxAvifStillOptions) {
    const { width, height, data } = opts;
    if (data.length > 0xffff_ffff) throw new Error("mdat too large");
    const info =
        opts.info ??
        parseAv1SequenceHeader(data) ??
        (opts.fallbackCodec ? infoFromCodec(opts.fallbackCodec) : null);
    if (!info) throw new Error("no AV1 sequence header");
    const brand = info.profile === 0 && info.bitDepth === 8 ? "MA1B" : "MA1A";

    const ftyp = box(
        "ftyp",
        str("avif"),
        u32(0),
        ...["avif", "mif1", "miaf", brand].map(str),
    );

    const build = (colorOffset: number) => {
        const iloc = fullbox(
            "iloc",
            0,
            0,
            u8(0x44, 0),
            u16(1),
            u16(1),
            u16(0),
            u16(1),
            u32(colorOffset),
            u32(data.length),
        );
        const iinf = fullbox(
            "iinf",
            0,
            0,
            u16(1),
            fullbox(
                "infe",
                2,
                0,
                u16(1),
                u16(0),
                str("av01"),
                str("Color"),
                u8(0),
            ),
        );
        const ipco = box(
            "ipco",
            ispe(width, height),
            pixi(info.bitDepth),
            av1C(info),
            nclx(info),
        );
        const ipma = fullbox(
            "ipma",
            0,
            0,
            u32(1),
            u16(1),
            u8(4, 1, 2, 0x83, 4),
        );
        return fullbox(
            "meta",
            0,
            0,
            fullbox("hdlr", 0, 0, u32(0), str("pict"), zeros(12), u8(0)),
            fullbox("pitm", 0, 0, u16(1)),
            iloc,
            iinf,
            box("iprp", ipco, ipma),
        );
    };

    const dataStart = ftyp.length + build(0).length + 8;
    return concat(ftyp, build(dataStart), box("mdat", data));
}

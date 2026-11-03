import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import bmp from "bmp-js";
import { findOffset } from "picture_match";
import { applyLongStep, LongStitcher } from "../lib/longStitch.ts";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) {
    console.error(
        "用法: pnpm long-stitch <长截屏调试目录> [--from N] [--to N] [--step N]",
    );
    process.exit(1);
}

function argNumber(name, fallback) {
    const index = args.indexOf(name);
    if (index < 0) return fallback;
    const value = Number(args[index + 1]);
    return Number.isFinite(value) ? value : fallback;
}

const manifest = JSON.parse(
    readFileSync(path.join(dir, "manifest.json"), "utf8"),
);
const allMetas = readFileSync(path.join(dir, "frames.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

if (allMetas.length === 0) {
    console.error("没有帧数据");
    process.exit(1);
}

const from = Math.max(0, Math.floor(argNumber("--from", 0)));
const to = Math.min(
    allMetas.length - 1,
    Math.floor(argNumber("--to", allMetas.length - 1)),
);
const step = Math.max(1, Math.floor(argNumber("--step", 1)));
const indices = [];
for (let i = from; i <= to; i += step) indices.push(i);
if (indices.at(-1) !== to) indices.push(to);
const metas = indices.map((i) => allMetas[i]);
const fullSession = from === 0 && to === allMetas.length - 1 && step === 1;
const suffix = fullSession ? "" : `-${from}-${to}-s${step}`;

const margins = metas.find((m) => m.margins)?.margins;

function loadFrame(meta) {
    const raw = inflateRawSync(
        readFileSync(path.join(dir, "frames", meta.file)),
    );
    if (raw.byteLength !== meta.width * meta.height * 4) {
        throw new Error(
            `帧 ${meta.file} 大小不符: ${raw.byteLength} != ${meta.width * meta.height * 4}`,
        );
    }
    return {
        width: meta.width,
        height: meta.height,
        data: new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.byteLength),
    };
}

function writeBmp(name, raster) {
    if (!raster) return;
    // bmp-js 的 encoder 要 ABGR；canvas/raw 帧是 RGBA，直接传会把 alpha 写成红色
    const data = Buffer.alloc(raster.data.byteLength);
    for (let i = 0; i < raster.data.length; i += 4) {
        data[i] = raster.data[i + 3];
        data[i + 1] = raster.data[i + 2];
        data[i + 2] = raster.data[i + 1];
        data[i + 3] = raster.data[i];
    }
    const image = bmp.encode({
        data,
        width: raster.bounds.width,
        height: raster.bounds.height,
    });
    writeFileSync(path.join(dir, name), image.data);
    console.log(`输出 ${path.join(dir, name)}`);
}

function compareRaster(label, raster) {
    if (!fullSession) {
        console.log(`${label}: 当前是子集，跳过与线上结果比较`);
        return;
    }
    const resultPath = path.join(dir, "result.rgba.z");
    const resultMetaPath = path.join(dir, "result.json");
    let resultMeta;
    let raw;
    try {
        resultMeta = JSON.parse(readFileSync(resultMetaPath, "utf8"));
        raw = inflateRawSync(readFileSync(resultPath));
    } catch {
        return;
    }
    const live = new Uint8ClampedArray(
        raw.buffer,
        raw.byteOffset,
        raw.byteLength,
    );
    if (!raster) {
        console.log(`${label}: 没有可比较的拼接结果`);
        return;
    }
    const widthMatch = raster.bounds.width === resultMeta.width;
    const heightMatch = raster.bounds.height === resultMeta.height;
    if (!widthMatch || !heightMatch) {
        console.log(
            `${label}: 尺寸不一致 live=${resultMeta.width}x${resultMeta.height} replay=${raster.bounds.width}x${raster.bounds.height}`,
        );
        return;
    }
    let mismatch = 0;
    let first = "";
    for (let i = 0; i < live.length; i++) {
        if (live[i] === raster.data[i]) continue;
        mismatch++;
        if (!first) {
            const pixel = Math.floor(i / 4);
            first = `(${pixel % resultMeta.width}, ${Math.floor(pixel / resultMeta.width)})`;
        }
    }
    console.log(
        `${label}: ${mismatch === 0 ? "逐像素一致" : `${mismatch} 个字节不同，首处 ${first}`}`,
    );
}

/** 找出整行/整列明显发红的位置，并定位最后写入它的帧 */
function reportRed(raster, steps) {
    if (!raster) return;
    const { bounds, data } = raster;
    const rows = [];
    const cols = [];
    for (let y = 0; y < bounds.height; y++) {
        let red = 0;
        for (let x = 0; x < bounds.width; x++) {
            const i = (y * bounds.width + x) * 4;
            if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) {
                red++;
            }
        }
        if (red > bounds.width * 0.8) rows.push(bounds.y + y);
    }
    for (let x = 0; x < bounds.width; x++) {
        let red = 0;
        for (let y = 0; y < bounds.height; y++) {
            const i = (y * bounds.width + x) * 4;
            if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) {
                red++;
            }
        }
        if (red > bounds.height * 0.8) cols.push(bounds.x + x);
    }

    function groups(list) {
        const out = [];
        for (const v of list) {
            const last = out.at(-1);
            if (last && v === last.end + 1) last.end = v;
            else out.push({ start: v, end: v });
        }
        return out;
    }

    function writerOf(value, vertical) {
        let writer = null;
        for (const item of steps) {
            const p = item.step.patch;
            if (!p) continue;
            if (
                vertical
                    ? value >= p.dy && value < p.dy + p.sh
                    : value >= p.dx && value < p.dx + p.sw
            ) {
                writer = item.index;
            }
        }
        return writer;
    }

    for (const group of groups(rows)) {
        console.log(
            `红色行 ${group.start}-${group.end}，最后写入帧 #${writerOf(group.start, true)}`,
        );
    }
    for (const group of groups(cols)) {
        console.log(
            `红色列 ${group.start}-${group.end}，最后写入帧 #${writerOf(group.start, false)}`,
        );
    }
    if (rows.length === 0 && cols.length === 0) {
        console.log("未发现整行/整列发红的位置");
    }
}

async function replay(useRecorded) {
    console.log(
        `\n=== ${useRecorded ? "使用记录偏移" : "重新匹配"} 帧 ${indices.join(",")} ===`,
    );
    let next = 0;
    const frameFinder = async () => {
        const recorded = metas[next]?.offset;
        return recorded ?? { dx: 0, dy: 0, confidence: 0 };
    };
    const stitcher = new LongStitcher({
        findOffset: useRecorded ? frameFinder : findOffset,
        direction: manifest.direction ?? "y",
        margins,
        refine: !useRecorded,
    });
    let raster = null;
    const steps = [];
    for (const index of indices) {
        const meta = allMetas[index];
        const local = indices.indexOf(index);
        next = local;
        const frame = loadFrame(meta);
        const step = await stitcher.addFrame(frame, Boolean(meta.forceLast));
        steps.push({ index, step });
        raster = applyLongStep(raster, step, frame);

        const rec = meta.offset;
        const now = step.offset;
        let offsetText = "";
        if (rec && now) {
            const diff = Math.abs(rec.dx - now.dx) + Math.abs(rec.dy - now.dy);
            offsetText = ` recorded=(${rec.dx},${rec.dy}) replay=(${now.dx},${now.dy}) diff=${diff}`;
        }
        console.log(
            `#${index}${offsetText} margins=${JSON.stringify(step.margins)} patch=${JSON.stringify(step.patch)} bounds=${JSON.stringify(step.bounds)}`,
        );
        if (now && step.margins) {
            const limit = now.dy > 0 ? step.margins.top : step.margins.bottom;
            if (limit + Math.abs(now.dy) > frame.height) {
                console.log(
                    `#${index} 警告: 边距 ${limit} + 偏移 ${Math.abs(now.dy)} 超过帧高 ${frame.height}，可能出现缺口`,
                );
            }
        }
    }
    return { raster, steps };
}

const real = await replay(false);
writeBmp(`replay-result${suffix}.bmp`, real.raster);
compareRaster("重新匹配", real.raster);
reportRed(real.raster, real.steps);

const recorded = await replay(true);
writeBmp(`recorded-result${suffix}.bmp`, recorded.raster);
compareRaster("记录偏移", recorded.raster);

console.log("\n完成");

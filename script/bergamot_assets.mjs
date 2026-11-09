import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ATTACHMENTS_URL = "https://firefox-settings-attachments.cdn.mozilla.net/";

const OUT = process.env.BERGAMOT_ASSETS_DIR || "bergamot-assets";
const TAG = process.env.BERGAMOT_RELEASE || "bergamot-v1";
const UPLOAD = process.argv.includes("--upload");
const CONCURRENCY = 4;

const FILE_TYPES = ["model", "lex", "vocab", "srcvocab", "trgvocab"];
const SERVER_ENV = { "appinfo.OS": "Linux", channel: "release" };

function parseVersion(version) {
    const match = /^(\d+)\.(\d+)$/.exec(version);
    return match
        ? { major: Number(match[1]), minor: Number(match[2]) }
        : undefined;
}

function matchesDesktop(expression) {
    if (!expression || expression.trim() === "") return true;
    return expression.split("||").some((clause) =>
        clause.split("&&").every((atom) => {
            const match = /^\s*env\.([\w.]+)\s*(==|!=)\s*'([^']*)'\s*$/.exec(
                atom,
            );
            if (!match) return false;
            const value = SERVER_ENV[match[1]];
            if (value === undefined) return false;
            return match[2] === "==" ? value === match[3] : value !== match[3];
        }),
    );
}

function assetName(from, to, version, role, filename) {
    return `bergamot-${from}-${to}-${version}-${role}-${filename}`;
}

async function fetchBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

async function mapLimit(items, limit, callback) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (true) {
            const index = next++;
            if (index >= items.length) return;
            results[index] = await callback(items[index], index);
        }
    }
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, worker),
    );
    return results;
}

async function download(url, dest, hash) {
    if (existsSync(dest)) {
        const bytes = await readFile(dest);
        if (createHash("sha256").update(bytes).digest("hex") === hash) {
            return dest;
        }
        await rm(dest, { force: true });
    }
    const bytes = await fetchBuffer(url);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== hash) {
        throw new Error(`校验失败: ${url}`);
    }
    await writeFile(dest, bytes);
    return dest;
}

function selectSets(records) {
    const byVersion = new Map();
    for (const record of records) {
        if (!FILE_TYPES.includes(record.fileType)) continue;
        const version = parseVersion(record.version);
        if (version?.major !== 3) continue;
        const key = `${record.sourceLanguage}\u0000${record.targetLanguage}\u0000${record.version}`;
        const set = byVersion.get(key) || {
            from: record.sourceLanguage,
            to: record.targetLanguage,
            version: record.version,
            files: {},
        };
        set.files[record.fileType] = record;
        byVersion.set(key, set);
    }

    const complete = [...byVersion.values()].filter(
        ({ files }) =>
            files.model &&
            files.lex &&
            (files.vocab || (files.srcvocab && files.trgvocab)),
    );
    const byPair = new Map();
    for (const set of complete) {
        const key = `${set.from}-${set.to}`;
        const list = byPair.get(key) || [];
        list.push(set);
        byPair.set(key, list);
    }

    const selected = new Map();
    for (const [key, list] of byPair) {
        const desktop = list.filter(({ files }) =>
            Object.values(files).every((file) =>
                matchesDesktop(file.filter_expression),
            ),
        );
        const candidates = desktop.length > 0 ? desktop : list;
        candidates.sort(
            (a, b) =>
                (parseVersion(b.version)?.minor ?? 0) -
                (parseVersion(a.version)?.minor ?? 0),
        );
        selected.set(key, candidates[0]);
    }
    return selected;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureRelease() {
    try {
        execFileSync("gh", ["release", "view", TAG], { stdio: "ignore" });
    } catch (error) {
        execFileSync(
            "gh",
            [
                "release",
                "create",
                TAG,
                "--title",
                "Bergamot models",
                "--notes",
                "Firefox Translations Bergamot models and runtime for eSearch.",
            ],
            { stdio: "inherit" },
        );
    }
}

function existingAssets() {
    try {
        const output = execFileSync(
            "gh",
            [
                "release",
                "view",
                TAG,
                "--json",
                "assets",
                "--jq",
                ".assets[].name",
            ],
            { encoding: "utf8" },
        );
        return new Set(output.split("\n").filter(Boolean));
    } catch (error) {
        return new Set();
    }
}

async function uploadAssets(assets) {
    let pending = [...assets];
    for (let pass = 0; pass < 20 && pending.length > 0; pass++) {
        const existing = existingAssets();
        pending = pending.filter((asset) => !existing.has(asset));
        if (pending.length === 0) break;

        const batch = pending.slice(0, 40);
        console.log(
            `上传 ${assets.length - pending.length + 1}-${
                assets.length - pending.length + batch.length
            }/${assets.length}`,
        );
        try {
            execFileSync("gh", ["release", "upload", TAG, ...batch], {
                stdio: "inherit",
            });
            pending = pending.slice(batch.length);
        } catch (error) {
            console.log(`上传批次失败，重试: ${error.message}`);
            await sleep(3000);
        }
    }
    if (pending.length > 0) {
        throw new Error(`还有 ${pending.length} 个资源未上传`);
    }
}

async function main() {
    await mkdir(OUT, { recursive: true });

    const models = JSON.parse(
        await readFile(
            new URL("./bergamot-records-v1.json", import.meta.url),
            "utf8",
        ),
    );
    const wasm = JSON.parse(
        await readFile(
            new URL("./bergamot-wasm-v1.json", import.meta.url),
            "utf8",
        ),
    );
    const sets = selectSets(models.data);

    const manifest = {
        generated: new Date().toISOString(),
        runtime: null,
        models: {},
    };

    const wasmRecord = wasm.data
        .filter(
            (record) =>
                record.name === "bergamot-translator" &&
                parseVersion(record.version)?.major === 4,
        )
        .sort(
            (a, b) =>
                (parseVersion(b.version)?.minor ?? 0) -
                (parseVersion(a.version)?.minor ?? 0),
        )[0];
    if (!wasmRecord) {
        throw new Error("找不到 4.x Bergamot 运行时");
    }

    const wasmAsset = `bergamot-translator-${wasmRecord.version}.wasm.zst`;
    const wasmUrl = new URL(wasmRecord.attachment.location, ATTACHMENTS_URL)
        .href;
    console.log(`运行时 ${wasmRecord.release} (${wasmRecord.version})`);
    manifest.runtime = {
        version: wasmRecord.version,
        release: wasmRecord.release,
        asset: wasmAsset,
        filename: wasmRecord.attachment.filename,
        hash: wasmRecord.attachment.hash,
        decompressedHash: wasmRecord.decompressedHash,
        size: wasmRecord.attachment.size,
    };

    const entries = [];
    for (const [pair, set] of sets) {
        const files = {};
        for (const [role, record] of Object.entries(set.files)) {
            const asset = assetName(
                set.from,
                set.to,
                set.version,
                role,
                record.attachment.filename,
            );
            const url = new URL(record.attachment.location, ATTACHMENTS_URL)
                .href;
            entries.push({
                url,
                asset,
                hash: record.attachment.hash,
                size: record.attachment.size,
                label: `${pair} ${role}`,
            });
            files[role] = {
                asset,
                filename: record.attachment.filename,
                hash: record.attachment.hash,
                decompressedHash: record.decompressedHash,
                size: record.attachment.size,
            };
        }
        manifest.models[pair] = {
            from: set.from,
            to: set.to,
            version: set.version,
            files,
        };
    }

    console.log(
        `模型 ${sets.size} 对，${entries.length} 个文件，` +
            `${Math.round(
                entries.reduce((sum, entry) => sum + entry.size, 0) / 1e6,
            )} MB`,
    );

    let existing = new Set();
    if (UPLOAD) {
        ensureRelease();
        existing = existingAssets();
    }

    const needWasm = !UPLOAD || !existing.has(wasmAsset);
    if (needWasm) {
        await download(
            wasmUrl,
            join(OUT, wasmAsset),
            wasmRecord.attachment.hash,
        );
    }

    const missingEntries = UPLOAD
        ? entries.filter((entry) => !existing.has(entry.asset))
        : entries;
    console.log(
        UPLOAD
            ? `已上传 ${entries.length - missingEntries.length}/${entries.length}，` +
                  `待下载 ${missingEntries.length}`
            : `待下载 ${missingEntries.length}`,
    );

    let downloaded = 0;
    await mapLimit(missingEntries, CONCURRENCY, async (entry) => {
        await download(entry.url, join(OUT, entry.asset), entry.hash);
        downloaded++;
        if (downloaded % 10 === 0 || downloaded === missingEntries.length) {
            console.log(`下载 ${downloaded}/${missingEntries.length}`);
        }
    });

    const manifestPath = join(OUT, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`清单: ${manifestPath}`);

    if (!UPLOAD) return;

    await uploadAssets(missingEntries.map((entry) => join(OUT, entry.asset)));
    if (needWasm) {
        console.log("上传运行时");
        execFileSync("gh", ["release", "upload", TAG, join(OUT, wasmAsset)], {
            stdio: "inherit",
        });
    }
    if (!existing.has("manifest.json")) {
        console.log("上传清单");
        execFileSync("gh", ["release", "upload", TAG, manifestPath], {
            stdio: "inherit",
        });
    }
    console.log("完成");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

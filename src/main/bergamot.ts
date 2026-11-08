import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
    mkdir,
    readdir,
    readFile,
    rename,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { app } from "electron";
import { mainHandle, mainSend } from "../../lib/ipc";
import glueSource from "./bergamot-translator.js?raw";
import workerSource from "./bergamot-worker.cjs?raw";

/**
 * Firefox Translations 的 Bergamot 运行时和模型（MPL-2.0）。
 * 运行时 v0.6.0 / wasm 4.0，模型从 Mozilla Remote Settings 下载，不随应用分发。
 */

const RECORDS_URL =
    "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/translations-models-v2/records";
const WASM_URL =
    "https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/translations-wasm-v2/records";
const ATTACHMENTS_URL = "https://firefox-settings-attachments.cdn.mozilla.net/";

const MODEL_MAJOR_VERSION = 3;
const WASM_MAJOR_VERSION = 4;
const MAX_ROUTES = 1;

const FILE_TYPES = ["model", "lex", "vocab", "srcvocab", "trgvocab"] as const;

type FileType = (typeof FILE_TYPES)[number];

type FileRecord = {
    name: string;
    version: string;
    fileType: FileType;
    sourceLanguage: string;
    targetLanguage: string;
    attachment: {
        hash: string;
        size: number;
        location: string;
        filename: string;
        mimetype: string;
    };
    decompressedHash?: string;
    decompressedSize?: number;
    filter_expression?: string;
};

type RecordsResponse = { data: FileRecord[] };

type FileSpec = {
    path: string;
    hash: string;
    decompressedHash?: string;
};

type ModelSet = {
    from: string;
    to: string;
    version: string;
    files: Partial<Record<FileType, FileRecord>>;
};

type ModelSpec = {
    key: string;
    from: string;
    to: string;
    files: Partial<Record<FileType, FileSpec>>;
};

type Progress = {
    file: string;
    received: number;
    total?: number;
};

type ProgressCallback = (progress: Progress) => void;

type DownloadProgress = Progress & {
    from: string;
    to: string;
};

type DownloadProgressCallback = (progress: DownloadProgress) => void;

type ModelInfo = {
    from: string;
    to: string;
    version: string;
    size: number;
};

type ManifestFile = {
    filename: string;
    hash: string;
    decompressedHash?: string;
};

type ModelManifest = {
    from: string;
    to: string;
    version: string;
    files: Partial<Record<FileType, ManifestFile>>;
};

type RuntimeManifest = {
    file: ManifestFile;
};

type Pending = {
    resolve: (texts: string[]) => void;
    reject: (error: Error) => void;
};

type WorkerEntry = {
    worker: Worker;
    pending: Map<number, Pending>;
    lastUsed: number;
};

const LANG_ALIAS: Record<string, string> = {
    zh: "zh-Hans",
    "zh-CN": "zh-Hans",
    "zh-SG": "zh-Hans",
    "zh-TW": "zh-Hant",
    "zh-HK": "zh-Hant",
    "zh-HANS": "zh-Hans",
    "zh-HANT": "zh-Hant",
    "ZH-HANS": "zh-Hans",
    "ZH-HANT": "zh-Hant",
    "pt-BR": "pt",
    "pt-Pt": "pt",
    "pt-Br": "pt",
    "pt-PT": "pt",
    no: "nb",
    nn: "nb",
    iw: "he",
    in: "id",
    fil: "tl",
    "en-GB": "en",
    "en-US": "en",
    "en-Gb": "en",
    "en-Us": "en",
    "fa-AF": "fa",
    "fa-Af": "fa",
    "sr-Latn": "sr",
    "sr-Cyrl": "sr",
    yue: "zh-Hant",
};

const SERVER_ENV: Record<string, string> = {
    "appinfo.OS": "Linux",
    channel: "release",
};

let modelRecordsPromise: Promise<FileRecord[]> | undefined;
let wasmRecordPromise: Promise<FileRecord> | undefined;
let runtimePromise: Promise<FileSpec> | undefined;
const downloads = new Map<string, Promise<string>>();
const routes = new Map<string, WorkerEntry>();
let routeLock = Promise.resolve();
let nextId = 0;

function cacheDir() {
    return join(app.getPath("userData"), "bergamot");
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return (await response.json()) as T;
}

async function fetchBytes(
    url: string,
    onProgress?: (progress: { received: number; total?: number }) => void,
): Promise<Buffer> {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
    }

    const length = response.headers.get("content-length");
    const total = length ? Number(length) : undefined;

    if (!response.body) {
        return Buffer.from(await response.arrayBuffer());
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress?.({ received, total });
    }
    return Buffer.concat(chunks, received);
}

function modelRecords() {
    modelRecordsPromise ??= fetchJson<RecordsResponse>(RECORDS_URL)
        .then((data) => data.data)
        .catch((error) => {
            modelRecordsPromise = undefined;
            throw error;
        });
    return modelRecordsPromise;
}

function parseVersion(version: string) {
    const match = /^(\d+)\.(\d+)$/.exec(version);
    return match
        ? { major: Number(match[1]), minor: Number(match[2]) }
        : undefined;
}

/**
 * 判断 Remote Settings 的 filter_expression 是否适用于桌面版 Firefox。
 * Firefox 的模型列表只用到 env.appinfo.OS 和 env.channel 两个变量。
 */
function matchesDesktop(expression: string | undefined) {
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

function selectModelSet(
    records: FileRecord[],
    from: string,
    to: string,
): ModelSet | undefined {
    const byVersion = new Map<string, ModelSet>();

    for (const record of records) {
        if (record.sourceLanguage !== from || record.targetLanguage !== to) {
            continue;
        }
        const version = parseVersion(record.version);
        if (!version || version.major !== MODEL_MAJOR_VERSION) continue;
        if (!FILE_TYPES.includes(record.fileType)) continue;

        const set =
            byVersion.get(record.version) ??
            ({
                from,
                to,
                version: record.version,
                files: {},
            } satisfies ModelSet);
        set.files[record.fileType] = record;
        byVersion.set(record.version, set);
    }

    const complete = [...byVersion.values()].filter(
        ({ files }) =>
            files.model &&
            files.lex &&
            (files.vocab || (files.srcvocab && files.trgvocab)),
    );

    const desktop = complete.filter(({ files }) =>
        Object.values(files).every(
            (file) =>
                file !== undefined && matchesDesktop(file.filter_expression),
        ),
    );
    const candidates = desktop.length > 0 ? desktop : complete;

    candidates.sort((a, b) => {
        const av = parseVersion(a.version);
        const bv = parseVersion(b.version);
        return (bv?.minor ?? 0) - (av?.minor ?? 0);
    });

    return candidates[0];
}

function modelFilePath(record: FileRecord, dir: string) {
    return join(
        dir,
        `${record.attachment.hash.slice(0, 16)}-${record.attachment.filename}`,
    );
}

function manifestFilePath(dir: string) {
    return join(dir, "manifest.json");
}

function manifestFileToSpec(dir: string, file: ManifestFile): FileSpec {
    return {
        path: join(dir, `${file.hash.slice(0, 16)}-${file.filename}`),
        hash: file.hash,
        decompressedHash: file.decompressedHash,
    };
}

async function readManifest<T>(path: string): Promise<T | undefined> {
    try {
        return JSON.parse(await readFile(path, "utf8")) as T;
    } catch (error) {
        return undefined;
    }
}

async function download(
    record: FileRecord,
    dir: string,
    onProgress?: ProgressCallback,
): Promise<string> {
    const dest = modelFilePath(record, dir);
    if (existsSync(dest)) return dest;

    const pending = downloads.get(dest);
    if (pending) return pending;

    const promise = (async () => {
        await mkdir(dir, { recursive: true });
        const url = new URL(record.attachment.location, ATTACHMENTS_URL).href;
        const bytes = await fetchBytes(url, (progress) =>
            onProgress?.({
                ...progress,
                file: record.attachment.filename,
            }),
        );
        const hash = createHash("sha256").update(bytes).digest("hex");
        if (hash !== record.attachment.hash) {
            throw new Error(`模型校验失败: ${record.name}`);
        }
        const tmp = `${dest}.tmp`;
        await writeFile(tmp, bytes);
        await rename(tmp, dest);
        return dest;
    })().finally(() => downloads.delete(dest));

    downloads.set(dest, promise);
    return promise;
}

function getWasmRecord() {
    wasmRecordPromise ??= fetchJson<RecordsResponse>(WASM_URL)
        .then((records) => {
            const record = records.data
                .filter(
                    (item) =>
                        item.name === "bergamot-translator" &&
                        parseVersion(item.version)?.major ===
                            WASM_MAJOR_VERSION,
                )
                .sort(
                    (a, b) =>
                        (parseVersion(b.version)?.minor ?? 0) -
                        (parseVersion(a.version)?.minor ?? 0),
                )[0];
            if (!record) {
                throw new Error("找不到 Firefox 翻译运行时");
            }
            return record;
        })
        .catch((error) => {
            wasmRecordPromise = undefined;
            throw error;
        });
    return wasmRecordPromise;
}

function runtimeFile(record: FileRecord, path: string): FileSpec {
    return {
        path,
        hash: record.attachment.hash,
        decompressedHash: record.decompressedHash,
    };
}

async function getRuntime(onProgress?: ProgressCallback): Promise<FileSpec> {
    runtimePromise ??= (async () => {
        const record = await getWasmRecord();
        const dir = join(cacheDir(), "runtime");
        const path = await download(record, dir, onProgress);
        const manifest: RuntimeManifest = {
            file: {
                filename: record.attachment.filename,
                hash: record.attachment.hash,
                decompressedHash: record.decompressedHash,
            },
        };
        await writeFile(manifestFilePath(dir), JSON.stringify(manifest)).catch(
            (error) => {
                console.error("写入运行时清单失败", error);
            },
        );
        return runtimeFile(record, path);
    })().catch((error) => {
        runtimePromise = undefined;
        throw error;
    });

    return runtimePromise;
}

async function getCachedRuntime(): Promise<FileSpec> {
    const dir = join(cacheDir(), "runtime");
    const manifest = await readManifest<RuntimeManifest>(manifestFilePath(dir));
    if (manifest?.file) {
        const spec = manifestFileToSpec(dir, manifest.file);
        if (existsSync(spec.path)) return spec;
    }

    const record = await getWasmRecord();
    const path = modelFilePath(record, dir);
    if (!existsSync(path)) {
        throw new Error("Firefox 本地模型运行时未下载，请在设置中下载");
    }
    return runtimeFile(record, path);
}

async function getModel(
    from: string,
    to: string,
    onProgress?: ProgressCallback,
): Promise<ModelSpec | undefined> {
    const set = selectModelSet(await modelRecords(), from, to);
    if (!set) return undefined;

    const dir = join(cacheDir(), "models", `${from}-${to}`, set.version);
    const records = Object.entries(set.files) as [FileType, FileRecord][];
    const files: Partial<Record<FileType, FileSpec>> = {};
    await Promise.all(
        records.map(async ([role, record]) => {
            const path = await download(record, dir, onProgress);
            files[role] = {
                path,
                hash: record.attachment.hash,
                decompressedHash: record.decompressedHash,
            };
        }),
    );

    const manifest: ModelManifest = {
        from,
        to,
        version: set.version,
        files: {},
    };
    for (const [role, record] of records) {
        manifest.files[role] = {
            filename: record.attachment.filename,
            hash: record.attachment.hash,
            decompressedHash: record.decompressedHash,
        };
    }
    await writeFile(manifestFilePath(dir), JSON.stringify(manifest)).catch(
        (error) => {
            console.error("写入模型清单失败", error);
        },
    );

    return {
        key: `${from}-${to}@${set.version}`,
        from,
        to,
        files,
    };
}

async function getCachedModel(
    from: string,
    to: string,
): Promise<ModelSpec | undefined> {
    const pairPath = join(cacheDir(), "models", `${from}-${to}`);
    if (existsSync(pairPath)) {
        const versions = await readdir(pairPath);
        versions.sort(
            (a, b) =>
                (parseVersion(b)?.minor ?? 0) - (parseVersion(a)?.minor ?? 0),
        );
        for (const version of versions) {
            const dir = join(pairPath, version);
            const manifest = await readManifest<ModelManifest>(
                manifestFilePath(dir),
            );
            if (!manifest || manifest.from !== from || manifest.to !== to) {
                continue;
            }

            const files: Partial<Record<FileType, FileSpec>> = {};
            let complete = true;
            for (const [role, file] of Object.entries(manifest.files) as [
                FileType,
                ManifestFile,
            ][]) {
                const spec = manifestFileToSpec(dir, file);
                if (!existsSync(spec.path)) {
                    complete = false;
                    break;
                }
                files[role] = spec;
            }
            if (
                complete &&
                files.model &&
                files.lex &&
                (files.vocab || (files.srcvocab && files.trgvocab))
            ) {
                return {
                    key: `${from}-${to}@${version}`,
                    from,
                    to,
                    files,
                };
            }
        }
    }

    const set = selectModelSet(await modelRecords(), from, to);
    if (!set) return undefined;

    const dir = join(cacheDir(), "models", `${from}-${to}`, set.version);
    const records = Object.entries(set.files) as [FileType, FileRecord][];
    if (records.some(([, record]) => !existsSync(modelFilePath(record, dir)))) {
        return undefined;
    }

    const files: Partial<Record<FileType, FileSpec>> = {};
    for (const [role, record] of records) {
        files[role] = {
            path: modelFilePath(record, dir),
            hash: record.attachment.hash,
            decompressedHash: record.decompressedHash,
        };
    }

    return {
        key: `${from}-${to}@${set.version}`,
        from,
        to,
        files,
    };
}

function normalizeLang(code: string) {
    return LANG_ALIAS[code] ?? code;
}

function detectLang(texts: string[]) {
    const text = texts.join("\n");
    if (/[\u3040-\u30ff]/.test(text)) return "ja";
    if (/[\uac00-\ud7af]/.test(text)) return "ko";
    if (/[\u0400-\u04ff]/.test(text)) return "ru";
    if (/[\u0600-\u06ff]/.test(text)) return "ar";
    if (/[\u0590-\u05ff]/.test(text)) return "he";
    if (/[\u0900-\u097f]/.test(text)) return "hi";
    if (/[\u0e00-\u0e7f]/.test(text)) return "th";
    if (/[\u0370-\u03ff]/.test(text)) return "el";
    if (/[\u4e00-\u9fff]/.test(text)) return "zh-Hans";
    return "en";
}

async function routeModels(
    from: string,
    to: string,
    get: (from: string, to: string) => Promise<ModelSpec | undefined>,
): Promise<ModelSpec[] | undefined> {
    const direct = await get(from, to);
    if (direct) return [direct];

    if (from !== "en" && to !== "en") {
        const [source, target] = await Promise.all([
            get(from, "en"),
            get("en", to),
        ]);
        if (source && target) return [source, target];
    }

    return undefined;
}

async function downloadRouteModels(
    from: string,
    to: string,
    onProgress?: ProgressCallback,
) {
    const models = await routeModels(from, to, (source, target) =>
        getModel(source, target, onProgress),
    );
    if (!models) {
        throw new Error(`Firefox 本地模型不支持 ${from} → ${to}`);
    }
    return models;
}

async function getCachedRouteModels(from: string, to: string) {
    const models = await routeModels(from, to, getCachedModel);
    if (!models) {
        throw new Error(
            `Firefox 本地模型未下载或不支持 ${from} → ${to}，请在设置 → 翻译 → 本地模型中下载`,
        );
    }
    return models;
}

function spawnWorker(specs: ModelSpec[], runtime: FileSpec) {
    const entry: WorkerEntry = {
        worker: new Worker(workerSource, {
            eval: true,
            workerData: {
                wasm: runtime,
                glueSource,
                models: specs,
            },
        }),
        pending: new Map(),
        lastUsed: Date.now(),
    };

    entry.worker.unref();

    entry.worker.on(
        "message",
        (message: { id: number; texts?: string[]; error?: string }) => {
            const pending = entry.pending.get(message.id);
            if (!pending) return;
            entry.pending.delete(message.id);
            if (message.texts) {
                pending.resolve(message.texts);
            } else {
                pending.reject(
                    new Error(`Firefox 本地模型翻译失败: ${message.error}`),
                );
            }
        },
    );

    const fail = (error: Error) => {
        for (const pending of entry.pending.values()) {
            pending.reject(error);
        }
        entry.pending.clear();
        for (const [key, value] of routes) {
            if (value === entry) routes.delete(key);
        }
    };

    entry.worker.on("error", fail);
    entry.worker.on("exit", (code) => {
        fail(new Error(`Firefox 本地模型进程退出: ${code}`));
    });

    return entry;
}

async function getRoute(specs: ModelSpec[], runtime: FileSpec) {
    const key = specs.map((spec) => spec.key).join(">");
    const existing = routes.get(key);
    if (existing) {
        existing.lastUsed = Date.now();
        return existing;
    }

    const previous = routeLock;
    let release: () => void = () => undefined;
    routeLock = new Promise<void>((resolve) => {
        release = resolve;
    });
    await previous;

    try {
        const current = routes.get(key);
        if (current) {
            current.lastUsed = Date.now();
            return current;
        }

        const entry = spawnWorker(specs, runtime);
        routes.set(key, entry);

        while (routes.size > MAX_ROUTES) {
            const oldest = [...routes.entries()]
                .filter(
                    ([routeKey, entry]) =>
                        routeKey !== key && entry.pending.size === 0,
                )
                .sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
            if (!oldest) break;
            routes.delete(oldest[0]);
            void oldest[1].worker.terminate();
        }

        return entry;
    } finally {
        release();
    }
}

function send(entry: WorkerEntry, texts: string[]) {
    return new Promise<string[]>((resolve, reject) => {
        const id = nextId++;
        entry.pending.set(id, { resolve, reject });
        entry.worker.postMessage({ id, texts, html: false });
    });
}

export type BergamotStatus = "ready" | "missing" | "unsupported" | "error";

export async function translateBergamot(
    texts: string[],
    from: string,
    to: string,
) {
    if (texts.length === 0) return [];

    const source = from === "auto" ? detectLang(texts) : normalizeLang(from);
    const target = normalizeLang(to);

    if (target === "auto") {
        throw new Error("目标语言不能是自动");
    }
    if (source === target) return texts;

    const runtime = await getCachedRuntime();
    const specs = await getCachedRouteModels(source, target);
    const entry = await getRoute(specs, runtime);
    return send(entry, texts);
}

export async function downloadBergamot(
    from: string,
    to: string,
    onProgress?: DownloadProgressCallback,
) {
    const source = normalizeLang(from);
    const target = normalizeLang(to);

    if (source === "auto" || target === "auto") {
        throw new Error("请选择具体语言");
    }
    if (source === target) return;

    const report = (progress: Progress) =>
        onProgress?.({ ...progress, from: source, to: target });

    await getRuntime(report);
    await downloadRouteModels(source, target, report);
}

export async function bergamotStatus(
    from: string,
    to: string,
): Promise<BergamotStatus> {
    const source = normalizeLang(from);
    const target = normalizeLang(to);

    if (source === "auto" || target === "auto") return "missing";
    if (source === target) return "ready";

    try {
        try {
            await getCachedRuntime();
        } catch (error) {
            return "missing";
        }

        const cached = await routeModels(source, target, getCachedModel);
        if (cached) return "ready";

        const direct = selectModelSet(await modelRecords(), source, target);
        if (direct) return "missing";

        if (source !== "en" && target !== "en") {
            const [sourceSet, targetSet] = await Promise.all([
                selectModelSet(await modelRecords(), source, "en"),
                selectModelSet(await modelRecords(), "en", target),
            ]);
            if (sourceSet && targetSet) return "missing";
        }

        return "unsupported";
    } catch (error) {
        console.error("检查 Firefox 本地模型失败", error);
        return "error";
    }
}

export async function clearBergamotCache() {
    for (const entry of routes.values()) {
        void entry.worker.terminate();
    }
    routes.clear();
    runtimePromise = undefined;
    await Promise.allSettled([...downloads.values()]);
    downloads.clear();
    await rm(cacheDir(), { recursive: true, force: true });
}

export async function listDownloadedModels() {
    const base = join(cacheDir(), "models");
    const runtimeDir = join(cacheDir(), "runtime");
    const runtime =
        existsSync(runtimeDir) &&
        (await readdir(runtimeDir)).some((file) => file !== "manifest.json");
    const models: ModelInfo[] = [];

    if (!existsSync(base)) {
        return { runtime, models };
    }

    const pairByDir = new Map<string, { from: string; to: string }>();
    let records: FileRecord[] = [];
    try {
        records = await modelRecords();
        for (const record of records) {
            pairByDir.set(`${record.sourceLanguage}-${record.targetLanguage}`, {
                from: record.sourceLanguage,
                to: record.targetLanguage,
            });
        }
    } catch (error) {
        console.error("读取模型列表失败，使用本地清单", error);
    }

    for (const pairDir of await readdir(base)) {
        const pairPath = join(base, pairDir);
        for (const version of await readdir(pairPath)) {
            const dir = join(pairPath, version);
            let files: string[];
            try {
                files = await readdir(dir);
            } catch (error) {
                console.error(`读取模型目录失败: ${dir}`, error);
                continue;
            }
            if (!files.some((file) => file !== "manifest.json")) continue;

            const manifest = await readManifest<ModelManifest>(
                manifestFilePath(dir),
            );
            const pair = manifest
                ? { from: manifest.from, to: manifest.to }
                : pairByDir.get(pairDir);
            if (!pair) continue;

            let complete = false;
            if (manifest) {
                const manifestFiles = Object.values(
                    manifest.files,
                ) as ManifestFile[];
                complete =
                    !!manifest.files.model &&
                    !!manifest.files.lex &&
                    (!!manifest.files.vocab ||
                        (!!manifest.files.srcvocab &&
                            !!manifest.files.trgvocab)) &&
                    manifestFiles.every((file) =>
                        existsSync(manifestFileToSpec(dir, file).path),
                    );
            } else {
                const set = records.filter(
                    (record) =>
                        `${record.sourceLanguage}-${record.targetLanguage}` ===
                            pairDir && record.version === version,
                );
                const roles = new Set(set.map((record) => record.fileType));
                complete =
                    roles.has("model") &&
                    roles.has("lex") &&
                    (roles.has("vocab") ||
                        (roles.has("srcvocab") && roles.has("trgvocab"))) &&
                    set.every((record) =>
                        existsSync(modelFilePath(record, dir)),
                    );
            }
            if (!complete) continue;

            let size = 0;
            for (const file of files) {
                try {
                    size += (await stat(join(dir, file))).size;
                } catch (error) {
                    console.error(`读取模型文件失败: ${file}`, error);
                }
            }
            models.push({ ...pair, version, size });
        }
    }

    models.sort(
        (a, b) =>
            a.from.localeCompare(b.from) ||
            a.to.localeCompare(b.to) ||
            b.version.localeCompare(a.version),
    );
    return { runtime, models };
}

export async function removeBergamotModel(from: string, to: string) {
    const source = normalizeLang(from);
    const target = normalizeLang(to);
    const pairKey = `${source}-${target}`;

    for (const [key, entry] of routes) {
        const pairs = key.split(">").map((part) => part.split("@")[0]);
        if (pairs.includes(pairKey)) {
            routes.delete(key);
            void entry.worker.terminate();
        }
    }

    const prefix = join(cacheDir(), "models", pairKey);
    await Promise.allSettled(
        [...downloads.entries()]
            .filter(([dest]) => dest.startsWith(prefix))
            .map(([, pending]) => pending),
    );
    await rm(prefix, { recursive: true, force: true });
}

let inited = false;

export function initBergamot() {
    if (inited) return;
    inited = true;
    mainHandle("bergamot_translate", ([data]) =>
        translateBergamot(data.texts, data.from, data.to),
    );
    mainHandle("bergamot_download", ([data], event) =>
        downloadBergamot(data.from, data.to, (progress) => {
            mainSend(event.sender, "bergamot_progress", [progress]);
        }),
    );
    mainHandle("bergamot_status", ([data]) =>
        bergamotStatus(data.from, data.to),
    );
    mainHandle("bergamot_models", () => listDownloadedModels());
    mainHandle("bergamot_remove_model", ([data]) =>
        removeBergamotModel(data.from, data.to),
    );
    mainHandle("bergamot_clear", () => clearBergamotCache());
}

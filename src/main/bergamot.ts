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
 * 运行时和模型由 eSearch release 托管，模型从设置页手动下载。
 */

const REPO = "xushengfeng/eSearch";
const RELEASE_TAG = "bergamot-v1";
const MAX_ROUTES = 1;

const FILE_TYPES = ["model", "lex", "vocab", "srcvocab", "trgvocab"] as const;

type FileType = (typeof FILE_TYPES)[number];

type ManifestFile = {
    asset?: string;
    filename: string;
    hash: string;
    decompressedHash?: string;
    size?: number;
};

type ManifestModel = {
    from: string;
    to: string;
    version: string;
    files: Partial<Record<FileType, ManifestFile>>;
};

type ManifestRuntime = ManifestFile & {
    version: string;
    release: string;
};

type BergamotManifest = {
    generated?: string;
    runtime: ManifestRuntime;
    models: Record<string, ManifestModel>;
};

type LocalModelManifest = {
    from: string;
    to: string;
    version: string;
    files: Partial<Record<FileType, ManifestFile>>;
};

type LocalRuntimeManifest = {
    file: ManifestFile;
};

type FileSpec = {
    path: string;
    hash: string;
    decompressedHash?: string;
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

let githubBase = (path: string) => `https://github.com/${path}`;
let manifestPromise: Promise<BergamotManifest> | undefined;
let runtimePromise: Promise<FileSpec> | undefined;
const downloads = new Map<string, Promise<string>>();
const routes = new Map<string, WorkerEntry>();
let routeLock = Promise.resolve();
let nextId = 0;

function cacheDir() {
    return join(app.getPath("userData"), "bergamot");
}

function bundledDir() {
    return join(app.getAppPath(), "assets", "bergamot");
}

function releaseAssetUrl(asset: string) {
    return githubBase(
        `${REPO}/releases/download/${RELEASE_TAG}/${encodeURIComponent(asset)}`,
    );
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

function getManifest() {
    manifestPromise ??= fetchJson<BergamotManifest>(
        releaseAssetUrl("manifest.json"),
    ).catch((error) => {
        manifestPromise = undefined;
        throw error;
    });
    return manifestPromise;
}

function modelFilePath(file: ManifestFile, dir: string) {
    return join(dir, `${file.hash.slice(0, 16)}-${file.filename}`);
}

function manifestFilePath(dir: string) {
    return join(dir, "manifest.json");
}

function manifestFileToSpec(dir: string, file: ManifestFile): FileSpec {
    return {
        path: modelFilePath(file, dir),
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

async function downloadFile(
    file: ManifestFile,
    dir: string,
    onProgress?: ProgressCallback,
): Promise<string> {
    if (!file.asset) {
        throw new Error(`模型文件 ${file.filename} 缺少下载地址`);
    }
    const asset = file.asset;

    const dest = modelFilePath(file, dir);
    if (existsSync(dest)) return dest;

    const pending = downloads.get(dest);
    if (pending) return pending;

    const promise = (async () => {
        await mkdir(dir, { recursive: true });
        const bytes = await fetchBytes(releaseAssetUrl(asset), (progress) =>
            onProgress?.({
                ...progress,
                file: file.filename,
            }),
        );
        const hash = createHash("sha256").update(bytes).digest("hex");
        if (hash !== file.hash) {
            throw new Error(`模型校验失败: ${file.filename}`);
        }
        const tmp = `${dest}.tmp`;
        await writeFile(tmp, bytes);
        await rename(tmp, dest);
        return dest;
    })().finally(() => downloads.delete(dest));

    downloads.set(dest, promise);
    return promise;
}

async function getBundledRuntime(): Promise<FileSpec | undefined> {
    const dir = bundledDir();
    const runtime = await readManifest<ManifestRuntime>(
        join(dir, "runtime.json"),
    );
    if (!runtime?.asset) return undefined;
    const path = join(dir, runtime.asset);
    if (!existsSync(path)) return undefined;
    return {
        path,
        hash: runtime.hash,
        decompressedHash: runtime.decompressedHash,
    };
}

async function getCachedRuntimeLocal(): Promise<FileSpec | undefined> {
    const dir = join(cacheDir(), "runtime");
    const manifest = await readManifest<LocalRuntimeManifest>(
        manifestFilePath(dir),
    );
    if (!manifest?.file) return undefined;
    const spec = manifestFileToSpec(dir, manifest.file);
    if (!existsSync(spec.path)) return undefined;
    return spec;
}

async function getRuntime(onProgress?: ProgressCallback): Promise<FileSpec> {
    runtimePromise ??= (async () => {
        const bundled = await getBundledRuntime();
        if (bundled) return bundled;

        const cached = await getCachedRuntimeLocal();
        if (cached) return cached;

        const manifest = await getManifest();
        const dir = join(cacheDir(), "runtime");
        const path = await downloadFile(manifest.runtime, dir, onProgress);
        const local: LocalRuntimeManifest = {
            file: manifest.runtime,
        };
        await writeFile(manifestFilePath(dir), JSON.stringify(local)).catch(
            (error) => {
                console.error("写入运行时清单失败", error);
            },
        );
        return {
            path,
            hash: manifest.runtime.hash,
            decompressedHash: manifest.runtime.decompressedHash,
        };
    })().catch((error) => {
        runtimePromise = undefined;
        throw error;
    });

    return runtimePromise;
}

async function getCachedRuntime(): Promise<FileSpec> {
    const bundled = await getBundledRuntime();
    if (bundled) return bundled;

    const cached = await getCachedRuntimeLocal();
    if (cached) return cached;

    throw new Error("Firefox 本地模型运行时缺失，请重新构建或安装");
}

async function getModel(
    from: string,
    to: string,
    onProgress?: ProgressCallback,
): Promise<ModelSpec | undefined> {
    const manifest = await getManifest();
    const entry = manifest.models[`${from}-${to}`];
    if (!entry) return undefined;

    const dir = join(cacheDir(), "models", `${from}-${to}`, entry.version);
    const files: Partial<Record<FileType, FileSpec>> = {};
    const records = Object.entries(entry.files) as [FileType, ManifestFile][];
    await Promise.all(
        records.map(async ([role, file]) => {
            const path = await downloadFile(file, dir, onProgress);
            files[role] = {
                path,
                hash: file.hash,
                decompressedHash: file.decompressedHash,
            };
        }),
    );

    const local: LocalModelManifest = {
        from,
        to,
        version: entry.version,
        files: entry.files,
    };
    await writeFile(manifestFilePath(dir), JSON.stringify(local)).catch(
        (error) => {
            console.error("写入模型清单失败", error);
        },
    );

    return {
        key: `${from}-${to}@${entry.version}`,
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
                Number(b.split(".")[1] ?? 0) - Number(a.split(".")[1] ?? 0),
        );
        for (const version of versions) {
            const dir = join(pairPath, version);
            const manifest = await readManifest<LocalModelManifest>(
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

    const manifest = await getManifest();
    const entry = manifest.models[`${from}-${to}`];
    if (!entry) return undefined;

    const dir = join(cacheDir(), "models", `${from}-${to}`, entry.version);
    const records = Object.entries(entry.files) as [FileType, ManifestFile][];
    if (records.some(([, file]) => !existsSync(modelFilePath(file, dir)))) {
        return undefined;
    }

    const files: Partial<Record<FileType, FileSpec>> = {};
    for (const [role, file] of records) {
        files[role] = manifestFileToSpec(dir, file);
    }

    return {
        key: `${from}-${to}@${entry.version}`,
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
        await getCachedRuntime();
        const cached = await routeModels(source, target, getCachedModel);
        if (cached) return "ready";

        const manifest = await getManifest();
        if (manifest.models[`${source}-${target}`]) return "missing";

        if (source !== "en" && target !== "en") {
            if (
                manifest.models[`${source}-en`] &&
                manifest.models[`en-${target}`]
            ) {
                return "missing";
            }
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
    const runtime =
        !!(await getBundledRuntime()) || !!(await getCachedRuntimeLocal());
    const models: ModelInfo[] = [];

    if (!existsSync(base)) {
        return { runtime, models };
    }

    let manifest: BergamotManifest | undefined;
    try {
        manifest = await getManifest();
    } catch (error) {
        console.error("读取模型清单失败，使用本地清单", error);
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

            const local = await readManifest<LocalModelManifest>(
                manifestFilePath(dir),
            );
            const release = manifest?.models[pairDir];
            const pair = local
                ? { from: local.from, to: local.to }
                : release
                  ? { from: release.from, to: release.to }
                  : undefined;
            if (!pair) continue;

            const entry = manifest?.models[pairDir];
            const sourceFiles = local?.files ?? entry?.files;
            if (!sourceFiles) continue;

            const records = Object.entries(sourceFiles) as [
                FileType,
                ManifestFile,
            ][];
            const complete =
                !!sourceFiles.model &&
                !!sourceFiles.lex &&
                (!!sourceFiles.vocab ||
                    (!!sourceFiles.srcvocab && !!sourceFiles.trgvocab)) &&
                records.every(([, file]) =>
                    existsSync(modelFilePath(file, dir)),
                );
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

export function initBergamot(getBaseUrl: (path: string) => string) {
    if (inited) return;
    inited = true;
    githubBase = getBaseUrl;
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

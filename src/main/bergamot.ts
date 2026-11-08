import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { app, Notification } from "electron";
import { mainHandle } from "../../lib/ipc";
import { t } from "../../lib/translate/translate";
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
let runtimePromise: Promise<FileSpec> | undefined;
const downloads = new Map<string, Promise<string>>();
const routes = new Map<string, WorkerEntry>();
let routeLock = Promise.resolve();
let nextId = 0;
let notifiedDownload = false;

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

async function fetchBytes(url: string): Promise<Buffer> {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
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

function notifyDownload() {
    if (notifiedDownload) return;
    notifiedDownload = true;
    try {
        if (Notification.isSupported()) {
            new Notification({
                title: t("Firefox 本地模型"),
                body: t("首次使用需要下载翻译模型，请稍候"),
            }).show();
        }
    } catch (error) {
        console.error("通知发送失败", error);
    }
}

async function download(record: FileRecord, dir: string): Promise<string> {
    const dest = modelFilePath(record, dir);
    if (existsSync(dest)) return dest;

    const pending = downloads.get(dest);
    if (pending) return pending;

    const promise = (async () => {
        await mkdir(dir, { recursive: true });
        const url = new URL(record.attachment.location, ATTACHMENTS_URL).href;
        const bytes = await fetchBytes(url);
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

async function getRuntime(): Promise<FileSpec> {
    runtimePromise ??= (async () => {
        const records = await fetchJson<RecordsResponse>(WASM_URL);
        const record = records.data
            .filter(
                (item) =>
                    item.name === "bergamot-translator" &&
                    parseVersion(item.version)?.major === WASM_MAJOR_VERSION,
            )
            .sort(
                (a, b) =>
                    (parseVersion(b.version)?.minor ?? 0) -
                    (parseVersion(a.version)?.minor ?? 0),
            )[0];

        if (!record) {
            throw new Error("找不到 Firefox 翻译运行时");
        }

        const dir = join(cacheDir(), "runtime");
        if (!existsSync(modelFilePath(record, dir))) {
            notifyDownload();
        }
        const path = await download(record, dir);
        return {
            path,
            hash: record.attachment.hash,
            decompressedHash: record.decompressedHash,
        };
    })().catch((error) => {
        runtimePromise = undefined;
        throw error;
    });

    return runtimePromise;
}

async function getModel(
    from: string,
    to: string,
): Promise<ModelSpec | undefined> {
    const set = selectModelSet(await modelRecords(), from, to);
    if (!set) return undefined;

    const dir = join(cacheDir(), "models", `${from}-${to}`, set.version);
    const records = Object.entries(set.files) as [FileType, FileRecord][];
    if (records.some(([, record]) => !existsSync(modelFilePath(record, dir)))) {
        notifyDownload();
    }

    const files: Partial<Record<FileType, FileSpec>> = {};
    await Promise.all(
        records.map(async ([role, record]) => {
            const path = await download(record, dir);
            files[role] = {
                path,
                hash: record.attachment.hash,
                decompressedHash: record.decompressedHash,
            };
        }),
    );

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

async function getRouteModels(from: string, to: string): Promise<ModelSpec[]> {
    const direct = await getModel(from, to);
    if (direct) return [direct];

    if (from !== "en" && to !== "en") {
        const source = await getModel(from, "en");
        const target = await getModel("en", to);
        if (source && target) return [source, target];
    }

    throw new Error(`Firefox 本地模型不支持 ${from} → ${to}`);
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

async function getRoute(specs: ModelSpec[]) {
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

        const runtime = await getRuntime();
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

    const specs = await getRouteModels(source, target);
    const entry = await getRoute(specs);
    return send(entry, texts);
}

let inited = false;

export function initBergamot() {
    if (inited) return;
    inited = true;
    mainHandle("bergamot_translate", ([data]) =>
        translateBergamot(data.texts, data.from, data.to),
    );
}

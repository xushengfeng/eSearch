const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { runInThisContext } = require("node:vm");
const { zstdDecompressSync } = require("node:zlib");
const { parentPort, workerData } = require("node:worker_threads");

const ALIGNMENT = {
    model: 256,
    lex: 64,
    vocab: 64,
    srcvocab: 64,
    trgvocab: 64,
};

const MODEL_CONFIG = `
beam-size: 1
normalize: 1.0
word-penalty: 0
max-length-break: 128
mini-batch-words: 1024
workspace: 128
max-length-factor: 2.0
skip-cost: true
cpu-threads: 0
quiet: true
quiet-translation: true
gemm-precision: int8shiftAlphaAll
alignment: soft
`;

const init = workerData;

/**
 * @param {{ path: string; hash: string; decompressedHash?: string }} file
 * @returns {Buffer}
 */
function readVerified(file) {
    const compressed = readFileSync(file.path);
    const compressedHash = createHash("sha256")
        .update(compressed)
        .digest("hex");
    if (compressedHash !== file.hash) {
        throw new Error(`文件校验失败: ${file.path}`);
    }
    const raw = zstdDecompressSync(compressed);
    if (file.decompressedHash) {
        const rawHash = createHash("sha256").update(raw).digest("hex");
        if (rawHash !== file.decompressedHash) {
            throw new Error(`解压校验失败: ${file.path}`);
        }
    }
    return raw;
}

async function loadRuntime() {
    const loadBergamot = runInThisContext(
        `(function () {\n${init.glueSource}\nreturn loadBergamot\n})()`,
        { filename: "bergamot-translator.js" },
    );

    const log = console.log;
    console.log = () => undefined;
    try {
        return await new Promise((resolve, reject) => {
            const module = loadBergamot({
                INITIAL_MEMORY: 234_291_200,
                wasmBinary: readVerified(init.wasm),
                print: () => undefined,
                printErr: () => undefined,
                onAbort: (reason) => {
                    reject(
                        new Error(
                            `Bergamot runtime aborted: ${String(reason)}`,
                        ),
                    );
                },
                onRuntimeInitialized: () => resolve(module),
            });
        });
    } finally {
        console.log = log;
    }
}

/**
 * @param {ReturnType<typeof loadRuntime> extends Promise<infer T> ? T : never} bergamot
 * @param {{ from: string; to: string; files: Record<string, { path: string; hash: string; decompressedHash?: string }> }} spec
 */
function loadModel(bergamot, spec) {
    /** @param {string} role @param {{ path: string; hash: string; decompressedHash?: string }} file */
    const memory = (role, file) => {
        const bytes = readVerified(file);
        const aligned = new bergamot.AlignedMemory(
            bytes.byteLength,
            ALIGNMENT[role],
        );
        aligned.getByteArrayView().set(bytes);
        return aligned;
    };

    const vocabs = new bergamot.AlignedMemoryList();
    if (spec.files.vocab) {
        vocabs.push_back(memory("vocab", spec.files.vocab));
    } else if (spec.files.srcvocab && spec.files.trgvocab) {
        vocabs.push_back(memory("srcvocab", spec.files.srcvocab));
        vocabs.push_back(memory("trgvocab", spec.files.trgvocab));
    } else {
        throw new Error(`模型 ${spec.from}-${spec.to} 缺少词表`);
    }

    return new bergamot.TranslationModel(
        spec.from,
        spec.to,
        MODEL_CONFIG,
        memory("model", spec.files.model),
        memory("lex", spec.files.lex),
        vocabs,
        null,
    );
}

async function start() {
    if (init.models.length < 1 || init.models.length > 2) {
        throw new Error(
            `Bergamot 需要 1 或 2 个模型，收到 ${init.models.length}`,
        );
    }
    const bergamot = await loadRuntime();
    return {
        bergamot,
        service: new bergamot.BlockingService({ cacheSize: 0 }),
        models: init.models.map((spec) => loadModel(bergamot, spec)),
    };
}

const ready = start();
ready.catch(() => undefined);

/**
 * @param {string[]} input
 * @param {boolean} html
 * @returns {Promise<string[]>}
 */
async function translate(input, html) {
    const { bergamot, service, models } = await ready;
    const out = [...input];
    const positions = [];
    const edges = [];
    const texts = new bergamot.VectorString();
    const options = new bergamot.VectorResponseOptions();
    let responses = null;
    try {
        input.forEach((text, i) => {
            const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
            if (!match || match[2] === "") return;
            positions.push(i);
            edges.push([match[1], match[3]]);
            texts.push_back(match[2]);
            options.push_back({ qualityScores: false, alignment: html, html });
        });
        if (positions.length === 0) return out;

        responses =
            models.length === 1
                ? service.translate(models[0], texts, options)
                : service.translateViaPivoting(
                      models[0],
                      models[1],
                      texts,
                      options,
                  );

        positions.forEach((position, k) => {
            out[position] =
                edges[k][0] +
                responses.get(k).getTranslatedText() +
                edges[k][1];
        });
        return out;
    } finally {
        texts.delete();
        options.delete();
        responses?.delete();
    }
}

let chain = Promise.resolve();

parentPort?.on("message", (message) => {
    chain = chain.then(async () => {
        try {
            const texts = await translate(message.texts, message.html);
            parentPort?.postMessage({ id: message.id, texts });
        } catch (error) {
            parentPort?.postMessage({
                id: message.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });
});

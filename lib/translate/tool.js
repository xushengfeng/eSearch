// @ts-check

const fs = require("node:fs");
const path = require("node:path");
const csv = require("csv-parse");
const { execSync } = require("node:child_process");

const rootDir = __dirname;

const args = process.argv;
const lang = args.includes("-l") ? args[args.indexOf("-l") + 1] : "";
const enableEn = args.includes("-e");
const inputFile = args.includes("-i") ? args[args.indexOf("-i") + 1] : "";
const uuid = args.includes("-u");
const pure = args.includes("-p");
const ai = args.includes("--ai") ? args[args.indexOf("--ai") + 1] : "";
const getAllStr = args.includes("--all");
const allStrFile = args.includes("--all")
    ? args[args.indexOf("--all") + 1]
    : "";
const getAllAllStr = args.includes("--auto-clean-trans");

const sourcePath = path.join(rootDir, "source.json");

console.log(
    `latestSrcId: ${execSync(`git log -n 1 --pretty=format:%h -- ${sourcePath}`)}`,
);

/**
 * @type {{[key:string]:{id:string,finishId:string[]}}}
 * @description id是某个语言翻译基于的source.json的commit id。
 * @description master与commit id的变化之间，只翻译了部分，为了让程序识别，添加翻译id到finishedid，变化全部翻译完后，可清空finishedid
 */
const srcCommit = {
    ar: { id: "b84865eb", finishId: [] }, // 阿拉伯语
    en: { id: "b84865eb", finishId: [] }, // 英语
    eo: { id: "b84865eb", finishId: [] }, // 世界语
    es: { id: "b84865eb", finishId: [] }, // 西班牙语
    fr: { id: "b84865eb", finishId: [] }, // 法语
    ru: { id: "b84865eb", finishId: [] }, // 俄语
    "zh-HANT": { id: "b84865eb", finishId: [] }, // 繁体中文
};

/**
 * @param {string} name
 */
function getFile(name) {
    const p = path.join(rootDir, name);
    return fs.readFileSync(p, "utf8").toString();
}

/**
 * @param {string} name
 * @returns {{[k:string]:string}}
 */
function getLan(name) {
    const l = JSON.parse(getFile(`${name}.json`));
    return l;
}

/**
 * @param {string} name
 * @param {string} data
 */
function setFile(name, data) {
    const p = path.join(rootDir, name);
    fs.writeFileSync(p, data);
    return p;
}

/**
 * @param {string} name
 * @param {object} data
 */
function setLanR(name, data) {
    setFile(name, `${JSON.stringify(data, null, 4)}\n`);
}
/**
 * @param {string} name
 * @param {object} data
 */
function setLan(name, data) {
    setLanR(`${name}.json`, data);
}

/**
 * @param {string} lang
 * @returns {{raw:string[],csv:string}}
 */
function getToTranslate(lang) {
    let l = {};
    try {
        l = getLan(lang);
    } catch (error) {
        console.log("\x1B[32m%s\x1B[0m", `+ ${lang}`);
    }
    let enLan = {};
    try {
        if (enableEn) {
            enLan = require(path.join(rootDir, "./en.json"));
            console.log(
                "\x1B[32m%s\x1B[0m",
                "with en, For more accuracy, please refer to the Chinese(column 2)",
            );
        }
    } catch (error) {}

    const t = [];
    /**@type {string[]} */
    const tt = [];

    const w = args.includes("-a");

    /**@param {string} i  */
    function addItem(i) {
        if (!enableEn)
            t.push(`"${source[i]}","${i}","${pure ? "" : l[source[i]] || ""}"`);
        else
            t.push(
                `"${source[i]}","${i}","${enLan[source[i]] || ""}","${pure ? "" : l[source[i]] || ""}"`,
            );
        tt.push(i);
    }

    if (!w) {
        const commit = srcCommit[lang];
        const diff = commit
            ? execSync(`git diff ${commit.id} master ${sourcePath}`).toString()
            : "";
        const lastDiff = `${diff.match(/-.+"$/m)?.[0]?.replace("-", "+")},`;
        const diffId = diff
            .split("\n")
            .filter((x) => x.startsWith("+ ") && x !== lastDiff)
            .map((x) => x.replace(/.+: "(.+)",?/, "$1"));
        for (const i in source) {
            if (
                (!l[source[i]] || diffId.includes(source[i])) &&
                !(commit?.finishId || []).includes(source[i])
            )
                addItem(i);
        }
    } else {
        for (const i in source) {
            addItem(i);
        }
    }

    const csv = t.join("\n");
    return { raw: tt, csv };
}

/**
 * @type {{[k:string]:string}}
 */
const source = JSON.parse(getFile("source.json"));

if (lang) {
    const csv = getToTranslate(lang).csv;

    const csvFilePath = setFile(`./${lang}.csv`, csv);

    console.log(csvFilePath);
}

if (inputFile) {
    const lang = inputFile.replace(".csv", "");
    const input = getFile(inputFile);
    let l = {};
    try {
        l = getLan(lang);
    } catch (error) {
        console.log("\x1B[32m%s\x1B[0m", `+ ${lang}`);
    }
    csv.parse(input, (_err, t) => {
        const out = {};
        for (const i in source) {
            const id = source[i];
            out[id] = l[id] || "";
        }
        for (const i of t) {
            out[i[0]] = i.at(-1);
        }
        setLan(lang, out);
    });
}

if (uuid) {
    const ids = Object.values(source);
    for (const i in source) {
        if (source[i]) continue;
        const id = crypto.randomUUID().slice(0, 6);
        if (!ids.includes(id)) {
            source[i] = id;
            ids.push(id);
        }
    }
    setLanR("source.json", source);
}

function runAi(ai) {
    const tt = getToTranslate(ai).raw;
    if (!process.env.gpt)
        throw new Error("Please set GPT_TOKEN: export gpt=sk-");
    if (tt.length > 0)
        fetch("https://api.chatanywhere.tech/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.gpt}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                stream: false,
                messages: [
                    {
                        role: "system",
                        content:
                            "你将翻译提供的JSON，不需要任何解释，$1,$2等用于变量占位，请保留",
                    },
                    {
                        role: "user",
                        content: `把下面这些JSON翻译成 en\n${JSON.stringify(["hello", "bye"])}`,
                    },
                    {
                        role: "assistant",
                        content: `${JSON.stringify(["你好", "再见"])}`,
                    },
                    {
                        role: "user",
                        content: `把下面这些JSON翻译成 ${ai}\n${JSON.stringify(tt)}`,
                    },
                ],
            }),
        })
            .then((res) => res.json())
            .then((data) => {
                const x = JSON.parse(data.choices[0].message.content);
                const v = {};
                const logTable = {};
                for (const i in x) {
                    const zh = tt[i];
                    if (!source[zh]) {
                        console.log(`no ${zh}`);
                        continue;
                    }
                    v[source[zh]] = x[i];
                    logTable[zh] = x[i];
                }

                console.log(ai);
                console.table(logTable);

                let l = {};
                try {
                    l = getLan(ai);
                } catch (error) {
                    console.log("\x1B[32m%s\x1B[0m", `+ ${ai}`);
                }

                const out = {};
                for (const i in source) {
                    const id = source[i];
                    out[id] = v[id] || l[id] || "";
                }
                setLan(ai, out);
            });
}

if (ai) {
    if (ai === "all") {
        for (const l of Object.keys(srcCommit)) {
            runAi(l);
        }
    } else {
        runAi(ai);
    }
}

/**
 *
 * @param {string} dir
 * @param {(f:string)=>void} callback
 */
function traverseDirectorySync(dir, callback) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            traverseDirectorySync(filePath, callback);
        } else if (stats.isFile()) {
            callback(filePath);
        }
    }
}
const STRING_REGEX = /(['"])(?:(?!\1).|\\.)*\1/g;

function extractStringsFromCode(code) {
    const strings = [];
    let match;

    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    while ((match = STRING_REGEX.exec(code)) !== null) {
        const t = match[0].slice(1, -1);
        if (
            t.match(/[a-z]/) ||
            t.match(/^[A-Z ]*$/) ||
            t.match(/[0-9]/) ||
            t.includes(".") ||
            t.startsWith("#")
        )
            continue;
        if (t.trim() === "") continue;
        const v = t.endsWith("：") ? t.slice(0, -1) : t;
        strings.push(v);
    }

    return strings;
}

function extractStringsFromFile(filePath) {
    const code = fs.readFileSync(filePath, "utf-8");
    return extractStringsFromCode(code);
}

if (getAllStr) {
    const l = [];
    traverseDirectorySync(path.join(rootDir, "../../src"), (f) => {
        if (allStrFile ? f.endsWith(allStrFile) : f.endsWith(".ts")) {
            l.push(f);
        }
    });
    console.log(l);
    const strs2files = new Map();
    const strs = new Set();
    for (const f of l) {
        const x = extractStringsFromFile(f);
        for (const v of x) {
            const files = strs2files.get(v) || new Set();
            files.add(path.basename(f));
            strs2files.set(v, files);
            strs.add(v);
        }
    }
    const keys = new Set(Object.keys(source));
    // @ts-ignore
    const unAdd = Array.from(strs.difference(keys));
    if (!allStrFile)
        console.log(
            unAdd
                .map(
                    (i) =>
                        `${i}    ${Array.from(strs2files.get(i)).join(", ")}`,
                )
                .join("\n"),
        );
    else console.log(unAdd.map((i) => `"${i}":"",`).join("\n"));
}

if (getAllAllStr) {
    const l = [];
    traverseDirectorySync(path.join(rootDir, "../../src"), (f) => {
        l.push(f);
    });
    console.log(l);
    const keys = new Set(Object.keys(source));
    const hasKeys = new Set();

    for (const f of l) {
        const code = fs.readFileSync(f, "utf-8");
        for (const k of keys) {
            if (code.includes(k)) hasKeys.add(k);
        }
    }
    // @ts-ignore
    const unUse = keys.difference(hasKeys);
    for (const k of ["识屏 · 搜索"]) {
        unUse.delete(k);
    }
    const o = {};
    for (const k in source) {
        if (unUse.has(k)) continue;
        o[k] = source[k];
    }
    setLanR("./source.json", o);
}

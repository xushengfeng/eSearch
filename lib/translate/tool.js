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

const source = require(path.join(rootDir, "./source.json"));

console.log(
    `latestSrcId: ${execSync("git log -n 1 --pretty=format:%h -- source.json")}`,
);

/**
 * @type {{[key:string]:{id:string,finishId:string[]}}}
 * @description id是某个语言翻译基于的source.json的commit id。
 * @description master与commit id的变化之间，只翻译了部分，为了让程序识别，添加翻译id到finishedid，变化全部翻译完后，可清空finishedid
 */
const srcCommit = {
    ar: { id: "31dfaec2", finishId: [] }, // 阿拉伯语
    en: { id: "31dfaec2", finishId: [] }, // 英语
    eo: { id: "31dfaec2", finishId: [] }, // 世界语
    es: { id: "31dfaec2", finishId: [] }, // 西班牙语
    fr: { id: "31dfaec2", finishId: [] }, // 法语
    ru: { id: "31dfaec2", finishId: [] }, // 俄语
    "zh-HANT": { id: "31dfaec2", finishId: [] }, // 繁体中文
};

/**
 * @param {string} lang
 * @returns {{raw:string[],csv:string}}
 */
function getToTranslate(lang) {
    let l = {};
    try {
        l = require(path.join(rootDir, `./${lang}.json`));
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
            ? execSync(`git diff ${commit.id} master source.json`).toString()
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

if (lang) {
    const csv = getToTranslate(lang).csv;

    const csvFilePath = path.join(rootDir, `./${lang}.csv`);

    fs.writeFileSync(csvFilePath, csv);

    console.log(csvFilePath);
}

if (inputFile) {
    const lang = inputFile.replace(".csv", "");
    const input = fs.readFileSync(inputFile, "utf8");
    let l = {};
    try {
        l = require(path.join(rootDir, `./${lang}.json`));
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
        fs.writeFileSync(`${lang}.json`, `${JSON.stringify(out, null, 4)}\n`);
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
    fs.writeFileSync("source.json", `${JSON.stringify(source, null, 4)}\n`);
}

if (ai) {
    const tt = getToTranslate(ai).raw;
    console.log(tt);
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
                        content: "你将翻译提供的JSON，不需要任何解释",
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
                console.log(data.choices[0].message);
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

                console.table(logTable);

                let l = {};
                try {
                    l = require(path.join(rootDir, `./${ai}.json`));
                } catch (error) {
                    console.log("\x1B[32m%s\x1B[0m", `+ ${ai}`);
                }

                const out = {};
                for (const i in source) {
                    const id = source[i];
                    out[id] = v[id] || l[id] || "";
                }
                fs.writeFileSync(
                    `${ai}.json`,
                    `${JSON.stringify(out, null, 4)}\n`,
                );
            });
}

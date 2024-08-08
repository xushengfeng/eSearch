const fs = require("fs");
const path = require("path");
const csv = require("csv-parse");
const { execSync } = require("child_process");

let rootDir = __dirname;

const args = process.argv;
const lang = args.includes("-l") ? args[args.indexOf("-l") + 1] : "";
const enableEn = args.includes("-e");
const inputFile = args.includes("-i") ? args[args.indexOf("-i") + 1] : "";
const uuid = args.includes("-u");

let source = require(path.join(rootDir, "./source.json"));

console.log(`latestSrcId: ${execSync("git log -n 1 --pretty=format:%h -- source.json")}`);

/**
 * @type {{[key:string]:{id:string,finishId:string[]}}}
 * @description id是某个语言翻译基于的source.json的commit id。
 * @description master与commit id的变化之间，只翻译了部分，为了让程序识别，添加翻译id到finishedid，变化全部翻译完后，可清空finishedid
 */
const srcCommit = {
    ar: { id: "1a21eafd", finishId: [] },
    en: { id: "1a21eafd", finishId: [] },
    eo: { id: "1a21eafd", finishId: [] },
    es: { id: "1a21eafd", finishId: [] },
    fr: { id: "1a21eafd", finishId: [] },
    ru: { id: "1a21eafd", finishId: [] },
    "zh-HANT": { id: "1a21eafd", finishId: [] },
};

if (lang) {
    let l = {};
    try {
        l = require(path.join(rootDir, `./${lang}.json`));
    } catch (error) {
        console.log("\x1B[32m%s\x1B[0m", `+ ${lang}`);
    }
    let enLan = {};
    try {
        if (enableEn) {
            enLan = require(path.join(rootDir, `./en.json`));
            console.log("\x1B[32m%s\x1B[0m", `with en, For more accuracy, please refer to the Chinese(column 2)`);
        }
    } catch (error) {}

    const t = [];

    const w = args.includes("-a");

    function addItem(i) {
        if (!enableEn) t.push(`"${source[i]}","${i}","${l[source[i]] || ""}"`);
        else t.push(`"${source[i]}","${i}","${enLan[source[i]] || ""}","${l[source[i]] || ""}"`);
    }

    if (!w) {
        const commit = srcCommit[lang];
        const diff = commit ? execSync(`git diff ${commit.id} master source.json`).toString() : "";
        let lastDiff = diff.match(/-.+"$/m)?.[0]?.replace("-", "+") + ",";
        const diffId = diff
            .split("\n")
            .filter((x) => x.startsWith("+ ") && x != lastDiff)
            .map((x) => x.replace(/.+: "(.+)",?/, "$1"));
        for (let i in source) {
            if ((!l[source[i]] || diffId.includes(source[i])) && !(commit?.finishId || []).includes(source[i]))
                addItem(i);
        }
    } else {
        for (let i in source) {
            addItem(i);
        }
    }

    const csv = t.join("\n");

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
        let out = {};
        for (let i in source) {
            const id = source[i];
            out[id] = l[id] || "";
        }
        for (let i of t) {
            out[i[0]] = i.at(-1);
        }
        fs.writeFileSync(`${lang}.json`, JSON.stringify(out, null, 4) + "\n");
    });
}

if (uuid) {
    const ids = Object.values(source);
    for (let i in source) {
        if (source[i]) continue;
        const id = crypto.randomUUID().slice(0, 6);
        if (!ids.includes(id)) {
            source[i] = id;
            ids.push(id);
        }
    }
    fs.writeFileSync(`source.json`, JSON.stringify(source, null, 4) + "\n");
}

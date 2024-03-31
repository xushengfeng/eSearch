const fs = require("fs");
const path = require("path");
const csv = require("csv-parse");
const { execSync } = require("child_process");

let rootDir = __dirname;

const args = process.argv;
const lang = args.includes("-l") ? args[args.indexOf("-l") + 1] : "";
const inputFile = args.includes("-i") ? args[args.indexOf("-i") + 1] : "";
const uuid = args.includes("-u");

let source = require(path.join(rootDir, "./source.json"));

/**
 * @type {{[key:string]:{id:string,finishId:string[]}}}
 */
const srcCommit = {
    ar: { id: "9911bdc3", finishId: [] },
    en: { id: "9911bdc3", finishId: [] },
    eo: { id: "9911bdc3", finishId: [] },
    es: { id: "9911bdc3", finishId: [] },
    fr: { id: "9911bdc3", finishId: [] },
    ru: { id: "9911bdc3", finishId: [] },
    "zh-HANT": { id: "9911bdc3", finishId: [] },
};

if (lang) {
    let l = {};
    try {
        l = require(path.join(rootDir, `./${lang}.json`));
    } catch (error) {
        console.log("\x1B[32m%s\x1B[0m", `+ ${lang}`);
    }

    const t = [];

    const w = args.includes("-a");

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
                t.push(`"${source[i]}","${i}","${l[source[i]] || ""}"`);
        }
    } else {
        for (let i in source) {
            t.push(`"${source[i]}","${i}","${l[source[i]] || ""}"`);
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
            out[i[0]] = i[2];
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

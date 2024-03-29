const fs = require("fs");
const path = require("path");
const csv = require("csv-parse");

let rootDir = __dirname;

const args = process.argv;
const lang = args.includes("-l") ? args[args.indexOf("-l") + 1] : "";
const inputFile = args.includes("-i") ? args[args.indexOf("-i") + 1] : "";

let source = require(path.join(rootDir, "./source.json"));

if (lang) {
    const lans = ["ar", "en", "eo", "es", "fr", "ru", "zh-HANT"];

    if (!lans.includes(lang)) {
        console.warn(`-l ${lans.join(" | ")}`);
        return;
    }

    let l = require(path.join(rootDir, `./${lang}.json`));

    const t = [];

    for (let i in source) {
        t.push(`"${source[i]}","${i}","${l[source[i]] || ""}"`);
    }

    const csv = t.join("\n");

    const csvFilePath = path.join(rootDir, `./${lang}.csv`);

    fs.writeFileSync(csvFilePath, csv);
}

if (inputFile) {
    const lang = inputFile.replace(".csv", "");
    const input = fs.readFileSync(inputFile, "utf8");
    console.log(input);
    csv.parse(input, (_err, t) => {
        console.log(t);
        let out = {};
        for (let i of t) {
            out[i[0]] = i[2];
        }
        fs.writeFileSync(`${lang}.json`, JSON.stringify(out, null, 4) + "\n");
    });
}

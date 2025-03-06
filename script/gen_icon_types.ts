const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");

const assetsPath = path.join(
    __dirname,
    "..",
    "src",
    "renderer",
    "assets",
    "icons",
);
const typesPath = path.join(__dirname, "..", "src", "iconTypes.d.ts");

console.log(assetsPath);

const iconTypes = fs
    .readdirSync(assetsPath, { withFileTypes: true })
    .filter((dirent) => !dirent.isDirectory())
    .map((dirent) => dirent.name);

const content = `export type RawIconType = ${iconTypes.map((name) => `"${name}"`).join(" | ")};\n`;

const content2 = `export type IconType = ${iconTypes.map((name) => `"${name.replace(/\.svg$/, "")}"`).join(" | ")};\n`;

fs.writeFileSync(typesPath, `${content}\n${content2}`);

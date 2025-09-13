const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");
// biome-ignore format:
const { execSync } = require("node:child_process") as typeof import("child_process");

if (!__dirname.endsWith("make_aur")) {
    console.log("dir need in make_aur");
    process.exit();
}

const projectRoot = path.join(__dirname, "..", "..");

const assetsPath = path.join(projectRoot, "assets", "logo");

const iconList = ["16", "32", "48", "64", "128", "256", "512", "1024"];

for (const size of iconList) {
    const from = path.join(assetsPath, `${size}x${size}.png`);
    const toDir = path.join(
        __dirname,
        "e-search",
        "usr",
        "share",
        "icons",
        "hicolor",
        `${size}x${size}`,
        "apps",
    );
    if (!fs.existsSync(toDir)) {
        fs.mkdirSync(toDir, { recursive: true });
    }
    const to = path.join(toDir, "esearch.png");
    fs.copyFileSync(from, to);
    console.log(`Copied ${from} to ${to}`);
}

execSync("pnpm run pack", { stdio: "inherit" });

console.log("Pack done");

const binTarget = path.join(
    __dirname,
    "e-search",
    "usr",
    "lib",
    "e-search",
    "app",
);
try {
    fs.rmSync(binTarget, { recursive: true });
} catch {}

fs.cpSync(
    path.join(projectRoot, "build", "linux-unpacked", "resources", "app"),
    binTarget,
    { recursive: true },
);

fs.cpSync(
    path.join(projectRoot, "assets", "e-search.desktop"),
    path.join(
        __dirname,
        "e-search",
        "usr",
        "share",
        "applications",
        "e-search.desktop",
    ),
);

const packageJSON = JSON.parse(
    fs
        .readFileSync(path.join(__dirname, "..", "..", "package.json"))
        .toString(),
);

execSync(`tar -czvf eSearch_${packageJSON.version}.aur e-search`, {
    stdio: "inherit",
    cwd: __dirname,
});

execSync(`sha512sum eSearch_${packageJSON.version}.aur`, {
    stdio: "inherit",
});

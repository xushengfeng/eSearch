// @ts-check
const fs = require("node:fs");
const path = require("node:path");
const archiver = require("archiver");
const { execSync } = require("node:child_process");
const download = require("download");

const arch =
    (process.env.npm_config_arch || process.env.M_ARCH || process.arch) ===
    "arm64"
        ? "arm64"
        : "x64";

const platform = process.platform;
const platformMap = { linux: "linux", win32: "win", darwin: "mac" };
/**
 * @type {"linux"|"win"|"mac"}
 */
const platform2 = platformMap[platform];

const beforePack = async () => {
    if (!fs.existsSync("./ocr/ppocr/默认")) {
        fs.mkdirSync("./ocr/ppocr/默认", { recursive: true });
        await download(
            "https://github.com/xushengfeng/eSearch-OCR/releases/download/4.0.0/ch.zip",
            "./ocr/ppocr/默认/",
            {
                extract: true,
                rejectUnauthorized: false,
            },
        );
    }
    if (!fs.existsSync("./assets/onnx/seg")) {
        fs.mkdirSync("./assets/onnx/seg", { recursive: true });
        await download(
            "https://github.com/xushengfeng/eSearch-seg/releases/download/1.0.0/seg.onnx",
            "./assets/onnx/seg/",
            { rejectUnauthorized: false },
        );
    }
    if (!fs.existsSync("./assets/onnx/inpaint")) {
        fs.mkdirSync("./assets/onnx/inpaint", { recursive: true });
        await download(
            "https://github.com/xushengfeng/eSearch/releases/download/13.1.6/migan_pipeline_v2.onnx",
            "./assets/onnx/inpaint/",
            { rejectUnauthorized: false },
        );
    }
    if (process.platform === "win32" && !fs.existsSync("./lib/win_rect.exe")) {
        fs.writeFileSync(
            "./lib/win_rect.exe",
            await download(
                "https://github.com/xushengfeng/win_rect/releases/download/0.1.0/win_rect.exe",
                {
                    rejectUnauthorized: false,
                },
            ),
        );
    }
    if (process.platform === "win32" && !fs.existsSync("./lib/copy.exe")) {
        fs.writeFileSync(
            "./lib/copy.exe",
            await download(
                "https://github.com/xushengfeng/ctrlc/releases/download/0.1.0/copy.exe",
                {
                    rejectUnauthorized: false,
                },
            ),
        );
    }
    if (!fs.existsSync("./lib/ffmpeg")) {
        const winpath = "ffmpeg-n6.1-latest-win64-gpl-6.1";
        const o = {
            win32: {
                x64: "https://github.com/xushengfeng/eSearch/releases/download/13.0.0-beta.1/ffmpeg-win32-x64.zip",
            },
            darwin: {
                x64: "https://github.com/xushengfeng/eSearch/releases/download/13.0.0-beta.1/ffmpeg-darwin-x64.zip",
                arm64: "https://github.com/xushengfeng/eSearch/releases/download/13.0.0-beta.1/ffmpeg-darwin-arm64.zip",
            },
        };
        if (o?.[process.platform]?.[arch]) {
            fs.mkdirSync("./lib/ffmpeg");
            await download(o[process.platform][process.arch], "./lib/ffmpeg/", {
                extract: true,
                rejectUnauthorized: false,
            });
            if (process.platform === "win32") {
                fs.copyFileSync(
                    path.join("./lib/ffmpeg/", winpath, "bin", "ffmpeg.exe"),
                    path.join("./lib/ffmpeg/", "ffmpeg.exe"),
                );
                fs.rmSync(path.join("./lib/ffmpeg/", winpath), {
                    recursive: true,
                });
            }
        }
    }
    // 指定arch pnpm似乎不支持，手动安装和剔除
    if ((platform === "win32" || platform === "darwin") && arch === "arm64") {
        execSync("pnpm add node-screenshots --force");
        const list = [
            "darwin-arm64",
            "darwin-x64",
            "darwin-universal",
            "linux-x64-gnu",
            "linux-x64-musl",
            "win32-ia32-msvc",
            "win32-x64-msvc",
            "win32-arm64-msvc",
        ];
        let rmList = [];
        if (platform === "win32") {
            rmList = list.filter((i) => !i.startsWith("win32"));
            rmList.push("win32-ia32-msvc", "win32-x64-msvc");
        }
        if (platform === "darwin") {
            rmList = list.filter((i) => !i.startsWith("darwin"));
            rmList.push("darwin-x64");
        }
        console.log(`移除${rmList.join(", ")}`);
        for (const i of rmList) {
            try {
                execSync(`pnpm uninstall node-screenshots-${i}`);
            } catch (error) {}
        }
    }
};

/**
 * @type import("electron-builder").Configuration
 */
const build = {
    appId: "com.esearch.app",
    executableName: "e-search",
    directories: {
        output: "build",
    },
    icon: "./assets/logo",
    electronDownload: {
        mirror: "https://npmmirror.com/mirrors/electron/",
    },
    npmRebuild: false,
    fileAssociations: [
        {
            ext: "svg",
            mimeType: "image/svg+xml",
            role: "Editor",
        },
        {
            ext: "png",
            mimeType: "image/png",
            role: "Editor",
        },
        {
            ext: "jpg",
            mimeType: "image/jpeg",
            role: "Editor",
        },
    ],
    asar: false,
    artifactName: `\${productName}-\${version}-\${platform}-${arch}.\${ext}`,
    beforePack: beforePack,
    linux: {
        category: "Utility",
        target: [
            { target: "tar.gz", arch },
            { target: "deb", arch },
            { target: "rpm", arch },
            { target: "AppImage", arch },
        ],
        files: [
            "!assets/logo/icon.icns",
            "!assets/logo/icon.ico",
            "!node_modules/onnxruntime-node/bin/napi-v3/win32",
            "!node_modules/onnxruntime-node/bin/napi-v3/darwin",
        ],
    },
    deb: {
        depends: ["ffmpeg"],
    },
    rpm: {
        depends: ["ffmpeg-free"],
    },
    mac: {
        files: [
            "!lib/gtk-open-with",
            "!lib/kde-open-with",
            "!assets/logo/1024x1024.png",
            "!assets/logo/512x512.png",
            "!assets/logo/icon.ico",
            "!node_modules/onnxruntime-node/bin/napi-v3/win32",
            "!node_modules/onnxruntime-node/bin/napi-v3/linux",
        ],
        target: [
            {
                target: "dmg",
                arch: arch,
            },
            {
                target: "zip",
                arch: arch,
            },
        ],
    },
    dmg: {
        writeUpdateInfo: false,
    },
    win: {
        icon: "./assets/logo/icon.ico",
        target: [
            {
                target: "nsis",
                arch: arch,
            },
            {
                target: "zip",
                arch: arch,
            },
        ],
        files: [
            "!lib/gtk-open-with",
            "!lib/kde-open-with",
            "!assets/logo/icon.icns",
            "!assets/logo/1024x1024.png",
            "!assets/logo/512x512.png",
            "!node_modules/onnxruntime-node/bin/napi-v3/linux",
            "!node_modules/onnxruntime-node/bin/napi-v3/darwin",
        ],
    },
    nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        differentialPackage: false,
    },
    afterPack: async (c) => {
        const localsPath = path.join(c.appOutDir, "locales");
        const suportLan = fs
            .readdirSync(path.join(__dirname, "lib/translate"))
            .filter((file) => {
                return (
                    file.endsWith(".json") &&
                    !file.startsWith("source") &&
                    !file.startsWith(".")
                );
            })
            .map((i) => i.replace(".json", ""))
            .concat("zh-HANS")
            .map((i) => i.split("-")[0]);
        if (process.platform !== "darwin")
            try {
                const files = fs
                    .readdirSync(localsPath)
                    .filter(
                        (i) =>
                            !suportLan.includes(
                                i.replace(".pak", "").split("-")[0],
                            ),
                    );
                for (const i of files) {
                    fs.rmSync(path.join(localsPath, i));
                }
                console.log("移除原生语言包");
            } catch (error) {
                console.log(error);
            }

        const appPath = path.join(
            c.appOutDir,
            process.platform === "darwin"
                ? "e-search.app/Contents/Resources/app"
                : "resources/app",
        );

        const appDir = path.join(c.outDir, "app");
        fs.cpSync(appPath, appDir, { recursive: true });
        const ignoreDir = ["node_modules/onnxruntime-node", "ocr"];
        for (const i of ignoreDir) {
            fs.rmSync(path.join(appDir, i), { recursive: true });
        }

        const outputFilePath = path.join(
            c.outDir,
            `app-${process.platform}-${arch}`,
        );

        const output = fs.createWriteStream(outputFilePath);
        const archive = archiver("zip", {
            zlib: { level: 9 },
        });

        archive.pipe(output);
        archive.directory(appDir, "app");
        archive.finalize();

        return new Promise((rj) => {
            output.on("close", () => {
                console.log("生成核心包");
                rj(true);
            });
        });
    },
};

const archFilter = arch === "arm64" ? "x64" : "arm64";
const otherPlatform = Object.keys(platformMap).filter((i) => i !== platform);

/** @type {string[]|undefined} */
// @ts-ignore
const files = build[platform2]?.files;

// 移除 onnxruntime-node/bin/napi-v3/
files?.push(
    `!node_modules/onnxruntime-node/bin/napi-v3/${platform}/${archFilter}`,
);

// 移除 uiohook-napi/prebuilds
for (const i of otherPlatform) {
    files?.push(`!node_modules/uiohook-napi/prebuilds/${i}-arm64`);
    files?.push(`!node_modules/uiohook-napi/prebuilds/${i}-x64`);
}
files?.push(`!node_modules/uiohook-napi/prebuilds/${platform}-${archFilter}`);

const ignoreDir = [
    ".*",
    "tsconfig*",
    "*.md",
    "*.js",
    "*.yaml",
    "**/*.map",
    "**/*.ts",
    "src",
    "docs",
    "node_modules/**/*.flow",
    "node_modules/**/*.md",
    "node_modules/**/*.h", // uiohook
    "node_modules/**/*.c", // uiohook
    "node_modules/**/demo*", // js-clipper
    "node_modules/js-clipper/vendor",
    "node_modules/onnxruntime-node/script",
    "node_modules/**/**esm**",
    "node_modules/**/*.es*",
    "node_modules/esearch-ocr/dist/esearch-ocr.js",
];
const ignoreModule = [
    "qr-scanner-wechat",
    "tar",
    "sortablejs",
    "hotkeys-js",
    "hex-to-css-filter",
    "dkh-ui",
    "xtranslator",
    "fabric",
    "jsdom",
    "canvas",
];
for (const i of ignoreModule) {
    ignoreDir.push(`node_modules/${i}`);
}
for (let i of ignoreDir) {
    i = `!${i}`;
    files?.push(i);
}

module.exports = build;

/**
 * @type {Record<string,Record<string,string[]>>}
 */
const release = {
    win32: { gh: ["exe", "zip"], arch: ["x64", "arm64"] },
    linux: { gh: ["AppImage", "deb", "rpm", "tar.gz"], arch: ["x64", "arm64"] },
    darwin: { gh: ["dmg", "zip"], arch: ["x64", "arm64"] },
};

/**
 *
 * @param {string} url
 */
function getUrl(url) {
    let t = "| | Windows | macOS | Linux|\n| --- | --- | --- | --- |\n";
    for (const arch of ["x64", "arm64"]) {
        t += `|${arch}| `;
        for (const p of ["win32", "darwin", "linux"]) {
            if (!release[p].arch.includes(arch)) continue;
            t += `${(release[p].gh || []).map((i) => `[${i}](${url.replace("$arch", arch).replace("$p", p).replace("$h", i)})`).join(" ")}|`;
        }
        t += "\n";
    }
    return t;
}

console.log(
    getUrl(
        "https://github.com/xushengfeng/eSearch/releases/download/1.12.3/eSearch-1.12.3-$p-$arch.$h",
    ),
);

console.log(
    getUrl(
        "https://mirror.ghproxy.com/https://github.com/xushengfeng/eSearch/releases/download/1.12.3/eSearch-1.12.3-$p-$arch.$h",
    ),
);

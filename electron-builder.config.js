// @ts-check
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const yauzl = require("yauzl");

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * @param {string} url
 */
async function downloadBuffer(url) {
    console.log(url);
    const b = await (await fetch(url)).arrayBuffer();
    return Buffer.from(b);
}
/**
 * @param {string} url
 * @param {string} targetDir
 */
async function download(url, targetDir) {
    const b = await downloadBuffer(url);
    ensureDir(targetDir);
    const fileName = url.split("/").at(-1);
    if (fileName) fs.writeFileSync(path.join(targetDir, fileName), b);
}
/**
 * @param {string} url
 * @param {string} targetDir
 */
async function downloadUnzip(url, targetDir) {
    const b = await downloadBuffer(url);
    ensureDir(targetDir);
    const fileName = url.split("/").at(-1);
    return new Promise((resolve, reject) => {
        yauzl.fromBuffer(b, { lazyEntries: true }, (err, zipfile) => {
            if (err) throw err;
            zipfile.readEntry();
            console.log(`开始解压 ${fileName} 到 ${targetDir}`);
            zipfile.on("entry", (entry) => {
                const filePath = path.join(targetDir, entry.fileName);
                if (/\/$/.test(entry.fileName)) {
                    ensureDir(filePath);
                    zipfile.readEntry();
                } else {
                    zipfile.openReadStream(entry, (err, readStream) => {
                        if (err) throw err;
                        ensureDir(path.dirname(filePath));
                        const writeStream = fs.createWriteStream(filePath);
                        readStream.pipe(writeStream);
                        writeStream.on("finish", () => {
                            zipfile.readEntry();
                        });
                    });
                }
            });
            zipfile.on("end", () => {
                zipfile.close();
                resolve(true);
            });
        });
    });
}

/**
 * @param {string} dir
 */
function checkPath(dir) {
    return (
        fs.existsSync(dir) &&
        (fs.statSync(dir).isFile() ||
            (fs.statSync(dir).isDirectory() && fs.readdirSync(dir).length > 0))
    );
}

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

// const githubUrl = "https://gh-proxy.com/https://github.com" || true;
const githubUrl = "https://github.com";

const beforePack = async () => {
    if (!checkPath("./assets/onnx/ppocr")) {
        ensureDir("./assets/onnx/ppocr");
        await downloadUnzip(
            `${githubUrl}/xushengfeng/eSearch-OCR/releases/download/4.0.0/ch.zip`,
            "./assets/onnx/ppocr/",
        );
    }
    if (!checkPath("./assets/onnx/ppocr/doc_cls.onnx")) {
        await download(
            `${githubUrl}/xushengfeng/eSearch-OCR/releases/download/8.1.0/doc_cls.onnx`,
            "./assets/onnx/ppocr/",
        );
    }
    if (!checkPath("./assets/onnx/seg")) {
        ensureDir("./assets/onnx/seg");
        await download(
            `${githubUrl}/xushengfeng/eSearch-seg/releases/download/1.0.0/seg.onnx`,
            "./assets/onnx/seg/",
        );
    }
    if (!checkPath("./assets/onnx/inpaint")) {
        ensureDir("./assets/onnx/inpaint");
        await download(
            `${githubUrl}/xushengfeng/eSearch/releases/download/13.1.6/migan_pipeline_v2.onnx`,
            "./assets/onnx/inpaint/",
        );
    }
    if (process.platform === "win32" && !checkPath("./lib/copy.exe")) {
        fs.writeFileSync(
            "./lib/copy.exe",
            await downloadBuffer(
                `${githubUrl}/xushengfeng/ctrlc/releases/download/0.1.0/copy.exe`,
            ),
        );
    }
    if (!checkPath("./lib/ffmpeg")) {
        const winpath = "ffmpeg-n6.1-latest-win64-gpl-6.1";
        const o = {
            win32: {
                x64: `${githubUrl}/xushengfeng/eSearch/releases/download/13.0.0-beta.1/ffmpeg-win32-x64.zip`,
            },
            darwin: {
                x64: `${githubUrl}/xushengfeng/eSearch/releases/download/13.0.0-beta.1/ffmpeg-darwin-x64.zip`,
                arm64: `${githubUrl}/xushengfeng/eSearch/releases/download/13.0.0-beta.1/ffmpeg-darwin-arm64.zip`,
            },
        };
        if (o?.[process.platform]?.[arch]) {
            ensureDir("./lib/ffmpeg");
            await downloadUnzip(
                o[process.platform][process.arch],
                "./lib/ffmpeg/",
            );
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
    "hotkeys-js",
    "hex-to-css-filter",
    "dkh-ui",
    "xtranslator",
    "fabric",
    "jsdom",
    "canvas",
    "remarkable",
    "autolinker",
    "chroma-js",
    "parse5",
    "source-map",
    "acorn",
    "cssstyle",
    "psl",
    "js-clipper",
    "iso-639-3-to-1",
    "fuse.js",
    "iconv-lite",
    "esprima",
    "decimal.js",
    "@xushengfeng/fasttext_wasm",
    "tar-fs",
    "node-abi",
    "tr46",
    "argparse",
];
for (const i of ignoreModule) {
    ignoreDir.push(`node_modules/${i}`);
}
for (let i of ignoreDir) {
    i = `!${i}`;
    files?.push(i);
}

module.exports = build;

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { execSync } = require("child_process");
const download = require("download");

const arch =
    (process.env["npm_config_arch"] || process.env["M_ARCH"] || process.arch) === "arm64" ? ["arm64"] : ["x64"];

const platform = process.platform;
const platformMap = { linux: "linux", win32: "win", darwin: "mac" };
/**
 * @type {"linux"|"win"|"mac"}
 */
const platform2 = platformMap[platform];

const beforePack = async function () {
    if (!fs.existsSync("./ocr/ppocr/默认")) {
        fs.mkdirSync("./ocr/ppocr/默认", { recursive: true });
        await download(
            "https://github.com/xushengfeng/eSearch-OCR/releases/download/4.0.0/ch.zip",
            "./ocr/ppocr/默认/",
            {
                extract: true,
                rejectUnauthorized: false,
            }
        );
    }
    if (!fs.existsSync("./assets/onnx/seg")) {
        fs.mkdirSync("./assets/onnx/seg", { recursive: true });
        await download(
            "https://github.com/xushengfeng/eSearch-seg/releases/download/1.0.0/seg.onnx",
            "./assets/onnx/seg/",
            { rejectUnauthorized: false }
        );
    }
    if (process.platform === "win32" && !fs.existsSync("./lib/win_rect.exe")) {
        fs.writeFileSync(
            "./lib/win_rect.exe",
            await download("https://github.com/xushengfeng/win_rect/releases/download/0.1.0/win_rect.exe", {
                rejectUnauthorized: false,
            })
        );
    }
    if (process.platform === "win32" && !fs.existsSync("./lib/copy.exe")) {
        fs.writeFileSync(
            "./lib/copy.exe",
            await download("https://github.com/xushengfeng/ctrlc/releases/download/0.1.0/copy.exe", {
                rejectUnauthorized: false,
            })
        );
    }
    if (!fs.existsSync("./lib/ffmpeg")) {
        const winpath = "ffmpeg-n6.1-latest-win64-gpl-6.1";
        let o = {
            win32: {
                x64: `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${winpath}.zip`,
            },
            darwin: {
                x64: "https://evermeet.cx/ffmpeg/ffmpeg-6.0.zip",
                arm64: "https://www.osxexperts.net/ffmpeg6arm.zip",
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
                    path.join("./lib/ffmpeg/", "ffmpeg.exe")
                );
                fs.rmSync(path.join("./lib/ffmpeg/", winpath), { recursive: true });
            }
        }
    }
    if (process.platform === "win32" && arch === "arm64") {
        execSync("npm i node-screenshots-win32-arm64-msvc");
        execSync("npm uninstall node-screenshots-win32-x64-msvc");
    }
    if (process.platform === "darwin" && arch === "arm64") {
        execSync("npm i node-screenshots-darwin-arm64");
        execSync("npm uninstall node-screenshots-darwin-x64");
    }
};

/**
 * @type import("electron-builder").Configuration
 */
let build = {
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
    artifactName: "${productName}-${version}-${platform}-" + arch[0] + ".${ext}",
    beforePack: beforePack,
    linux: {
        category: "Utility",
        target: ["tar.gz", "deb", "rpm", "AppImage"],
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
        if (process.platform != "darwin")
            try {
                const files = fs.readdirSync(localsPath).filter((i) => i != "zh-CN.pak" && i != "en-US.pak");
                for (let i of files) {
                    fs.rmSync(path.join(localsPath, i));
                }
                console.log("移除原生语言包");
            } catch (error) {
                console.log(error);
            }

        const appPath = path.join(
            c.appOutDir,
            process.platform === "darwin" ? "e-search.app/Contents/Resources/app" : "resources/app"
        );

        const appDir = path.join(c.outDir, "app");
        fs.cpSync(appPath, appDir, { recursive: true });
        let ignoreDir = ["node_modules/onnxruntime-node", "ocr"];
        for (let i of ignoreDir) {
            fs.rmSync(path.join(appDir, i), { recursive: true });
        }

        const outputFilePath = path.join(c.outDir, `app-${process.platform}-${arch[0]}`);

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
                rj();
            });
        });
    },
};

const archFilter = arch[0] === "arm64" ? "x64" : "arm64";
const otherPlatform = Object.keys(platformMap).filter((i) => i != platform);

// 移除 onnxruntime-node/bin/napi-v3/
build[platform2].files.push(`!node_modules/onnxruntime-node/bin/napi-v3/${platform}/${archFilter}`);

// 移除 uiohook-napi/prebuilds
otherPlatform.forEach((i) => {
    build[platform2].files.push(`!node_modules/uiohook-napi/prebuilds/${i}-arm64`);
    build[platform2].files.push(`!node_modules/uiohook-napi/prebuilds/${i}-x64`);
});
build[platform2].files.push(`!node_modules/uiohook-napi/prebuilds/${platform}-${archFilter}`);

const ignoreDir = [
    ".*",
    "tsconfig*",
    "*.md",
    "*.js",
    "*.yaml",
    "**/*.ts",
    "src",
    "node_modules/qr-scanner-wechat",
    "lib/fabric.min.js",
    "node_modules/tar",
    "node_modules/**/*.flow",
    "node_modules/**/*.md",
    "node_modules/**/*.map",
];
for (let i of ignoreDir) {
    i = "!" + i;
    build[platform2].files.push(i);
}

module.exports = build;

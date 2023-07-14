const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const download = require("download");
exports.default = async function () {
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
    const arch = process.env["npm_config_arch"] || process.arch;
    if (process.platform == "win32" && !fs.existsSync("./lib/win_rect.exe")) {
        fs.writeFileSync(
            "./lib/win_rect.exe",
            await download("https://github.com/xushengfeng/win_rect/releases/download/0.1.0/win_rect.exe", {
                rejectUnauthorized: false,
            })
        );
    }
    if (process.platform == "win32" && !fs.existsSync("./lib/copy.exe")) {
        fs.writeFileSync(
            "./lib/copy.exe",
            await download("https://github.com/xushengfeng/ctrlc/releases/download/0.1.0/copy.exe", {
                rejectUnauthorized: false,
            })
        );
    }
    if (!fs.existsSync("./lib/ffmpeg")) {
        let o = {
            win32: {
                x64: "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n6.0-latest-win64-gpl-6.0.zip",
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
            if (process.platform == "win32") {
                fs.copyFileSync(
                    path.join("./lib/ffmpeg/", "ffmpeg-n6.0-latest-win64-gpl-6.0", "bin", "ffmpeg.exe"),
                    path.join("./lib/ffmpeg/", "ffmpeg.exe")
                );
                fs.rmSync(path.join("./lib/ffmpeg/", "ffmpeg-n6.0-latest-win64-gpl-6.0"), { recursive: true });
            }
        }
    }
    if (process.platform == "win32" && arch == "arm64") {
        execSync("npm i node-screenshots-win32-arm64-msvc");
        execSync("npm uninstall node-screenshots-win32-x64-msvc");
    }
    if (process.platform == "darwin" && arch == "arm64") {
        execSync("npm i node-screenshots-darwin-arm64");
        execSync("npm uninstall node-screenshots-darwin-x64");
    }
};

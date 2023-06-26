const fs = require("fs");
const path = require("path");
const download = require("download");
exports.default = async function () {
    if (!fs.existsSync("./ocr/ppocr/默认")) {
        fs.mkdirSync("./ocr/ppocr/默认", { recursive: true });
        await download(
            "https://github.com/xushengfeng/eSearch-OCR/releases/download/3.0.0/ch.zip",
            "./ocr/ppocr/默认/",
            {
                extract: true,
                rejectUnauthorized: false,
            }
        );
    }
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
};

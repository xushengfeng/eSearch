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
    if (process.platform == "win32" && !fs.existsSync("./build/vc_redist.x64.exe")) {
        fs.writeFileSync(
            "./build/vc_redist.x64.exe",
            await download("https://aka.ms/vs/17/release/vc_redist.x64.exe", {
                rejectUnauthorized: false,
            })
        );
    }
};

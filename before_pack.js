const fs = require("fs");
const path = require("path");
const download = require("download");
exports.default = async function () {
    // 重写存储器
    const storeindex = path.join(__dirname, "/node_modules/electron-store/index.js");
    fs.writeFileSync(
        storeindex,
        fs
            .readFileSync(storeindex)
            .toString()
            .replace(/ipcMain\.on\(.*\n.*\n.*?;/, "")
    );

    if (!fs.existsSync("./ocr/ppocr/默认")) {
        fs.mkdirSync("./ocr/ppocr/默认", { recursive: true });
        fs.writeFileSync(
            "./ocr/ppocr/默认/ch_PP-OCRv2_det_infer.onnx",
            await download(
                "https://github.com/xushengfeng/eSearch-OCR/releases/download/3.0.0/ch_PP-OCRv2_det_infer.onnx",
                { rejectUnauthorized: false }
            )
        );
        fs.writeFileSync(
            "./ocr/ppocr/默认/ch_PP-OCRv2_rec_infer.onnx",
            await download(
                "https://github.com/xushengfeng/eSearch-OCR/releases/download/3.0.0/ch_PP-OCRv2_rec_infer.onnx",
                { rejectUnauthorized: false }
            )
        );
        fs.writeFileSync(
            "./ocr/ppocr/默认/ppocr_keys_v1.txt",
            await download("https://github.com/xushengfeng/eSearch-OCR/releases/download/3.0.0/ppocr_keys_v1.txt", {
                rejectUnauthorized: false,
            })
        );
    }
};

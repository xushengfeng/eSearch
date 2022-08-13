const fs = require("fs");
const path = require("path");
const https = require("https");
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

    function download(url, path_name) {
        return new Promise((rj) => {
            https.get(url, (res) => {
                const file = fs.createWriteStream(path_name);
                res.pipe(file);
                file.on("finish", () => {
                    file.close();
                    rj();
                });
            });
        });
    }

    if (!fs.existsSync("./ocr/ppocr")) fs.mkdirSync("./ocr/ppocr");

    await download(
        "https://bj.bcebos.com/paddle2onnx/model_zoo/ch_PP-OCRv2_det_infer.onnx",
        "./ocr/ppocr/ch_PP-OCRv2_det_infer.onnx"
    );
    await download(
        "https://bj.bcebos.com/paddle2onnx/model_zoo/ch_PP-OCRv2_rec_infer.onnx",
        "./ocr/ppocr/ch_PP-OCRv2_rec_infer.onnx"
    );
    await download(
        "https://raw.fastgit.org/PaddlePaddle/PaddleOCR/release/2.5/ppocr/utils/ppocr_keys_v1.txt",
        "./ocr/ppocr/ppocr_keys_v1.txt"
    );
};

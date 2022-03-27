const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
function ocr(arg, callback) {
    local_ocr(arg, (err, r) => {
        return callback(err, r);
    });
}
module.exports = ocr;

function local_ocr(arg, callback) {
    var tmp_path = path.join(os.tmpdir(), "/eSearch/ocr.png");
    fs.writeFile(tmp_path, Buffer.from(arg, "base64"), async (err) => {
        if (err) callback(err);
        switch (process.platform) {
            case "linux":
                exec(
                    `cd ${__dirname}/ppocr/ && export LD_LIBRARY_PATH=ocr && 
                ./ocr/ppocr --det_model_dir=inference/ch_ppocr_mobile_v2.0_det_infer \
                --rec_model_dir=inference/ch_ppocr_mobile_v2.0_rec_infer \
                --char_list_file ppocr_keys_v1.txt \
                --image_dir=${tmp_path}`,
                    (e, result) => {
                        result = result.split(/[\r\n]/);
                        result = result.slice(0, result.length - 1);
                        result.reverse();
                        result = result.join("\n");
                        return callback(e, result);
                    }
                );
                break;
            case "win32":
                exec(
                    `CHCP 65001 && cd ${__dirname}\\ppocr && .\\ocr\\ppocr.exe --det_model_dir=inference/ch_ppocr_mobile_v2.0_det_infer --rec_model_dir=inference/ch_ppocr_mobile_v2.0_rec_infer --char_list_file ppocr_keys_v1.txt --image_dir=${tmp_path}`,
                    (e, result) => {
                        result = result.split(/\n/);
                        result = result.slice(1, result.length - 1);
                        result.reverse();
                        result = result.join("\n");
                        return callback(e, result);
                    }
                );
                break;
        }
    });
}

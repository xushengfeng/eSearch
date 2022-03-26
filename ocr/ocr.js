const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const { ipcRenderer } = require("electron");
const path = require("path");
function ocr(event, arg) {
    local_ocr(event, arg);
}
module.exports = ocr;

function local_ocr(event, arg) {
    var tmp_path = path.join(os.tmpdir(), "/eSearch/ocr.png");
    fs.writeFile(tmp_path, Buffer.from(arg, "base64"), (err) => {
        if (err) return;
        switch (process.platform) {
            case "linux":
                // 判断桌面环境
                exec(
                    `cd ${__dirname}/ppocr/ && 
                ./ppocr --det_model_dir=inference/ch_ppocr_mobile_v2.0_det_infer \
                --rec_model_dir=inference/ch_ppocr_mobile_v2.0_rec_infer \
                --char_list_file ppocr_keys_v1.txt \
                --image_dir=${tmp_path}`,
                    (e, result) => {
                        console.log(result);
                        event.sender.send("ocr_back", e ? "else" : "ok");
                    }
                );
                break;
        }
    });
}

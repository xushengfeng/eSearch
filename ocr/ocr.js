const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Store = require("electron-store");
var store = new Store();
function ocr(arg, callback) {
    if (store.get("OCR.类型") == "离线") {
        local_ocr(arg, (err, r) => {
            return callback(err, r);
        });
    } else {
        online_ocr(store.get("OCR.类型"), arg, (err, r) => {
            return callback(err, r);
        });
    }
}
module.exports = ocr;

/**
 * 离线OCR
 * @param {String} arg 图片base64
 * @param {Function} callback 回调
 */
function local_ocr(arg, callback) {
    var det = store.get("OCR.det") || "inference/ch_PP-OCRv2_det_infer",
        rec = store.get("OCR.rec") || "inference/ch_PP-OCRv2_rec_infer",
        字典 = store.get("OCR.字典") || "ppocr_keys_v1.txt";
    var tmp_path = path.join(os.tmpdir(), "/eSearch/ocr.png");
    var ocr_path = store.path.replace("config.json", "ocr").replace(" ", "\\ ");
    console.log(ocr_path);
    fs.writeFile(tmp_path, Buffer.from(arg, "base64"), async (err) => {
        if (err) callback(err);
        switch (process.platform) {
            case "linux":
                exec(
                    `cd ${__dirname}/ppocr/ && export LD_LIBRARY_PATH=${ocr_path} && 
                ${ocr_path}/ppocr --det_model_dir=${det} \
                --rec_model_dir=${rec} \
                --char_list_file=${字典} \
                --image_dir=${tmp_path}`,
                    (e, result) => {
                        if (e) console.log(e);
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
                    `CHCP 65001 && cd ${__dirname}\\ppocr && ${ocr_path}\\ppocr.exe --det_model_dir=${det} --rec_model_dir=${rec} --char_list_file=${字典} --image_dir=${tmp_path}`,
                    (e, result) => {
                        if (e) console.log(e);
                        result = result.split(/\n/);
                        result = result.slice(1, result.length - 1);
                        result.reverse();
                        result = result.join("\n");
                        return callback(e, result);
                    }
                );
                break;
            case "darwin":
                exec(
                    `source ${ocr_path}/env/bin/activate && ${ocr_path}/env/bin/python ${ocr_path}/ppocr/tools/infer/predict_system.py --image_dir="${tmp_path}" --det_model_dir="${__dirname}/ppocr/${det}" --rec_model_dir="${__dirname}/ppocr/${rec}" --use_gpu=False --rec_char_dict_path="${__dirname}/ppocr/ppocr_keys_v1.txt"
                    `,
                    (e, result) => {
                        if (e) console.log(e);
                        console.log(result);
                        return callback(e, result);
                    }
                );
                break;
        }
    });
}

/**
 * 在线OCR
 * @param {String} type 服务提供者
 * @param {String} arg 图片base64
 * @param {Function} callback 回调
 */
function online_ocr(type, arg, callback) {
    const https = require("https");
    const { URLSearchParams } = require("url");

    var client_id = store.get(`在线OCR.${type}.id`),
        client_secret = store.get(`在线OCR.${type}.secret`);

    if (!client_id || !client_secret) return callback("未填写 API Key 或 Secret Key", null);

    access();
    function access() {
        var options = {
            method: "GET",
            hostname: "aip.baidubce.com",
            port: null,
            path: `/oauth/2.0/token?grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`,
        };

        var req = https.request(options, function (res) {
            var chunks = [];

            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                var body = Buffer.concat(chunks);
                var access_token = JSON.parse(body.toString()).access_token;
                console.log(access_token);
                if (!access_token) return callback(body.toString(), null);
                get_ocr(access_token);
            });

            res.on("error", () => {
                return callback(JSON.stringify(err), null);
            });
        });

        req.on("error", () => {
            if (store.get("OCR.离线切换")) {
                local_ocr(arg, (err, r) => {
                    return callback(err, r);
                });
            } else {
                return callback("网络或服务错误", null);
            }
        });

        req.end();
    }
    function get_ocr(access_token) {
        var url = store.get(`在线OCR.${type}.url`);
        var hostname = url.replace(/https:\/\/(.*)/, "$1").split("/")[0];
        var path = url
            .replace(/https:\/\/(.*)/, "$1")
            .split("/")
            .splice(1)
            .join("/");
        var options = {
            method: "POST",
            hostname: hostname,
            port: null,
            path: `/${path}?access_token=${access_token}`,
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
        };

        var req = https.request(options, (res) => {
            var chunks = [];

            res.on("data", function (chunk) {
                chunks.push(chunk);
            });

            res.on("end", function () {
                var body = Buffer.concat(chunks);
                console.log(body.toString());
                format(body.toString());
            });

            res.on("error", (err) => {
                return callback(err, null);
            });
        });

        req.write(new URLSearchParams({ image: arg, paragraph: "true" }).toString());
        req.end();
    }
    function format(result) {
        result = JSON.parse(result);

        if (result.error_msg || result.error_code) return callback(JSON.stringify(result), null);

        var output = "";
        for (i in result.paragraphs_result) {
            for (ii in result.paragraphs_result[i]["words_result_idx"]) {
                output += result.words_result[result.paragraphs_result[i]["words_result_idx"][ii]].words;
            }
            if (i != result.paragraphs_result.length - 1) output += "\n";
        }
        console.log(output);
        return callback(null, output);
    }
}
// online_ocr();

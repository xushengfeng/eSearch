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
                        return callback(e, result);
                    }
                );
                break;
        }
    });
}

/**
 * @param {string} url
 * @param {https.RequestOptions} options
 * @param {Function} cb 回调
 * @param {object} write req.write(write)
 */
function 获取(url, options, cb, write) {
    const https = require("https");
    const { URLSearchParams } = require("url");

    var req = https.request(url, options, function (res) {
        var chunks = [];
        res.on("data", function (chunk) {
            chunks.push(chunk);
        });
        res.on("end", function () {
            var body = Buffer.concat(chunks);
            return cb(null, JSON.parse(body.toString()));
        });
        res.on("error", (err) => {
            return cb(new Error(JSON.stringify(err)), null);
        });
    });
    req.on("error", () => {
        return cb(new Error("网络或服务错误"), null);
    });
    if (write) req.write(new URLSearchParams(write).toString());
    req.end();
}

/**
 * 在线OCR
 * @param {String} type 服务提供者
 * @param {String} arg 图片base64
 * @param {Function} callback 回调
 */
function online_ocr(type, arg, callback) {
    var client_id = store.get(`在线OCR.${type}.id`),
        client_secret = store.get(`在线OCR.${type}.secret`);
    if (!client_id || !client_secret) return callback("未填写 API Key 或 Secret Key", null);

    switch (type) {
        case "baidu":
            baidu_ocr();
            break;
        case "youdao":
            youdao_ocr();
            break;
    }

    function baidu_ocr() {
        获取(
            `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`,
            {
                method: "GET",
                port: null,
            },
            (error, result) => {
                if (error) {
                    if (store.get("OCR.离线切换")) {
                        local_ocr(arg, (err, r) => {
                            return callback(err, r);
                        });
                    } else {
                        return callback("网络或服务错误", null);
                    }
                } else {
                    var access_token = result.access_token;
                    console.log(access_token);
                    if (!access_token) return callback(body.toString(), null);
                    获取(
                        `${store.get(`在线OCR.${type}.url`)}?access_token=${access_token}`,
                        {
                            method: "POST",
                            port: null,
                            headers: {
                                "content-type": "application/x-www-form-urlencoded",
                            },
                        },
                        (error, result) => {
                            if (error) return callback(error, null);
                            baidu_format(result);
                        },
                        { image: arg, paragraph: "true" }
                    );
                }
            }
        );

        function baidu_format(result) {
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

    function youdao_ocr() {
        const crypto = require("crypto");
        var input = arg.length >= 20 ? arg.slice(0, 10) + arg.length + arg.slice(-10) : arg;
        var curtime = Math.round(new Date().getTime() / 1000);
        var salt = crypto.randomUUID();
        var sign = crypto
            .createHash("sha256")
            .update(client_id + input + salt + curtime + client_secret)
            .digest("hex");
        var data = {
            img: arg,
            langType: "auto",
            detectType: "10012",
            imageType: "1",
            appKey: client_id,
            docType: "json",
            signType: "v3",
            salt,
            sign,
            curtime,
        };
        获取(
            "https://openapi.youdao.com/ocrapi",
            {
                method: "POST",
                port: null,
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                },
            },
            (error, result) => {
                if (error) return callback(error, null);
                youdao_format(result);
            },
            data
        );
        function youdao_format(result) {
            if (result.errorCode != "0") return callback(new Error(JSON.stringify(result)), null);
            var text = [];
            for (i of result.Result.regions) {
                var t = "";
                for (j of i.lines) {
                    t += j.text;
                }
                text.push(t);
            }
            text = text.join("\n");
            console.log(text);
            return callback(null, text);
        }
    }
}
// online_ocr();

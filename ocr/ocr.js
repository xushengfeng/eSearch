const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Store = require("electron-store");
var store = new Store();
function ocr(arg, callback) {
    if (store.get("OCR.离线OCR")) {
        local_ocr(arg, (err, r) => {
            return callback(err, r);
        });
    } else {
        online_ocr(arg, (err, r) => {
            return callback(err, r);
        });
    }
}
module.exports = ocr;

function local_ocr(arg, callback) {
    var det = store.get("OCR.det") || "inference/ch_ppocr_mobile_v2.0_det_infer",
        rec = store.get("OCR.rec") || "inference/ch_ppocr_mobile_v2.0_rec_infer",
        字典 = store.get("OCR.字典") || "ppocr_keys_v1.txt";
    var tmp_path = path.join(os.tmpdir(), "/eSearch/ocr.png");
    var ocr_path = store.path.replace("config.json", "ocr");
    console.log(ocr_path);
    fs.writeFile(tmp_path, Buffer.from(arg, "base64"), async (err) => {
        if (err) callback(err);
        switch (process.platform) {
            case "linux":
                exec(
                    `cd ${__dirname}/ppocr/ && export LD_LIBRARY_PATH=ocr && 
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
        }
    });
}

function online_ocr(arg, callback) {
    var https = require("https");
    var qs = require("querystring");

    var client_id = store.get("在线OCR.baidu.id"),
        client_secret = store.get("在线OCR.baidu.secret");

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
                get_ocr(access_token);
            });
        });

        req.end();
    }
    function get_ocr(access_token) {
        var url = store.get("在线OCR.baidu.url");
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
        });

        req.write(qs.stringify({ image: arg, paragraph: "true" }));
        req.end();
    }
    function format(result) {
        result = JSON.parse(result);

        if (result.error_msg || result.error_code) return callback(result, null);

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

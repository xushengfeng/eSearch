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
    fs.writeFile(tmp_path, Buffer.from(arg, "base64"), async (err) => {
        if (err) callback(err);
        switch (process.platform) {
            case "linux":
                exec(
                    `cd ${__dirname}/ppocr/ && export LD_LIBRARY_PATH=ocr && 
                ./ocr/ppocr --det_model_dir=${det} \
                --rec_model_dir=${rec} \
                --char_list_file=${字典} \
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
                    `CHCP 65001 && cd ${__dirname}\\ppocr && .\\ocr\\ppocr.exe --det_model_dir=${det} --rec_model_dir=${rec} --char_list_file=${字典} --image_dir=${tmp_path}`,
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

function online_ocr() {
    var https = require("https");
    var qs = require("querystring");

    var client_id = "",
        client_secret = "";

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
        var options = {
            method: "POST",
            hostname: "aip.baidubce.com",
            port: null,
            path: `/rest/2.0/ocr/v1/general_basic?access_token=${access_token}`,
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
            });
        });

        req.write(qs.stringify({ url: "https://esearch.vercel.app/readme/2.png", paragraph: "true" }));
        req.end();
    }
    // return callback(e, result);
}
online_ocr();

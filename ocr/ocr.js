const { exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const download = require("download");
const { net } = require("electron");
function ocr(arg, callback) {
    if (!arg) {
        download_ocr();
    } else {
        local_ocr(arg, (err, r) => {
            return callback(err, r);
        });
    }
}
module.exports = ocr;

function local_ocr(arg, callback) {
    var tmp_path = path.join(os.tmpdir(), "/eSearch/ocr.png");
    fs.writeFile(tmp_path, Buffer.from(arg, "base64"), async (err) => {
        if (err) callback(err);
        switch (process.platform) {
            case "linux":
                exec(
                    `cd ${__dirname}/ppocr/ && 
                ./ppocr --det_model_dir=inference/ch_ppocr_mobile_v2.0_det_infer \
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
        }
    });
}

function download_ocr() {
    const request = net.request({
        method: "GET",
        url: "https://api.github.com/repos/xushengfeng/eSearch-service/releases",
    });
    request.on("response", (response) => {
        response.on("data", (chunk) => {
            var t = chunk.toString();
            var result = JSON.parse(t);
            for (i of result[0].assets) {
                var url = i.browser_download_url;
                var name = i.name;
                if (process.platform == "linux" && name == "Linux.tar.gz") {
                    download_file(url);
                } else if (process.platform == "win32" && name == "Windows.zip") {
                    download_file(url);
                } else if (process.platform == "darwin" && name == "macOS.zip") {
                    download_file(url);
                }
            }
        });
    });
    request.end();

    function download_file(url) {
        url = url.replace("https://github.com", "https://download.fastgit.org");
        var download_path = path.join(__dirname, "/ppocr/");
        (async () => {
            await download(url, download_path, { extract: true });
            console.log("完成");
        })();
    }
}

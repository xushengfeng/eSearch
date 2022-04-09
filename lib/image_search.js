const https = require("https");
const { URLSearchParams } = require("url");
function search(arg, type, callback) {
    switch (type) {
        case "baidu":
            baidu(arg, (err, url) => {
                return callback(err, url);
            });
            break;
        case "yandex":
            yandex(arg, (err, url) => {
                return callback(err, url);
            });
            break;
        case "google":
            google(arg, (err, url) => {
                return callback(err, url);
            });
    }
}
module.exports = search;

/**
 * @param {string} url
 * @param {https.RequestOptions} options
 * @param {Function} cb 回调
 * @param {object} write req.write(write)
 */
function post(url, options, write, cb) {
    var req = https.request(url, Object.assign(options, { method: "POST" }), function (res) {
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
    req.write(write);
    req.end();
}

function baidu(image, callback) {
    var data = new URLSearchParams({ from: "pc", image }).toString();
    post(
        "https://graph.baidu.com/upload",
        { headers: { "content-type": "application/x-www-form-urlencoded" } },
        data,
        (err, result) => {
            if (err) return callback(err, null);
            if (result.msg != "Success") return callback(new Error(JSON.stringify(err)), null);
            console.log(result.data.url);
            return callback(null, result.data.url);
        }
    );
}

function yandex(image, callback) {
    var b = Buffer.from(image, "base64");
    var url =
        "https://yandex.com/images-apphost/image-download?cbird=111&images_avatars_size=preview&images_avatars_namespace=images-cbir";
    post(url, {}, b, (err, result) => {
        if (err) return callback(err, null);
        console.log(result);
        var img_url = result.url;
        if (img_url) {
            var b_url = `https://yandex.com/images/search?family=yes&rpt=imageview&url=${encodeURIComponent(img_url)}`;
            callback(null, b_url);
        } else {
            callback(new Error(result), null);
        }
    });
}

function google(image, callback) {
    var FormData = require("form-data");
    var form = new FormData();
    form.append("encoded_image", Buffer.from(image, "base64"), "eSearch.png");
    form.append("image_content", "");
    var url = "https://www.google.com/searchbyimage/upload";
    form.submit(url, (err, r) => {
        if (err) return callback(err, null);
        return callback(null, r.headers.location);
    });
}

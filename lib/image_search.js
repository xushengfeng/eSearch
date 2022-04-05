const Store = require("electron-store");
const https = require("https");
const { URLSearchParams } = require("url");
var store = new Store();
function search(arg, callback) {
    switch (store.get("以图搜图.引擎")) {
        case "baidu":
            baidu(arg, (err, url) => {
                return callback(err, url);
            });
            break;
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
    req.write(new URLSearchParams(write).toString());
    req.end();
}

function baidu(image, callback) {
    var data = { from: "pc", image };
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

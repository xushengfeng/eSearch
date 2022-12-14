const fs = require("fs");
const path = require("path");
exports.default = async function () {
    let p = fs.readdirSync("./build");
    let pp = "";
    for (let f of p) {
        if (f.includes("unpacked")) pp = f;
    }
    if (!pp) return;
    let onnx_path = path.join("./build", pp, "/resources/app/node_modules/onnxruntime-node/bin/napi-v3");
    console.log(onnx_path);
    if (process.arch == "x64") {
        onnx_path = path.join(onnx_path, process.platform, "arm64");
    }
    if (process.arch == "arm64") {
        onnx_path = path.join(onnx_path, process.platform, "x64");
    }
    if (!fs.existsSync(onnx_path)) return;
    let l = fs.readdirSync(onnx_path);
    for (let f of l) {
        fs.rmSync(path.join(onnx_path, f));
    }
    fs.rmdirSync(onnx_path);
};

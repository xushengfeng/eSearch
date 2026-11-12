// 官方二进制默认开启 1DS 遥测，必须在 ONNX Runtime 初始化前关闭。
// renderer 构建会把 process.env 替换为空对象，这里通过 require 取真实的 env。
require("node:process").env.ORT_DISABLE_TELEMETRY = "1";

const ort = require("onnxruntime-node") as typeof import("onnxruntime-node");

export default ort;

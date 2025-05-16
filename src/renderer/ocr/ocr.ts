const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");

export { ocr as initLocalOCR };

async function ocr(
    store: typeof import("../../../lib/store/renderStore")["default"],
    type: string,
    onProgress?: (type: "det" | "rec", total: number, count: number) => void,
) {
    const l = store.get("离线OCR").find((i) => i[0] === type);
    if (!l) return null;
    function ocrPath(p: string) {
        return path.join(
            path.isAbsolute(p) ? "" : path.join(__dirname, "../../ocr/ppocr"),
            p,
        );
    }
    const detp = ocrPath(l[1]);
    const recp = ocrPath(l[2]);
    const 字典 = ocrPath(l[3]);
    console.log(detp, recp, 字典);
    // biome-ignore format:
    const localOCR = require("esearch-ocr") as typeof import("esearch-ocr");
    const ort = require("onnxruntime-node");
    const provider = store.get("AI.运行后端") || "cpu";
    return await localOCR.init({
        detPath: detp,
        recPath: recp,
        dic: fs.readFileSync(字典).toString(),
        detRatio: 0.75,
        ort,
        ortOption: { executionProviders: [{ name: provider }] },
        onProgress: onProgress,
    });
}

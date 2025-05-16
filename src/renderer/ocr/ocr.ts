const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");

export { ocr as initLocalOCR };

async function ocr(
    store: typeof import("../../../lib/store/renderStore")["default"],
    type: string,
    onProgress?: (type: "det" | "rec", total: number, count: number) => void,
) {
    const ocrList = store.get("离线OCR");
    const defaultPaths = {
        det: "ppocr_det.onnx",
        rec: "ppocr_v4_rec_doc.onnx",
        dic: "ppocrv4_doc_dict.txt",
    };
    const defaultOcr = ocrList.find((i) => i[0] === "默认");
    if (defaultOcr) {
        defaultOcr[1] = defaultPaths.det;
        defaultOcr[2] = defaultPaths.rec;
        defaultOcr[3] = defaultPaths.dic;
    } else {
        ocrList.push([
            "默认",
            defaultPaths.det,
            defaultPaths.rec,
            defaultPaths.dic,
        ]);
    }
    const l = store.get("离线OCR").find((i) => i[0] === type);
    if (!l) return null;
    function ocrPath(p: string) {
        if (!p) return "";
        const xp = path.isAbsolute(p)
            ? p
            : path.join(__dirname, "../../assets/onnx/ppocr", p);
        if (fs.existsSync(xp)) return xp;
        return "";
    }
    const detp = ocrPath(l[1]) || ocrPath(defaultPaths.det);
    const recp = ocrPath(l[2]) || ocrPath(defaultPaths.rec);
    const 字典 = ocrPath(l[3]) || ocrPath(defaultPaths.dic);
    console.log(detp, recp, 字典);
    if (!detp || !recp || !字典) {
        console.error("OCR路径错误");
        return null;
    }
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

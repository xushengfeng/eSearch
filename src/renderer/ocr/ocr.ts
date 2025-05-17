const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");

export { ocr as initLocalOCR, defaultOcrId };

const defaultOcrId = "0";

async function ocr(
    store: typeof import("../../../lib/store/renderStore")["default"],
    type: string,
    onProgress?: (type: "det" | "rec", total: number, count: number) => void,
    op?: {
        docCls?: boolean;
    },
) {
    const ocrList = store.get("离线OCR");
    const defaultPaths = {
        det: "ppocr_det.onnx",
        rec: "ppocr_v4_rec_doc.onnx",
        dic: "ppocrv4_doc_dict.txt",
        docCls: "doc_cls.onnx",
    };
    const defaultOcr = ocrList.find((i) => i.id === defaultOcrId);
    if (defaultOcr) {
        defaultOcr.detPath = defaultPaths.det;
        defaultOcr.recPath = defaultPaths.rec;
        defaultOcr.dicPath = defaultPaths.dic;
    } else {
        ocrList.push({
            id: defaultOcrId,
            name: "",
            detPath: defaultPaths.det,
            recPath: defaultPaths.rec,
            dicPath: defaultPaths.dic,
            scripts: ["zh-HANS", "zh-HANT", "en"],
        });
    }
    const l = ocrList.find((i) => i.id === type);
    if (!l) return null;
    function ocrPath(p: string) {
        if (!p) return "";
        const xp = path.isAbsolute(p)
            ? p
            : path.join(__dirname, "../../assets/onnx/ppocr", p);
        if (fs.existsSync(xp)) return xp;
        return "";
    }
    const detp = ocrPath(l.detPath) || ocrPath(defaultPaths.det);
    const recp = ocrPath(l.recPath) || ocrPath(defaultPaths.rec);
    const 字典 = ocrPath(l.dicPath) || ocrPath(defaultPaths.dic);
    const docCls = op?.docCls ? ocrPath(defaultPaths.docCls) : undefined;
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
        docClsPath: docCls,
    });
}

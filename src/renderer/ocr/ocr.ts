import type { InitOcrBase } from "esearch-ocr";

const path = require("node:path") as typeof import("path");
const fs = require("node:fs") as typeof import("fs");

export { loadOCR, defaultOcrId };

const defaultOcrId = "0";

function loadOCR(
    store: typeof import("../../../lib/store/renderStore")["default"],
    type: string,
    op?: {
        docCls?: boolean;
    },
) {
    const ocrList = store.get("离线OCR");
    const defaultPaths = {
        det: "ppocr_det.onnx",
        rec: "ppocr_rec.onnx",
        dic: "ppocr_keys_v1.txt",
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
            scripts: ["zh-HANS", "en"],
            accuracy: "low",
            speed: "fast",
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
    return {
        ocr: localOCR,
        config: {
            det: {
                input: detp,
                ratio: 0.75,
            },
            rec: {
                input: recp,
                decodeDic: fs.readFileSync(字典).toString(),
            },
            ...(docCls
                ? {
                      docCls: {
                          input: docCls,
                      },
                  }
                : {}),
            ort,
            ortOption: { executionProviders: [{ name: provider }] },
        } as InitOcrBase,
    };
}

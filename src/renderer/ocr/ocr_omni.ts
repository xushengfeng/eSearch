import { noI18n } from "dkh-ui";
import { defaultOcrId, loadOCR } from "./ocr";
import { ocrOnline } from "./ocr_online";

type ocrResult = {
    text: string;
    box: /** lt,rt,rb,lb */ [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ];
}[];

export function ocrOmniLoad(
    store: typeof import("../../../lib/store/renderStore")["default"],
    type: string,
): { ocr: (img: string) => Promise<string[]> } | null {
    if (type === "baidu" || type === "youdao" || type.startsWith("ai-")) {
        return {
            ocr: async (img: string) => {
                return new Promise<string[]>((resolve, reject) => {
                    ocrOnline(
                        store,
                        type.startsWith("ai-") ? type.slice(3) : type,
                        img,
                        (err, result) => {
                            if (err) {
                                reject(err);
                            } else if (result) {
                                resolve(result.text.split("\n"));
                            } else {
                                reject(new Error("未知错误"));
                            }
                        },
                    );
                });
            },
        };
    }
    const x = loadOCR(store, type);
    if (!x) throw new Error("不支持的 OCR 类型");
    const ocr = x.ocr.init(x.config);
    return {
        ocr: async (img: string) => {
            const res = await (await ocr).ocr(img);
            return res.columns
                .flatMap((c) => c.parragraphs)
                .map((p) => p.parse.text);
        },
    };
}

export function ocrOmni(
    store: typeof import("../../../lib/store/renderStore")["default"],
    type: string,
    arg: string,
    callback: (
        err: Error | null,
        result: { raw: ocrResult; text: string } | null,
    ) => void,
) {
    if (type === "baidu" || type === "youdao") {
        ocrOnline(store, type, arg, callback);
    } else if (type.startsWith("ai-")) {
        const ntype = type.slice(3);
        ocrOnline(store, ntype, arg, callback);
    } else {
        callback(new Error("不支持的 OCR 类型"), null);
    }
}

export function ocrList(
    store: typeof import("../../../lib/store/renderStore")["default"],
) {
    return [
        ...store
            .get("离线OCR")
            .map((i) => ({
                value: i.id,
                name: i.id === defaultOcrId ? i.name : noI18n(i.name),
            })),
        ...store
            .get("AI.在线模型")
            .filter((i) => i.supportVision)
            .map((i) => ({ value: `ai-${i.name}`, name: noI18n(i.name) })),
        { value: "baidu", name: "百度" },
        { value: "youdao", name: "有道" },
    ];
}

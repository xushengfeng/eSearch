import { runAI } from "../lib/ai";

type ocrResult = {
    text: string;
    box: /** lt,rt,rb,lb */ [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ];
}[];
// todo 按行 按段
export function ocrOnline(
    store: typeof import("../../../lib/store/renderStore")["default"],
    type: string,
    arg: string,
    callback: (
        err: Error | null,
        result: { raw: ocrResult; text: string } | null,
    ) => void,
) {
    if (type === "baidu") {
        baiduOcr(store, arg, callback);
    } else if (type === "youdao") {
        youdaoOcr(store, arg, callback);
    } else {
        llmOCR(store, type, arg, callback);
    }
}

function llmOCR(
    store: typeof import("../../../lib/store/renderStore")["default"],
    type: string,
    img: string,
    callback: (
        err: Error | null,
        result: { raw: ocrResult; text: string } | null,
    ) => void,
) {
    const aiConfig = store.get("AI.在线模型").find((i) => i.name === type);
    if (!aiConfig) return callback(new Error("未找到模型"), null);
    if (!aiConfig.supportVision)
        return callback(new Error("模型不支持视觉"), null);
    const prompt = "recognize the text in the image and return it in text raw";
    runAI([{ role: "user", content: { text: prompt, img } }], aiConfig)
        .text.then((text) => {
            return callback(null, {
                raw: [
                    {
                        box: [
                            [0, 0],
                            [0, 0],
                            [0, 0],
                            [0, 0],
                        ],
                        text,
                    },
                ],
                text,
            });
        })
        .catch((e) => {
            return callback(e, null);
        });
}

function baiduOcr(
    store: typeof import("../../../lib/store/renderStore")["default"],
    sarg: string,
    callback: (
        err: Error | null,
        result: { raw: ocrResult; text: string } | null,
    ) => void,
) {
    const clientId = store.get("在线OCR.baidu.id");
    const clientSecret = store.get("在线OCR.baidu.secret");
    if (!clientId || !clientSecret)
        return callback(new Error("未填写 API Key 或 Secret Key"), null);
    const arg = sarg.replace("data:image/png;base64,", "");
    if (
        !store.get("在线OCR.baidu.token") ||
        store.get("在线OCR.baidu.time") < Date.now()
    )
        fetch(
            `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
            { method: "GET" },
        )
            .then((t) => t.json())
            .then((result) => {
                const access_token = result?.access_token;
                console.log(access_token);
                if (!access_token) {
                    if (result.error) {
                        if (result.error_description === "unknown client id") {
                            return callback(new Error("API Key 错误"), null);
                        }
                        if (
                            result.error_description ===
                            "Client authentication failed"
                        )
                            return callback(new Error("Secret Key 错误"), null);
                    }
                    return callback(new Error(JSON.stringify(result)), null);
                }
                store.set("在线OCR.baidu.token", access_token);
                store.set(
                    "在线OCR.baidu.time",
                    Date.now() + result.expires_in * 1000,
                );
                ocrGet(access_token);
            })
            .catch((e) => callback(e, null));
    else {
        ocrGet(store.get("在线OCR.baidu.token"));
    }

    function ocrGet(token: string) {
        fetch(`${store.get("在线OCR.baidu.url")}?access_token=${token}`, {
            method: "POST",
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                image: arg,
                paragraph: "true",
                cell_contents: "true",
            }).toString(),
        })
            .then((v) => v.json())
            .then((result) => {
                baiduFormat(result);
            })
            .catch((e) => callback(e, null));
    }

    interface BaiduOcrResult {
        error_msg?: string;
        error_code?: number;
        tables_result?: {
            header: { words: string[] };
            body: {
                row_start: number;
                col_start: number;
                words: string;
            }[];
            footer: { words: string[] };
        }[];
        words_result: {
            words: string;
            location?: {
                top: number;
                left: number;
                width: number;
                height: number;
            };
        }[];
        paragraphs_result?: {
            words_result_idx: number[];
        }[];
    }

    function baiduFormat(result: BaiduOcrResult) {
        if (result.error_msg || result.error_code)
            return callback(new Error(JSON.stringify(result)), null);

        if (result.tables_result) {
            const tables: string[] = [];
            for (const i of result.tables_result) {
                const m: string[][] = [];
                for (const c of i.body) {
                    if (!m[c.row_start]) m[c.row_start] = [];
                    m[c.row_start][c.col_start] = c.words;
                }
                const body = m
                    .map((row) =>
                        row.map((i) => i.replaceAll("\n", "")).join("\t"),
                    )
                    .join("\n");
                const r = [i.header.words, body, i.footer.words];
                tables.push(r.flat().join("\n"));
            }
            return callback(null, { raw: [], text: tables.join("\n") });
        }

        const outputL: string[] = [];
        if (!result.paragraphs_result) {
            for (const i of result.words_result) {
                outputL.push(i.words);
            }
        } else {
            for (const i in result.paragraphs_result) {
                outputL[i] = "";
                for (const ii in result.paragraphs_result[i].words_result_idx) {
                    outputL[i] +=
                        result.words_result[
                            result.paragraphs_result[i].words_result_idx[ii]
                        ].words;
                }
            }
        }
        const output = outputL.join("\n");
        console.log(output);
        const r: ocrResult = [];
        if (result.words_result[0]?.location)
            for (const i of result.words_result) {
                const l = i.location!;
                r.push({
                    box: [
                        [l.left, l.top],
                        [l.left + l.width, l.top],
                        [l.left + l.width, l.top + l.height],
                        [l.left, l.top + l.height],
                    ],
                    text: i.words,
                });
            }

        return callback(null, { raw: r, text: output });
    }
}

function youdaoOcr(
    store: typeof import("../../../lib/store/renderStore")["default"],
    sarg: string,
    callback: (
        err: Error | null,
        result: { raw: ocrResult; text: string } | null,
    ) => void,
) {
    const clientId = store.get("在线OCR.youdao.id");
    const clientSecret = store.get("在线OCR.youdao.secret");
    if (!clientId || !clientSecret)
        return callback(new Error("未填写 API Key 或 Secret Key"), null);
    const arg = sarg.replace("data:image/png;base64,", "");
    const crypto = require("node:crypto") as typeof import("crypto");
    const input =
        arg.length >= 20 ? arg.slice(0, 10) + arg.length + arg.slice(-10) : arg;
    const curtime = String(Math.round(Date.now() / 1000));
    const salt = crypto.randomUUID();
    const sign = crypto
        .createHash("sha256")
        .update(clientId + input + salt + curtime + clientSecret)
        .digest("hex");
    const data = {
        img: arg,
        langType: "auto",
        detectType: "10012",
        imageType: "1",
        appKey: clientId,
        docType: "json",
        signType: "v3",
        salt,
        sign,
        curtime,
    };

    fetch("https://openapi.youdao.com/ocrapi", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(data).toString(),
    })
        .then((v) => v.json())
        .then((result) => {
            youdao_format(result);
        })
        .catch((e) => {
            return callback(e, null);
        });

    interface YoudaoOcrResult {
        errorCode: string;
        Result: {
            regions: {
                lines: {
                    boundingBox: string;
                    text: string;
                }[];
            }[];
        };
    }

    function youdao_format(result: YoudaoOcrResult) {
        if (result.errorCode !== "0")
            return callback(new Error(JSON.stringify(result)), null);
        const r: ocrResult = [];
        const textL: string[] = [];
        for (const i of result.Result.regions) {
            let t = "";
            for (const j of i.lines) {
                const p = j.boundingBox as string;
                const pl = p.split(",").map((x: string) => Number(x));
                r.push({
                    box: [
                        [pl[0], pl[1]],
                        [pl[2], pl[3]],
                        [pl[4], pl[5]],
                        [pl[6], pl[7]],
                    ],
                    text: j.text,
                });
                t += j.text;
            }
            textL.push(t);
        }
        const text = textL.join("\n");
        console.log(text);
        return callback(null, { raw: r, text });
    }
}

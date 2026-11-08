import xtranslator from "xtranslator";
import { renderInvoke } from "../../../lib/ipc";
import type { setting } from "../../ShareTypes";

export const BERGAMOT_LANGS = [
    "af",
    "ar",
    "az",
    "be",
    "bg",
    "bn",
    "bs",
    "ca",
    "cs",
    "da",
    "de",
    "el",
    "en",
    "es",
    "et",
    "eu",
    "fa",
    "fi",
    "fr",
    "gl",
    "gu",
    "he",
    "hi",
    "hr",
    "hu",
    "id",
    "is",
    "it",
    "ja",
    "kn",
    "ko",
    "lt",
    "lv",
    "ml",
    "mr",
    "ms",
    "nb",
    "nl",
    "pl",
    "pt",
    "ro",
    "ru",
    "sk",
    "sl",
    "sq",
    "sr",
    "sv",
    "ta",
    "te",
    "th",
    "tl",
    "tr",
    "ug",
    "uk",
    "ur",
    "vi",
    "zh-Hans",
    "zh-Hant",
] as const;

type TranslatorLike = {
    run(text: string, from: string, to: string): Promise<string>;
    run(text: string[], from: string, to: string): Promise<string[]>;
    readonly lan: string[];
    readonly targetLan: string[];
};

export class BergamotTranslator implements TranslatorLike {
    readonly lan = ["auto", ...BERGAMOT_LANGS];
    readonly targetLan = [...BERGAMOT_LANGS];

    async run(text: string, from: string, to: string): Promise<string>;
    async run(text: string[], from: string, to: string): Promise<string[]>;
    async run(
        text: string | string[],
        from: string,
        to: string,
    ): Promise<string | string[]> {
        const input = typeof text === "string" ? [text] : text;
        if (input.length === 0) {
            return typeof text === "string" ? "" : [];
        }
        const output = await renderInvoke("bergamot_translate", [
            {
                texts: input,
                from,
                to,
            },
        ]);
        return typeof text === "string" ? output.join("") : output;
    }

    async test() {
        const testText = "The test passed";
        const result = await this.run(testText, "en", "zh-Hans");
        return {
            from: "en",
            to: "zh-Hans",
            testText,
            result,
        };
    }
}

export function loadTranslator(
    store: typeof import("../../../lib/store/renderStore")["default"],
) {
    const transE = store.get("翻译.翻译器");

    if (transE.length > 0) {
        const x = transE[0];
        const e = getTranslators(store, x);
        if (e) {
            const lan = store.get("屏幕翻译.语言");
            const to = lan.to || store.get("语言.语言") || "zh-Hans";
            return (input: string[]) => e.run(input, lan.from || "auto", to);
        }
    }
}

export function getTranslators(
    store: typeof import("../../../lib/store/renderStore")["default"],
    settingItem: setting["翻译"]["翻译器"][0],
): TranslatorLike | undefined {
    if (settingItem.type === "bergamot") {
        return new BergamotTranslator();
    }

    const e =
        xtranslator.es[
            settingItem.type === "llm" ? "chatgpt" : settingItem.type
        ]();
    if (e) {
        if (settingItem.type === "llm") {
            const model = store
                .get("AI.在线模型")
                .find((i) => i.name === settingItem.keys.name);
            if (!model) {
                return;
            }
            // @ts-ignore
            e.setKeys({
                url: new URL("chat/completions", model.url).toString(),
                key: model.key,
                config: {
                    model: model.model,
                },
            });
            // @ts-ignore
        } else e.setKeys(settingItem.keys);
        return e as unknown as TranslatorLike;
    }
    return undefined;
}

export function getEngineLans(type: string) {
    if (type === "bergamot") {
        return {
            lan: ["auto", ...BERGAMOT_LANGS],
            targetLan: [...BERGAMOT_LANGS],
        };
    }
    const engine = xtranslator.getEngine(type === "llm" ? "chatgpt" : type);
    return engine
        ? { lan: [...engine.lan], targetLan: [...engine.targetLan] }
        : undefined;
}

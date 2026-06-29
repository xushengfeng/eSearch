import xtranslator from "xtranslator";
import type { setting } from "../../ShareTypes";

export function loadTranslator(
    store: typeof import("../../../lib/store/renderStore")["default"],
) {
    const transE = store.get("翻译.翻译器");

    if (transE.length > 0) {
        const x = transE[0];
        const e = getTranslators(store, x);
        if (e) {
            const lan = store.get("屏幕翻译.语言");
            return (input: string[]) =>
                e.run(
                    input,
                    (lan.from ||
                        "auto") as (typeof xtranslator.languages.normal)[number],
                    (lan.to ||
                        store.get(
                            "语言.语言",
                        )) as (typeof xtranslator.languages.normal)[number],
                );
        }
    }
}

export function getTranslators(
    store: typeof import("../../../lib/store/renderStore")["default"],
    settingItem: setting["翻译"]["翻译器"][0],
): InstanceType<(typeof xtranslator)["Translator"]> | undefined {
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
                url: new URL("v1/chat/completions", model.url).toString(),
                key: model.key,
                config: {
                    model: model.model,
                },
            });
            // @ts-ignore
        } else e.setKeys(settingItem.keys);
        return e;
    }
    return undefined;
}

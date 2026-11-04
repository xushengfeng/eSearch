import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Store from "./store";

function createStore(config: Record<string, unknown>) {
    const dir = mkdtempSync(join(tmpdir(), "esearch-store-"));
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, JSON.stringify(config));
    return new Store({
        configPath,
        defaultData: {
            网络: {
                github镜像: {
                    启用: false,
                    api: "https://api.github.com/",
                    base: "https://github.com/",
                },
            },
        },
    });
}

describe("Store", () => {
    it("读取对象时用默认值补齐缺失字段", () => {
        const store = createStore({
            网络: { github镜像: { 启用: true, base: "https://mirror/" } },
        });
        expect(store.get("网络.github镜像")).toEqual({
            启用: true,
            api: "https://api.github.com/",
            base: "https://mirror/",
        });
    });

    it("读取单个字段和数组时保持原值", () => {
        const store = createStore({
            引擎: { 搜索: [{ name: "a", url: "https://a/" }] },
        });
        expect(store.get("网络.github镜像.api")).toBe(
            "https://api.github.com/",
        );
        expect(store.get("引擎.搜索")).toEqual([
            { name: "a", url: "https://a/" },
        ]);
    });
});

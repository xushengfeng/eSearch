const fs = require("node:fs") as typeof import("fs");

import type { setting } from "../../src/ShareTypes";
import { safeJSONParse } from "../utils";
import { xget, xset } from "./parse";
import type { GetValue, SettingPath } from "./renderStore";

type data = {
    [key: string]: unknown;
};

type StringSettingPath = {
    [P in SettingPath]: GetValue<setting, P> extends string ? P : never;
}[SettingPath];

function deepMerge(target: data, source: data): data {
    const result = { ...target };
    for (const key in source) {
        if (
            source[key]?.constructor === Object &&
            target[key]?.constructor === Object
        ) {
            result[key] = deepMerge(target[key] as data, source[key] as data);
        } else if (target[key] === undefined) {
            result[key] = source[key];
        }
    }
    return result;
}

class Store {
    private configPath: string;
    private data: data | undefined;
    private defaultData: data;

    constructor(op: { configPath: string; defaultData?: data }) {
        this.configPath = op.configPath;
        this.defaultData = op.defaultData || {};
        if (!fs.existsSync(this.configPath)) {
            this.init();
        }
        this.data = this.getStore();
    }

    setDefaultData(defaultData: setting) {
        this.defaultData = defaultData as unknown as data;
    }

    private init() {
        fs.writeFileSync(this.configPath, "{}");
        this.data = {};
    }

    private getStore() {
        if (this.data) return this.data;
        let str = "{}";
        try {
            str = fs.readFileSync(this.configPath).toString() || "{}";
        } catch (error) {
            this.init();
        }
        return safeJSONParse<data>(str, {});
    }

    private setStore(data: data) {
        this.data = data;
        fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
    }

    path() {
        return this.configPath;
    }

    set<P extends SettingPath>(
        keyPath: P,
        value: GetValue<setting, P> | (unknown & {}),
    ): void {
        const store = this.getStore();
        xset(store, keyPath, value);
        this.setStore(store);
    }
    get<P extends SettingPath>(keyPath: P): GetValue<setting, P> {
        const store = this.getStore();
        const value = xget(store, keyPath);
        const defaultValue = xget(
            this.defaultData as Record<string, unknown>,
            keyPath,
        );
        if (value === undefined) return defaultValue as GetValue<setting, P>;
        // 读取对象时补齐默认值，避免配置里缺少新增字段时拿到不完整的对象
        if (
            value?.constructor === Object &&
            defaultValue?.constructor === Object
        ) {
            return deepMerge(value as data, defaultValue as data) as GetValue<
                setting,
                P
            >;
        }
        return value as GetValue<setting, P>;
    }
    /** 读取字符串设置；配置被改坏（如路径变成布尔）时回退到默认值，避免传给 path 接口 */
    getString<P extends StringSettingPath>(keyPath: P): string {
        const value: unknown = this.get(keyPath);
        if (typeof value === "string") return value;
        if (value !== undefined) {
            console.error(`设置 ${keyPath} 应为字符串，实际为 ${typeof value}`);
        }
        return "";
    }

    clear() {
        this.init();
    }

    getAll() {
        const store = this.getStore();
        return deepMerge(store, this.defaultData);
    }
    setAll(data: data) {
        this.setStore(data);
    }
}

export default Store;

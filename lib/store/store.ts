const fs = require("node:fs") as typeof import("fs");

import { xget, xset } from "./parse";

import type { GetValue, SettingPath } from "./renderStore";
import type { setting } from "../../src/ShareTypes";
import { safeJSONParse } from "../utils";

type data = {
    [key: string]: unknown;
};

function deepMerge(target: data, source: data): data {
    const result = { ...target };
    for (const key in source) {
        if (source[key]?.constructor === Object && target[key]?.constructor === Object) {
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
        if (value !== undefined) return value;
        return xget(this.defaultData as Record<string, unknown>, keyPath);
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

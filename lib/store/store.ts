const fs = require("node:fs") as typeof import("fs");

import { xget, xset } from "./parse";

import type { GetValue, SettingPath } from "./renderStore";
import type { setting } from "../../src/ShareTypes";

type data = {
    [key: string]: unknown;
};

class Store {
    private configPath: string;
    private data: data | undefined;

    constructor(op: { configPath: string }) {
        this.configPath = op.configPath;
        if (!fs.existsSync(this.configPath)) {
            this.init();
        }
        this.data = this.getStore();
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
        return JSON.parse(str) as data;
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
        return xget(store, keyPath);
    }

    clear() {
        this.init();
    }

    getAll() {
        return this.getStore();
    }
    setAll(data: data) {
        this.setStore(data);
    }
}

export default Store;

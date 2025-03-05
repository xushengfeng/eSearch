const { app } = require("electron");
const fs = require("node:fs") as typeof import("fs");
const path = require("node:path") as typeof import("path");
import type { GetValue, SettingPath } from "./renderStore";
import type { setting } from "../../src/ShareTypes";

type data = {
    [key: string]: unknown;
};

class Store {
    private configPath: string;

    constructor() {
        this.configPath = path.join(app.getPath("userData"), "config.json");
        if (!fs.existsSync(this.configPath)) {
            this.init();
        }
    }

    private init() {
        fs.writeFileSync(this.configPath, "{}");
    }

    private getStore() {
        let str = "{}";
        try {
            str = fs.readFileSync(this.configPath).toString() || "{}";
        } catch (error) {
            this.init();
        }
        return JSON.parse(str) as data;
    }

    private setStore(data: data) {
        fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
    }

    public set<P extends SettingPath>(
        keyPath: P | (string & {}),
        value: GetValue<setting, P> | (unknown & {}),
    ): void {
        const store = this.getStore();
        const pathx = keyPath.split(".");
        let obj = store;
        for (let i = 0; i < pathx.length; i++) {
            const p = pathx[i];
            if (i === pathx.length - 1) obj[p] = value;
            else {
                if (obj[p]?.constructor !== Object) {
                    if (!Number.isNaN(Number(pathx[i + 1]))) {
                        obj[p] = [];
                    } else {
                        obj[p] = {};
                    }
                }
                // @ts-ignore
                obj = obj[p];
            }
        }
        this.setStore(store);
    }
    public get<P extends SettingPath>(
        keyPath: P | (string & {}),
    ): GetValue<setting, P> {
        const store = this.getStore();
        const pathx = keyPath.split(".");
        const lastp = pathx.pop() ?? "";
        // @ts-ignore
        const lastobj = pathx.reduce((p, c) => {
            return p[c] || {};
        }, store);
        return lastobj[lastp];
    }

    public clear() {
        this.init();
    }

    public getAll() {
        return this.getStore();
    }
    public setAll(data: data) {
        this.setStore(data);
    }
}

export default Store;

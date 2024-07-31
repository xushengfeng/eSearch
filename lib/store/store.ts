const { app } = require("electron");
const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");

type data = {
    [key: string]: any;
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

    public set(keyPath: string, value: any): void {
        const store = this.getStore();
        let pathx = keyPath.split(".");
        const lastp = pathx.pop();
        const lastobj = pathx.reduce((p, c) => (p[c] = p[c] || {}), store);
        lastobj[lastp] = value;
        this.setStore(store);
    }

    public get(keyPath: string): any {
        const store = this.getStore();
        let pathx = keyPath.split(".");
        const lastp = pathx.pop();
        const lastobj = pathx.reduce((p, c) => (p[c] = p[c] || {}), store);
        return lastobj[lastp];
    }

    public clear() {
        this.init();
    }
}

export default Store;

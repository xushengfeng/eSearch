// biome-ignore lint/suspicious/noExplicitAny: <explanation>
class xhistory<Data, Diff = any> {
    history: ((
        | { data: Data; type: "key" }
        | { data: Diff; type: "delta"; parentId: number }
    ) & {
        time: number;
        des: string;
    })[];
    private i = -1;
    private tmpData: Data | null = null;
    private tmpDiff: Diff | null = null;
    private des = "";
    private changeEvent = new Set<() => void>();
    private diffFun: (last: Data, now: Data) => Diff | null = (last, now) =>
        last === now ? null : (now as unknown as Diff);
    private applyFun: (data: Data, diff: Diff) => Data = (_, d) =>
        d as unknown as Data;
    constructor(
        datas: typeof this.history,
        _initData: Data,
        op?: {
            diff: (last: Data, now: Data) => Diff;
            apply: (data: Data, diff: Diff) => Data;
        },
    ) {
        this.history = datas;
        if (this.history.length === 0)
            this.history.unshift({
                des: "0",
                type: "key",
                data: _initData,
                time: Date.now(),
            });
        this.i = this.history.length - 1;
        if (op) {
            this.diffFun = op.diff;
            this.applyFun = op.apply;
        }
    }

    getTmpData() {
        return structuredClone(this.tmpData) ?? this.getData();
    }

    /**
     * 设置数据
     * **记得调用apply()**
     * @param fun 处理函数，适合修改部分数据
     * @param des 描述
     */
    setDataF(fun: (data: Data) => Data, des?: string) {
        this.tmpData = fun(this.getTmpData());
        if (des) this.des += ` ${des}`;
    }
    /**
     * 设置数据
     * **记得调用apply()**
     * @param data 数据
     * @param des 描述
     */
    setData(data: Data, des?: string) {
        this.tmpData = data;
        if (des) this.des += ` ${des}`;
    }
    /**
     * 设置数据（手动指定diff）
     * **记得调用apply()**
     * @param diff 数据
     * @param des 描述
     */
    setDiff(diff: Diff, des?: string) {
        this.tmpDiff = diff;
        if (des) this.des += ` ${des}`;
    }

    apply(des = this.des) {
        let diff = structuredClone(this.tmpDiff);
        if (!diff) {
            const data = structuredClone(this.tmpData);
            if (data) {
                const last = structuredClone(this.getDataByI(this.i));
                const _diff = this.diffFun(last, data);
                diff = _diff;
            }
        }

        if (diff !== null && diff !== undefined) {
            if (this.i !== this.history.length - 1) {
                // 中途添加，保留上一个数据
                const h = this.history.at(this.i);
                this.history.push({
                    ...h,
                    time: Date.now(),
                });
            }
            this.history.push({
                data: diff,
                type: "delta",
                parentId: this.i,
                time: Date.now(),
                des: des || String(this.history.length),
            });
        }

        this.i = this.history.length - 1;
        this.cleanData();
        for (const f of this.changeEvent) {
            f();
        }
    }

    private cleanData() {
        this.tmpData = null;
        this.tmpDiff = null;
        this.des = "";
    }
    giveup() {
        this.cleanData();
    }

    getDataByI(i: number): Data {
        const h = this.history.at(i) as (typeof this.history)[0];
        const data =
            h.type === "key"
                ? h.data
                : this.applyFun(this.getDataByI(h.parentId), h.data);
        return data;
    }

    getData() {
        return structuredClone(this.getDataByI(this.i));
    }
    undo() {
        this.jump(this.i - 1);
    }
    unundo() {
        this.jump(this.i + 1);
    }
    jump(i: number) {
        this.i = Math.min(Math.max(i, 0), this.history.length - 1);
    }

    on(name: "change", fun: () => void) {
        if (name === "change") this.changeEvent.add(fun);
    }
    get index() {
        return this.i;
    }
    get list() {
        return this.history.map((i) => i.des);
    }
}

export default xhistory;

function getTestState() {
    return false;
}

if (getTestState()) {
    const history = new xhistory<string>([], "");

    function logList() {
        const l = structuredClone(history.history);
        console.log(l);
        return l;
    }

    console.assert(history.getData() === "");
    logList();

    history.setData("hi");
    console.assert(history.getData() === "");
    logList();

    history.apply();
    console.assert(history.getData() === "hi");
    logList();

    history.setData("hello");
    history.apply();

    history.setData("world");
    history.apply();

    history.undo();
    console.assert(history.getData() === "hello");

    history.undo();
    console.assert(history.getData() === "hi");

    history.unundo();
    console.assert(history.getData() === "hello");
    logList();

    history.setData("end");
    history.apply();
    history.setData("end");
    history.apply();
    const l = logList();
    console.assert(
        JSON.stringify(["", "hi", "hello", "world", "hello", "end"]) ===
            JSON.stringify(l.map((i) => i.data)),
    );
}

if (getTestState()) {
    const diff_match_patch = (await import("diff-match-patch")).default;
    const dmp = new diff_match_patch();

    const history = new xhistory<string, import("diff-match-patch").Diff[]>(
        [],
        "",
        {
            diff: (last, now) => {
                const diff = dmp.diff_main(last, now);
                if (diff.length === 1 && diff[0][0] === 0) return null;
                return diff;
            },
            apply: (data, diff) => {
                const patch = dmp.patch_make(diff);
                return dmp.patch_apply(patch, data)[0];
            },
        },
    );

    function logList() {
        const l = structuredClone(history.history);
        console.log(l);
        return l;
    }

    console.assert(history.getData() === "");
    logList();

    history.setData("he");
    history.apply();
    console.assert(history.getData() === "he");
    logList();

    history.setData("hello");
    history.apply();

    console.assert(history.getData() === "hello");

    history.undo();
    console.assert(history.getData() === "he");

    history.unundo();
    console.assert(history.getData() === "hello");
    logList();

    history.undo();
    history.setData("end");
    history.apply();
    // 重复
    history.setData("end");
    history.apply();
    const l = logList();

    console.assert(
        JSON.stringify(["", "he", "hello", "he", "end"]) ===
            JSON.stringify(l.map((_, i) => history.getDataByI(i))),
    );
}

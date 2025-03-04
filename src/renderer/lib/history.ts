class xhistory<Data> {
    history: { data: Data; time: number; des: string }[];
    i = -1;
    private tmpData: Data | null = null;
    private des = "";
    private changeEvent = new Set<() => void>();
    constructor(datas: typeof this.history, _initData: Data) {
        this.history = datas;
        this.history.unshift({
            des: "0",
            data: _initData,
            time: new Date().getTime(),
        });
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

    // todo 复制
    apply(des = this.des) {
        const data = structuredClone(this.tmpData);
        if (data) {
            this.history.push({ data, time: new Date().getTime(), des });
        }
        this.i = this.history.length - 1;
        this.des = "";
        for (const f of this.changeEvent) {
            f();
        }
    }
    giveup() {
        this.tmpData = null;
        this.des = "";
    }

    getData() {
        return structuredClone(this.history.at(this.i)?.data as Data);
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
}

export default xhistory;

// biome-ignore lint/correctness/noConstantCondition: test code
if (false) {
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
    const l = logList();
    console.assert(
        JSON.stringify(["", "hi", "hello", "world"]),
        JSON.stringify(l.map((i) => i.data)),
    );
}

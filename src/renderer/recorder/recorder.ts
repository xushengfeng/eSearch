/// <reference types="vite/client" />
import { initStyle, getImgUrl, setTitle, Class, cssColor } from "../root/root";
import {
    button,
    check,
    dynamicSelect,
    ele,
    image,
    input,
    label,
    p,
    txt,
} from "dkh-ui";
import { t } from "../../../lib/translate/translate";
import { view } from "dkh-ui";

import store from "../../../lib/store/renderStore";
initStyle(store);

setTitle(t("录屏"));

let recorder: MediaRecorder;

/** 临时保存的原始视频位置 */
let tmpPath: string;
/** 转换 */
let output: string;

let sS = false;
let stop = false;

const clipTime = Number(store.get("录屏.转换.分段")) * 1000;

const nameT: { s: number; e: number }[] = [{ s: 0, e: Number.NaN }];

const timeL: number[] = [];
function pTime() {
    const t = Date.now();
    timeL.push(t);
    let d = 0;
    for (let i = 0; i < timeL.length; i += 2) {
        if (timeL[i + 1]) d += timeL[i + 1] - timeL[i];
    }
}
function getT() {
    let t = 0;
    for (let i = 1; i < timeL.length - 1; i += 2) {
        t += timeL[i] - timeL[i - 1];
    }
    if (timeL.length % 2 === 0) {
        t += Date.now() - (timeL.at(-2) as number);
    } else {
        t += Date.now() - (timeL.at(-1) as number);
    }
    return t;
}
function setTime(t: string) {
    renderSend("recordTime", [t]);
    timeEl.sv(t);
}
function getTime() {
    if (recorder.state === "recording") {
        let t = 0;
        for (let i = 1; i < timeL.length - 1; i += 2) {
            t += timeL[i] - timeL[i - 1];
        }
        t += Date.now() - (timeL.at(-1) as number);
        const s = Math.trunc(t / 1000);
        const m = Math.trunc(s / 60);
        const h = Math.trunc(m / 60);
        setTime(
            `${h === 0 ? "" : `${h}:`}${m - 60 * h}:${String(
                s - 60 * m,
            ).padStart(2, "0")}`,
        );
    }
}

type mimeType =
    | "mp4"
    | "webm"
    | "gif"
    | "mkv"
    | "mov"
    | "avi"
    | "ts"
    | "mpeg"
    | "flv";
let type = store.get("录屏.转换.格式") as mimeType;

const audioStreamS = new Map<string, MediaStream>();
let stream: MediaStream;

const sysAudioName = "00";

let rect: [number, number, number, number];

// biome-ignore format:
const spawn = require("node:child_process").spawn as typeof import("child_process").spawn;
const fs = require("node:fs") as typeof import("fs");
const os = require("node:os") as typeof import("os");
const path = require("node:path") as typeof import("path");
import { renderOn, renderSend } from "../../../lib/ipc";
import type { IconType } from "../../iconTypes";
let pathToFfmpeg = "ffmpeg";
if (process.platform === "win32" || process.platform === "darwin") {
    const p = path.join(__dirname, "..", "..", "lib", "ffmpeg");
    const n = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
    pathToFfmpeg = path.join(p, n);
}
const start = spawn(pathToFfmpeg, ["-version"]);
start.on("error", () => {
    const m =
        process.platform === "linux"
            ? t("请安装FFmpeg，并确保软件可使用ffmpeg命令")
            : t("请重新安装软件，或进行反馈");
    renderSend("dialogMessage", [
        {
            message: `${t("FFmpeg用于处理视频，但现在软件无法使用它")}\n${m}`,
            buttons: [t("取消")],
        },
    ]);
});
console.log(pathToFfmpeg);

/** 自动分段 */
function c() {
    if (clipTime === 0) return;
    setTimeout(() => {
        if (!stop) {
            recorder.stop();
            c();
        }
    }, clipTime);
}

function cameraStreamF(b: boolean) {
    renderSend("recordCamera", [b]);
}

function resize() {
    const p = {
        h: videoPEl.el.offsetHeight,
        w: videoPEl.el.offsetWidth,
    };
    const c = {
        h: vpEl.el.offsetHeight,
        w: vpEl.el.offsetWidth,
    };
    const k0 = p.h / p.w;
    const k1 = c.h / c.w;
    if (k0 >= k1) {
        console.log(p.w, c.w);
        // @ts-ignore
        vpEl.el.style.zoom = p.w / c.w;
    } else {
        // @ts-ignore
        vpEl.el.style.zoom = p.h / c.h;
    }
}

let editting = false;

function setVideo(n: number) {
    videoEl.src = `${tmpPath}/${n}`;
}

/** 获取绝对时间 */
function getPlayT() {
    let t = 0;
    for (let i = 0; i < playName; i++) {
        t += nameT[i].e - nameT[i].s;
    }
    t += videoEl.currentTime * 1000;
    return t;
}

/** 通过绝对时间设定视频和其相对时间 */
function setPlayT(time: number) {
    const x = getTimeInV(time);
    setVideo(x.v);
    playName = x.v;
    videoEl.currentTime = x.time / 1000;
}

/** 获取绝对时间对应的视频和相对时间 */
function getTimeInV(time: number) {
    for (let i = 0; i < nameT.length; i++) {
        if (nameT[i].s <= time && time < (nameT?.[i + 1]?.s || nameT[i].e)) {
            return { v: i, time: time - nameT[i].s };
        }
    }
    return { v: 0, time: 0 };
}

function getAudioNames() {
    const names = Array.from(audioStreamS.keys());
    if (recordSysAudio) names.push(sysAudioName);
    return names;
}

function showControl() {
    editting = true;
    playEl.sv(true);
    if (cameraEl.gv) cameraStreamF(false);
    sEl.class("s_show");
    settingEl.style({ display: "none" });
    mEl.style({ backgroundColor: cssColor.bg });
    videoPEl.style({ transform: "" });
    segEl.remove();
    setVideo(0);
    videoEl.style.left = `${-rect[0]}px`;
    videoEl.style.top = `${-rect[1]}px`;
    vpEl.style({
        width: `${rect[2]}px`,
        minWidth: `${rect[2]}px`,
        height: `${rect[3]}px`,
        minHeight: `${rect[3]}px`,
    });
    clipV();
    saveEl.el.disabled = false;
    if (store.get("录屏.转换.自动转换")) {
        save();
    } else {
        renderSend("windowMax", []);
    }
    setTimeout(() => {
        resize();
        mEl.style({ transition: "none" });
    }, 400);
}

let playName = 0;

function clipV() {
    tStartEl.sv(0);
    setEndEl.el.click();

    tTEl.sv(tFormat(tEndEl.gv - tStartEl.gv));
    tNtEl.sv(tFormat(0));
}

/**
 *
 * @param x 输入秒
 */
function tFormat(x: number) {
    const t = x;
    const s = Math.trunc(t / 1000);
    const m = Math.trunc(s / 60);
    const h = Math.trunc(m / 60);
    return `${h === 0 ? "" : `${h}:`}${m - 60 * h}:${String(s - 60 * m).padStart(2, "0")}.${String(
        t % 1000,
    ).slice(0, 1)}`;
}

function videoPlay() {
    setPlayT(tStartEl.gv);
    videoEl.play();
}

const clipPath: string[] = [];
let isClipRun = false;
/** 获取要切割的视频和位置 */
async function clip() {
    if (isClipRun) return;
    isClipRun = true;
    const start = tStartEl.gv;
    const end = tEndEl.gv;
    const startV = getTimeInV(start);
    const endV = getTimeInV(end);
    const output1 = path.join(tmpPath, "output1");
    try {
        fs.rmSync(output1, { recursive: true });
    } catch (error) {}
    fs.mkdirSync(output1);
    function toArg(
        v: number,
        t: number,
        a: "start" | "end" | "both",
        t2: number,
    ) {
        const args: (string | number)[] = [];
        args.push("-i", path.join(output, `${v}.${type}`));
        if (a === "start") {
            args.push("-ss", t / 1000);
        } else if (a === "end") {
            args.push("-to", t / 1000);
        } else {
            args.push("-ss", t / 1000, "-to", t2 / 1000);
        }
        args.push(path.join(output1, `${v}.${type}`));
        return args.map((i) => String(i));
    }
    if (startV.v + 1 < endV.v) {
        for (let i = startV.v + 1; i < endV.v; i++) {
            fs.copyFileSync(
                path.join(output, `${i}.${type}`),
                path.join(output1, `${i}.${type}`),
            );
        }
    }
    for (let i = startV.v; i <= endV.v; i++) {
        clipPath.push(
            path
                .join(output1, `${i}.${type}`)
                .replaceAll(path.sep, path.posix.sep),
        );
    }
    if (startV.v === endV.v) {
        await runFfmpeg(
            "clip",
            0,
            toArg(startV.v, startV.time, "both", endV.time),
        );
    } else {
        await Promise.all([
            runFfmpeg("clip", 0, toArg(startV.v, startV.time, "start", 0)),
            runFfmpeg("clip", 1, toArg(endV.v, endV.time, "end", 0)),
        ]);
    }
}

function joinAndSave(filepath: string) {
    if (clipPath.length === 1) {
        fs.cpSync(clipPath[0], filepath);
        ffprocess.join[0] = { args: [], finish: "ok", logs: [], testCom: "" };
        updataPrEl(ffprocess);
        return;
    }
    const args: string[] = [];

    // 针对不同格式的合并（用switch还要加上作用域的话缩进就太多了）
    if (type === "gif") {
        for (const i of clipPath) {
            args.push("-i", i);
        }
        args.push("-filter_complex");
        let t = "";
        for (const i in clipPath) {
            t += `[${i}:v:0]`;
        }
        t += `concat=n=${clipPath.length}:v=1[outv]`;
        args.push(`"${t}"`, "-map", '"[outv]"');
    } else if (
        type === "webm" ||
        type === "mp4" ||
        type === "ts" ||
        type === "mkv" ||
        type === "mov" ||
        type === "flv" ||
        type === "mpeg"
    ) {
        let t = "";
        for (const i of clipPath) {
            t += `file ${i}\n`;
        }
        const textPath = path.join(tmpPath, "output1", "x.txt");
        fs.writeFileSync(textPath, t);
        args.push("-f", "concat", "-safe", "0", "-i", textPath, "-c", "copy");
    } else if (type === "avi") {
    }
    args.push(filepath);

    runFfmpeg("join", 0, args);
}

async function save() {
    store.set("录屏.转换.格式", 格式El.el.gv);
    renderSend("recordSavePath", [type]); // todo 可以使用promise控制流程
}

let savePath = "";
let isTsOk = false;

const prText = {
    wait: {
        ts: "等待转换",
        clip: "等待裁剪",
        join: "等待合并",
    },
    running: {
        ts: "正在转换",
        clip: "正在裁剪",
        join: "正在合并",
    },
    ok: {
        ts: "转换完成",
        clip: "裁剪完成",
        join: "合并完成",
    },
    error: {
        ts: "转换失败",
        clip: "裁剪失败",
        join: "合并失败",
    },
};

for (const i in prText) {
    for (const j in prText[i]) {
        prText[i][j] = t(prText[i][j]);
    }
}

function setFFState(type: keyof typeof prEl, n: number, state: prst) {
    ffprocess[type][n].finish = state;
    if (
        type === "ts" &&
        Object.values(ffprocess[type]).every((i) => i.finish === "ok")
    ) {
        if (savePath) {
            clip()
                .then(() => joinAndSave(savePath))
                .catch(() => {
                    isClipRun = false;
                });
        }
    }
}

function updataPrEl(pr: typeof ffprocess) {
    for (const i in pr) {
        const key = i as "ts" | "clip" | "join";
        const prILen = Object.keys(pr[key]).length;
        if (prILen === 0) {
            prEl[key].el.innerText = `${prText.wait[key]}`;
        } else {
            const stI: { [key in prst]: number } = {
                ok: 0,
                err: 0,
                running: 0,
            };
            for (const j in pr[key]) {
                stI[pr[key][j].finish]++;
            }
            if (stI.err > 0) {
                prEl[key].el.innerText =
                    `${prText.error[key]} ${t("点击重试")}`;
                prEl[key].class("pro_error");
                prEl[key].el.onclick = () => {
                    for (const i in pr[key]) {
                        if (pr[key][i].finish === "err") {
                            runFfmpeg(key, Number(i), pr[key][i].args);
                        }
                    }
                    logText.el.value += "\n\n重试\n\n";
                };
                logP.el.classList.remove("hide_log");
                for (const i in pr[key]) {
                    if (pr[key][i].finish === "err") {
                        logText.el.value += `\n命令：\n${pr[key][i].testCom}\n\n输出：\n${pr[key][i].logs.map((i) => i.text).join("\n")}`;
                    }
                }
                logText.el.scrollTop = logText.el.scrollHeight;
            } else if (stI.ok === prILen) {
                prEl[key].el.innerText = `${prText.ok[key]}`;
                prEl[key].el.style.width = "100%";
                prEl[key].class("pro_ok");
                if (key === "ts") {
                    isTsOk = true;
                    if (!savePath) {
                        prEl[key].el.innerText += ` ${t("等待保存")}`;
                    }
                }
            } else {
                prEl[key].el.innerText =
                    `${prText.running[key]} ${stI.running}/${prILen}`;
                prEl[key].el.style.width = `${(stI.running / prILen) * 100}%`;
                prEl[key].class("pro_running");
            }
        }
    }
}

type prst = "ok" | "err" | "running";

type P = {
    [k: number]: {
        args: string[];
        testCom: string;
        logs: { text: string }[];
        finish: "ok" | "err" | "running";
    };
};
const ffprocess: {
    [key in "ts" | "clip" | "join"]: P;
} = {
    ts: {},
    clip: {},
    join: {},
};

function runFfmpeg(type: "ts" | "clip" | "join", n: number, args: string[]) {
    const ffmpeg = spawn(pathToFfmpeg, args);
    ffprocess[type][n] = {
        args,
        testCom: `ffmpeg ${args.join(" ")}`,
        finish: "running",
        logs: [],
    };
    updataPrEl(ffprocess);
    return new Promise((re, rj) => {
        ffmpeg.on("close", (code) => {
            if (code === 0) {
                setFFState(type, n, "ok");
                updataPrEl(ffprocess);
                console.log(ffprocess);
                re(true);
            } else {
                setFFState(type, n, "err");
                updataPrEl(ffprocess);
                console.log(ffprocess);
                rj(false);
            }
        });
        ffmpeg.stdout.on("data", (data: Uint8Array) => {
            ffprocess[type][n].logs.push({ text: data.toString() });
            console.log(data.toString());
        });
        ffmpeg.stderr.on("data", (data: Uint8Array) => {
            ffprocess[type][n].logs.push({ text: data.toString() });
            console.log(data.toString());
        });
    });
}

function iconEl(src: IconType) {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}
function iconBEl(src: IconType) {
    return button().add(image(getImgUrl(`${src}.svg`), "icon").class("icon"));
}

class time_i extends HTMLElement {
    _value = 0;
    _min = 0;
    _max = 0;
    input = document.createElement("input");

    connectedCallback() {
        this._value = Number(this.getAttribute("value")) || 0;
        this._min = Number(this.getAttribute("min")) || 0;
        this._max = Number(this.getAttribute("max")) || 0;
        const i = document.createElement("span");
        this.appendChild(i);
        i.innerHTML = `<span contenteditable="true"></span>:<span contenteditable="true"></span>:<span contenteditable="true"></span>.<span contenteditable="true"></span>`;
        const 加减 = this.input;
        加减.type = "number";
        this.appendChild(加减);
        加减.max = this._max.toString();
        加减.min = this._min.toString();
        加减.value = this._value.toString();
        const [h, m, s, ss] = i.querySelectorAll("span");

        h.onfocus = () => {
            加减.step = "3600000";
        };
        m.onfocus = () => {
            加减.step = "60000";
        };
        s.onfocus = () => {
            加减.step = "1000";
        };
        ss.onfocus = () => {
            加减.step = "1";
        };

        h.oninput = () => {
            r(h, "0", Number.POSITIVE_INFINITY);
        };
        m.oninput = () => {
            r(m, "00", 60);
        };
        s.oninput = () => {
            r(s, "00", 60);
        };
        ss.oninput = () => {
            r(ss, "000", 1000);
        };
        /**
         *
         * @param {HTMLSpanElement} el
         * @param {string} dv
         * @param {number} max
         */
        const r = (el: HTMLSpanElement, dv: string, max: number) => {
            if (Number.isNaN(Number(el.innerText))) {
                el.innerText = "";
            } else {
                let tf = false;
                switch (el) {
                    case ss:
                        tf = 0 <= this.n(ss) && this.n(ss) < max;
                        break;
                    case s:
                        tf = 0 <= this.n(s) && this.n(s) < max;
                        break;
                    case m:
                        tf = 0 <= this.n(m) && this.n(m) < max;
                        break;
                    case h:
                        tf = 0 <= this.n(h) && this.n(h) < max;
                        break;
                }
                if (tf) {
                    if (
                        this.sum_value() > this._max ||
                        this.sum_value() < this._min
                    ) {
                        el.innerText = dv;
                        加减.value = this.sum_value().toString();
                    } else {
                        this._value = this.sum_value();
                        加减.value = this.sum_value().toString();
                    }
                } else {
                    el.innerText = dv;
                    加减.value = this.sum_value().toString();
                }
            }
        };

        加减.oninput = () => {
            this.set_value(Number(加减.value));
            this.dispatchEvent(new Event("input"));
        };
    }

    /** @param {HTMLSpanElement} el*/
    n(el) {
        return Number(el.innerText);
    }

    set_value(v: number) {
        this._value = v;
        const tn = v % 1000;
        const sn = Math.trunc(v / 1000);
        const mn = Math.trunc(sn / 60);
        const hn = Math.trunc(mn / 60);
        const [h, m, s, ss] =
            // @ts-ignore
            this.querySelector("span").querySelectorAll("span");
        h.innerText = String(hn);
        m.innerText = String(mn - 60 * hn);
        s.innerText = String(sn - 60 * mn).padStart(2, "0");
        ss.innerText = String(tn).padStart(3, "0");
    }

    sum_value() {
        const [h, m, s, ss] =
            // @ts-ignore
            this.querySelector("span").querySelectorAll("span");
        const [hn, mn, sn, ssn] = [h, m, s, ss].map((v) => this.n(v));
        const v = hn * 3600000 + mn * 60000 + sn * 1000 + ssn;
        return v;
    }

    get value() {
        return this._value;
    }
    set value(v: number) {
        this.set_value(v);
        this.setAttribute("value", String(v));
        this.input.value = v.toString();
    }
    get max() {
        return this._max;
    }
    set max(x) {
        const v = Number(x) || 0;
        this._max = v;
        this.setAttribute("max", String(v));
        this.input.max = v.toString();
    }
    get min() {
        return this._min;
    }
    set min(x) {
        const v = Number(x) || 0;
        this._max = v;
        this.setAttribute("min", String(v));
        this.input.min = v.toString();
    }
    get gv() {
        return this.value;
    }
    sv(v: number) {
        this.set_value(v);
    }
    set svc(v: number) {
        this.set_value(v);
    }
}

window.customElements.define("time-i", time_i);

const mEl = view().attr({ id: "m" }).addInto();
const startStop = button()
    .add(iconEl("start_record").style({ filter: "none" }))
    .attr({ id: "start_stop" })
    .style({ width: "80px", height: "80px" })
    .on("click", () => {
        if (sS) {
            if (!recordSysAudio) {
                const audioTracks = stream.getAudioTracks();
                for (const i of audioTracks) {
                    i.stop();
                    stream.removeTrack(i);
                }
            }
            for (const a of audioStreamS.values()) {
                for (const i of a.getAudioTracks()) stream.addTrack(i);
            }
            recorder.start();
            格式El.el.style({ display: "none" });
            type = 格式El.el.gv as mimeType;
            startStop
                .clear()
                .add(iconEl("stop_record").style({ filter: "none" }));
            settingEl
                .clear()
                .add([
                    startStop,
                    view("x")
                        .add([timeEl, cancelEl])
                        .style({ alignItems: "center" }),
                ]);
            pTime();
            setInterval(getTime, 500);
            sS = false;
            renderSend("recordStart", []);

            c();
        } else {
            stop = true;
            recorder.stop();
            for (const i of stream.getTracks()) {
                i.stop();
            }
            for (const s of audioStreamS.values())
                for (const t of s.getTracks()) {
                    t.stop();
                }

            pTime();
        }
    });

const timeEl = txt().class(Class.mono);
const cancelEl = iconBEl("close").on("click", () => {
    recorder.stop();
    for (const i of stream.getTracks()) {
        i.stop();
    }
    for (const s of audioStreamS.values())
        for (const t of s.getTracks()) {
            t.stop();
        }

    renderSend("recordStop", []);
    renderSend("windowClose", []);
});

const cameraEl = check("camera")
    .attr({ id: "camera" })
    .on("click", () => {
        try {
            cameraStreamF(cameraEl.gv);
            store.set("录屏.摄像头.开启", cameraEl.gv);
        } catch (e) {
            console.error(e);
        }
    });
const micList = view("y");

const 格式El = dynamicSelect();
const types: mimeType[] = [
    "mp4",
    "webm",
    "gif",
    "mkv",
    "mov",
    "ts",
    "mpeg",
    "flv",
];
格式El.setList(types.map((i) => ({ value: i, text: i })));
格式El.el.el.value = type;

const settingEl = view("y")
    .style({
        position: "fixed",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
    })
    .class(Class.gap)
    .add([
        startStop,
        view("y")
            .add([
                view("y").add([t("格式"), 格式El.el]),
                view("y").add([t("选择输入音频"), micList]),
                view("y").add([t("摄像头"), label([cameraEl, t("开启")])]),
            ])
            .class(Class.gap),
    ])
    .addInto();

const waitTip = ele("dialog")
    .add([
        p(t("等待录屏权限和录音权限获取")),
        p(t("或者在系统设置手动批准权限")),
    ])
    .addInto();
waitTip.el.showModal();

const videoPEl = view().attr({ id: "video" }).addInto(mEl);
const vpEl = view().attr({ id: "v_p" }).addInto(videoPEl);
const videoEl = ele("video").style({ maxWidth: "none" }).addInto(vpEl).el;
const segEl = view().attr({ id: "seg" }).addInto(vpEl);

videoEl.onpause = () => {
    playEl.sv(true);
};
videoEl.onplay = () => {
    playEl.sv(false);
};

videoEl.ontimeupdate = () => {
    if (!editting) return;
    tNtEl.sv(tFormat(getPlayT() - tStartEl.gv));
    if (getPlayT() > tEndEl.gv) {
        videoEl.pause();
        tNtEl.sv(tTEl.gv);
    }
    jdtEl.sv(getPlayT());
};

videoEl.onended = () => {
    if (playName < nameT.length - 1) {
        playName++;
        setVideo(playName);
        videoEl.play();
    } else {
        tNtEl.sv(tTEl.gv);
        jdtEl.svc = Number(jdtEl.el.max);
    }
};

const sEl = view().attr({ id: "s" }).class(Class.smallSize).addInto(mEl);

const jdtEl = input("range")
    .attr({ id: "jdt" })
    .bindGet((el) => Number(el.value))
    .bindSet((v: number, el) => {
        el.value = String(v);
    })
    .on("input", () => {
        setPlayT(jdtEl.gv);
    });

const tStartEl = document.createElement("time-i") as time_i;
tStartEl.id = "t_start";
const tNtEl = txt()
    .attr({ id: "t_nt" })
    .bindSet((v: string, el) => {
        el.innerText = v;
    });
const tTEl = txt()
    .attr({ id: "t_t" })
    .bindSet((v: string, el) => {
        el.innerText = v;
        el.setAttribute("t", v);
    })
    .bindGet((el) => {
        return el.getAttribute("t") ?? "";
    });
const tEndEl = document.createElement("time-i") as time_i;
tEndEl.id = "t_end";

tStartEl.oninput = () => {
    const t = tStartEl.gv / 1000;
    videoEl.currentTime = tEndEl.min = t;
    jdtEl.el.min = String(t);
    tTEl.sv(tFormat(tEndEl.gv - tStartEl.gv));
};
tEndEl.oninput = () => {
    const t = tEndEl.gv / 1000;
    videoEl.currentTime = tStartEl.max = t;
    jdtEl.el.max = String(t);
    tTEl.sv(tFormat(tEndEl.gv - tStartEl.gv));
};

const playEl = check("play", [iconEl("recume"), iconEl("pause")])
    .attr({ id: "v_play" })
    .style({
        display: "inline-block",
    })
    .on("change", () => {
        if (playEl.gv) {
            videoEl.pause();
        } else {
            videoPlay();
        }
    });
const setEndEl = iconBEl("right")
    .attr({ id: "b_t_end" })
    .on("click", () => {
        const last = timeL.at(-1) as number;
        const max = last - timeL[0];
        jdtEl.attr({ max: String(max) });
        tEndEl.svc = tStartEl.max = tEndEl.max = last - timeL[0];
    });

const saveEl = iconBEl("save")
    .attr({ id: "save", disabled: true })
    .on("click", () => save());

const proEl = (id: string) =>
    view()
        .class("pro_p")
        .add(
            view()
                .class("pro")
                .attr({ id: `pr_${id}` }),
        );

const prTs = proEl("ts");
const prClip = proEl("clip");
const prJoin = proEl("join");

const prEl = {
    ts: prTs,
    clip: prClip,
    join: prJoin,
};

updataPrEl(ffprocess);

const logP = ele("details").attr({ id: "log_p" }).class("hide_log");
const logText = ele("textarea").attr({ id: "log", cols: 30, rows: 10 });
logP.add([ele("summary").add(t("FFmpeg 错误日志")), logText]);

sEl.add([
    jdtEl,
    ele("br"),
    t("开始时间："),
    tStartEl,
    tNtEl,
    " / ",
    tTEl,
    playEl,
    t("结束时间："),
    tEndEl,
    setEndEl,
    saveEl,
    prTs,
    prClip,
    prJoin,
    logP,
]);

const devices = await navigator.mediaDevices.enumerateDevices();
const audioL = devices.filter((i) => i.kind === "audioinput");
let recordSysAudio = false;
const canSysAudio = store.get("录屏.音频.启用系统内录");
if (canSysAudio)
    micList.add(
        label([check(""), t("系统音频")])
            .on("input", (_, el) => {
                recordSysAudio = el.gv;
                store.set("录屏.音频.设备列表", getAudioNames());
            })
            .sv(store.get("录屏.音频.设备列表").includes(sysAudioName)),
    );

const audioRmb = store.get("录屏.音频.设备列表");
for (const i of audioL) {
    const el = label([check(""), i.label || i.deviceId]).sv(
        audioRmb.includes(i.deviceId),
    );
    set(el.gv);
    async function set(v: boolean) {
        if (v) {
            const audioStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: i.deviceId },
                video: false,
            });
            audioStreamS.set(i.deviceId, audioStream);
        } else {
            const s = audioStreamS.get(i.deviceId);
            if (s) {
                for (const t of s.getTracks()) {
                    t.stop();
                }
            }
            audioStreamS.delete(i.deviceId);
        }
    }
    el.on("input", async () => {
        await set(el.gv);
        store.set("录屏.音频.设备列表", getAudioNames());
    });
    micList.add(el);
}
if (!canSysAudio && audioL.length === 0) {
    micList.add(t("无音频输入设备"));
}

if (store.get("录屏.摄像头.开启")) {
    try {
        cameraStreamF(true);
        cameraEl.sv(true);
    } catch (e) {
        console.error(e);
    }
}

document.body.onresize = resize;

renderOn("recordInit", async ([sourceId, r, screen_w, screen_h]) => {
    waitTip.remove();
    rect = r;
    sS = true;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: canSysAudio // 可能会导致应用崩溃，所以添加这个设置
                ? {
                      // @ts-ignore
                      mandatory: {
                          chromeMediaSource: "desktop",
                      },
                  }
                : false,
            video: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: "desktop",
                    chromeMediaSourceId: sourceId,
                    minWidth: screen_w,
                    minHeight: screen_h,
                },
            },
        });
    } catch (e) {
        console.error(e);
    }
    if (!stream) return;
    let chunks: Blob[] = [];
    recorder = new MediaRecorder(stream, {
        videoBitsPerSecond: store.get("录屏.视频比特率") * 10 ** 6,
        mimeType: "video/webm",
    });
    recorder.ondataavailable = (e) => {
        chunks.push(e.data);
    };

    const fileName = String(Date.now());
    tmpPath = path.join(os.tmpdir(), "eSearch/", fileName);
    output = path.join(tmpPath, "output");
    fs.mkdirSync(tmpPath);
    fs.mkdirSync(output);
    let clipName = 0;
    function save(f: () => void) {
        const b = new Blob(chunks, { type: "video/webm" });
        console.log(chunks, b);
        const reader = new FileReader();
        reader.readAsArrayBuffer(b);
        reader.onloadend = (_e) => {
            const baseName = String(clipName);
            const baseName2 = `${baseName}.${type}`;
            const p = path.join(tmpPath, baseName);
            const crop =
                type === "gif" && store.get("录屏.转换.高质量gif")
                    ? `[in]crop=${rect[2]}:${rect[3]}:${rect[0]}:${rect[1]},split[split1][split2];[split1]palettegen=stats_mode=single[pal];[split2][pal]paletteuse=new=1`
                    : `crop=${rect[2]}:${rect[3]}:${rect[0]}:${rect[1]}`;
            const args = ["-i", p, "-vf", crop, path.join(output, baseName2)];
            fs.writeFile(p, Buffer.from(reader.result as string), (_err) => {
                runFfmpeg("ts", clipName, args);
                chunks = [];
                if (f) f();
                clipName++;
            });
        };
    }

    recorder.onstop = () => {
        (nameT.at(-1) as (typeof nameT)[0]).e = getT();
        if (stop) {
            renderSend("recordStop", []);
            save(showControl);
            console.log(nameT);
        } else {
            save(() => {});
            recorder.start();
            nameT.push({ s: getT(), e: Number.NaN });
        }
    };

    if (store.get("录屏.自动录制") === true) {
        let t = store.get("录屏.自动录制延时");
        function d() {
            if (recorder.state !== "inactive") return;
            setTime(String(t));
            setTimeout(() => {
                if (t === 0) {
                    startStop.el.click();
                } else {
                    t--;
                    d();
                }
            }, 1000);
        }
        d();
    }
});

renderOn("recordStartStop", () => {
    startStop.el.click();
});

renderOn("recordSavePathReturn", ([arg]) => {
    savePath = arg;
    if (isTsOk)
        clip()
            .then(() => joinAndSave(arg))
            .catch(() => {
                isClipRun = false;
            });
});

renderOn("recordState", ([s]) => {
    if (s === "stop") {
        startStop.el.click();
    } else if (s === "pause") {
        if (recorder.state === "inactive") return;
        if (recorder.state === "recording") {
            recorder.pause();
            pTime();
        } else if (recorder.state === "paused") {
            recorder.resume();
            pTime();
        }
    }
});

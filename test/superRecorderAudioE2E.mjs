// 超级录屏音频功能端到端验证（CDP 驱动，无需人工交互）
//
// 前置：pnpm run build，需要图形环境（X11/Wayland）与 ffprobe
// 运行：node test/superRecorderAudioE2E.mjs
//
// 流程：启动打包后的 Electron（fake 音频设备 + fake 音频文件）→ 打开超级录屏窗口
// → 录制中展开音频面板勾选麦克风、检查实时电平 → 停止录制并等待变换
// → 预览播放（检查是否创建音频节点）→ 导出 mp4/webm → ffprobe 校验音轨
// → 检查设备选择已持久化。
// 全部通过 exit 0，否则 exit 1；产物与日志在 os.tmpdir()/esearch-superRecorder-audio-e2e。
import { spawn, execFileSync } from "node:child_process";
import {
    mkdirSync,
    writeFileSync,
    readdirSync,
    rmSync,
    readFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

// 按名字找图标（构建后资源带 hash，如 mic-DiR6_Fzp.svg）
const imgFinder = (name) =>
    `[...document.images].find(i => new RegExp("/${name}[-.][^/]*\\\\.svg").test(i.src))`;

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(os.tmpdir(), "esearch-superRecorder-audio-e2e");
const OUT = path.join(DIR, "out");
const USER_DATA = path.join(DIR, "userData");
const WAV = path.join(DIR, "tone.wav");
const DEBUG_PORT = 9333;
const INSPECT_PORT = 9334;

mkdirSync(OUT, { recursive: true });
mkdirSync(USER_DATA, { recursive: true });
// 清空上次产物，避免误判
for (const f of readdirSync(OUT)) {
    try {
        rmSync(path.join(OUT, f));
    } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function genWav(file) {
    const sr = 48000;
    const secs = 30;
    const n = sr * secs;
    const data = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
        const t = i / sr;
        const v =
            0.35 * Math.sin(2 * Math.PI * 440 * t) +
            0.2 * Math.sin(2 * Math.PI * 660 * t) +
            0.1 * Math.sin(2 * Math.PI * 880 * t);
        const s = Math.max(-1, Math.min(1, v));
        const int16 = Math.round(s * 32000);
        data.writeInt16LE(int16, i * 4);
        data.writeInt16LE(int16, i * 4 + 2);
    }
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(2, 22);
    header.writeUInt32LE(sr, 24);
    header.writeUInt32LE(sr * 4, 28);
    header.writeUInt16LE(4, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(data.length, 40);
    writeFileSync(file, Buffer.concat([header, data]));
}
genWav(WAV);

writeFileSync(
    path.join(USER_DATA, "config.json"),
    JSON.stringify(
        {
            保存: {
                快速保存: true,
                保存路径: { 视频: OUT, 图片: OUT },
            },
            录屏: {
                超级录屏: { 格式: "mp4" },
                音频: { 设备列表: [], 启用系统内录: true },
            },
        },
        null,
        2,
    ),
);

// ---------- CDP ----------
class Session {
    constructor(ws) {
        this.ws = ws;
        this.id = 0;
        this.pending = new Map();
        this.listeners = [];
        ws.onmessage = (e) => {
            const m = JSON.parse(e.data);
            if (m.id && this.pending.has(m.id)) {
                const { res, rej } = this.pending.get(m.id);
                this.pending.delete(m.id);
                if (m.error) rej(new Error(m.error.message));
                else res(m.result);
            } else {
                for (const fn of this.listeners) fn(m);
            }
        };
    }
    static connect(url) {
        const ws = new WebSocket(url);
        return new Promise((res, rej) => {
            ws.onopen = () => res(new Session(ws));
            ws.onerror = (e) => rej(e);
        });
    }
    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((res, rej) => {
            this.pending.set(id, { res, rej });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    on(fn) {
        this.listeners.push(fn);
    }
    async eval(expression, timeout = 60000) {
        let timer = 0;
        try {
            const r = await Promise.race([
                this.send("Runtime.evaluate", {
                    expression,
                    awaitPromise: true,
                    returnByValue: true,
                }),
                new Promise((_, rej) => {
                    timer = setTimeout(
                        () =>
                            rej(
                                new Error(
                                    `CDP eval 超时: ${String(expression).slice(0, 80)}`,
                                ),
                            ),
                        timeout,
                    );
                }),
            ]);
            if (r.exceptionDetails) {
                throw new Error(
                    JSON.stringify(
                        r.exceptionDetails.exception ?? r.exceptionDetails.text,
                    ),
                );
            }
            return r.result?.value;
        } finally {
            clearTimeout(timer);
        }
    }
    close() {
        try {
            this.ws.close();
        } catch {}
    }
}

async function jsonList(port) {
    try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        return await r.json();
    } catch {
        return null;
    }
}
async function waitTarget(port, pred, timeout = 30000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        const list = await jsonList(port);
        if (list) {
            const t = list.find(pred);
            if (t) return t;
        }
        await sleep(300);
    }
    throw new Error(`target not found on :${port} in ${timeout}ms`);
}

// ---------- 启动 ----------
/** 上次被中断的运行会留下占用调试端口的 Electron，先清理 */
function killStale() {
    const pids = [];
    for (const d of readdirSync("/proc")) {
        if (!/^\d+$/.test(d)) continue;
        let cmd = "";
        try {
            cmd = readFileSync(`/proc/${d}/cmdline`, "utf8");
        } catch {
            continue;
        }
        if (cmd.includes(USER_DATA) && cmd.includes("electron")) {
            pids.push(Number(d));
        }
    }
    for (const p of pids) {
        try {
            process.kill(p, "SIGKILL");
        } catch {}
    }
    if (pids.length) console.log("已清理残留进程:", pids.join(", "));
}
killStale();

const electron = path.join(ROOT, "node_modules", ".bin", "electron");
const child = spawn(
    electron,
    [
        path.join(ROOT, "out", "main", "main.js"),
        `--userData=${USER_DATA}`,
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${WAV}`,
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--inspect=${INSPECT_PORT}`,
        "--autoplay-policy=no-user-gesture-required",
        "--no-sandbox",
        "--disable-gpu",
    ],
    // detached：独立进程组，退出时整组回收，避免残留 Electron
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true },
);
/** 结束本次启动的整个 Electron 进程组 */
function killElectron() {
    if (!child.pid) return;
    try {
        process.kill(-child.pid, "SIGKILL");
    } catch {
        try {
            child.kill("SIGKILL");
        } catch {}
    }
}
process.on("exit", killElectron);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => {
        killElectron();
        process.exit(130);
    });
}
let electronLog = "";
child.stdout.on("data", (d) => {
    electronLog += d;
});
child.stderr.on("data", (d) => {
    electronLog += d;
});

const result = { ok: [], fail: [] };
function step(msg) {
    console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);
}
// 看门狗：确保脚本一定会退出，并回收 Electron
setTimeout(() => {
    console.log("WATCHDOG timeout, aborting");
    result.fail.push("watchdog");
    killElectron();
    process.exit(2);
}, 600000).unref?.();
const t0 = Date.now();
function check(name, cond, extra = "") {
    if (cond) {
        result.ok.push(name);
        console.log(`✅ ${name} ${extra}`);
    } else {
        result.fail.push(name);
        console.log(`❌ ${name} ${extra}`);
    }
}
let msgMark = 0;
function dumpMsgs(step, all = false) {
    const fresh = consoleMsgs.slice(msgMark);
    msgMark = consoleMsgs.length;
    const errs = fresh.filter(
        (m) => m.type === "exception" || m.type === "error",
    );
    for (const e of errs)
        console.log(
            `--- ${step} 错误:`,
            String(e.text).slice(0, 300).replace(/\n/g, " | "),
        );
    if (all) {
        for (const m of fresh)
            console.log(`--- ${step}:`, m.type, String(m.text).slice(0, 100));
    }
}

let page;
let main;
const consoleMsgs = [];
try {
    // 主进程（node inspector）
    const nodeT = await waitTarget(INSPECT_PORT, (t) => t.type === "node", 40000);
    main = await Session.connect(nodeT.webSocketDebuggerUrl);
    await main.send("Runtime.enable");
    console.log("connected to main");

    // 打开超级录屏窗口（复刻 main.ts createSuperRecorderWindow）
    const created = await main.eval(`
        (() => {
            const { BrowserWindow, desktopCapturer } = process.mainModule.require("electron");
            const w = new BrowserWindow({
                width: 1280, height: 800, show: true,
                webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false },
            });
            globalThis.__sr = w;
            w.loadFile("${path.join(ROOT, "out", "renderer", "videoEditor.html")}");
            w.webContents.on("did-finish-load", () => {
                desktopCapturer.getSources({ types: ["screen"] })
                    .then((s) => w.webContents.send("ipc", "superRecorderInit", [s[0].id]))
                    .catch((e) => console.error("srtest", e));
            });
            return "ok";
        })()
    `);
    console.log("create window:", created);

    const pageT = await waitTarget(
        DEBUG_PORT,
        (t) => t.url && t.url.includes("videoEditor.html"),
        30000,
    );
    page = await Session.connect(pageT.webSocketDebuggerUrl);
    await page.send("Runtime.enable");
    await page.send("Log.enable");
    page.on((m) => {
        if (m.method === "Runtime.consoleAPICalled") {
            const args = (m.params.args || [])
                .map((a) => a.value ?? a.description ?? "")
                .join(" ");
            consoleMsgs.push({ type: m.params.type, text: args });
        } else if (m.method === "Runtime.exceptionThrown") {
            const d = m.params.exceptionDetails;
            consoleMsgs.push({
                type: "exception",
                text: `${d.text} ${d.exception?.description ?? ""}`,
            });
        } else if (m.method === "Log.entryAdded") {
            consoleMsgs.push({
                type: m.params.entry.level,
                text: m.params.entry.text,
            });
        }
    });
    console.log("recorder window:", pageT.url);

    // 录制面板出现（说明录制已开始）
    await sleep(8000);
    const hasStop = await page.eval(`!!${imgFinder("stop_record")}`);
    check("录制面板出现", hasStop);

    // 设备枚举
    const devices = await page.eval(`
        (async () => {
            const ds = await navigator.mediaDevices.enumerateDevices();
            return ds.map(d => ({ kind: d.kind, id: d.deviceId, label: d.label }));
        })()
    `);
    console.log("devices:", JSON.stringify(devices));

    // 打点：记录播放时创建的音频节点
    await page.eval(`
        (() => {
            window.__starts = [];
            const origStart = AudioBufferSourceNode.prototype.start;
            AudioBufferSourceNode.prototype.start = function (...a) {
                window.__starts.push(a.map(x => (typeof x === "number" ? x : String(x))));
                return origStart.apply(this, a);
            };
            const origCreate = AudioContext.prototype.createBufferSource;
            window.__createCount = 0;
            AudioContext.prototype.createBufferSource = function (...a) {
                window.__createCount++;
                return origCreate.apply(this, a);
            };
            return "patched";
        })()
    `);

    // 打开音频面板并勾选第一个输入设备
    const audioSel = await page.eval(`
        (() => {
            const img = ${imgFinder("mic")};
            const btn = img && img.closest("button");
            if (!btn) return "no-mic-btn";
            btn.click();
            return "clicked";
        })()
    `);
    console.log("mic panel:", audioSel);
    check("录制面板有麦克风按钮", audioSel === "clicked");
    await sleep(800);
    const checkInfo = await page.eval(`
        (() => {
            const overlay = [...document.querySelectorAll("div")].find(
                d => d.style.position === "fixed" && d.style.zIndex === "9",
            );
            if (!overlay) return "no-overlay";
            const inputs = [...overlay.querySelectorAll('input[type="checkbox"]')];
            if (inputs.length === 0) return "no-inputs";
            inputs[0].click();
            return inputs.length + ":" + (inputs[0].closest("label")?.innerText || "");
        })()
    `);
    console.log("audio check:", checkInfo);
    check("音频列表可勾选设备", String(checkInfo).includes(":"), String(checkInfo));
    await sleep(500);
    const checked = await page.eval(`
        (() => {
            const overlay = [...document.querySelectorAll("div")].find(
                d => d.style.position === "fixed" && d.style.zIndex === "9",
            );
            const inputs = [...overlay.querySelectorAll('input[type="checkbox"]')];
            return inputs.map(i => i.checked).join(",");
        })()
    `);
    console.log("checked:", checked);
    check("设备勾选生效", checked.startsWith("true"), checked);
    await sleep(4000);
    const level = await page.eval(`
        (() => {
            const overlay = [...document.querySelectorAll("div")].find(
                d => d.style.position === "fixed" && d.style.zIndex === "9",
            );
            const bar = overlay && [...overlay.querySelectorAll("div")].find(d => d.style.width === "120px");
            return bar ? bar.firstElementChild.style.width : "no-bar";
        })()
    `);
    console.log("level:", level);
    check("音量电平有反应", level !== "no-bar" && level !== "0%", level);
    await sleep(4000);

    // 停止录制
    await page.eval(`
        (() => {
            const img = ${imgFinder("stop_record")};
            const el = img && img.parentElement;
            el && el.click();
            return !!el;
        })()
    `);
    // 等待补帧 + 变换完成（缩略图出现）
    let ready = false;
    for (let i = 0; i < 120; i++) {
        await sleep(1000);
        const n = await page.eval(`document.querySelectorAll("canvas").length`);
        const overlayGone = await page.eval(
            `![...document.querySelectorAll("div")].some(d => d.style.position === "fixed" && d.style.zIndex === "9")`,
        );
        if (overlayGone && n >= 5) {
            ready = true;
            break;
        }
    }
    check("录制结束并完成变换", ready, `(canvas=${await page.eval("document.querySelectorAll('canvas').length")})`);
    dumpMsgs("变换完成", true);

    // 预览播放 3 秒
    const clickedPlay = await page.eval(`
        (() => {
            const img = ${imgFinder("pause")};
            const el = img && img.parentElement;
            el && el.click();
            return !!el;
        })()
    `);
    check("可点击播放", clickedPlay);
    await sleep(1500);
    dumpMsgs("播放1.5s");
    await sleep(1500);
    dumpMsgs("播放3s");
    const playInfo = await page.eval(
        `JSON.stringify({ starts: window.__starts, create: window.__createCount })`,
    );
    const paused = await page.eval(`
        (() => {
            const img = ${imgFinder("recume")} || ${imgFinder("pause")};
            const el = img && img.parentElement;
            el && el.click();
            return !!el;
        })()
    `);
    await sleep(800);
    dumpMsgs("暂停后");
    console.log("play:", playInfo, "paused:", paused);
    let createOk = false;
    try {
        createOk = JSON.parse(playInfo).create === 1;
    } catch {}
    check(
        "预览播放创建了音频节点",
        createOk,
        String(playInfo).slice(0, 200),
    );

    // 导出 mp4
    await page.eval(`
        (() => {
            const img = ${imgFinder("save")};
            const btn = img && img.closest("button");
            btn && btn.click();
            return !!btn;
        })()
    `);
    let mp4 = "";
    for (let i = 0; i < 120; i++) {
        await sleep(1000);
        const files = readdirSync(OUT).filter((f) => f.endsWith(".mp4"));
        if (files.length) {
            mp4 = path.join(OUT, files[0]);
            break;
        }
    }
    check("导出 mp4", !!mp4, mp4);

    if (mp4) {
        const info = execFileSync(
            "ffprobe",
            ["-v", "error", "-show_entries", "stream=index,codec_type,codec_name,duration", "-of", "json", mp4],
            { encoding: "utf8" },
        );
        console.log("ffprobe mp4:", info);
        const parsed = JSON.parse(info);
        const audio = (parsed.streams || []).find((s) => s.codec_type === "audio");
        check("mp4 包含音频流", !!audio, audio ? `${audio.codec_name} ${audio.duration}s` : "");
    }

    // 切到 webm 再导出一次
    const selOk = await page.eval(`
        (() => {
            const s = [...document.querySelectorAll("select")].find(sel =>
                [...sel.options].some(o => o.value === "webm"),
            );
            if (!s) return "no-select";
            s.value = "webm";
            s.dispatchEvent(new Event("change", { bubbles: true }));
            return "ok";
        })()
    `);
    console.log("switch webm:", selOk);
    await sleep(500);
    await page.eval(`
        (() => {
            const img = ${imgFinder("save")};
            const btn = img && img.closest("button");
            btn && btn.click();
            return !!btn;
        })()
    `);
    let webm = "";
    for (let i = 0; i < 120; i++) {
        await sleep(1000);
        const files = readdirSync(OUT).filter((f) => f.endsWith(".webm"));
        if (files.length) {
            webm = path.join(OUT, files[0]);
            break;
        }
    }
    check("导出 webm", !!webm, webm);
    if (webm) {
        const info = execFileSync(
            "ffprobe",
            ["-v", "error", "-show_entries", "stream=index,codec_type,codec_name,duration", "-of", "json", webm],
            { encoding: "utf8" },
        );
        console.log("ffprobe webm:", info);
        const parsed = JSON.parse(info);
        const audio = (parsed.streams || []).find((s) => s.codec_type === "audio");
        check("webm 包含音频流", !!audio, audio ? `${audio.codec_name} ${audio.duration}s` : "");
    }
} catch (e) {
    console.log("FATAL:", e);
    result.fail.push("fatal: " + e.message);
} finally {
    try {
        const cfg = JSON.parse(
            readFileSync(path.join(USER_DATA, "config.json"), "utf8"),
        );
        const dl = cfg?.录屏?.音频?.设备列表;
        check(
            "设备选择已持久化",
            Array.isArray(dl) && dl.length > 0,
            JSON.stringify(dl),
        );
    } catch (e) {
        check("设备选择已持久化", false, String(e));
    }
    const errs = consoleMsgs.filter(
        (m) => m.type === "exception" || m.type === "error",
    );
    console.log("\n=== console errors/exceptions ===");
    for (const e of errs) console.log(e.type, ":", String(e.text).slice(0, 500));
    console.log("=== console (all, tail) ===");
    for (const m of consoleMsgs.slice(-40))
        console.log(m.type, ":", String(m.text).slice(0, 200));
    writeFileSync(path.join(DIR, "electron.log"), electronLog);
    // 回收整个 Electron 进程组，避免残留
    killElectron();
    try {
        page?.close();
        main?.close();
    } catch {}
}

console.log("\n=== RESULT ===");
console.log("ok:", result.ok.length, "fail:", result.fail.length);
for (const f of result.fail) console.log("FAIL:", f);
process.exit(result.fail.length ? 1 : 0);

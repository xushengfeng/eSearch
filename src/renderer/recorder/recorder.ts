/// <reference types="vite/client" />
import root_init from "../root/root";
root_init();
import "../../../lib/template2.js";
import pause_svg from "../assets/icons/pause.svg";
import recume_svg from "../assets/icons/recume.svg";

const mic_el = document.getElementById("mic") as HTMLInputElement;
const camera_el = document.getElementById("camera") as HTMLInputElement;
const save_el = document.getElementById("save") as HTMLButtonElement;
const 格式_el = document.getElementById("格式") as HTMLInputElement;
const 码率_el = document.getElementById("码率") as HTMLInputElement;
const 帧率_el = document.getElementById("帧率") as HTMLInputElement;
const 其他参数_el = document.getElementById("其他参数") as HTMLInputElement;
const t_start_el: time_el = document.getElementById("t_start") as unknown as time_el;
const t_end_el = document.getElementById("t_end") as unknown as time_el;
const jdt_el = document.getElementById("jdt") as unknown as time_el;

type time_el = {
    value: number;
    min: number;
    max: number;
} & HTMLElement;

let config_path = new URLSearchParams(location.search).get("config_path");
const Store = require("electron-store");
var store = new Store({
    cwd: config_path || "",
});

var ratio = 1;

var recorder: MediaRecorder;

var tmp_path: string;

var start_stop = document.getElementById("start_stop");
var s_s = false;
let stop = false;

const clip_time = 0.1 * 60 * 1000;

start_stop.onclick = () => {
    if (s_s) {
        start_stop.querySelector("div").className = "stop";
        pause_recume.querySelector("img").src = pause_svg;
        document.getElementById("time").innerText = "0:00";
        recorder.start();
        格式_el.style.display = "none";
        type = 格式_el.value;
        p_time();
        setInterval(get_time, 500);
        s_s = false;
        ipcRenderer.send("record", "start", tmp_path, type);

        c();
    } else {
        stop = true;
        recorder.stop();
        p_time();
    }
};

var pause_recume = document.getElementById("pause_recume");
pause_recume.onclick = () => {
    if (recorder.state == "inactive") return;
    if (recorder.state == "recording") {
        pause_recume.querySelector("img").src = recume_svg;
        recorder.pause();
        p_time();
    } else if (recorder.state == "paused") {
        pause_recume.querySelector("img").src = recume_svg;
        recorder.resume();
        p_time();
    }
};

var name_t: { s: number; e: number }[] = [{ s: 0, e: NaN }];

var time_l = [];
function p_time() {
    let t = new Date().getTime();
    time_l.push(t);
    let d = 0;
    for (let i = 0; i < time_l.length; i += 2) {
        if (time_l[i + 1]) d += time_l[i + 1] - time_l[i];
    }
    ipcRenderer.send("record", "pause_time", { t, dt: d, pause: time_l.length % 2 == 0 });
}
function get_t() {
    let t = 0;
    for (let i = 1; i < time_l.length - 1; i += 2) {
        t += time_l[i] - time_l[i - 1];
    }
    if (time_l.length % 2 == 0) {
        t += new Date().getTime() - time_l.at(-2);
    } else {
        t += new Date().getTime() - time_l.at(-1);
    }
    return t;
}
function get_time() {
    if (recorder.state == "recording") {
        let t = 0;
        for (let i = 1; i < time_l.length - 1; i += 2) {
            t += time_l[i] - time_l[i - 1];
        }
        t += new Date().getTime() - time_l.at(-1);
        let s = Math.trunc(t / 1000);
        let m = Math.trunc(s / 60);
        let h = Math.trunc(m / 60);
        document.getElementById("time").innerText = `${h == 0 ? "" : `${h}:`}${m - 60 * h}:${String(
            s - 60 * m
        ).padStart(2, "0")}`;
    }
}

add_types();
let type = (格式_el.value = store.get("录屏.转换.格式"));

var audio_stream: MediaStream, stream: MediaStream;

var audio = false,
    camera = false;

var rect;

const { ipcRenderer } = require("electron") as typeof import("electron");
var pathToFfmpeg = require("@ffmpeg-installer/ffmpeg").path as string;
const spawn = require("child_process").spawn as typeof import("child_process").spawn;
console.log(pathToFfmpeg);

/** 自动分段 */
function c() {
    setTimeout(() => {
        if (!stop) {
            recorder.stop();
            c();
        }
    }, clip_time);
}

ipcRenderer.on("record", async (_event, t, sourceId, r, screen_w, screen_h, screen_ratio) => {
    switch (t) {
        case "init":
            rect = r;
            ratio = screen_ratio;
            s_s = true;
            let devices = await navigator.mediaDevices.enumerateDevices();
            for (let i of devices) {
                if (i.kind == "audioinput") audio = true;
                if (i.kind == "videoinput") camera = true;
            }
            if (audio) {
                audio_stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false,
                });
            } else {
                mic_el.style.display = "none";
            }
            if (!camera) document.getElementById("camera").style.display = "none";
            navigator.mediaDevices.ondevicechange = () => {
                navigator.mediaDevices.enumerateDevices().then((d) => {
                    let video = false;
                    for (let i of d) {
                        if (i.kind == "videoinput") video = true;
                    }
                    if (video) {
                        document.getElementById("camera").style.display = "";
                    } else {
                        document.getElementById("camera").style.display = "none";
                        camera_stream_f(false);
                    }
                });
            };
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
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
            if (audio_stream) {
                for (let i of audio_stream.getAudioTracks()) stream.addTrack(i);
                mic_stream(store.get("录屏.音频.默认开启"));
            }
            var chunks = [];
            recorder = new MediaRecorder(stream, {
                videoBitsPerSecond: store.get("录屏.视频比特率") * 10 ** 6,
                mimeType: "video/webm",
            });
            document.getElementById("record_b").style.opacity = "1";
            document.getElementById("record_b").style.pointerEvents = "auto";
            recorder.ondataavailable = function (e) {
                chunks.push(e.data);
            };

            const fs = require("fs") as typeof import("fs");
            const os = require("os") as typeof import("os");
            const path = require("path") as typeof import("path");
            let file_name = String(new Date().getTime());
            tmp_path = path.join(os.tmpdir(), "eSearch/", file_name);
            let output = path.join(tmp_path, "output");
            fs.mkdirSync(tmp_path);
            fs.mkdirSync(output);
            let clip_name = 0;
            function save(f: () => void) {
                let b = new Blob(chunks, { type: "video/webm" });
                console.log(chunks, b);
                let reader = new FileReader();
                reader.readAsArrayBuffer(b);
                reader.onloadend = (_e) => {
                    const base_name = String(clip_name);
                    const base_name2 = `${base_name}.${type}`;
                    let p = path.join(tmp_path, base_name);
                    let crop =
                        type == "gif" && store.get("录屏.转换.高质量gif")
                            ? `[in]crop=${rect[2]}:${rect[3]}:${rect[0]}:${rect[1]},split[split1][split2];[split1]palettegen=stats_mode=single[pal];[split2][pal]paletteuse=new=1`
                            : `crop=${rect[2]}:${rect[3]}:${rect[0]}:${rect[1]}`;
                    let args = ["-i", p, "-vf", crop, path.join(output, base_name2)];
                    fs.writeFile(p, Buffer.from(reader.result as string), (_err) => {
                        const ffmpeg = spawn(pathToFfmpeg, args);
                        chunks = [];
                        if (f) f();
                        clip_name++;
                        ffmpeg.on("exit", () => {});
                    });
                };
            }

            recorder.onstop = () => {
                name_t.at(-1).e = get_t();
                if (stop) {
                    ipcRenderer.send("record", "stop");
                    save(show_control);
                    console.log(name_t);
                } else {
                    save(null);
                    recorder.start();
                    name_t.push({ s: get_t(), e: NaN });
                }
            };

            if (store.get("录屏.自动录制")) {
                let t = store.get("录屏.自动录制");
                function d() {
                    if (recorder.state != "inactive") return;
                    document.getElementById("time").innerText = t;
                    setTimeout(() => {
                        if (t == 0) {
                            start_stop.click();
                        } else {
                            t--;
                            d();
                        }
                    }, 1000);
                }
                d();
            }
            break;
        case "start_stop":
            start_stop.click();
            break;
    }
});

document.getElementById("min").onclick = () => {
    ipcRenderer.send("record", "min");
};

document.getElementById("close").onclick = () => {
    ipcRenderer.send("record", "close");
};

async function mic_stream(v) {
    for (let i of audio_stream.getAudioTracks()) {
        i.enabled = v;
    }
    if (v != mic_el.checked) mic_el.checked = v;
}

mic_el.onclick = () => {
    try {
        mic_stream(mic_el.checked);
        if (store.get("录屏.音频.记住开启状态")) store.set("录屏.音频.默认开启", mic_el.checked);
    } catch (e) {
        console.error(e);
    }
};

var camera_stream: MediaStream;
async function camera_stream_f(v) {
    if (v) {
        camera_stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true,
        });
        document.querySelector("video").srcObject = camera_stream;
        document.querySelector("video").play();
        if (store.get("录屏.摄像头.镜像")) document.querySelector("video").style.transform = "rotateY(180deg)";
        ipcRenderer.send("record", "camera", 0);
        setTimeout(() => {
            resize();
        }, 400);
    } else {
        camera_stream.getVideoTracks()[0].stop();
        document.querySelector("video").srcObject = null;
        ipcRenderer.send("record", "camera", 1);
    }
}

if (store.get("录屏.摄像头.默认开启")) {
    try {
        camera_stream_f(true);
        camera_el.checked = true;
    } catch (e) {
        console.error(e);
    }
}

camera_el.onclick = () => {
    try {
        camera_stream_f(camera_el.checked);
        if (store.get("录屏.摄像头.记住开启状态")) store.set("录屏.摄像头.默认开启", camera_el.checked);
    } catch (e) {
        console.error(e);
    }
};

document.body.onresize = resize;

function resize() {
    let p = { h: document.getElementById("video").offsetHeight, w: document.getElementById("video").offsetWidth },
        c = { h: document.getElementById("v_p").offsetHeight, w: document.getElementById("v_p").offsetWidth };
    let k0 = p.h / p.w;
    let k1 = c.h / c.w;
    if (k0 >= k1) {
        console.log(p.w, c.w);
        // @ts-ignore
        document.getElementById("v_p").style.zoom = p.w / c.w;
    } else {
        // @ts-ignore
        document.getElementById("v_p").style.zoom = p.h / c.h;
    }
}

ipcRenderer.on("ff", (_e, t, arg) => {
    if (t == "p") {
        document.getElementById("pro").style.width = arg * 100 + "%";
        if (arg == 1)
            setTimeout(() => {
                ipcRenderer.send("record", "close");
            }, 400);
    }
    if (t == "l") {
        const textarea = <HTMLTextAreaElement>document.getElementById("log");
        textarea.value += "\n" + arg[1];
        textarea.scrollTop = textarea.scrollHeight;
    }
});

var editting = false;

function set_v(n: number) {
    video.src = `${tmp_path}/${n}`;
}

function get_play_t() {
    let t = 0;
    for (let i = 0; i < play_name; i++) {
        t += name_t[i].e - name_t[i].s;
    }
    t += video.currentTime * 1000;
    return t;
}

function set_play_t(time: number) {
    for (let i = 0; i < name_t.length; i++) {
        if (name_t[i].s <= time && time < (name_t?.[i + 1]?.s || name_t[i].e)) {
            set_v(i);
            play_name = i;
            video.currentTime = (time - name_t[i].s) / 1000;
        }
    }
}

function show_control() {
    editting = true;
    document.getElementById("v_play").querySelector("img").src = recume_svg;
    if (mic_el.checked) mic_stream(false);
    if (camera_el.checked) camera_stream_f(false);
    document.getElementById("s").className = "s_show";
    document.getElementById("record_b").style.display = "none";
    document.getElementById("m").style.backgroundColor = "var(--bg)";
    document.getElementById("time").innerText = "";
    document.querySelector("video").style.transform = "";
    set_v(0);
    document.querySelector("video").style.left = -rect[0] * ratio + "px";
    document.querySelector("video").style.top = -rect[1] * ratio + "px";
    document.getElementById("v_p").style.width = document.getElementById("v_p").style.minWidth = rect[2] * ratio + "px";
    document.getElementById("v_p").style.height = document.getElementById("v_p").style.minHeight =
        rect[3] * ratio + "px";
    clip_v();
    save_el.disabled = false;
    码率_el.value = store.get("录屏.转换.码率");
    帧率_el.value = store.get("录屏.转换.帧率");
    其他参数_el.value = store.get("录屏.转换.其他");
    if (store.get("录屏.转换.自动转换")) {
        save();
    } else {
        ipcRenderer.send("record", "camera", 2);
    }
    setTimeout(() => {
        resize();
        document.getElementById("m").style.transition = "none";
    }, 400);
}

var video = document.querySelector("video");

let play_name = 0;

function clip_v() {
    t_start_el.value = 0;
    document.getElementById("b_t_end").click();

    document.getElementById("t_t").innerText = t_format(t_end_el.value - t_start_el.value);

    document.getElementById("t_nt").innerText = t_format(0);
}

t_start_el.oninput = () => {
    video.currentTime = (t_end_el.min = jdt_el.min = t_start_el.value) / 1000;
    document.getElementById("t_t").innerText = t_format(t_end_el.value - t_start_el.value);
};
t_end_el.oninput = () => {
    video.currentTime = (t_start_el.max = jdt_el.max = t_end_el.value) / 1000;
    document.getElementById("t_t").innerText = t_format(t_end_el.value - t_start_el.value);
};

document.getElementById("b_t_end").onclick = () => {
    jdt_el.max = t_end_el.value = t_start_el.max = t_end_el.max = time_l.at(-1) - time_l[0];
};

/**
 *
 * @param x 输入秒
 */
function t_format(x: number) {
    let t = x;
    let s = Math.trunc(t / 1000);
    let m = Math.trunc(s / 60);
    let h = Math.trunc(m / 60);
    return `${h == 0 ? "" : `${h}:`}${m - 60 * h}:${String(s - 60 * m).padStart(2, "0")}.${String(t % 1000).slice(
        0,
        1
    )}`;
}

document.getElementById("v_play").onclick = () => {
    if (video.paused) {
        video_play();
        document.getElementById("v_play").querySelector("img").src = pause_svg;
    } else {
        video.pause();
        document.getElementById("v_play").querySelector("img").src = recume_svg;
    }
};

video.onpause = () => {
    document.getElementById("v_play").querySelector("img").src = recume_svg;
};
video.onplay = () => {
    document.getElementById("v_play").querySelector("img").src = pause_svg;
};

function video_play() {
    set_play_t(t_start_el.value);
    video.play();
}

video.ontimeupdate = () => {
    if (!editting) return;
    document.getElementById("t_nt").innerText = t_format(get_play_t() - t_start_el.value);
    if (get_play_t() > t_end_el.value) {
        video.pause();
        document.getElementById("t_nt").innerText = document.getElementById("t_t").innerText;
    }
    jdt_el.value = get_play_t();
};

jdt_el.oninput = () => {
    set_play_t(jdt_el.value);
};

video.onended = () => {
    if (play_name < name_t.length - 1) {
        play_name++;
        set_v(play_name);
        video.play();
    } else {
        document.getElementById("t_nt").innerText = document.getElementById("t_t").innerText;
        jdt_el.value = jdt_el.max;
    }
};

function add_types() {
    let types = [
        "mp4",
        "mkv",
        "mov",
        "avi",
        "wmv",
        "m4v",
        "mpeg",
        "vob",
        "webm",
        "ogv",
        "3gp",
        "flv",
        "f4v",
        "swf",
        "gif",
    ];
    let t = "";
    for (let i of types) {
        t += `<option value="${i}">${i}</option>`;
    }
    格式_el.innerHTML = t;
}

function save() {
    let t = "";
    if (码率_el.value) t += `-b:v ${Number(码率_el.value) * 1000}k `;
    if (帧率_el.value) t += `-r ${帧率_el.value} `;
    if (其他参数_el.value) t += `${其他参数_el.value} `;
    t += `-ss ${t_start_el.value / 1000} `;
    if (t_end_el.value != (time_l.at(-1) - time_l[0]) / 1000) t += `-to ${t_end_el.value / 1000} `;
    let 格式 = 格式_el.value;
    console.log(t);
    store.set("录屏.转换.格式", 格式_el.value);
    store.set("录屏.转换.码率", Number(码率_el.value));
    store.set("录屏.转换.帧率", Number(帧率_el.value));
    store.set("录屏.转换.其他", 其他参数_el.value);
    ipcRenderer.send("record", "ff", { 源文件: tmp_path, 参数: t.split(" "), 格式 });
    // ipcRenderer.send("record", "close");
}

document.getElementById("save").onclick = save;

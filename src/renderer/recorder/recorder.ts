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

const Store = require("electron-store");
var store = new Store();

var ratio = 1;

var /**@type {MediaRecorder} */ recorder;

var tmp_path;

var start_stop = document.getElementById("start_stop");
var s_s = false;
start_stop.onclick = () => {
    if (s_s) {
        start_stop.querySelector("div").className = "stop";
        pause_recume.querySelector("img").src = pause_svg;
        document.getElementById("time").innerText = "0:00";
        recorder.start();
        p_time();
        setInterval(get_time, 500);
        s_s = false;
        ipcRenderer.send("record", "start", time_l[0]);
    } else {
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
function get_time() {
    if (recorder.state == "recording") {
        let t = 0;
        for (let i = 1; i < time_l.length - 1; i += 2) {
            t += time_l[i] - time_l[i - 1];
        }
        t += new Date().getTime() - time_l[time_l.length - 1];
        let s = Math.trunc(t / 1000);
        let m = Math.trunc(s / 60);
        let h = Math.trunc(m / 60);
        document.getElementById("time").innerText = `${h == 0 ? "" : `${h}:`}${m - 60 * h}:${String(
            s - 60 * m
        ).padStart(2, "0")}`;
    }
}

var /**@type {MediaStream} */ audio_stream, /**@type {MediaStream} */ stream;

var audio = false,
    camera = false;

var rect;

const { ipcRenderer } = require("electron") as typeof import("electron");
ipcRenderer.on("record", async (event, t, sourceId, r, screen_w, screen_h, screen_ratio) => {
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
            recorder.onstop = () => {
                ipcRenderer.send("record", "stop");
                let b = new Blob(chunks, { type: "video/webm" });
                let reader = new FileReader();
                reader.readAsArrayBuffer(b);
                reader.onloadend = (e) => {
                    const fs = require("fs") as typeof import("fs");
                    const os = require("os") as typeof import("os");
                    const path = require("path") as typeof import("path");
                    let file_name = String(new Date().getTime());
                    tmp_path = path.join(os.tmpdir(), "eSearch/", file_name);
                    fs.writeFile(tmp_path, Buffer.from(reader.result as string), (err) => {
                        if (!err) {
                            show_control();
                        }
                    });
                };
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

var /**@type {MediaStream} */ camera_stream;
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

ipcRenderer.on("ff", (e, t, arg) => {
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

function show_control() {
    editting = true;
    document.getElementById("v_play").querySelector("img").src = recume_svg;
    if (mic_el.checked) mic_stream(false);
    if (camera_el.checked) camera_stream_f(false);
    document.getElementById("s").className = "s_show";
    document.getElementById("record_b").style.display = "none";
    document.getElementById("m").style.backgroundColor = "var(--bg)";
    document.getElementById("time").innerText = "";
    add_types();
    document.querySelector("video").style.transform = "";
    document.querySelector("video").src = tmp_path;
    document.querySelector("video").style.left = -rect[0] * ratio + "px";
    document.querySelector("video").style.top = -rect[1] * ratio + "px";
    document.getElementById("v_p").style.width = document.getElementById("v_p").style.minWidth = rect[2] * ratio + "px";
    document.getElementById("v_p").style.height = document.getElementById("v_p").style.minHeight =
        rect[3] * ratio + "px";
    clip_v();
    save_el.disabled = false;
    格式_el.value = store.get("录屏.转换.格式");
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
    jdt_el.max = t_end_el.value = t_start_el.max = t_end_el.max = time_l[time_l.length - 1] - time_l[0];
};

/**
 *
 * @param {string} x 输入秒
 */
function t_format(x) {
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
    video.currentTime = t_start_el.value / 1000;
    video.play();
}

video.ontimeupdate = () => {
    if (!editting) return;
    document.getElementById("t_nt").innerText = t_format(video.currentTime * 1000 - t_start_el.value);
    if (video.currentTime * 1000 > t_end_el.value) {
        video.pause();
        document.getElementById("t_nt").innerText = document.getElementById("t_t").innerText;
    }
    jdt_el.value = video.currentTime * 1000;
};

jdt_el.oninput = () => {
    video.currentTime = jdt_el.value / 1000;
};

video.onended = () => {
    document.getElementById("t_nt").innerText = document.getElementById("t_t").innerText;
    jdt_el.value = jdt_el.max;
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
    if (t_end_el.value != (time_l[time_l.length - 1] - time_l[0]) / 1000) t += `-to ${t_end_el.value / 1000} `;
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

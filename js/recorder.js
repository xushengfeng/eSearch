var /**@type {MediaRecorder} */ recorder;

var tmp_path;

var start_stop = document.getElementById("start_stop");
var s_s = false;
start_stop.onclick = () => {
    if (s_s) {
        start_stop.querySelector("div").className = "stop";
        pause_recume.querySelector("img").src = "./assets/icons/pause.svg";
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
        pause_recume.querySelector("img").src = "./assets/icons/recume.svg";
        recorder.pause();
        p_time();
    } else if (recorder.state == "paused") {
        pause_recume.querySelector("img").src = "./assets/icons/pause.svg";
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
        ).padStart(2, 0)}`;
    }
}

var /**@type {MediaStream} */ audio_stream, /**@type {MediaStream} */ stream;

var audio = false,
    camera = false;

const { ipcRenderer } = require("electron");
ipcRenderer.on("record", async (event, t, sourceId) => {
    switch (t) {
        case "init":
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
                document.getElementById("mic").style.display = "none";
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
                        mandatory: {
                            chromeMediaSource: "desktop",
                            chromeMediaSourceId: sourceId,
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
                    const fs = require("fs");
                    const os = require("os");
                    const path = require("path");
                    let file_name = String(new Date().getTime());
                    tmp_path = path.join(os.tmpdir(), "eSearch/", file_name);
                    fs.writeFile(tmp_path, Buffer.from(reader.result), (err) => {
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
    if (v != document.getElementById("mic").checked) document.getElementById("mic").checked = v;
}

document.getElementById("mic").onclick = () => {
    try {
        mic_stream(document.getElementById("mic").checked);
        if (store.get("录屏.音频.记住开启状态"))
            store.set("录屏.音频.默认开启", document.getElementById("mic").checked);
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
    } else {
        camera_stream.getVideoTracks()[0].stop();
        document.querySelector("video").srcObject = null;
        ipcRenderer.send("record", "camera", 1);
    }
}

if (store.get("录屏.摄像头.默认开启")) {
    try {
        camera_stream_f(true);
        document.getElementById("camera").checked = true;
    } catch (e) {
        console.error(e);
    }
}

document.getElementById("camera").onclick = () => {
    try {
        camera_stream_f(document.getElementById("camera").checked);
        if (store.get("录屏.摄像头.记住开启状态"))
            store.set("录屏.摄像头.默认开启", document.getElementById("camera").checked);
    } catch (e) {
        console.error(e);
    }
};

ipcRenderer.on("ff", (event, err, st) => {
    if (err) {
        console.error(err);
    } else {
        ipcRenderer.send("record", "close");
    }
});

var editting = false;

function show_control() {
    editting = true;
    document.getElementById("v_play").querySelector("img").src = "./assets/icons/recume.svg";
    if (document.getElementById("mic").checked) mic_stream(false);
    if (document.getElementById("camera").checked) camera_stream_f(false);
    document.getElementById("s").className = "s_show";
    document.getElementById("record_b").style.display = "none";
    document.getElementById("m").style.backgroundColor = "var(--bg)";
    document.getElementById("time").innerText = "";
    add_types();
    document.querySelector("video").style.transform = "";
    document.querySelector("video").src = tmp_path;
    clip_v();
    document.getElementById("save").disabled = false;
    document.getElementById("格式").value = store.get("录屏.转换.格式");
    document.getElementById("码率").value = store.get("录屏.转换.码率");
    document.getElementById("帧率").value = store.get("录屏.转换.帧率");
    document.getElementById("其他参数").value = store.get("录屏.转换.其他");
    if (store.get("录屏.转换.自动转换")) {
        save();
    } else {
        ipcRenderer.send("record", "camera", 2);
    }
}

var video = document.querySelector("video");

function clip_v() {
    document.getElementById("t_start").value = 0;
    document.getElementById("b_t_end").click();

    document.getElementById("t_t").innerText = t_format(
        document.getElementById("t_end").value - document.getElementById("t_start").value
    );

    document.getElementById("t_nt").innerText = t_format(0);
}

document.getElementById("t_start").oninput = () => {
    video.currentTime = (document.getElementById("t_end").min = document.getElementById("t_start").value) * 1000;
    document.getElementById("t_t").innerText = t_format(
        document.getElementById("t_end").value - document.getElementById("t_start").value
    );
};
document.getElementById("t_end").oninput = () => {
    video.currentTime = (document.getElementById("t_start").max = document.getElementById("t_end").value) * 1000;
    document.getElementById("t_t").innerText = t_format(
        document.getElementById("t_end").value - document.getElementById("t_start").value
    );
};

document.getElementById("b_t_end").onclick = () => {
    document.getElementById("t_end").value =
        document.getElementById("t_start").max =
        document.getElementById("t_end").max =
            time_l[time_l.length - 1] - time_l[0];
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
    return `${h == 0 ? "" : `${h}:`}${m - 60 * h}:${String(s - 60 * m).padStart(2, 0)}.${String(t % 1000).slice(0, 1)}`;
}

document.getElementById("v_play").onclick = () => {
    if (video.paused) {
        video_play();
        document.getElementById("v_play").querySelector("img").src = "./assets/icons/pause.svg";
    } else {
        video.pause();
        document.getElementById("v_play").querySelector("img").src = "./assets/icons/recume.svg";
    }
};

video.onpause = () => {
    document.getElementById("v_play").querySelector("img").src = "./assets/icons/recume.svg";
};
video.onplay = () => {
    document.getElementById("v_play").querySelector("img").src = "./assets/icons/pause.svg";
};

function video_play() {
    video.currentTime = document.getElementById("t_start").value / 1000;
    video.play();
}

video.ontimeupdate = () => {
    if (!editting) return;
    document.getElementById("t_nt").innerText = t_format(video.currentTime * 1000);
    if (video.currentTime * 1000 > document.getElementById("t_end").value) {
        video.pause();
        document.getElementById("t_nt").innerText = document.getElementById("t_t").innerText;
    }
};

video.onended = () => {
    document.getElementById("t_nt").innerText = document.getElementById("t_t").innerText;
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
    document.getElementById("格式").innerHTML = t;
}

function save() {
    let t = "";
    if (document.getElementById("码率").value) t += `-b:v ${document.getElementById("码率").value * 1000}k `;
    if (document.getElementById("帧率").value) t += `-r ${document.getElementById("帧率").value} `;
    if (document.getElementById("其他参数").value) t += `${document.getElementById("其他参数").value} `;
    t += `-ss ${document.getElementById("t_start").value / 1000} `;
    if (document.getElementById("t_end").value != (time_l[time_l.length - 1] - time_l[0]) / 1000)
        t += `-to ${document.getElementById("t_end").value / 1000} `;
    let 格式 = document.getElementById("格式").value;
    console.log(t);
    store.set("录屏.转换.格式", document.getElementById("格式").value);
    store.set("录屏.转换.码率", Number(document.getElementById("码率").value));
    store.set("录屏.转换.帧率", Number(document.getElementById("帧率").value));
    store.set("录屏.转换.其他", document.getElementById("其他参数").value);
    ipcRenderer.send("record", "ff", { 源文件: tmp_path, 参数: t, 格式 });
    // ipcRenderer.send("record", "close");
}

document.getElementById("save").onclick = save;

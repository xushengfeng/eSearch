var /**@type {MediaRecorder} */ recorder;

var save_path;

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
ipcRenderer.on("record", async (event, t, v, sourceId) => {
    switch (t) {
        case "init":
            s_s = true;
            save_path = v;
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
                    fs.writeFile(v, Buffer.from(reader.result), (err) => {
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
        case "stop":
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
    } else {
        camera_stream.getVideoTracks()[0].stop();
        document.querySelector("video").srcObject = null;
    }
    ipcRenderer.send("record", "camera", v);
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
    if (err) console.error(err);
    console.log(st);
});

function show_control() {
    add_types();
    document.querySelector("video").style.height = "300px";
    document.getElementById("save").disabled = false;
    ipcRenderer.send("record", "camera", true);
}

function add_types() {
    let types = [
        "MP4",
        "MKV",
        "MOV",
        "AVI",
        "WMV",
        "M4V",
        "MPEG",
        "VOB",
        "WEBM",
        "OGV",
        "3GP",
        "FLV",
        "F4V",
        "SWF",
        "GIF",
    ];
    let t = "";
    for (let i of types) {
        t += `<option value="${i}">${i}</option>`;
    }
    document.getElementById("格式").innerHTML = t;
}

function save() {
    let t = "";
    t += `-b:v ${document.getElementById("码率").value * 1000}k `;
    t += `-r ${document.getElementById("帧率").value} `;
    t += `${document.getElementById("其他参数").value}`;
    let tt = save_path.replace(".webm", `.${document.getElementById("格式").value} `);
    t += tt;
    console.log(t);
    ipcRenderer.send("record", "ff", t);
    ipcRenderer.send("clip_main_b", "record_ok_save", tt);
}

document.getElementById("save").onclick = save;

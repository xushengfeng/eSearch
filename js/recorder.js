var /**@type {MediaRecorder} */ recorder;

var save_path;

var start_stop = document.getElementById("start_stop");
var s_s = false;
start_stop.onclick = () => {
    if (s_s) {
        start_stop.querySelector("img").src = "./assets/icons/stop.svg";
        pause_recume.querySelector("img").src = "./assets/icons/pause.svg";
        recorder.start();
        p_time();
        setInterval(get_time, 10);
        s_s = false;
        ipcRenderer.send("record", "start");
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
        document.getElementById("time").innerText = `${m}:${s - 60 * m}.${t % 1000}`;
    }
}

var /**@type {MediaStream} */ audio_stream, /**@type {MediaStream} */ stream;

const { ipcRenderer } = require("electron");
ipcRenderer.on("record", async (event, t, v, sourceId) => {
    switch (t) {
        case "init":
            s_s = true;
            save_path = v;
            audio_stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: sourceId,
                    },
                },
            });
            if (audio_stream) for (let i of audio_stream.getAudioTracks()) stream.addTrack(i);
            mic_stream(store.get("录屏.音频.默认开启"));
            var chunks = [];
            recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
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
                            ipcRenderer.send("clip_main_b", "ok_save", v);
                            ipcRenderer.send("record", "close");
                        }
                    });
                };
            };
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
    mic_stream(document.getElementById("mic").checked);
    if (store.get("录屏.音频.记住开启状态")) store.set("录屏.音频.默认开启", document.getElementById("mic").checked);
};

var /**@type {MediaStream} */ camera_stream;
async function camera_streamcamera(v) {
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
    camera_streamcamera(true);
    document.getElementById("camera").checked = true;
}

document.getElementById("camera").onclick = () => {
    camera_streamcamera(document.getElementById("camera").checked);
    if (store.get("录屏.摄像头.记住开启状态"))
        store.set("录屏.摄像头.默认开启", document.getElementById("camera").checked);
};

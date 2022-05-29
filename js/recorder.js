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

const { ipcRenderer } = require("electron");
ipcRenderer.on("record", async (event, t, v, sourceId) => {
    switch (t) {
        case "init":
            s_s = true;
            save_path = v;
            const audio_stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: sourceId,
                    },
                },
            });
            if (audio_stream) for (let i of audio_stream.getAudioTracks()) stream.addTrack(i);
            var chunks = [];
            recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
            document.getElementById("main").style.opacity = "1";
            document.getElementById("main").style.pointerEvents = "auto";
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

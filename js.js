// In the renderer process.
const { desktopCapturer } = require("electron");
systemPreferences.getMediaAccessStatus(screen)  // mac授权
desktopCapturer
    .getSources({ types: ["window", "screen"] ,fetchWindowIcons:true})
    .then(async (sources) => {
        console.log(sources);
        for (const source of sources) {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId:"window:136314886:0",
                        // minWidth: 1280,
                        // maxWidth: 1280,
                        // minHeight: 720,
                        // maxHeight: 720,
                    },
                },
            });
            handleStream(stream);

            return;
        }
    });

function handleStream(stream) {
    const video = document.querySelector("video");
    video.srcObject = stream;
    video.onloadedmetadata = (e) => video.play();
}

function handleError(e) {
    console.log(e);
}

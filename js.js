// In the renderer process.
const { desktopCapturer ,screen} = require('electron')
desktopCapturer
    .getSources({ types: ["window", "screen"] ,fetchWindowIcons:true})
    .then(async (sources) => {
        // screen.getPrimaryDisplay()
        console.log(sources)
        draw_windows_bar(sources)
        for (const source of sources) {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId:source.id,
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

function draw_windows_bar(o){
    内容=''
    for(i in o){
        内容+=`<div id="window"><div id="window_name"><p class="window_title"><img src="${o[i].appIcon?.toDataURL()??'assets/no_photo.png'}" class="window_icon">${o[i].name}</p></div><div id="window_photo" ><img src="${o[i].thumbnail.toDataURL()}" class="window_thumbnail"></div></div>`
    }
    document.getElementById('windows_bar').innerHTML=内容
}
function handleStream(stream) {
    const video = document.querySelector("video");
    video.srcObject = stream;
    video.onloadedmetadata = (e) => video.play();
}

function handleError(e) {
    console.log(e);
}

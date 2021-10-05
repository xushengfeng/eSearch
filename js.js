// In the renderer process.
const { desktopCapturer } = require("electron");

const canvas = document.getElementById("main_photo");

desktopCapturer
    .getSources({
        types: ["window", "screen"],
        fetchWindowIcons: true,
        thumbnailSize: {
            width: window.screen.width * window.devicePixelRatio,
            height: 8000,
        },
    })
    .then(async (sources) => {
        console.log(sources);
        draw_windows_bar(sources);
        draw_canvas(sources[0].thumbnail.toDataURL());
    });

function draw_windows_bar(o) {
    内容 = "";
    for (i in o) {
        内容 += `<div class="window" id="${
            o[i].id
        }"><div class="window_name"><p class="window_title"><img src="${
            o[i].appIcon?.toDataURL() ?? "assets/no_photo.png"
        }" class="window_icon">${
            o[i].name
        }</p></div><div id="window_photo" ><img src="${o[
            i
        ].thumbnail.toDataURL()}" class="window_thumbnail"></div></div>`;
    }
    document.getElementById("windows_bar").innerHTML = 内容;
    for (i in o) {
        (function (n) {
            document.getElementById(o[n].id).addEventListener("click", () => {
                draw_canvas(o[n].thumbnail.toDataURL())
            });
        })(i);
    }
}

function draw_canvas(url) {
    let ctx = canvas.getContext("2d");
    let img = new Image();
    img.src = url;
    img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };
}

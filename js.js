// In the renderer process.
const { desktopCapturer} = require("electron");

desktopCapturer
    .getSources({
        types: ["window", "screen"],
        fetchWindowIcons: true,
        thumbnailSize: {
            width: window.screen.width * window.devicePixelRatio,
            height: window.screen.height * window.devicePixelRatio,
        },
    })
    .then(async (sources) => {
        console.log(sources);
        draw_windows_bar(sources);
        document.getElementById("main_photo").src =
            sources[0].thumbnail.toDataURL();
    });

document.getElementById('main_photo').width=window.screen.width

function draw_windows_bar(o) {
    内容 = "";
    for (i in o) {
        内容 += `<div class="window" onclick="load_photo(${i})" id="${
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
                document.getElementById("main_photo").src =
                    o[n].thumbnail.toDataURL();
            });
        })(i);
    }
}

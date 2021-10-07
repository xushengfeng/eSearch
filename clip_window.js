// In the renderer process.
const { desktopCapturer, ipcRenderer, clipboard, nativeImage } = require("electron");
const fs = require("fs");
const jsqr = require("jsqr");

const main_canvas = document.getElementById("main_photo");
main_canvas.style.width = window.screen.width + "px";
const clip_canvas = document.getElementById("clip_photo");
clip_canvas.style.width = window.screen.width + "px";
const draw_canvas = document.getElementById("draw_photo");
draw_canvas.style.width = window.screen.width + "px";
// 第一次截的一定是桌面,所以可提前定义
main_canvas.width=window.screen.width * window.devicePixelRatio
main_canvas.height=window.screen.height * window.devicePixelRatio

function get_desktop_capturer() {
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
            show_photo(sources[0].thumbnail.toDataURL());
        });
}
get_desktop_capturer();
ipcRenderer.on("reflash", () => {
    get_desktop_capturer();
});

function draw_windows_bar(o) {
    内容 = "";
    for (i in o) {
        内容 += `<div class="window" id="${o[i].id}"><div class="window_name"><p class="window_title"><img src="${
            o[i].appIcon?.toDataURL() ?? "assets/no_photo.png"
        }" class="window_icon">${o[i].name}</p></div><div id="window_photo" ><img src="${o[
            i
        ].thumbnail.toDataURL()}" class="window_thumbnail"></div></div>`;
    }
    document.getElementById("windows_bar").innerHTML = 内容;
    for (i in o) {
        (function (n) {
            document.getElementById(o[n].id).addEventListener("click", () => {
                show_photo(o[n].thumbnail.toDataURL());
            });
        })(i);
    }
}

final_rect = xywh = [0, 0, main_canvas.width, main_canvas.height];

function show_photo(url) {
    final_rect = xywh = [0, 0, main_canvas.width, main_canvas.height];
    var main_ctx = main_canvas.getContext("2d");
    let img = new Image();
    img.src = url;
    img.onload = function () {
        // 统一大小
        main_canvas.width = clip_canvas.width = draw_canvas.width = img.width;
        main_canvas.height = clip_canvas.height = draw_canvas.height = img.height;
        main_ctx.drawImage(img, 0, 0);
    };
}

// 工具栏按钮
document.getElementById("tool_close").addEventListener("click", tool_close_f);
document.getElementById("tool_ocr").addEventListener("click", tool_ocr_f);
document.getElementById("tool_QR").addEventListener("click", tool_QR_f);
document.getElementById("tool_draw").addEventListener("click", tool_draw_f);
document.getElementById("tool_ding").addEventListener("click", tool_ding_f);
document.getElementById("tool_copy").addEventListener("click", tool_copy_f);
document.getElementById("tool_save").addEventListener("click", tool_save_f);

// 关闭
function tool_close_f() {
    ipcRenderer.send("window-close");
}
// OCR
function tool_ocr_f() {
    ipcRenderer.send(
        "ocr",
        get_clip_photo()
            .toDataURL()
            .replace(/^data:image\/\w+;base64,/, "")
    );
    document.getElementById("waiting").style.display = "block";
    document.getElementById("waiting").style.left = final_rect[0] + "px";
    document.getElementById("waiting").style.top = final_rect[1] + "px";
    document.getElementById("waiting").style.width = final_rect[2] + "px";
    document.getElementById("waiting").style.height = final_rect[3] + "px";
    ipcRenderer.on("ocr_back", (event, arg) => {
        if ((arg = "ok")) {
            document.getElementById("waiting").style.display = "none";
            tool_close_f();
        } else {
            document.getElementById("waiting").style.display = "none";
        }
    });
}
// 二维码
function tool_QR_f() {
    var imageData = get_clip_photo()
        .getContext("2d")
        .getImageData(0, 0, get_clip_photo().width, get_clip_photo().height);
    var code = jsqr(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
    });
    if (code) {
        ipcRenderer.send("QR", code.data);
        tool_close_f();
    } else {
        ipcRenderer.send("QR", "nothing");
    }
}
// 图片编辑
drawing = false;
function tool_draw_f() {
    drawing = drawing ? false : true; // 切换状态
    if (drawing) {
        document.getElementById("tool_draw").style.backgroundColor = getComputedStyle(
            document.documentElement
        ).getPropertyValue("--hover-color");
        document.getElementById("draw_bar").style.maxHeight = "500px";
        document.getElementById("windows_bar").style.left = "-100%";
    } else {
        document.getElementById("tool_draw").style.backgroundColor = "";
        document.getElementById("draw_bar").style.maxHeight = "0";
        document.getElementById("windows_bar").style.left = "";
    }
}
// 钉在屏幕上
function tool_ding_f() {
    if (final_rect != "") {
        // 解决全屏无法钉的bug
        ding_window_setting = final_rect;
    } else {
        ding_window_setting = [0, 0, main_canvas.width, main_canvas.height];
    }

    ding_window_setting[4] = get_clip_photo().toDataURL();
    ipcRenderer.send("ding", ding_window_setting);
    tool_close_f();
}
// 复制
function tool_copy_f() {
    clipboard.writeImage(nativeImage.createFromDataURL(get_clip_photo().toDataURL()));
    tool_close_f();
}
// 保存
function tool_save_f() {
    ipcRenderer.send("save");
    ipcRenderer.on("save_path", (event, message) => {
        console.log(message);
        if (message != "") {
            f = get_clip_photo()
                .toDataURL()
                .replace(/^data:image\/\w+;base64,/, "");
            console.log(f);
            dataBuffer = new Buffer(f, "base64");
            fs.writeFile(message, dataBuffer, () => {});
            tool_close_f();
        }
    });
}

function get_clip_photo() {
    if (final_rect != "") {
        main_ctx = main_canvas.getContext("2d");
        var tmp_canvas = document.createElement("canvas");
        tmp_canvas.width = final_rect[2];
        tmp_canvas.height = final_rect[3];
        gid = main_ctx.getImageData(final_rect[0], final_rect[1], final_rect[2], final_rect[3]); // 裁剪
        tmp_canvas.getContext("2d").putImageData(gid, 0, 0);
        return tmp_canvas;
    } else {
        return main_canvas;
    }
}

// In the renderer process.
const { desktopCapturer, ipcRenderer, clipboard, nativeImage } = require("electron");
const fs = require("fs");
const jsqr = require("jsqr");
const Store = require("electron-store");
const hotkeys = require("hotkeys-js");

// 获取设置
store = new Store();
function set_setting() {
    工具栏跟随 = store.get("工具栏跟随") || "展示内容优先";
    光标 = store.get("光标") || "以(1,1)为起点";
    四角坐标 = store.get("显示四角坐标") || false;
    取色器默认格式 = store.get("取色器默认格式") || "RGBA";
    遮罩颜色 = store.get("遮罩颜色") || "#0005";
    选区颜色 = store.get("选区颜色") || "#0000";

    copy_size = store.get("取色器大小") || "15";
    copy_i_size = store.get("像素大小") || "10";
    document.documentElement.style.setProperty("--copy_size", `${copy_size * copy_i_size}px`);
    document.documentElement.style.setProperty("--copy_i_size", `${copy_i_size}px`);
}

const main_canvas = document.getElementById("main_photo");
main_canvas.style.width = window.screen.width + "px";
const clip_canvas = document.getElementById("clip_photo");
clip_canvas.style.width = window.screen.width + "px";
const draw_canvas = document.getElementById("draw_photo");
draw_canvas.style.width = window.screen.width + "px";
// 第一次截的一定是桌面,所以可提前定义
main_canvas.width = clip_canvas.width = draw_canvas.width = window.screen.width * window.devicePixelRatio;
main_canvas.height = clip_canvas.height = draw_canvas.height = window.screen.height * window.devicePixelRatio;

final_rect = xywh = [0, 0, main_canvas.width, main_canvas.height];

function get_desktop_capturer(n) {
    set_setting();
    document.querySelector("body").style.display = "none";
    desktopCapturer
        .getSources({ types: ["screen"], fetchWindowIcons: true, thumbnailSize: { width: 200, height: 1000 } })
        .then(async (sources) => {
            draw_windows_bar(sources);
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: "desktop",
                        chromeMediaSourceId: sources[n].id,
                    },
                },
                // cursor: "never"
            });
            const video = document.querySelector("#root_resource");
            video.srcObject = stream;
            video.onloadedmetadata = (e) => {
                video.play();
                canvas.clear();
                main_canvas.width = clip_canvas.width = draw_canvas.width = video.videoWidth;
                main_canvas.height = clip_canvas.height = draw_canvas.height = video.videoHeight;
                main_canvas.getContext("2d").drawImage(video, 0, 0);
                final_rect = xywh = [0, 0, main_canvas.width, main_canvas.height];
                document.querySelector("#clip_wh").style.left =
                    final_rect[2] / 2 - document.querySelector("#clip_wh").offsetWidth / 2 + "px";
                document.querySelector("#clip_wh").style.top = "10px";
                document.querySelector("#wh").innerHTML = `${final_rect[2]} × ${final_rect[3]}`;
                video.pause();
                document.querySelector("body").style.display = "block";
            };
            return;
        });
}

get_desktop_capturer(0);

ipcRenderer.on("reflash", () => {
    get_desktop_capturer(0);
    // 刷新设置
    工具栏跟随 = store.get("工具栏跟随") || "展示内容优先";
    光标 = store.get("光标") || "以(1,1)为起点";
    取色器默认格式 = store.get("取色器默认格式") || "HEX";
    遮罩颜色 = store.get("遮罩颜色") || "#0005";
    选区颜色 = store.get("选区颜色") || "#0000";
});

function draw_windows_bar(o) {
    内容 = "";
    for (i in o) {
        内容 += `<div class="window" id="${
            o[i].id
        }"><div class="window_name"><p class="window_title"><img src="assets/screen.svg" class="window_icon">屏幕${
            i - 0 + 1
        }</p></div><div id="window_photo" ><img src="${o[
            i
        ].thumbnail.toDataURL()}" class="window_thumbnail"></div></div>`;
    }
    document.getElementById("windows_bar").innerHTML = 内容;
    for (i in o) {
        (function (n) {
            document.getElementById(o[n].id).addEventListener("click", () => {
                get_desktop_capturer(n);
            });
        })(i);
    }
}

// 左边窗口工具栏弹出
o = false;
hotkeys("z", () => {
    if (!o) {
        document.querySelector("#windows_bar").style.transform = "translateX(0)";
        o = true;
    } else {
        document.querySelector("#windows_bar").style.transform = "translateX(-100%)";
        o = false;
    }
});

// 工具栏按钮
document.getElementById("tool_close").addEventListener("click", tool_close_f);
document.getElementById("tool_ocr").addEventListener("click", tool_ocr_f);
document.getElementById("tool_QR").addEventListener("click", tool_QR_f);
document.getElementById("tool_draw").addEventListener("click", tool_draw_f);
document.getElementById("tool_ding").addEventListener("click", tool_ding_f);
document.getElementById("tool_copy").addEventListener("click", tool_copy_f);
document.getElementById("tool_save").addEventListener("click", tool_save_f);

hotkeys("esc", tool_close_f);
hotkeys("enter", tool_ocr_f);
hotkeys("ctrl+s, command+s", tool_save_f);
hotkeys("ctrl+c, command+c", tool_copy_f);

// 关闭
function tool_close_f() {
    ipcRenderer.send("window-close");
    document.getElementById("waiting").style.display = "none";
    document.querySelectorAll("#waiting line animate")[0].endElement();
    document.querySelectorAll("#waiting line animate")[1].endElement();

    document.querySelector("body").style.display = "none";
}
// OCR
function tool_ocr_f() {
    get_clip_photo().then((c) => {
        ipcRenderer.send("ocr", c.toDataURL().replace(/^data:image\/\w+;base64,/, ""));
    });

    document.querySelector("#waiting").style.display = "block";
    document.querySelector("#waiting").style.left = final_rect[0] + "px";
    document.querySelector("#waiting").style.top = final_rect[1] + "px";
    document.querySelector("#waiting").style.width = final_rect[2] + "px";
    document.querySelector("#waiting").style.height = final_rect[3] + "px";
    document.querySelectorAll("#waiting line animate")[0].beginElement();
    document.querySelectorAll("#waiting line animate")[1].beginElement();

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
    get_clip_photo().then((c) => {
        var imageData = c.getContext("2d").getImageData(0, 0, c.width, c.height);
        var code = jsqr(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        if (code) {
            ipcRenderer.send("QR", code.data);
            tool_close_f();
        } else {
            ipcRenderer.send("QR", "nothing");
        }
    });
}
// 图片编辑
drawing = false;
function tool_draw_f() {
    drawing = drawing ? false : true; // 切换状态
    if (drawing) {
        document.getElementById("tool_draw").style.backgroundColor = getComputedStyle(
            document.documentElement
        ).getPropertyValue("--hover-color");
        document.getElementById("draw_bar").style.height = "480px";
        document.querySelector("#draw_photo_top").style.zIndex = "11";
    } else {
        document.getElementById("tool_draw").style.backgroundColor = "";
        document.getElementById("draw_bar").style.height = "0";
        document.querySelector("#draw_photo_top").style.zIndex = "9";
    }
}
// 钉在屏幕上
function tool_ding_f() {
    ding_window_setting = final_rect;
    get_clip_photo().then((c) => {
        ding_window_setting[4] = c.toDataURL();
        ipcRenderer.send("ding", ding_window_setting);
        tool_close_f();
    });
}
// 复制
function tool_copy_f() {
    get_clip_photo().then((c) => {
        clipboard.writeImage(nativeImage.createFromDataURL(c.toDataURL()));
        tool_close_f();
    });
}
// 保存
function tool_save_f() {
    ipcRenderer.send("save");
    tool_close_f();
    ipcRenderer.on("save_path", (event, message) => {
        console.log(message);
        if (message != "") {
            get_clip_photo().then((c) => {
                f = c.toDataURL().replace(/^data:image\/\w+;base64,/, "");
                dataBuffer = new Buffer(f, "base64");
                fs.writeFile(message, dataBuffer, () => {});
            });
        }
    });
}

function get_clip_photo() {
    main_ctx = main_canvas.getContext("2d");
    var tmp_canvas = document.createElement("canvas");
    if (final_rect != "") {
        tmp_canvas.width = final_rect[2];
        tmp_canvas.height = final_rect[3];
    } else {
        tmp_canvas.width = main_canvas.width;
        tmp_canvas.height = main_canvas.height;
        final_rect = [0, 0, main_canvas.width, main_canvas.height];
    }
    gid = main_ctx.getImageData(final_rect[0], final_rect[1], final_rect[2], final_rect[3]); // 裁剪
    tmp_canvas.getContext("2d").putImageData(gid, 0, 0);
    canvas.discardActiveObject();
    var image = document.createElement("img");
    image.src = canvas.toDataURL({
        left: final_rect[0],
        top: final_rect[1],
        width: final_rect[2],
        height: final_rect[3],
        format: "png",
    });
    return new Promise((resolve, rejects) => {
        image.onload = () => {
            tmp_canvas.getContext("2d").drawImage(image, 0, 0, final_rect[2], final_rect[3]);
            resolve(tmp_canvas);
            // tmp_canvas;
        };
    });
}

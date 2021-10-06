// In the renderer process.
const {
    desktopCapturer,
    ipcRenderer,
    clipboard,
    nativeImage,
} = require("electron");
const fs = require("fs");

const main_canvas = document.getElementById("main_photo");
main_canvas.style.width = window.screen.width + "px";
const clip_canvas = document.getElementById("clip_photo");
clip_canvas.style.width = window.screen.width + "px";
const draw_canvas = document.getElementById("draw_photo");
draw_canvas.style.width = window.screen.width + "px";

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
                show_photo(o[n].thumbnail.toDataURL());
            });
        })(i);
    }
}

function show_photo(url) {
    var main_ctx = main_canvas.getContext("2d");
    let img = new Image();
    img.src = url;
    img.onload = function () {
        // 统一大小
        main_canvas.width = clip_canvas.width = draw_canvas.width = img.width;
        main_canvas.height =
            clip_canvas.height =
            draw_canvas.height =
                img.height;
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
function tool_ocr_f() {}
function tool_QR_f() {}
// 图片编辑
drawing = false;
function tool_draw_f() {
    drawing = drawing ? false : true; // 切换状态
    if (drawing) {
        document.getElementById("tool_draw").style.backgroundColor =
            getComputedStyle(document.documentElement).getPropertyValue(
                "--hover-color"
            );
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
    ding_window_setting = final_rect;
    ding_window_setting[4] = get_clip_photo();
    ipcRenderer.send("ding", ding_window_setting);
    tool_close_f();
}
// 复制
function tool_copy_f() {
    clipboard.writeImage(nativeImage.createFromDataURL(get_clip_photo()));
    tool_close_f();
}
// 保存
function tool_save_f() {
    ipcRenderer.send("save");
    ipcRenderer.on("save_path", (event, message) => {
        console.log(message);
        if (message != undefined) {
            f = get_clip_photo().replace(/^data:image\/\w+;base64,/, "");
            console.log(f);
            dataBuffer = new Buffer(f, "base64");
            fs.writeFile(message, dataBuffer, () => {});
            tool_close_f();
        }
    });
}

function page_position_to_canvas_position(canvas, x, y) {
    c_x = canvas.width * (x / canvas.offsetWidth); // canvas本来无外宽，不影响
    c_y = canvas.height * (y / canvas.offsetHeight);
    return { x: Math.round(c_x), y: Math.round(c_y) };
}

// 防止宽高负数
function auto_fix_position(x, y, w, h) {
    if (w < 0) {
        x = x + w; // w是负数,下同
        w = -w;
    }
    if (h < 0) {
        y = y + h;
        h = -h;
    }
    return [x, y, w, h];
}

selecting = false;
canvas_rect = "";
var final_rect;
clip_ctx = clip_canvas.getContext("2d");
clip_canvas.onmousedown = (e) => {
    selecting = true;
    canvas_rect = page_position_to_canvas_position(
        // 起始坐标
        clip_canvas,
        e.offsetX,
        e.offsetY
    );
    console.log(e.offsetX, e.offsetY);
    console.log(canvas_rect);
};
clip_canvas.onmousemove = (e) => {
    if (selecting) {
        clip_ctx.clearRect(0, 0, clip_canvas.width, clip_canvas.height);
        clip_ctx.beginPath();
        canvas_rect_e = page_position_to_canvas_position(
            // 实时坐标
            clip_canvas,
            e.offsetX,
            e.offsetY
        );
        xywh = auto_fix_position(
            canvas_rect.x,
            canvas_rect.y,
            canvas_rect_e.x - canvas_rect.x,
            canvas_rect_e.y - canvas_rect.y
        );
        clip_ctx.strokeRect(xywh[0], xywh[1], xywh[2], xywh[3]);
    }
};
clip_canvas.onmouseup = (e) => {
    clip_ctx.closePath();
    selecting = false;
    canvas_rect_e = page_position_to_canvas_position(
        // 实时坐标
        clip_canvas,
        e.offsetX,
        e.offsetY
    );
    final_rect = auto_fix_position(
        // 最终坐标
        canvas_rect.x,
        canvas_rect.y,
        canvas_rect_e.x - canvas_rect.x,
        canvas_rect_e.y - canvas_rect.y
    );
};

function get_clip_photo() {
    if (final_rect != undefined) {
        main_ctx = main_canvas.getContext("2d");
        var tmp_canvas = document.createElement("canvas");
        tmp_canvas.width = final_rect[2];
        tmp_canvas.height = final_rect[3];
        gid = main_ctx.getImageData(
            final_rect[0],
            final_rect[1],
            final_rect[2],
            final_rect[3]
        );
        tmp_canvas.getContext("2d").putImageData(gid, 0, 0);
        return tmp_canvas.toDataURL();
    } else {
        return main_canvas.toDataURL();
    }
}

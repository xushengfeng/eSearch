// In the renderer process.
const { ipcRenderer, clipboard, nativeImage, shell } = require("electron");
const fs = require("fs");
const jsqr = require("jsqr");
const Store = require("electron-store");
const hotkeys = require("hotkeys-js");
const open = require("open");
const os = require("os");

// 获取设置
store = new Store();
function set_setting() {
    工具栏跟随 = store.get("工具栏跟随");
    光标 = store.get("光标");
    四角坐标 = store.get("显示四角坐标");
    取色器默认格式 = store.get("取色器默认格式");
    all_color_format = ["HEX", "RGB", "HSL", "HSV", "CMYK"];
    for (let i in all_color_format) {
        if (取色器默认格式 == all_color_format[i]) {
            取色器格式位置 = i - 0 + 1;
            break;
        }
    }
    遮罩颜色 = store.get("遮罩颜色");
    选区颜色 = store.get("选区颜色");

    字体 = store.get("字体");
    document.documentElement.style.setProperty("--main-font", 字体.主要字体);
    document.documentElement.style.setProperty("--monospace", 字体.等宽字体);

    模糊 = store.get("模糊");
    if (模糊 != 0) {
        document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
    } else {
        document.documentElement.style.setProperty("--blur", `none`);
    }

    color_size = store.get("取色器大小");
    color_i_size = store.get("像素大小");
    document.documentElement.style.setProperty("--color-size", `${color_size * color_i_size}px`);
    document.documentElement.style.setProperty("--color-i-size", `${color_i_size}px`);
    document.documentElement.style.setProperty("--color-i-i", `${color_size}`);
}

全局缩放 = store.get("全局缩放") || 1.0;
const main_canvas = document.getElementById("main_photo");
main_canvas.style.width = window.screen.width / 全局缩放 + "px";
const clip_canvas = document.getElementById("clip_photo");
clip_canvas.style.width = window.screen.width / 全局缩放 + "px";
const draw_canvas = document.getElementById("draw_photo");
draw_canvas.style.width = window.screen.width / 全局缩放 + "px";
// 第一次截的一定是桌面,所以可提前定义
main_canvas.width = clip_canvas.width = draw_canvas.width = window.screen.width * window.devicePixelRatio;
main_canvas.height = clip_canvas.height = draw_canvas.height = window.screen.height * window.devicePixelRatio;

final_rect = xywh = [0, 0, main_canvas.width, main_canvas.height];

set_setting();
ipcRenderer.on("reflash", (a, x, w, h) => {
    main_canvas.width = clip_canvas.width = draw_canvas.width = w;
    main_canvas.height = clip_canvas.height = draw_canvas.height = h;
    for (let i = 0; i < x.length; i += 4) {
        [x[i], x[i + 2]] = [x[i + 2], x[i]];
    }
    d = new ImageData(Uint8ClampedArray.from(x), w, h);
    main_canvas.getContext("2d").putImageData(d, 0, 0);
    final_rect = [0, 0, main_canvas.width, main_canvas.height];
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
var o = false;
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
document.getElementById("tool_bar").onmouseup = (e) => {
    if (e.button == 0) {
        eval(`${e.target.id}_f()`);
    } else {
        e.target.style.backgroundColor = "";
        auto_do = "no";
    }
};

hotkeys.setScope("normal");
hotkeys("esc", "normal", tool_close_f);
hotkeys("enter", tool_ocr_f);
hotkeys("ctrl+s, command+s", tool_save_f);
hotkeys("ctrl+c, command+c", tool_copy_f);

var auto_do = store.get("框选后默认操作");
if (auto_do != "no") {
    document.getElementById(`tool_${auto_do}`).style.backgroundColor = "var(--hover-color)";
}

// 关闭
function tool_close_f() {
    document.querySelector("html").style.display = "none";
    document.getElementById("waiting").style.display = "none";
    document.querySelectorAll("#waiting line animate")[0].endElement();
    document.querySelectorAll("#waiting line animate")[1].endElement();
    clip_canvas.getContext("2d").clearRect(0, 0, clip_canvas.width, clip_canvas.height);
    final_rect_list = [[0, 0, main_canvas.width, main_canvas.height]]; /* 清空撤销栈 */
    main_canvas.getContext("2d").clearRect(0, 0, main_canvas.width, main_canvas.height);
    try {
        fabric_canvas.clear();
        undo_stack = [fabric_canvas.toJSON()]; /* 清空撤销栈 */
    } catch {}

    // 取消打开程序框
    o = true;
    tool_open_f();
    setTimeout(() => {
        ipcRenderer.send("clip_main_b", "window-close");
        document.querySelector("html").style.display = "";
    }, 50);
}
// OCR
function tool_ocr_f() {
    get_clip_photo("png").then((c) => {
        ipcRenderer.send("clip_main_b", "ocr", c.toDataURL().replace(/^data:image\/\w+;base64,/, ""));
    });

    document.querySelector("#waiting").style.display = "block";
    document.querySelector("#waiting").style.left = final_rect[0] + "px";
    document.querySelector("#waiting").style.top = final_rect[1] + "px";
    document.querySelector("#waiting").style.width = final_rect[2] + "px";
    document.querySelector("#waiting").style.height = final_rect[3] + "px";
    document.querySelectorAll("#waiting line animate")[0].beginElement();
    document.querySelectorAll("#waiting line animate")[1].beginElement();

    ipcRenderer.on("ocr_back", (event, arg) => {
        if (arg == "ok") {
            document.getElementById("waiting").style.display = "none";
            tool_close_f();
        } else {
            document.getElementById("waiting").style.display = "none";
        }
    });
}
// 二维码
function tool_QR_f() {
    get_clip_photo("png").then((c) => {
        var imageData = c.getContext("2d").getImageData(0, 0, c.width, c.height);
        var code = jsqr(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        if (code) {
            ipcRenderer.send("clip_main_b", "QR", code.data);
            tool_close_f();
        } else {
            ipcRenderer.send("clip_main_b", "QR", "nothing");
        }
    });
}
// 图片编辑
drawing = false;
function tool_draw_f() {
    drawing = drawing ? false : true; // 切换状态
    if (drawing) {
        document.getElementById("tool_draw").className = "hover_b";
        document.getElementById("draw_bar").style.height = "360px";
        document.querySelector("#draw_photo_top").style.zIndex = "11";
        hotkeys.setScope("drawing");
    } else {
        document.getElementById("tool_draw").className = "";
        document.getElementById("draw_bar").style.height = "0";
        document.querySelector("#draw_photo_top").style.zIndex = "9";
        hotkeys.setScope("normal");
        fabric_canvas.discardActiveObject();
        fabric_canvas.renderAll();
    }
}
// 在其他应用打开
function tool_open_f() {
    o = !o;
    if (o) {
        document.querySelector("#windows_bar").style.transform = "translateX(0)";
        document.querySelector("#app_path > div > input").disabled = false;
        document.querySelector("#app_path > div > input").select();
        document.querySelector("#app_path > div > input").focus();
    } else {
        document.querySelector("#windows_bar").style.transform = "translateX(-100%)";
    }
}
document.querySelector("#app_path > div > input").value = store.get("其他应用打开") || "";
document.querySelector("#app_path > div > #open_file").onclick = () => {
    ipcRenderer.send("clip_main_b", "open");
    ipcRenderer.on("open_path", (event, message) => {
        if (typeof message != "undefined") {
            document.querySelector("#app_path > div > input").value = message;
            open_app();
        } else {
            document.querySelector("#app_path > div > input").select();
            document.querySelector("#app_path > div > input").focus();
        }
    });
};
document.querySelector("#app_path > div > #open").onclick = () => {
    open_app();
};
document.querySelector("#app_path > div > input").onkeydown = (e) => {
    if (e.key == "Enter") {
        e.preventDefault();
        open_app();
    }
};
function open_app() {
    var app = document.querySelector("#app_path > div > input").value;
    store.set("其他应用打开", app);
    get_clip_photo("png").then((c) => {
        f = c.toDataURL().replace(/^data:image\/\w+;base64,/, "");
        dataBuffer = new Buffer(f, "base64");
        fs.writeFile(os.tmpdir() + "/tmp.png", dataBuffer, () => {
            if (app == "") {
                open(os.tmpdir() + "/tmp.png").then(() => {
                    tool_close_f();
                });
            } else {
                open.openApp(app, { arguments: [os.tmpdir() + "/tmp.png"] }).then((c) => {
                    if (c.pid != undefined) {
                        tool_close_f();
                    } else {
                        document.querySelector("#app_path > div > input").disabled = false;
                        document.querySelector("#app_path > div > input").value = app;
                        document.querySelector("#app_path > div > input").select();
                    }
                });
            }
            document.querySelector("#app_path > div > input").disabled = true;
            document.querySelector("#app_path > div > input").value = "正在打开...";
        });
    });
}
// 钉在屏幕上
function tool_ding_f() {
    ding_window_setting = final_rect;
    get_clip_photo("png").then((c) => {
        ding_window_setting[4] = c.toDataURL();
        ipcRenderer.send("clip_main_b", "ding", ding_window_setting);
        tool_close_f();
    });
}
// 复制
function tool_copy_f() {
    get_clip_photo("png").then((c) => {
        clipboard.writeImage(nativeImage.createFromDataURL(c.toDataURL()));
        tool_close_f();
    });
}
// 保存
function tool_save_f() {
    document.querySelector("#windows_bar").style.transform = "translateX(0)";
    o = true;
    document.getElementById("save_type").style.display = "grid";
    document.getElementById("suffix").focus();
    document.getElementById("suffix").oninput = document.getElementById("suffix_b").onclick = () => {
        var type = document.getElementById("suffix").value;
        ipcRenderer.send("clip_main_b", "save", type);
        ipcRenderer.on("save_path", (event, message) => {
            console.log(message);
            if (message) {
                get_clip_photo(type).then((c) => {
                    if (type == "svg") {
                        var dataBuffer = new Buffer(c, "UTF-8");
                        fs.writeFile(message, dataBuffer, () => {});
                    } else {
                        var f = c.toDataURL().replace(/^data:image\/\w+;base64,/, "");
                        var dataBuffer = new Buffer(f, "base64");
                        fs.writeFile(message, dataBuffer, () => {});
                    }
                });
                tool_close_f();
            }
            document.getElementById("save_type").style.display = "none";
        });
    };
}

var svg;
function get_clip_photo(type) {
    main_ctx = main_canvas.getContext("2d");
    if (final_rect == "") final_rect = [0, 0, main_canvas.width, main_canvas.height];

    if (type == "svg") {
        fabric_canvas.discardActiveObject();
        fabric_canvas.renderAll();
        svg = document.createElement("div");
        svg.innerHTML = fabric_canvas.toSVG();
        svg.querySelector("svg").setAttribute("viewBox", final_rect.join(" "));
        var image = document.createElementNS("http://www.w3.org/2000/svg", "image");
        image.setAttribute("xlink:href", main_canvas.toDataURL());
        svg.querySelector("svg").insertBefore(image, svg.querySelector("svg").firstChild);
        svg_t = new XMLSerializer().serializeToString(svg.querySelector("svg"));
        return new Promise((resolve, rejects) => {
            resolve(svg_t);
        });
    } else {
        var tmp_canvas = document.createElement("canvas");
        tmp_canvas.width = final_rect[2];
        tmp_canvas.height = final_rect[3];
        gid = main_ctx.getImageData(final_rect[0], final_rect[1], final_rect[2], final_rect[3]); // 裁剪
        tmp_canvas.getContext("2d").putImageData(gid, 0, 0);
        fabric_canvas.discardActiveObject();
        fabric_canvas.renderAll();
        var image = document.createElement("img");
        image.src = fabric_canvas.toDataURL({
            left: final_rect[0],
            top: final_rect[1],
            width: final_rect[2],
            height: final_rect[3],
            format: type,
        });
        return new Promise((resolve, rejects) => {
            image.onload = () => {
                tmp_canvas.getContext("2d").drawImage(image, 0, 0, final_rect[2], final_rect[3]);
                resolve(tmp_canvas);
                // tmp_canvas;
            };
        });
    }
}

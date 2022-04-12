// In the renderer process.
const { ipcRenderer, clipboard, nativeImage, shell } = require("electron");
const fs = require("fs");
const jsqr = require("jsqr");
const Store = require("electron-store");
const hotkeys = require("hotkeys-js");
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

    模糊 = store.get("全局.模糊");
    if (模糊 != 0) {
        document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
    } else {
        document.documentElement.style.setProperty("--blur", `none`);
    }

    document.documentElement.style.setProperty("--alpha", store.get("全局.不透明度"));

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
    if (store.get("记录截屏.记录"))
        add_img([{ src: main_canvas.toDataURL({ left: 0, top: 0, width: w, height: h, type: "png" }), w, h }]);
});

var img_store = new Store({ name: "img_history" });

function add_img(img_l) {
    var time = new Date().getTime();
    img_store.set(`截屏记录.${time}`, img_l);
    img_l = null;
}

function show_img_his() {
    if (document.getElementById("img_history").innerHTML != "") return;
    var o_l = img_store.get("截屏记录");
    if (store.get("记录截屏.限定保留")) {
        var s_l = Object.keys(o_l).sort();
        s_l = s_l.splice(-store.get("记录截屏.保留次数"));
        var oo_l = {};
        for (i of s_l) {
            oo_l[i] = o_l[i];
        }
        o_l = oo_l;
        oo_l = null;
    }
    for (let j in o_l) {
        let div = document.createElement("div");
        div.innerHTML = '<button><img src="./assets/icons/close.svg" class="icon"></button>';
        for (k of o_l[j]) {
            let img = document.createElement("img");
            img.src = k.src;
            div.append(img);
            (() => {
                img.onclick = () => {
                    main_canvas.width = k.w;
                    main_canvas.height = k.h;
                    main_canvas.getContext("2d").drawImage(img, 0, 0, k.w, k.h);
                };
            })();
        }
        document.getElementById("img_history").prepend(div);
        (() => {
            div.querySelector("button").onclick = () => {
                div.parentElement.removeChild(div);
                img_store.delete(`截屏记录.${j}`);
            };
        })();
    }
    img_store.set("截屏记录", o_l);
    o_l = null;
}

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
hotkeys("z", windows_bar_c_o);
function windows_bar_c_o() {
    if (!o) {
        document.querySelector("#windows_bar").style.transform = "translateX(0)";
        o = true;
        show_img_his();
    } else {
        document.querySelector("#windows_bar").style.transform = "translateX(-100%)";
        o = false;
    }
}

document.getElementById("windows_bar_close").onclick = windows_bar_c_o;

var b_scope = null;
var center_bar_show = false;
var center_bar_m = null;
function s_center_bar(m) {
    hotkeys.deleteScope("c_bar");
    if (center_bar_m == m) {
        center_bar_show = false;
        center_bar_m = null;
    } else {
        center_bar_show = true;
        center_bar_m = m;
    }
    if (m === false) center_bar_show = false;
    if (center_bar_show) {
        document.getElementById("save_type").style.height = 0;
        document.getElementById("draw_edit").style.height = 0;
        document.getElementById("save_type").style.width = 0;
        document.getElementById("draw_edit").style.width = 0;
        document.getElementById("center_bar").style.opacity = 1;
        document.getElementById("center_bar").style.pointerEvents = "auto";
        if (hotkeys.getScope() != "all") b_scope = hotkeys.getScope();
        hotkeys.setScope("c_bar");
    } else {
        document.getElementById("center_bar").style.opacity = 0;
        document.getElementById("center_bar").style.pointerEvents = "none";
        hotkeys.setScope(b_scope || "normal");
    }
    switch (m) {
        case "save":
            document.getElementById("save_type").style.height = "";
            document.getElementById("save_type").style.width = "";
            break;
        case "edit":
            document.getElementById("draw_edit").style.height = "";
            document.getElementById("draw_edit").style.width = "";
            break;
    }
}

var tool_bar = document.getElementById("tool_bar");
// 工具栏按钮
tool_bar.onmouseup = (e) => {
    if (e.button == 0) {
        // * 拼接函数名
        eval(`${e.target.id}_f()`);
    }
    // 中键取消抬起操作
    if (e.button == 1) {
        e.target.style.backgroundColor = "";
        auto_do = "no";
    }
};

hotkeys.filter = (event) => {
    var tagName = (event.target || event.srcElement).tagName;
    return (
        !(tagName.isContentEditable || tagName == "INPUT" || tagName == "SELECT" || tagName == "TEXTAREA") ||
        event.target === document.querySelector("#draw_edit input")
    );
};

hotkeys.setScope("normal");
hotkeys("esc", "normal", tool_close_f);
hotkeys("enter", "normal", tool_ocr_f);
hotkeys("ctrl+s, command+s", tool_save_f);
hotkeys("ctrl+c, command+c", tool_copy_f);

var auto_do = store.get("框选后默认操作");
if (auto_do != "no") {
    document.getElementById(`tool_${auto_do}`).style.backgroundColor = "var(--hover-color)";
}

// 关闭
function tool_close_f() {
    document.querySelector("html").style.display = "none"; /* 退出时隐藏，透明窗口，动画不明显 */
    setTimeout(() => {
        ipcRenderer.send("clip_main_b", "window-close");
        location.reload();
    }, 50);
}
// OCR
document.getElementById("ocr引擎").value = store.get("OCR.记住") || store.get("OCR.类型");
document.getElementById("ocr引擎").oninput = () => {
    if (store.get("OCR.记住")) store.set("OCR.记住", document.getElementById("ocr引擎").value);
    tool_ocr_f();
};
document.getElementById("tool_ocr").title = `OCR(文字识别) - ${document.getElementById("ocr引擎").value}`;
function tool_ocr_f() {
    var type = document.getElementById("ocr引擎").value;
    get_clip_photo("png").then((c) => {
        ipcRenderer.send("clip_main_b", "ocr", [c.toDataURL().replace(/^data:image\/\w+;base64,/, ""), type]);
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
// 以图搜图
document.getElementById("识图引擎").value = store.get("以图搜图.记住") || store.get("以图搜图.引擎");
document.getElementById("识图引擎").oninput = () => {
    if (store.get("以图搜图.记住")) store.set("以图搜图.记住", document.getElementById("识图引擎").value);
    tool_search_f();
};
document.getElementById("tool_search").title = `以图搜图 - ${document.getElementById("识图引擎").value}`;
function tool_search_f() {
    var type = document.getElementById("识图引擎").value;
    get_clip_photo("png").then((c) => {
        ipcRenderer.send("clip_main_b", "search", [c.toDataURL().replace(/^data:image\/\w+;base64,/, ""), type]);
    });

    document.querySelector("#waiting").style.display = "block";
    document.querySelector("#waiting").style.left = final_rect[0] + "px";
    document.querySelector("#waiting").style.top = final_rect[1] + "px";
    document.querySelector("#waiting").style.width = final_rect[2] + "px";
    document.querySelector("#waiting").style.height = final_rect[3] + "px";
    document.querySelectorAll("#waiting line animate")[0].beginElement();
    document.querySelectorAll("#waiting line animate")[1].beginElement();

    ipcRenderer.on("search_back", (event, arg) => {
        if (arg == "ok") {
            tool_close_f();
            document.getElementById("waiting").style.display = "none";
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
        document.getElementById("draw_bar").style.height = "300px";
        document.getElementById("clip_photo").style.pointerEvents = "none";
        hotkeys.setScope("drawing");
    } else {
        document.getElementById("tool_draw").className = "";
        document.getElementById("draw_bar").style.height = "0";
        document.getElementById("clip_photo").style.pointerEvents = "auto";
        hotkeys.setScope("normal");
        fabric_canvas.discardActiveObject();
        fabric_canvas.renderAll();
    }
}
// 在其他应用打开
function tool_open_f() {
    open_app();
}

const path = require("path");
const tmp_photo = path.join(os.tmpdir(), "/eSearch/tmp.png");
function open_app() {
    get_clip_photo("png").then((c) => {
        f = c.toDataURL().replace(/^data:image\/\w+;base64,/, "");
        dataBuffer = new Buffer(f, "base64");
        fs.writeFile(tmp_photo, dataBuffer, () => {
            var open = require("./lib/open_with");
            open(tmp_photo);
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
var type;
function tool_save_f() {
    s_center_bar("save");
    document.querySelectorAll("#suffix > div")[0].className = "suffix_h";
    document.getElementById("suffix").onclick = (e) => {
        if (e.target.dataset.value) {
            ipcRenderer.send("clip_main_b", "save", e.target.dataset.value);
            type = e.target.dataset.value;
            s_center_bar("save");
        }
    };
    hotkeys.setScope("c_bar");
    var i = 0;
    hotkeys("enter", "c_bar", () => {
        document.querySelector("#suffix > .suffix_h").click();
        s_center_bar("save");
    });
    hotkeys("up", "c_bar", () => {
        document.querySelectorAll("#suffix > div")[i % 3].className = "";
        i = i == 0 ? 2 : i - 1;
        document.querySelectorAll("#suffix > div")[i % 3].className = "suffix_h";
    });
    hotkeys("down", "c_bar", () => {
        document.querySelectorAll("#suffix > div")[i % 3].className = "";
        i++;
        document.querySelectorAll("#suffix > div")[i % 3].className = "suffix_h";
    });
    hotkeys("esc", "c_bar", () => {
        s_center_bar("save");
    });
}
ipcRenderer.on("save_path", (event, message) => {
    console.log(message);
    if (message) {
        get_clip_photo(type).then((c) => {
            switch (type) {
                case "svg":
                    var dataBuffer = new Buffer(c, "UTF-8");
                    fs.writeFile(message, dataBuffer, (err) => {
                        if (!err) {
                            ipcRenderer.send("clip_main_b", "ok_save", message);
                        }
                    });
                    break;
                case "png":
                    var f = c.toDataURL().replace(/^data:image\/\w+;base64,/, "");
                    var dataBuffer = new Buffer(f, "base64");
                    fs.writeFile(message, dataBuffer, (err) => {
                        if (!err) {
                            ipcRenderer.send("clip_main_b", "ok_save", message);
                        }
                    });
                    break;
                case "jpg":
                    var f = c.toDataURL("image/jpeg", store.get("jpg质量") - 0).replace(/^data:image\/\w+;base64,/, "");
                    var dataBuffer = new Buffer(f, "base64");
                    fs.writeFile(message, dataBuffer, (err) => {
                        if (!err) {
                            ipcRenderer.send("clip_main_b", "ok_save", message);
                        }
                    });
                    break;
            }
        });
        tool_close_f();
    }
});
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

var tool_position = { x: null, y: null };
tool_bar.addEventListener("mousedown", (e) => {
    tool_bar.style.transition = "none";
    if (e.button == 2) {
        tool_position.x = e.clientX - tool_bar.offsetLeft;
        tool_position.y = e.clientY - tool_bar.offsetTop;
    }
});
tool_bar.addEventListener("mouseup", (e) => {
    tool_bar.style.transition = "";
    if (e.button == 2) tool_position = { x: null, y: null };
});

// In the renderer process.
const { ipcRenderer, clipboard, nativeImage } = require("electron");
const Store = require("electron-store");
const hotkeys = require("hotkeys-js");

// 获取设置
var store = new Store();

if (store.get("框选.自动框选.开启")) {
    var cv = require("opencv.js");
}

var 工具栏跟随, 光标, 四角坐标, 遮罩颜色, 选区颜色, 取色器默认格式, 取色器格式位置, color_size, color_i_size;
var all_color_format = ["HEX", "RGB", "HSL", "HSV", "CMYK"];
function set_setting() {
    工具栏跟随 = store.get("工具栏跟随");
    光标 = store.get("光标");
    四角坐标 = store.get("显示四角坐标");
    取色器默认格式 = store.get("取色器默认格式");
    for (let i in all_color_format) {
        if (取色器默认格式 == all_color_format[i]) {
            取色器格式位置 = i - 0 + 1;
            break;
        }
    }
    遮罩颜色 = store.get("遮罩颜色");
    选区颜色 = store.get("选区颜色");

    var 字体 = store.get("字体");
    document.documentElement.style.setProperty("--main-font", 字体.主要字体);
    document.documentElement.style.setProperty("--monospace", 字体.等宽字体);

    var 模糊 = store.get("全局.模糊");
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
    let 工具栏 = store.get("工具栏");
    document.documentElement.style.setProperty("--bar-size", `${工具栏.按钮大小}px`);
    document.documentElement.style.setProperty("--bar-icon", `${工具栏.按钮图标比例}`);
}

var 全局缩放 = store.get("全局.缩放") || 1.0;
const main_canvas = document.getElementById("main_photo");
main_canvas.style.width = window.screen.width / 全局缩放 + "px";
const clip_canvas = document.getElementById("clip_photo");
clip_canvas.style.width = window.screen.width / 全局缩放 + "px";
const draw_canvas = document.getElementById("draw_photo");
draw_canvas.style.width = window.screen.width / 全局缩放 + "px";
// 第一次截的一定是桌面,所以可提前定义
main_canvas.width = clip_canvas.width = draw_canvas.width = window.screen.width * window.devicePixelRatio;
main_canvas.height = clip_canvas.height = draw_canvas.height = window.screen.height * window.devicePixelRatio;

var final_rect = [0, 0, main_canvas.width, main_canvas.height];

set_setting();
ipcRenderer.on("reflash", (a, x, w, h) => {
    main_canvas.width = clip_canvas.width = draw_canvas.width = w;
    main_canvas.height = clip_canvas.height = draw_canvas.height = h;
    for (let i = 0; i < x.length; i += 4) {
        [x[i], x[i + 2]] = [x[i + 2], x[i]];
    }
    var d = new ImageData(Uint8ClampedArray.from(x), w, h);
    main_canvas.getContext("2d").putImageData(d, 0, 0);
    final_rect = [0, 0, main_canvas.width, main_canvas.height];
    if (store.get("框选.自动框选.开启")) {
        setTimeout(() => {
            edge();
        }, 0);
    }
});

var edge_init = false;
var edge_rect = [];
function edge() {
    edge_init = true;
    let canvas = main_canvas;
    let src = cv.imread(canvas);

    cv.cvtColor(src, src, cv.COLOR_RGBA2RGB);
    // cv.imshow(canvas, src);

    let dst = new cv.Mat();
    let c_min = store.get("框选.自动框选.最小阈值"),
        c_max = store.get("框选.自动框选.最大阈值");
    cv.Canny(src, dst, c_min, c_max, 3, true);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    cv.findContours(dst, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contours.size(); i++) {
        let cnt = contours.get(i);
        edge_rect.push(cv.boundingRect(cnt));
    }

    // cv.imshow(canvas, dst);

    src.delete();
    dst.delete();
    contours.delete();
    hierarchy.delete();

    src = dst = contours = hierarchy = null;
}

// 左边窗口工具栏弹出
var o = false;
hotkeys("z", windows_bar_c_o);
function windows_bar_c_o() {
    if (!o) {
        document.querySelector("#windows_bar").style.transform = "translateX(0)";
        o = true;
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
        document.getElementById("save_type").style.height = "0";
        document.getElementById("draw_edit").style.height = "0";
        document.getElementById("save_type").style.width = "0";
        document.getElementById("draw_edit").style.width = "0";
        document.getElementById("center_bar").style.opacity = "1";
        document.getElementById("center_bar").style.pointerEvents = "auto";
        if (hotkeys.getScope() != "all") b_scope = hotkeys.getScope();
        hotkeys.setScope("c_bar");
    } else {
        document.getElementById("center_bar").style.opacity = "0";
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
    var el = e.target;
    if (el.parentElement != tool_bar) return;
    if (e.button == 0) {
        // * 拼接函数名
        eval(`${el.id}_f()`);
    }
    // 中键取消抬起操作
    if (e.button == 1) {
        el.style.backgroundColor = "";
        auto_do = "no";
    }
};

hotkeys.filter = (event) => {
    var tagName = (event.target || event.srcElement).tagName;
    var v =
        !(event.target.isContentEditable || tagName == "INPUT" || tagName == "SELECT" || tagName == "TEXTAREA") ||
        event.target === document.querySelector("#draw_edit input");
    return v;
};

hotkeys.setScope("normal");
hotkeys(store.get("其他快捷键.关闭"), "normal", tool_close_f);
hotkeys(store.get("其他快捷键.OCR"), "normal", tool_ocr_f);
hotkeys(store.get("其他快捷键.以图搜图"), "normal", tool_search_f);
hotkeys(store.get("其他快捷键.QR码"), "normal", tool_QR_f);
hotkeys(store.get("其他快捷键.图像编辑"), "normal", tool_draw_f);
hotkeys(store.get("其他快捷键.其他应用打开"), "normal", tool_open_f);
hotkeys(store.get("其他快捷键.放在屏幕上"), "normal", tool_ding_f);
hotkeys(store.get("其他快捷键.复制"), "normal", tool_copy_f);
hotkeys(store.get("其他快捷键.保存"), "normal", tool_save_f);

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
var ocr引擎 = document.getElementById("ocr引擎");
ocr引擎.value = store.get("OCR.记住") || store.get("OCR.类型");
document.getElementById("ocr引擎").oninput = () => {
    if (store.get("OCR.记住")) store.set("OCR.记住", ocr引擎.value);
    tool_ocr_f();
};
document.getElementById("tool_ocr").title = `OCR(文字识别) - ${ocr引擎.value}`;
function tool_ocr_f() {
    var type = ocr引擎.value;
    get_clip_photo("png").then((c) => {
        ipcRenderer.send("clip_main_b", "ocr", [c.toDataURL().replace(/^data:image\/\w+;base64,/, ""), type]);
    });

    document.getElementById("waiting").style.display = "block";
    document.getElementById("waiting").style.left = final_rect[0] + "px";
    document.getElementById("waiting").style.top = final_rect[1] + "px";
    document.getElementById("waiting").style.width = final_rect[2] + "px";
    document.getElementById("waiting").style.height = final_rect[3] + "px";
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
var 识图引擎 = document.getElementById("识图引擎");
识图引擎.value = store.get("以图搜图.记住") || store.get("以图搜图.引擎");
识图引擎.oninput = () => {
    if (store.get("以图搜图.记住")) store.set("以图搜图.记住", 识图引擎.value);
    tool_search_f();
};
document.getElementById("tool_search").title = `以图搜图 - ${识图引擎.value}`;
function tool_search_f() {
    var type = 识图引擎.value;
    get_clip_photo("png").then((c) => {
        ipcRenderer.send("clip_main_b", "search", [c.toDataURL().replace(/^data:image\/\w+;base64,/, ""), type]);
    });

    document.getElementById("waiting").style.display = "block";
    document.getElementById("waiting").style.left = final_rect[0] + "px";
    document.getElementById("waiting").style.top = final_rect[1] + "px";
    document.getElementById("waiting").style.width = final_rect[2] + "px";
    document.getElementById("waiting").style.height = final_rect[3] + "px";
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
    const jsqr = require("jsqr");
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
var drawing = false;
var draw_bar_height = `calc(var(--bar-size) * 6)`;
function tool_draw_f() {
    drawing = drawing ? false : true; // 切换状态
    if (drawing) {
        document.getElementById("tool_draw").className = "hover_b";
        document.getElementById("draw_bar").style.height = `${draw_bar_height}`;
        document.getElementById("clip_photo").style.pointerEvents = "none";
        track_location();
    } else {
        document.getElementById("tool_draw").className = "";
        document.getElementById("draw_bar").style.height = "0";
        document.getElementById("clip_photo").style.pointerEvents = "auto";
        document.getElementById("draw_bar").style.width = "var(--bar-size)";
        document.querySelectorAll("#draw_main > div").forEach((ei) => {
            ei.show = false;
        });
        hotkeys.setScope("normal");
        fabric_canvas.discardActiveObject();
        fabric_canvas.renderAll();
    }
    setTimeout(add_edit_js, 400);
}

/**
 * 编辑栏跟踪工具栏
 */
function track_location() {
    let h = document.getElementById("tool_bar").offsetTop;
    let l = document.getElementById("tool_bar").offsetLeft + document.getElementById("tool_bar").offsetWidth + 8;
    document.getElementById("draw_bar").setAttribute("right", "true");
    let x =
        document.getElementById("tool_bar").offsetLeft < final_rect[0] &&
        document.getElementById("tool_bar").offsetLeft - document.getElementById("tool_bar").offsetWidth * 2 > 0;
    if (l + 2 * document.getElementById("tool_bar").offsetWidth > document.body.offsetWidth || x) {
        l = document.getElementById("tool_bar").offsetLeft - document.getElementById("draw_bar").offsetWidth - 8;
        l2 = document.getElementById("tool_bar").offsetLeft - document.getElementById("tool_bar").offsetWidth - 8;
        document.getElementById("draw_bar").setAttribute("right", `calc(${l2}px - var(--bar-size)), ${l2}px`);
    }
    document.getElementById("draw_bar").style.top = `${h}px`;
    document.getElementById("draw_bar").style.left = `${l}px`;
}

function add_edit_js() {
    if (document.querySelector("#edit_js")) return;
    var edit = document.createElement("script");
    edit.src = "js/edit.js";
    edit.id = "edit_js";
    document.body.append(edit);
}
// 在其他应用打开
function tool_open_f() {
    open_app();
}

function open_app() {
    const path = require("path");
    const os = require("os");
    const tmp_photo = path.join(os.tmpdir(), "/eSearch/tmp.png");
    const fs = require("fs");
    get_clip_photo("png").then((c) => {
        var f = c.toDataURL().replace(/^data:image\/\w+;base64,/, "");
        var dataBuffer = new Buffer(f, "base64");
        fs.writeFile(tmp_photo, dataBuffer, () => {
            var open = require("./lib/open_with");
            open(tmp_photo);
        });
    });
}

function tool_record_f() {
    ipcRenderer.send("clip_main_b", "record", final_rect);
    tool_close_f();
}
// 钉在屏幕上
function tool_ding_f() {
    var ding_window_setting = final_rect;
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
    var t_to_n = { png: 0, jpg: 1, svg: 2 };
    var i = t_to_n[store.get("保存.默认格式")];
    document.querySelectorAll("#suffix > div")[i].className = "suffix_h";
    document.getElementById("suffix").onclick = (e) => {
        var el = e.target;
        if (el.dataset.value) {
            ipcRenderer.send("clip_main_b", "save", el.dataset.value);
            type = el.dataset.value;
            s_center_bar("save");
        }
    };
    hotkeys.setScope("c_bar");
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
        const fs = require("fs");
        get_clip_photo(type).then((c) => {
            switch (type) {
                case "svg":
                    var dataBuffer = Buffer.from(c, "UTF-8");
                    fs.writeFile(message, dataBuffer, (err) => {
                        if (!err) {
                            ipcRenderer.send("clip_main_b", "ok_save", message);
                        }
                    });
                    break;
                case "png":
                    var f = c.toDataURL().replace(/^data:image\/\w+;base64,/, "");
                    var dataBuffer = Buffer.from(f, "base64");
                    fs.writeFile(message, dataBuffer, (err) => {
                        if (!err) {
                            ipcRenderer.send("clip_main_b", "ok_save", message);
                        }
                    });
                    break;
                case "jpg":
                    var f = c.toDataURL("image/jpeg", store.get("jpg质量") - 0).replace(/^data:image\/\w+;base64,/, "");
                    var dataBuffer = Buffer.from(f, "base64");
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
/**
 * 获取选区图像
 * @param {string} type 格式
 * @returns promise svg base64|canvas element
 */
function get_clip_photo(type) {
    var main_ctx = main_canvas.getContext("2d");
    if (!final_rect) final_rect = [0, 0, main_canvas.width, main_canvas.height];

    if (typeof fabric_canvas != "undefined") {
        fabric_canvas.discardActiveObject();
        fabric_canvas.renderAll();
    }

    if (type == "svg") {
        svg = document.createElement("div");
        if (typeof fabric_canvas == "undefined") {
            svg.innerHTML = `<!--?xml version="1.0" encoding="UTF-8" standalone="no" ?-->
            <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${main_canvas.width}" height="${main_canvas.height}" viewBox="0 0 1920 1080" xml:space="preserve">
            <desc>Created with eSearch</desc>
            </svg>`;
        } else {
            svg.innerHTML = fabric_canvas.toSVG();
            svg.querySelector("desc").innerHTML = "Created with eSearch & Fabric.js";
        }
        svg.querySelector("svg").setAttribute("viewBox", final_rect.join(" "));
        let image = document.createElementNS("http://www.w3.org/2000/svg", "image");
        image.setAttribute("xlink:href", main_canvas.toDataURL());
        svg.querySelector("svg").insertBefore(image, svg.querySelector("svg").firstChild);
        var svg_t = new XMLSerializer().serializeToString(svg.querySelector("svg"));
        return new Promise((resolve, rejects) => {
            resolve(svg_t);
        });
    } else {
        var tmp_canvas = document.createElement("canvas");
        tmp_canvas.width = final_rect[2];
        tmp_canvas.height = final_rect[3];
        var gid = main_ctx.getImageData(final_rect[0], final_rect[1], final_rect[2], final_rect[3]); // 裁剪
        tmp_canvas.getContext("2d").putImageData(gid, 0, 0);
        let image = document.createElement("img");
        if (typeof fabric_canvas != "undefined") {
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
                };
            });
        } else {
            return new Promise((resolve, rejects) => {
                resolve(tmp_canvas);
            });
        }
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

const { t, lan } = require("./lib/translate/translate");
lan(store.get("语言.语言"));
document.title = t(document.title);

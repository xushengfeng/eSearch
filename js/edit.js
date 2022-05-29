const { fabric } = require("./lib/fabric.min.js");
var fabric_canvas = new fabric.Canvas("draw_photo");

his_push();

var fill_color = store.get("图像编辑.默认属性.填充颜色");
var stroke_color = store.get("图像编辑.默认属性.边框颜色");
var stroke_width = store.get("图像编辑.默认属性.边框宽度");
var free_color = store.get("图像编辑.默认属性.画笔颜色");
var free_width = store.get("图像编辑.默认属性.画笔粗细");
var shadow_blur = 0;

// 编辑栏
document.querySelectorAll("#draw_main > div").forEach((e, index) => {
    document.querySelectorAll("#draw_side > div")[index].style.height = "0";
    e.addEventListener("click", () => {
        if (e.show) {
            e.show = !e.show;
            document.querySelectorAll("#draw_side > div")[index].style.height = "0";
            document.querySelector("#draw_bar").style.width = "var(--bar-size)";
            for (const ee of document.querySelectorAll("#draw_main > div")) {
                ee.style.backgroundColor = "";
            }
            if (document.getElementById("draw_bar").getAttribute("right") != "true") {
                document.getElementById("draw_bar").style.transition = "var(--transition)";
                document.getElementById("draw_bar").style.left = document
                    .getElementById("draw_bar")
                    .getAttribute("right")
                    .split(",")[1];
                setTimeout(() => {
                    document.getElementById("draw_bar").style.transition = "";
                }, 400);
            }
        } else {
            document.querySelector("#draw_bar").style.width = "calc(var(--bar-size) * 2)";
            for (const ee of document.querySelectorAll("#draw_main > div")) {
                ee.style.backgroundColor = "";
            }
            e.style.backgroundColor = "var(--hover-color)";
            if (document.getElementById("draw_bar").getAttribute("right") != "true") {
                document.getElementById("draw_bar").style.transition = "var(--transition)";
                document.getElementById("draw_bar").style.left = document
                    .getElementById("draw_bar")
                    .getAttribute("right")
                    .split(",")[0];
                setTimeout(() => {
                    document.getElementById("draw_bar").style.transition = "";
                }, 400);
            }
            document.querySelectorAll("#draw_main > div").forEach((ei) => {
                ei.show = false;
            });
            e.show = !e.show;
            document.querySelectorAll("#draw_side > div").forEach((ei) => {
                ei.style.height = "0";
            });
            var h = 0;
            Array.from(document.querySelectorAll("#draw_side > div")[index].children).forEach((e) => {
                h += e.offsetHeight;
            });
            if (h > draw_bar_height) {
                h = draw_bar_height;
            }
            document.querySelectorAll("#draw_side > div")[index].style.height = h + "px";
        }
    });
});

// 笔
document.querySelector("#draw_free_pencil").oninput = () => {
    fabric_canvas.isDrawingMode = document.querySelector("#draw_free_pencil").checked;
    get_f_object_v();
    if (document.querySelector("#draw_free_pencil").checked) {
        document.querySelectorAll("#draw_free_i > lock-b")[1].checked = false;
        document.querySelectorAll("#draw_free_i > lock-b")[2].checked = false;

        fabric_canvas.freeDrawingBrush = new fabric.PencilBrush(fabric_canvas);
        fabric_canvas.freeDrawingBrush.color = free_color;
        fabric_canvas.freeDrawingBrush.width = free_width;
        free_shadow();
    }
    exit_shape();
    exit_filter();
    free_draw_cursor();
};
// 橡皮
document.querySelector("#draw_free_eraser").oninput = () => {
    fabric_canvas.isDrawingMode = document.querySelector("#draw_free_eraser").checked;
    get_f_object_v();
    if (document.querySelector("#draw_free_eraser").checked) {
        document.querySelectorAll("#draw_free_i > lock-b")[0].checked = false;
        document.querySelectorAll("#draw_free_i > lock-b")[2].checked = false;

        fabric_canvas.freeDrawingBrush = new fabric.EraserBrush(fabric_canvas);
        fabric_canvas.freeDrawingBrush.width = free_width;
    }
    exit_shape();
    exit_filter();
    free_draw_cursor();
};
// 刷
document.querySelector("#draw_free_spray").oninput = () => {
    fabric_canvas.isDrawingMode = document.querySelector("#draw_free_spray").checked;
    get_f_object_v();
    if (document.querySelector("#draw_free_spray").checked) {
        document.querySelectorAll("#draw_free_i > lock-b")[0].checked = false;
        document.querySelectorAll("#draw_free_i > lock-b")[1].checked = false;

        fabric_canvas.freeDrawingBrush = new fabric.SprayBrush(fabric_canvas);
        fabric_canvas.freeDrawingBrush.color = free_color;
        fabric_canvas.freeDrawingBrush.width = free_width;
    }
    exit_shape();
    exit_filter();
    free_draw_cursor();
};
// 阴影
document.querySelector("#shadow_blur > range-b").oninput = free_shadow;

function free_shadow() {
    shadow_blur = document.querySelector("#shadow_blur > range-b").value;
    fabric_canvas.freeDrawingBrush.shadow = new fabric.Shadow({
        blur: shadow_blur,
        color: free_color,
    });
}

function free_draw_cursor() {
    var mode = "free";
    if (document.querySelector("#draw_free_pencil").checked) mode = "free";
    if (document.querySelector("#draw_free_eraser").checked) mode = "eraser";
    if (document.querySelector("#draw_free_spray").checked) mode = "spray";
    if (mode == "free" || mode == "eraser") {
        var svg_w = free_width,
            h_w = svg_w / 2,
            r = free_width / 2;
        if (svg_w < 10) {
            svg_w = 10;
            h_w = 5;
        }
        if (mode == "free") {
            var svg = `<svg width="${svg_w}" height="${svg_w}" xmlns="http://www.w3.org/2000/svg"><line x1="0" x2="${svg_w}" y1="${h_w}" y2="${h_w}" stroke="#000"/><line y1="0" y2="${svg_w}" x1="${h_w}" x2="${h_w}" stroke="#000"/><circle style="fill:${free_color};" cx="${h_w}" cy="${h_w}" r="${r}"/></svg>`;
        } else {
            var svg = `<svg width="${svg_w}" height="${svg_w}" xmlns="http://www.w3.org/2000/svg"><line x1="0" x2="${svg_w}" y1="${h_w}" y2="${h_w}" stroke="#000"/><line y1="0" y2="${svg_w}" x1="${h_w}" x2="${h_w}" stroke="#000"/><circle style="stroke-width:1;stroke:#000;fill:none" cx="${h_w}" cy="${h_w}" r="${r}"/></svg>`;
        }
        var d = document.createElement("div");
        d.innerHTML = svg;
        var s = new XMLSerializer().serializeToString(d.querySelector("svg"));
        var cursorUrl = `data:image/svg+xml;base64,` + window.btoa(s);
        fabric_canvas.freeDrawingCursor = `url(" ${cursorUrl} ") ${h_w} ${h_w}, auto`;
    } else {
        fabric_canvas.freeDrawingCursor = `auto`;
    }
}

// 几何
var shape = "";
document.getElementById("draw_shapes_i").onclick = (e) => {
    exit_shape();
    if (e.target.id != "draw_shapes_i") shape = e.target.id.replace("draw_shapes_", ""); // 根据元素id命名为shape赋值
    exit_free();
    exit_filter();
    fabric_canvas.defaultCursor = "crosshair";
    hotkeys.setScope("drawing_esc");
};
// 层叠位置
document.getElementById("draw_position_i").onclick = (e) => {
    switch (e.target.id) {
        case "draw_position_front":
            fabric_canvas.getActiveObject().bringToFront();
            break;
        case "draw_position_forwards":
            fabric_canvas.getActiveObject().bringForward();
            break;
        case "draw_position_backwards":
            fabric_canvas.getActiveObject().sendBackwards();
            break;
        case "draw_position_back":
            fabric_canvas.getActiveObject().sendToBack();
            break;
    }
};

// 删除快捷键
hotkeys("delete", fabric_delete);
function fabric_delete() {
    for (let o of fabric_canvas.getActiveObject()._objects || [fabric_canvas.getActiveObject()]) {
        fabric_canvas.remove(o);
    }
    get_f_object_v();
    get_filters();
    his_push();
}

var drawing_shape = false;
var shapes = [];
var draw_o_p = []; // 首次按下的点
var poly_o_p = []; // 多边形点
var new_filter_o = null;

fabric_canvas.on("mouse:down", (options) => {
    // 非常规状态下点击
    if (shape != "") {
        drawing_shape = true;
        fabric_canvas.selection = false;
        // 折线与多边形要多次点击，在poly_o_p存储点
        if (shape != "polyline" && shape != "polygon") {
            draw_o_p = [options.e.offsetX, options.e.offsetY];
            draw(shape, "start", draw_o_p[0], draw_o_p[1], options.e.offsetX, options.e.offsetY);
        } else {
            // 定义最后一个点,双击,点重复,结束
            var poly_o_p_l = poly_o_p[poly_o_p.length - 1];
            if (!(options.e.offsetX == poly_o_p_l?.x && options.e.offsetY == poly_o_p_l?.y)) {
                poly_o_p.push({ x: options.e.offsetX, y: options.e.offsetY });
                draw_poly(shape);
            } else {
                his_push();
                shape = "";
                poly_o_p = [];
                fabric_canvas.defaultCursor = "auto";
            }
        }
    }

    if (new_filter_selecting) {
        new_filter_o = fabric_canvas.getPointer(options.e);
    }
});
fabric_canvas.on("mouse:move", (options) => {
    if (drawing_shape) {
        if (shape != "polyline" && shape != "polygon") {
            draw(shape, "move", draw_o_p[0], draw_o_p[1], options.e.offsetX, options.e.offsetY);
        }
    }
});
fabric_canvas.on("mouse:up", (options) => {
    if (shape != "polyline" && shape != "polygon") {
        drawing_shape = false;
        fabric_canvas.selection = true;
        fabric_canvas.defaultCursor = "auto";
        if (shape != "") {
            fabric_canvas.setActiveObject(shapes[shapes.length - 1]);
            his_push();
        }
        shape = "";
        hotkeys.setScope("normal");
    }

    get_f_object_v();
    get_filters();

    if (new_filter_selecting) {
        new_filter_select(new_filter_o, fabric_canvas.getPointer(options.e));
        new_filter_selecting = false;
        document.querySelector("#draw_filters_select > lock-b").checked = false;
        fabric_canvas.defaultCursor = "auto";
        get_filters();
        his_push();
        hotkeys.setScope("normal");
    }

    if (fabric_canvas.isDrawingMode) {
        his_push();
    }
});

// 画一般图形
function draw(shape, v, x1, y1, x2, y2) {
    if (v == "move") {
        fabric_canvas.remove(shapes[shapes.length - 1]);
        shapes.splice(shapes.length - 1, 1);
    }
    var [x, y, w, h] = p_xy_to_c_xy(draw_canvas, x1, y1, x2, y2);
    switch (shape) {
        case "line":
            shapes[shapes.length] = new fabric.Line([x1, y1, x2, y2], {
                stroke: stroke_color,
            });
            break;
        case "circle":
            shapes[shapes.length] = new fabric.Circle({
                radius: Math.max(w, h) / 2,
                left: x,
                top: y,
                fill: fill_color,
                stroke: stroke_color,
                strokeWidth: stroke_width,
                canChangeFill: true,
            });
            break;
        case "rect":
            shapes[shapes.length] = new fabric.Rect({
                left: x,
                top: y,
                width: w,
                height: h,
                fill: fill_color,
                stroke: stroke_color,
                strokeWidth: stroke_width,
                canChangeFill: true,
            });
            break;
        case "text":
            shapes.push(
                new fabric.IText("点击输入文字", {
                    left: x,
                    top: y,
                    canChangeFill: true,
                })
            );
        default:
            break;
    }
    fabric_canvas.add(shapes[shapes.length - 1]);
}
// 多边形
function draw_poly(shape) {
    if (poly_o_p.length != 1) {
        fabric_canvas.remove(shapes[shapes.length - 1]);
        shapes.splice(shapes.length - 1, 1);
    }
    if (shape == "polyline") {
        shapes.push(
            new fabric.Polyline(poly_o_p, {
                fill: "#0000",
                stroke: stroke_color,
                strokeWidth: stroke_width,
            })
        );
    }
    if (shape == "polygon") {
        shapes.push(
            new fabric.Polygon(poly_o_p, {
                fill: fill_color,
                stroke: stroke_color,
                strokeWidth: stroke_width,
                canChangeFill: true,
            })
        );
    }
    fabric_canvas.add(shapes[shapes.length - 1]);
}

// 颜色选择
var color_m = "fill";
document.querySelector("#draw_color_fill").onfocus = () => {
    color_m = "fill";
};
document.querySelector("#draw_color_stroke").onfocus = () => {
    color_m = "stroke";
};
// 输入颜色
document.querySelector("#draw_color_fill").oninput = () => {
    change_color({ fill: document.querySelector("#draw_color_fill").innerText }, true, false);
    var fill_a = Color(document.querySelector("#draw_color_fill").innerText).valpha;
    document.querySelector("#draw_color_alpha > range-b:nth-child(1)").value = Math.round(fill_a * 100);
};
document.querySelector("#draw_color_stroke").oninput = () => {
    change_color({ stroke: document.querySelector("#draw_color_stroke").innerText }, true, false);
    var stroke_a = Color(document.querySelector("#draw_color_stroke").innerText).valpha;
    document.querySelector("#draw_color_alpha > range-b:nth-child(2)").value = Math.round(stroke_a * 100);
};

// 改变透明度
document.querySelector("#draw_color_alpha > range-b:nth-child(1)").oninput = () => {
    change_alpha(document.querySelector("#draw_color_alpha > range-b:nth-child(1)").value, "fill");
};
document.querySelector("#draw_color_alpha > range-b:nth-child(2)").oninput = () => {
    change_alpha(document.querySelector("#draw_color_alpha > range-b:nth-child(2)").value, "stroke");
};
function change_alpha(v, m) {
    var rgba = Color(document.querySelector(`#draw_color_${m}`).style.backgroundColor)
        .rgb()
        .array();
    rgba[3] = v / 100;
    change_color({ [m]: rgba }, true, true);
}

// 刷新控件颜色
/**
 * 改变颜色
 * @param {{fill?: String, stroke?: String}} m_l
 * @param {Boolean} set_o 是否改变选中形状样式
 * @param {Boolean} text 是否更改文字，仅在input时为true
 */
function change_color(m_l, set_o, text) {
    for (let i in m_l) {
        var color_m = i,
            color = m_l[i];
        if (color === null) color = "#0000";
        var color_l = Color(color).rgb().array();
        document.querySelector(`#draw_color_${color_m}`).style.backgroundColor = Color(color_l).string();
        if (color_m == "fill") {
            document.querySelector("#draw_color > div").style.backgroundColor = Color(color_l).string();
            if (set_o) set_f_object_v(Color(color_l).string(), null, null);
        }
        if (color_m == "stroke") {
            document.querySelector("#draw_color > div").style.borderColor = Color(color_l).string();
            if (set_o) set_f_object_v(null, Color(color_l).string(), null);
        }

        // 文字自适应
        var t_color = Color(document.querySelector(`#draw_color_${color_m}`).style.backgroundColor);
        var bg_color = Color(getComputedStyle(document.documentElement).getPropertyValue("--bar-bg").replace(" ", ""));
        if (t_color.rgb().array()[3] >= 0.5 || t_color.rgb().array()[3] === undefined) {
            if (t_color.isLight()) {
                document.querySelector(`#draw_color_${color_m}`).style.color = "#000";
            } else {
                document.querySelector(`#draw_color_${color_m}`).style.color = "#fff";
            }
        } else {
            // 低透明度背景呈现栏的颜色
            if (bg_color.isLight()) {
                document.querySelector(`#draw_color_${color_m}`).style.color = "#000";
            } else {
                document.querySelector(`#draw_color_${color_m}`).style.color = "#fff";
            }
        }

        if (text) {
            document.querySelector(`#draw_color_${color_m}`).innerText = Color(color).hexa();
        }
    }
}

// 色盘
function color_bar() {
    // 主盘
    var color_list = ["hsl(0, 0%, 100%)"];
    var base_color = Color("hsl(0, 100%, 50%)");
    for (let i = 0; i < 360; i += 15) {
        color_list.push(base_color.rotate(i).string());
    }
    show_color();
    // 下一层级
    function next_color(h) {
        var next_color_list = [];
        if (h == "hsl(0, 0%, 100%)") {
            for (let i = 255; i >= 0; i = Number((i - 10.625).toFixed(3))) {
                next_color_list.push(`rgb(${i}, ${i}, ${i})`);
            }
        } else {
            h = h.match(/hsl\(([0-9]*)/)[1] - 0;
            for (let i = 90; i > 0; i -= 20) {
                for (let j = 100; j > 0; j -= 20) {
                    next_color_list.push(`hsl(${h}, ${j}%, ${i}%)`);
                }
            }
        }
        var tt = "";
        for (let n in next_color_list) {
            tt += `<div class="color_i" style="background-color: ${next_color_list[n]}" title="${color_conversion(
                next_color_list[n],
                取色器默认格式
            )}"></div>`;
        }
        document.querySelector("#draw_color_color").innerHTML = tt;
        document.querySelectorAll("#draw_color_color > div").forEach((el, index) => {
            el.onmousedown = (event) => {
                if (event.button == 0) {
                    c_color(el);
                } else {
                    // 回到主盘
                    show_color();
                }
            };
        });
        next_color_list = tt = null;
    }
    function show_color() {
        var t = "";
        for (let x of color_list) {
            t += `<div class="color_i" style="background-color: ${x}" title="${color_conversion(
                x,
                取色器默认格式
            )}"></div>`;
        }
        document.querySelector("#draw_color_color").innerHTML = t;
        document.querySelectorAll("#draw_color_color > div").forEach((el, index) => {
            el.onmousedown = (event) => {
                if (event.button == 0) {
                    c_color(el);
                } else {
                    // 下一层级
                    next_color(color_list[index]);
                }
            };
        });
        t = null;
    }
    // 事件
    function c_color(el) {
        change_color({ [color_m]: el.style.backgroundColor }, true, true);
        if (color_m == "fill") document.querySelector("#draw_color_alpha > range-b:nth-child(1)").value = 100;
        if (color_m == "stroke") document.querySelector("#draw_color_alpha > range-b:nth-child(2)").value = 100;
    }
}
color_bar();

document.querySelector("#draw_stroke_width > range-b").oninput = () => {
    set_f_object_v(null, null, document.querySelector("#draw_stroke_width > range-b").value - 0);
};

/** 鼠标点击后，改变栏文字样式 */
function get_f_object_v() {
    if (fabric_canvas.getActiveObject()) {
        var n = fabric_canvas.getActiveObject();
        if (n._objects) {
            // 当线与形一起选中，确保形不会透明
            for (let i of n._objects) {
                if (i.canChangeFill) n = i;
            }
        }
        if (n.filters) n = { fill: fill_color, stroke: stroke_color, strokeWidth: stroke_width };
    } else if (fabric_canvas.isDrawingMode) {
        n = { fill: "#0000", stroke: free_color, strokeWidth: free_width };
    } else {
        n = { fill: fill_color, stroke: stroke_color, strokeWidth: stroke_width };
    }
    console.log(n);
    var [fill, stroke, strokeWidth] = [n.fill, n.stroke, n.strokeWidth];
    document.querySelector("#draw_stroke_width > range-b").value = strokeWidth;
    change_color({ fill: fill, stroke: stroke }, false, true);
    var fill_a = Color(document.querySelector("#draw_color_fill").innerText).valpha;
    document.querySelector("#draw_color_alpha > range-b:nth-child(1)").value = Math.round(fill_a * 100);
    var stroke_a = Color(document.querySelector("#draw_color_stroke").innerText).valpha;
    document.querySelector("#draw_color_alpha > range-b:nth-child(2)").value = Math.round(stroke_a * 100);
}
/**
 * 更改全局或选中形状的颜色
 * @param {String} fill 填充颜色
 * @param {String} stroke 边框颜色
 * @param {Number} strokeWidth 边框宽度
 */
function set_f_object_v(fill, stroke, strokeWidth) {
    if (fabric_canvas.getActiveObject()) {
        console.log(0);
        /* 选中Object */
        var n = fabric_canvas.getActiveObject(); /* 选中多个时，n下有_Object<形状>数组，1个时，n就是形状 */
        n = n._objects || [n];
        for (let i in n) {
            if (fill) {
                // 只改变形的颜色
                if (n[i].canChangeFill) n[i].set("fill", fill);
            }
            if (stroke) n[i].set("stroke", stroke);
            if (strokeWidth) n[i].set("strokeWidth", strokeWidth);
        }
        fabric_canvas.renderAll();
    } else if (fabric_canvas.isDrawingMode) {
        console.log(1);
        /* 画笔 */
        if (stroke) fabric_canvas.freeDrawingBrush.color = free_color = stroke;
        if (strokeWidth) fabric_canvas.freeDrawingBrush.width = free_width = strokeWidth;
        free_draw_cursor();
        free_shadow();
    } else {
        console.log(2);
        /* 非画笔非选中 */
        if (fill) fill_color = fill;
        if (stroke) stroke_color = free_color = stroke;
        if (strokeWidth) stroke_width = strokeWidth;
    }
}

// 滤镜
fabric_canvas.filterBackend = fabric.initFilterBackend();
var webglBackend;
try {
    webglBackend = new fabric.WebglFilterBackend();
    fabric_canvas.filterBackend = webglBackend;
} catch (e) {
    console.log(e);
}

var new_filter_selecting = false;
function new_filter_select(o, no) {
    var x1 = o.x.toFixed(),
        y1 = o.y.toFixed(),
        x2 = no.x.toFixed(),
        y2 = no.y.toFixed();
    var x = Math.min(x1, x2),
        y = Math.min(y1, y2),
        w = Math.abs(x1 - x2),
        h = Math.abs(y1 - y2);

    var main_ctx = main_canvas.getContext("2d");
    var tmp_canvas = document.createElement("canvas");
    tmp_canvas.width = w;
    tmp_canvas.height = h;
    var gid = main_ctx.getImageData(x, y, w, h); // 裁剪
    tmp_canvas.getContext("2d").putImageData(gid, 0, 0);
    var img = new fabric.Image(tmp_canvas, {
        left: x,
        top: y,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hasControls: false,
        hoverCursor: "auto",
    });
    fabric_canvas.add(img);
    fabric_canvas.setActiveObject(img);
}

document.querySelector("#draw_filters_select > lock-b").oninput = () => {
    exit_free();
    exit_shape();
    new_filter_selecting = true;
    fabric_canvas.defaultCursor = "crosshair";
    hotkeys.setScope("drawing_esc");
};

function apply_filter(i, filter) {
    var obj = fabric_canvas.getActiveObject();
    obj.filters[i] = filter;
    obj.applyFilters();
    fabric_canvas.renderAll();
}
function get_filters() {
    if (fabric_canvas.getActiveObject()?.filters !== undefined) {
        s_h_filters_div(false);
    } else {
        s_h_filters_div(true);
        return;
    }
    var f = fabric_canvas.getActiveObject().filters;
    console.log(f);
    document.querySelector("#draw_filters_pixelate > range-b").value = f[0]?.blocksize || 0;
    document.querySelector("#draw_filters_blur > range-b").value = f[1]?.blur * 100 || 0;
    document.querySelector("#draw_filters_brightness > range-b").value = f[2]?.brightness || 0;
    document.querySelector("#draw_filters_contrast > range-b").value = f[3]?.contrast || 0;
    document.querySelector("#draw_filters_saturation > range-b").value = f[4]?.saturation || 0;
    document.querySelector("#draw_filters_hue > range-b").value = f[5]?.rotation || 0;
    document.querySelector("#draw_filters_gamma > range-b:nth-child(1)").value = f[6]?.gamma[0] || 1;
    document.querySelector("#draw_filters_gamma > range-b:nth-child(2)").value = f[6]?.gamma[1] || 1;
    document.querySelector("#draw_filters_gamma > range-b:nth-child(3)").value = f[6]?.gamma[2] || 1;
    document.querySelector("#draw_filters_noise > range-b").value = f[7]?.noise || 0;
    var gray = f[8]?.mode;
    switch (gray) {
        case "average":
            document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)").checked = true;
            break;
        case "lightness":
            document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)").checked = true;
            break;
        case "luminosity":
            document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)").checked = true;
        default:
            document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)").checked = false;
            document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)").checked = false;
            document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)").checked = false;
    }
    document.querySelector("#draw_filters_invert > lock-b").checked = f[9] ? true : false;
    document.querySelector("#draw_filters_sepia > lock-b").checked = f[10] ? true : false;
    document.querySelector("#draw_filters_bw > lock-b").checked = f[11] ? true : false;
    document.querySelector("#draw_filters_brownie > lock-b").checked = f[12] ? true : false;
    document.querySelector("#draw_filters_vintage > lock-b").checked = f[13] ? true : false;
    document.querySelector("#draw_filters_koda > lock-b").checked = f[14] ? true : false;
    document.querySelector("#draw_filters_techni > lock-b").checked = f[15] ? true : false;
    document.querySelector("#draw_filters_polaroid > lock-b").checked = f[16] ? true : false;
}
function s_h_filters_div(v) {
    var l = document.querySelectorAll("#draw_filters_i > div");
    if (v) {
        for (let i = 1; i < l.length; i++) {
            l[i].style.pointerEvents = "none";
            l[i].style.opacity = 0.2;
        }
    } else {
        for (let i = 1; i < l.length; i++) {
            l[i].style.pointerEvents = "auto";
            l[i].style.opacity = 1;
        }
    }
}
s_h_filters_div(true);

// 马赛克
// 在fabric源码第二个uBlocksize * uStepW改为uBlocksize * uStepH
document.querySelector("#draw_filters_pixelate > range-b").oninput = () => {
    var value = document.querySelector("#draw_filters_pixelate > range-b").value;
    if (value != 0) {
        var filter = new fabric.Image.filters.Pixelate({
            blocksize: value,
        });
        apply_filter(0, filter);
    } else {
        apply_filter(0, null);
    }
};
// 模糊
document.querySelector("#draw_filters_blur > range-b").oninput = () => {
    var value = document.querySelector("#draw_filters_blur > range-b").value / 100;
    if (value != 0) {
        var filter = new fabric.Image.filters.Blur({
            blur: value,
        });
        apply_filter(1, filter);
    } else {
        apply_filter(1, null);
    }
};
// 亮度
document.querySelector("#draw_filters_brightness > range-b").oninput = () => {
    var value = document.querySelector("#draw_filters_brightness > range-b").value;
    var filter = new fabric.Image.filters.Brightness({
        brightness: value,
    });
    apply_filter(2, filter);
};
// 对比度
document.querySelector("#draw_filters_contrast > range-b").oninput = () => {
    var value = document.querySelector("#draw_filters_contrast > range-b").value;
    var filter = new fabric.Image.filters.Contrast({
        contrast: value,
    });
    apply_filter(3, filter);
};
// 饱和度
document.querySelector("#draw_filters_saturation > range-b").oninput = () => {
    var value = document.querySelector("#draw_filters_saturation > range-b").value;
    var filter = new fabric.Image.filters.Saturation({
        saturation: value,
    });
    apply_filter(4, filter);
};
// 色调
document.querySelector("#draw_filters_hue > range-b").oninput = () => {
    var value = document.querySelector("#draw_filters_hue > range-b").value;
    var filter = new fabric.Image.filters.HueRotation({
        rotation: value,
    });
    apply_filter(5, filter);
};
// 伽马
document.querySelector("#draw_filters_gamma > range-b:nth-child(1)").oninput =
    document.querySelector("#draw_filters_gamma > range-b:nth-child(2)").oninput =
    document.querySelector("#draw_filters_gamma > range-b:nth-child(3)").oninput =
        () => {
            var r = document.querySelector("#draw_filters_gamma > range-b:nth-child(1)").value;
            var g = document.querySelector("#draw_filters_gamma > range-b:nth-child(2)").value;
            var b = document.querySelector("#draw_filters_gamma > range-b:nth-child(3)").value;
            var filter = new fabric.Image.filters.Gamma({
                gamma: [r, g, b],
            });
            apply_filter(6, filter);
        };
// 噪音
document.querySelector("#draw_filters_noise > range-b").oninput = () => {
    var value = document.querySelector("#draw_filters_noise > range-b").value;
    var filter = new fabric.Image.filters.Noise({
        noise: value,
    });
    apply_filter(7, filter);
};
// 灰度
document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)").oninput = () => {
    document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)").checked = false;
    document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)").checked = false;
    if (document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)").checked)
        var filter = new fabric.Image.filters.Grayscale({ mode: "average" });
    apply_filter(8, filter);
};
document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)").oninput = () => {
    document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)").checked = false;
    document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)").checked = false;
    if (document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)").checked)
        var filter = new fabric.Image.filters.Grayscale({ mode: "lightness" });
    apply_filter(8, filter);
};
document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)").oninput = () => {
    document.querySelector("#draw_filters_grayscale > lock-b:nth-child(1)").checked = false;
    document.querySelector("#draw_filters_grayscale > lock-b:nth-child(2)").checked = false;
    if (document.querySelector("#draw_filters_grayscale > lock-b:nth-child(3)").checked)
        var filter = new fabric.Image.filters.Grayscale({ mode: "luminosity" });
    apply_filter(8, filter);
};
// 负片
document.querySelector("#draw_filters_invert > lock-b").oninput = () => {
    var value = document.querySelector("#draw_filters_invert > lock-b").checked;
    var filter = value ? new fabric.Image.filters.Invert() : null;
    apply_filter(9, filter);
};
// 棕褐色
document.querySelector("#draw_filters_sepia > lock-b").oninput = () => {
    var value = document.querySelector("#draw_filters_sepia > lock-b").checked;
    var filter = value ? new fabric.Image.filters.Sepia() : null;
    apply_filter(10, filter);
};
// 黑白
document.querySelector("#draw_filters_bw > lock-b").oninput = () => {
    var value = document.querySelector("#draw_filters_bw > lock-b").checked;
    var filter = value ? new fabric.Image.filters.BlackWhite() : null;
    apply_filter(11, filter);
};
// 布朗尼
document.querySelector("#draw_filters_brownie > lock-b").oninput = () => {
    var value = document.querySelector("#draw_filters_brownie > lock-b").checked;
    var filter = value ? new fabric.Image.filters.Brownie() : null;
    apply_filter(12, filter);
};
// 老式
document.querySelector("#draw_filters_vintage > lock-b").oninput = () => {
    var value = document.querySelector("#draw_filters_vintage > lock-b").checked;
    var filter = value ? new fabric.Image.filters.Vintage() : null;
    apply_filter(13, filter);
};
// 柯达彩色胶片
document.querySelector("#draw_filters_koda > lock-b").oninput = () => {
    var value = document.querySelector("#draw_filters_koda > lock-b").checked;
    var filter = value ? new fabric.Image.filters.Kodachrome() : null;
    apply_filter(14, filter);
};
// 特艺色彩
document.querySelector("#draw_filters_techni > lock-b").oninput = () => {
    var value = document.querySelector("#draw_filters_techni > lock-b").checked;
    var filter = value ? new fabric.Image.filters.Technicolor() : null;
    apply_filter(15, filter);
};
// 宝丽来
document.querySelector("#draw_filters_polaroid > lock-b").oninput = () => {
    var value = document.querySelector("#draw_filters_polaroid > lock-b").checked;
    var filter = value ? new fabric.Image.filters.Polaroid() : null;
    apply_filter(16, filter);
};

// 确保退出其他需要鼠标事件的东西，以免多个东西一起出现
function exit_free() {
    fabric_canvas.isDrawingMode = false;
    document.querySelectorAll("#draw_free_i > lock-b")[0].checked = false;
    document.querySelectorAll("#draw_free_i > lock-b")[1].checked = false;
    document.querySelectorAll("#draw_free_i > lock-b")[2].checked = false;
    fabric_canvas.defaultCursor = "auto";
}
function exit_shape() {
    shape = "";
    drawing_shape = false;
    fabric_canvas.selection = true;
    fabric_canvas.defaultCursor = "auto";
    poly_o_p = [];
}
function exit_filter() {
    new_filter_selecting = false;
    document.querySelector("#draw_filters_select > lock-b").checked = false;
    fabric_canvas.defaultCursor = "auto";
}
hotkeys("esc", "drawing_esc", () => {
    exit_free();
    exit_shape();
    exit_filter();
    hotkeys.setScope("normal");
});

// fabric命令行
document.getElementById("draw_edit_b").onclick = () => {
    s_center_bar("edit");
    if (center_bar_show) {
        document.querySelector("#draw_edit input").focus();
        hotkeys("enter", "c_bar", fabric_api);
        hotkeys("esc", "c_bar", () => {
            s_center_bar("edit");
        });
    }
};
document.querySelector("#draw_edit_run").onclick = () => {
    fabric_api();
};
function fabric_api() {
    var e = document.querySelector("#draw_edit input").value;
    var $0 = fabric_canvas.getActiveObject();
    if (!e.includes("$0")) {
        e = `fabric_canvas.getActiveObject().set({${e}})`;
    }
    var div = document.createElement("div");
    div.innerText = eval(e);
    document.getElementById("draw_edit_output").appendChild(div);
    document.getElementById("draw_edit_output").style.margin = "4px";
    fabric_canvas.renderAll();
}
document.getElementById("draw_edit_clear").onclick = () => {
    document.getElementById("draw_edit_output").innerHTML = "";
    document.getElementById("draw_edit_output").style.margin = "";
};

var fabric_clipboard;
function fabric_copy() {
    var dx = store.get("图像编辑.复制偏移.x"),
        dy = store.get("图像编辑.复制偏移.y");
    fabric_canvas.getActiveObject().clone(function (cloned) {
        fabric_clipboard = cloned;
    });
    fabric_clipboard.clone(function (clonedObj) {
        fabric_canvas.discardActiveObject();
        clonedObj.set({
            left: clonedObj.left + dx,
            top: clonedObj.top + dy,
            evented: true,
        });
        if (clonedObj.type === "activeSelection") {
            clonedObj.fabric_canvas = fabric_canvas;
            clonedObj.forEachObject(function (obj) {
                fabric_canvas.add(obj);
            });
            clonedObj.setCoords();
        } else {
            fabric_canvas.add(clonedObj);
        }
        fabric_canvas.setActiveObject(clonedObj);
        fabric_canvas.requestRenderAll();
    });
    his_push();
}
hotkeys("Ctrl+v", "normal", fabric_copy);

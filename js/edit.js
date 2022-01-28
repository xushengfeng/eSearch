let fabric_canvas = new fabric.Canvas("draw_photo");

stroke_color = "#333";
fill_color = "#fff";
stroke_width = 1;

// 画画栏
document.querySelectorAll("#draw_main > div").forEach((e, index) => {
    if (index == document.querySelectorAll("#draw_main > div").length - 1) return; // 排除move
    document.querySelectorAll("#draw_side > div")[index].style.height = "0";
    e.addEventListener("click", () => {
        if (e.show) {
            e.show = !e.show;
            document.querySelectorAll("#draw_side > div")[index].style.height = "0";
            document.querySelector("#draw_bar").style.width = "60px";
        } else {
            document.querySelector("#draw_bar").style.width = "120px";
            document.querySelectorAll("#draw_main > div").forEach((ei) => {
                ei.show = false;
            });
            e.show = !e.show;
            document.querySelectorAll("#draw_side > div").forEach((ei) => {
                ei.style.height = "0";
            });
            h = 0;
            Array.from(document.querySelectorAll("#draw_side > div")[index].children).forEach((e) => {
                h += e.offsetHeight;
            });
            if (h > 360) {
                h = 360;
            }
            document.querySelectorAll("#draw_side > div")[index].style.height = h + "px";
        }
    });
});

// 笔
document.querySelector("#draw_free_pencil").onclick = () => {
    if (!document.querySelector("#draw_free_pencil").clicked) {
        document
            .querySelector("#draw_free_pencil")
            .parentNode.querySelectorAll("div")
            .forEach((ei) => {
                ei.clicked = false;
                ei.style.backgroundColor = "";
            });
        document.querySelector("#draw_free_pencil").clicked = !document.querySelector("#draw_free_pencil").clicked;
        document.querySelector("#draw_free_pencil").style.backgroundColor = getComputedStyle(
            document.documentElement
        ).getPropertyValue("--hover-color");

        fabric_canvas.isDrawingMode = true;
        fabric_canvas.freeDrawingBrush = new fabric.PencilBrush(fabric_canvas);
        fabric_canvas.freeDrawingBrush.color = stroke_color;
        fabric_canvas.freeDrawingBrush.width = stroke_width;
    } else {
        document.querySelector("#draw_free_pencil").clicked = !document.querySelector("#draw_free_pencil").clicked;
        document.querySelector("#draw_free_pencil").style.backgroundColor = "";

        fabric_canvas.isDrawingMode = false;
    }
};
// 橡皮
document.querySelector("#draw_free_eraser").onclick = () => {
    if (!document.querySelector("#draw_free_eraser").clicked) {
        document
            .querySelector("#draw_free_eraser")
            .parentNode.querySelectorAll("div")
            .forEach((ei) => {
                ei.clicked = false;
                ei.style.backgroundColor = "";
            });
        document.querySelector("#draw_free_eraser").clicked = !document.querySelector("#draw_free_eraser").clicked;
        document.querySelector("#draw_free_eraser").style.backgroundColor = getComputedStyle(
            document.documentElement
        ).getPropertyValue("--hover-color");

        fabric_canvas.isDrawingMode = true;
        fabric_canvas.freeDrawingBrush = new fabric.EraserBrush(fabric_canvas);
    } else {
        document.querySelector("#draw_free_eraser").clicked = !document.querySelector("#draw_free_eraser").clicked;
        document.querySelector("#draw_free_eraser").style.backgroundColor = "";

        fabric_canvas.isDrawingMode = false;
    }
};
// 刷
document.querySelector("#draw_free_spray").onclick = () => {
    if (!document.querySelector("#draw_free_spray").clicked) {
        document
            .querySelector("#draw_free_spray")
            .parentNode.querySelectorAll("div")
            .forEach((ei) => {
                ei.clicked = false;
                ei.style.backgroundColor = "";
            });
        document.querySelector("#draw_free_spray").clicked = !document.querySelector("#draw_free_spray").clicked;
        document.querySelector("#draw_free_spray").style.backgroundColor = getComputedStyle(
            document.documentElement
        ).getPropertyValue("--hover-color");

        fabric_canvas.isDrawingMode = true;
        fabric_canvas.freeDrawingBrush = new fabric.SprayBrush(fabric_canvas);
        fabric_canvas.freeDrawingBrush.color = stroke_color;
        fabric_canvas.freeDrawingBrush.width = stroke_width;
    } else {
        document.querySelector("#draw_free_spray").clicked = !document.querySelector("#draw_free_spray").clicked;
        document.querySelector("#draw_free_spray").style.backgroundColor = "";

        fabric_canvas.isDrawingMode = false;
    }
};

// 几何
var shape = "";
document.getElementById("draw_shapes_i").onclick = (e) => {
    switch (e.target.id) {
        case "draw_shapes_line":
            shape = "line";
            break;
        case "draw_shapes_circle":
            shape = "circle";
            break;
        case "draw_shapes_rect":
            shape = "rect";
            break;
        case "draw_shapes_polyline":
            shape = "polyline";
            break;
        case "draw_shapes_polygon":
            shape = "polygon";
            break;
        case "draw_shapes_text":
            shape = "text";
            break;
    }
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
document.onkeydown = (e) => {
    if (e.key == "Delete") {
        fabric_canvas.remove(fabric_canvas.getActiveObject());
    }
};

var drawing_shape = false;
var shapes = [];
var draw_o_p = []; // 首次按下的点
var poly_o_p = []; // 多边形点

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
                shape = "";
                poly_o_p = [];
            }
        }
    }
});
fabric_canvas.on("mouse:move", (options) => {
    if (drawing_shape) {
        if (shape != "polyline" && shape != "polygon") {
            draw(shape, "move", draw_o_p[0], draw_o_p[1], options.e.offsetX, options.e.offsetY);
        }
    }
});
fabric_canvas.on("mouse:up", () => {
    if (shape != "polyline" && shape != "polygon") {
        drawing_shape = false;
        fabric_canvas.selection = true;
        shape = "";
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
            shapes[shapes.length] = new fabric.Line([x, y, x + w, y + h], {
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
            });
            break;
        case "text":
            shapes.push(
                new fabric.IText("点击输入文字", {
                    left: x,
                    top: y,
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
            })
        );
    }
    fabric_canvas.add(shapes[shapes.length - 1]);
}

// 颜色选择
var fill_a = 1;
var stroke_a = 1;
var color_m = "fill";
document.querySelector("#draw_color_fill").onfocus = () => {
    color_m = "fill";
    document.querySelector("#draw_color_alpha > range-b").value = fill_a * 100;
};
document.querySelector("#draw_color_stroke").onfocus = () => {
    color_m = "stroke";
    document.querySelector("#draw_color_alpha > range-b").value = stroke_a * 100;
};
document.querySelector("#draw_color_fill").oninput = () => {
    change_color(document.querySelector("#draw_color_fill").innerText, false);
    fill_a = Color(document.querySelector("#draw_color > div").style.backgroundColor).valpha;
    document.querySelector("#draw_color_alpha > range-b").value = fill_a * 100;
};
document.querySelector("#draw_color_stroke").oninput = () => {
    change_color(document.querySelector("#draw_color_stroke").innerText, false);
    stroke_a = Color(document.querySelector("#draw_color > div").style.borderColor).valpha;
    document.querySelector("#draw_color_alpha > range-b").value = stroke_a * 100;
};

document.querySelector("#draw_color_alpha > range-b").oninput = () => {
    change_alpha(document.querySelector("#draw_color_alpha > range-b").value);
};

function change_alpha(v) {
    var a = v / 100;
    if (color_m == "fill") {
        fill_a = a;
    } else {
        stroke_a = a;
    }

    var rgba = Color(document.querySelector(`#draw_color_${color_m}`).style.backgroundColor)
        .rgb()
        .array();
    rgba[3] = a;

    change_color(rgba, true);
}

function change_color(color, text) {
    color_l = Color(color).rgb().array();
    if (color_m == "fill") {
        if (text) color_l[3] = fill_a;
        document.querySelector("#draw_color_fill").style.backgroundColor =
            document.querySelector("#draw_color > div").style.backgroundColor =
            fill_color =
                Color(color_l).string();
    } else {
        if (text) color_l[3] = stroke_a;
        document.querySelector("#draw_color_stroke").style.backgroundColor =
            document.querySelector("#draw_color > div").style.borderColor =
            stroke_color =
                Color(color_l).string();
        fabric_canvas.freeDrawingBrush.color = stroke_color;
    }
    var t_color = Color(document.querySelector(`#draw_color_${color_m}`).style.backgroundColor);
    if (t_color.isLight()) {
        document.querySelector(`#draw_color_${color_m}`).style.color = "#000";
    } else {
        document.querySelector(`#draw_color_${color_m}`).style.color = "#fff";
    }

    if (text) {
        document.querySelector(`#draw_color_${color_m}`).innerText = Color(color).hex();
    }
}

// 色盘
function color_bar() {
    color_list = [];
    var b_color = Color("hsl(0,0%,100%)");
    for (k = 0; k <= 1; k += 0.25) {
        color_list[color_list.length] = b_color.darken(k).string();
    }
    var w_color = Color("hsl(0,100%,100%)");
    for (i = 0; i < 360; i += 24) {
        for (j = 0.1; j < 1; j += 0.1) {
            color_list[color_list.length] = w_color.rotate(i).darken(j).string();
        }
    }
    var t = "";
    for (x in color_list) {
        t += `<div class="color_i" style="background-color: ${color_list[x]}"></div>`;
    }
    document.querySelector("#draw_color_color").innerHTML = t;
    document.querySelectorAll("#draw_color_color > div").forEach((e, index) => {
        e.addEventListener("click", () => {
            change_color(e.style.backgroundColor, true);
        });
    });
}
color_bar();

document.querySelector("#draw_stroke_width > range-b").oninput = () => {
    if (typeof fabric_canvas.getActiveObject() != "undefined") {
        fabric_canvas.getActiveObject().strokeWidth = document.querySelector("#draw_stroke_width > range-b").value - 0;
        fabric_canvas.renderAll();
    } else {
        stroke_width = document.querySelector("#draw_stroke_width > range-b").value - 0;
        fabric_canvas.freeDrawingBrush.width = stroke_width;
    }
};


// fabric命令行
document.getElementById("draw_edit_b").onclick = () => {
    o = !o;
    if (o) {
        document.querySelector("#draw_edit input").focus();
        document.querySelector("#windows_bar").style.transform = "translateX(0)";
    } else {
        document.querySelector("#windows_bar").style.transform = "translateX(-100%)";
    }
};
document.querySelector("#draw_edit_run").onclick = () => {
    fabric_api();
};
document.querySelector("#draw_edit input").onkeydown = (e) => {
    if (e.key == "Enter") {
        fabric_api();
    }
};
function fabric_api() {
    var e = document.querySelector("#draw_edit input").value;
    if (e.includes("$0")) {
        e = e.replace("$0", "fabric_canvas.getActiveObject()");
    } else {
        e = `fabric_canvas.getActiveObject().set({${e}})`;
    }
    eval(e);
    fabric_canvas.renderAll();
}

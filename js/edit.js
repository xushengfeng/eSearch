let fabric_canvas = new fabric.Canvas("draw_photo");

stroke_color = "#fff";
fill_color = "#fff";

// 画画栏
document.querySelectorAll("#draw_main > div").forEach((e, index) => {
    if (index == document.querySelectorAll("#draw_main > div").length - 1) return;
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
            if (h > 420) {
                h = 420;
            }
            document.querySelectorAll("#draw_side > div")[index].style.height = h + "px";
        }
    });
});

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
    } else {
        document.querySelector("#draw_free_pencil").clicked = !document.querySelector("#draw_free_pencil").clicked;
        document.querySelector("#draw_free_pencil").style.backgroundColor = "";

        fabric_canvas.isDrawingMode = false;
    }
};
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
    } else {
        document.querySelector("#draw_free_spray").clicked = !document.querySelector("#draw_free_spray").clicked;
        document.querySelector("#draw_free_spray").style.backgroundColor = "";

        fabric_canvas.isDrawingMode = false;
    }
};

shape = "";
document.querySelector("#draw_shapes_line").onclick = () => {
    shape = "line";
};
document.querySelector("#draw_shapes_circle").onclick = () => {
    shape = "circle";
};
document.querySelector("#draw_shapes_rect").onclick = () => {
    shape = "rect";
};
document.querySelector("#draw_shapes_triangle").onclick = () => {
    shape = "triangle";
};
document.querySelector("#draw_position_front").onclick = () => {
    fabric_canvas.getActiveObject().bringToFront();
};
document.querySelector("#draw_position_forwards").onclick = () => {
    fabric_canvas.getActiveObject().bringForward();
};
document.querySelector("#draw_position_backwards").onclick = () => {
    fabric_canvas.getActiveObject().sendBackwards();
};
document.querySelector("#draw_position_back").onclick = () => {
    fabric_canvas.getActiveObject().sendToBack();
};

document.onkeydown = (e) => {
    if (e.key == "Delete") {
        fabric_canvas.remove(fabric_canvas.getActiveObject());
    }
};

drawing = false;
shapes = [];
draw_o_p = [];

fabric_canvas.on("mouse:down", (options) => {
    if (shape != "") {
        drawing = true;
        draw_o_p = [options.e.offsetX, options.e.offsetY];
        draw(shape, "start", draw_o_p[0], draw_o_p[1], options.e.offsetX, options.e.offsetY);
        // fabric_canvas.selection = false;
    }
});
fabric_canvas.on("mouse:move", (options) => {
    if (drawing) {
        console.log(options.e.offsetX, options.e.offsetY);
        draw(shape, "move", draw_o_p[0], draw_o_p[1], options.e.offsetX, options.e.offsetY);
    }
});
fabric_canvas.on("mouse:up", () => {
    drawing = false;
    // fabric_canvas.selection = true;
    shape = "";
});

function draw(shape, v, x1, y1, x2, y2) {
    var [x, y, w, h] = p_xy_to_c_xy(draw_canvas, x1, y1, x2, y2);
    if (v == "start") {
        switch (shape) {
            case "line":
                shapes[shapes.length] = new fabric.Line({
                    left: x,
                    top: y,
                    width: 1,
                    height: 1,
                    stroke: fill_color,
                });
                break;
            case "circle":
                shapes[shapes.length] = new fabric.Circle({
                    radius: 1,
                    left: x,
                    top: y,
                    fill: fill_color,
                });
                break;
            case "rect":
                shapes[shapes.length] = new fabric.Rect({
                    left: x,
                    top: y,
                    width: 1,
                    height: 1,
                    fill: fill_color,
                });
                break;
            case "triangle":
                shapes[shapes.length] = new fabric.Triangle({
                    left: x,
                    top: y,
                    width: 1,
                    height: 1,
                    fill: fill_color,
                });
                break;
            default:
                break;
        }
        fabric_canvas.add(shapes[shapes.length - 1]);
    } else {
        if (shape == "circle") {
            shapes[shapes.length - 1].set({
                radius: Math.min(w, h) / 2,
                left: x,
                top: y,
            });
        } else {
            shapes[shapes.length - 1].set({
                left: x,
                top: y,
                width: w,
                height: h,
            });
        }
    }
}

// 颜色选择
color_m = "fill";
document.querySelector("#draw_color_fill").onfocus = () => {
    color_m = "fill";
    var a = Color(document.querySelector("#draw_color > div").style.backgroundColor).valpha;
    document.querySelector("#draw_color_alpha_i").style.width = document.querySelector(
        "#draw_color_alpha_text"
    ).innerText = a * 100 + "%";
};
document.querySelector("#draw_color_stroke").onfocus = () => {
    color_m = "stroke";
    var a = Color(document.querySelector("#draw_color > div").style.borderColor).valpha;
    document.querySelector("#draw_color_alpha_i").style.width = document.querySelector(
        "#draw_color_alpha_text"
    ).innerText = a * 100 + "%";
};
document.querySelector("#draw_color_fill").oninput = () => {
    change_color(document.querySelector("#draw_color_fill").innerText, false);
    var a = Color(document.querySelector("#draw_color > div").style.backgroundColor).valpha;
    document.querySelector("#draw_color_alpha_i").style.width = document.querySelector(
        "#draw_color_alpha_text"
    ).innerText = a * 100 + "%";
};
document.querySelector("#draw_color_stroke").oninput = () => {
    change_color(document.querySelector("#draw_color_stroke").innerText, false);
    var a = Color(document.querySelector("#draw_color > div").style.borderColor).valpha;
    document.querySelector("#draw_color_alpha_i").style.width = document.querySelector(
        "#draw_color_alpha_text"
    ).innerText = a * 100 + "%";
};

[document.querySelector("#draw_color_alpha")].forEach((e, index) => {
    e.querySelector("div").style.width = "100%";
    e.addEventListener("mousedown", (event) => {
        e.querySelector("div").change = true;
        change_alpha(e, event);
    });
    e.addEventListener("mousemove", (event) => {
        if (e.querySelector("div").change) {
            change_alpha(e, event);
        }
    });
    e.addEventListener("mouseup", (event) => {
        e.querySelector("div").change = false;
    });
    e.addEventListener("mouseleave", (event) => {
        e.querySelector("div").change = false;
    });
});

function change_alpha(e, event) {
    e.querySelector("#draw_color_alpha_i").style.width = e.querySelector("#draw_color_alpha_text").innerText =
        ((event.offsetX / e.offsetWidth) * 100).toFixed(0) + "%";

    rgb = Color(document.querySelector(`#draw_color_${color_m}`).style.backgroundColor).hex();
    var alpha = Math.round(
        ((document.querySelector("#draw_color_alpha_i").style.width.replace("%", "") - 0) / 100) * 255
    )
        .toString(16)
        .padStart(2, 0)
        .toUpperCase();

    change_color(rgb + alpha, true);
}

function change_color(color, text) {
    if (color_m == "fill") {
        document.querySelector("#draw_color_fill").style.backgroundColor =
            document.querySelector("#draw_color > div").style.backgroundColor =
            fill_color =
                color;
    } else {
        document.querySelector("#draw_color_stroke").style.backgroundColor =
            document.querySelector("#draw_color > div").style.borderColor =
            stroke_color =
                color;
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

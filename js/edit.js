let fabric_canvas = new fabric.Canvas("draw_photo");

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
        console.log(options.e.offsetX, options.e.offsetY)
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
                    stroke: "green",
                });
                break;
            case "circle":
                shapes[shapes.length] = new fabric.Circle({
                    radius: 1,
                    left: x,
                    top: y,
                    fill: "green",
                });
                break;
            case "rect":
                shapes[shapes.length] = new fabric.Rect({
                    left: x,
                    top: y,
                    width: 1,
                    height: 1,
                    fill: "green",
                });
                break;
            case "triangle":
                shapes[shapes.length] = new fabric.Triangle({
                    left: x,
                    top: y,
                    width: 1,
                    height: 1,
                    fill: "green",
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

let canvas = new fabric.Canvas("draw_photo");

// 创建一个矩形对象

// 将矩形添加到canvas画布上
canvas.add(
    new fabric.Rect({
        left: 10, //距离左边的距离
        top: 10, //距离上边的距离
        fill: "green", //填充的颜色
        width: 20, //矩形宽度
        height: 20, //矩形高度
    })
);

// 画画栏
document.querySelectorAll("#draw_main > div").forEach((e, index) => {
    if (index == document.querySelectorAll("#draw_main > div").length-1) return;
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

        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    } else {
        document.querySelector("#draw_free_pencil").clicked = !document.querySelector("#draw_free_pencil").clicked;
        document.querySelector("#draw_free_pencil").style.backgroundColor = "";

        canvas.isDrawingMode = false;
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

        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.EraserBrush(canvas);
    } else {
        document.querySelector("#draw_free_eraser").clicked = !document.querySelector("#draw_free_eraser").clicked;
        document.querySelector("#draw_free_eraser").style.backgroundColor = "";

        canvas.isDrawingMode = false;
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

        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.SprayBrush(canvas);
    } else {
        document.querySelector("#draw_free_spray").clicked = !document.querySelector("#draw_free_spray").clicked;
        document.querySelector("#draw_free_spray").style.backgroundColor = "";

        canvas.isDrawingMode = false;
    }
};

document.querySelector("#draw_shapes_line").onclick = () => {
    canvas.add(
        new fabric.Line([50, 100, 200, 200], {
            left: 10,
            top: 20,
            width: 20,
            height: 20,
            stroke: "green",
        })
    );
};
document.querySelector("#draw_shapes_circle").onclick = () => {
    canvas.add(
        new fabric.Circle({
            radius: 20,
            left: 10,
            top: 20,
            width: 20,
            height: 20,
            fill: "green",
        })
    );
};
document.querySelector("#draw_shapes_rect").onclick = () => {
    canvas.add(
        new fabric.Rect({
            left: 10,
            top: 20,
            width: 20,
            height: 20,
            fill: "green",
        })
    );
};
document.querySelector("#draw_shapes_triangle").onclick = () => {
    canvas.add(
        new fabric.Triangle({
            left: 10,
            top: 20,
            width: 20,
            height: 20,
            fill: "green",
        })
    );
};
// document.querySelector("#draw_shapes_polyline").onclick = () => {
//     canvas.add(
//         new fabric.Polyline(
//             [
//                 { x: 200, y: 10 },
//                 { x: 250, y: 50 },
//             ],
//             {
//                 left: 10,
//                 top: 20,
//                 width: 20,
//                 height: 20,
//                 fill: "green",
//                 stroke: "green",
//                 lockUniScaling: true,
//             }
//         )
//     );
// };
// document.querySelector("#draw_shapes_polygon").onclick = () => {
//     canvas.add(
//         new fabric.Polygon({
//             left: 10,
//             top: 20,
//             width: 20,
//             height: 20,
//             fill: "green",
//         })
//     );
// };

document.onkeydown = (e) => {
    if (e.key == "Delete") {
        canvas.remove(canvas.getActiveObject());
    }
};

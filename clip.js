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
        // 奇迹!!!
        clip_ctx.fillStyle = "#0005";
        clip_ctx.fillRect(0, 0, clip_canvas.width, xywh[1]);
        clip_ctx.fillRect(0, xywh[1], xywh[0], xywh[3]);
        clip_ctx.fillRect(xywh[0] + xywh[2], xywh[1], clip_canvas.width - (xywh[0] + xywh[2]), xywh[3]);
        clip_ctx.fillRect(0, xywh[1] + xywh[3], clip_canvas.width, clip_canvas.height - (xywh[1] + xywh[3]));
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

function p_xy_to_c_xy(canvas, o_x1, o_y1, o_x2, o_y2) {
    // 0_零_1_一_2_二_3 阿拉伯数字为点坐标（canvas），汉字为像素坐标（html）
    // 输入为边框像素坐标
    // 为了让canvas获取全屏，边框像素点要包括
    // 像素坐标转为点坐标后,左和上(小的)是不变的,大的少1
    x1 = Math.min(o_x1, o_x2);
    y1 = Math.min(o_y1, o_y2);
    x2 = Math.max(o_x1, o_x2) + 1;
    y2 = Math.max(o_y1, o_y2) + 1;
    // canvas缩放变换
    x1 = Math.round(canvas.width * (x1 / canvas.offsetWidth));
    y1 = Math.round(canvas.height * (y1 / canvas.offsetHeight));
    x2 = Math.round(canvas.width * (x2 / canvas.offsetWidth));
    y2 = Math.round(canvas.height * (y2 / canvas.offsetHeight));
    return [x1, y1, x2 - x1, y2 - y1];
}

selecting = false;
o_position = "";
canvas_rect = "";
clip_ctx = clip_canvas.getContext("2d");

clip_canvas.onmousedown = (e) => {
    selecting = true;
    o_position = [e.screenX, e.screenY]; // 用于跟随
    canvas_rect = [e.offsetX, e.offsetY]; // 用于框选
};

clip_canvas.onmousemove = (e) => {
    // xywh=final_rect
    if (selecting) {
        final_rect = p_xy_to_c_xy(clip_canvas, canvas_rect[0], canvas_rect[1], e.offsetX, e.offsetY);
        clip_ctx.clearRect(0, 0, clip_canvas.width, clip_canvas.height);
        clip_ctx.beginPath();

        // 奇迹!!!
        clip_ctx.fillStyle = "#0005";
        clip_ctx.fillRect(0, 0, clip_canvas.width, final_rect[1]);
        clip_ctx.fillRect(0, final_rect[1], final_rect[0], final_rect[3]);
        clip_ctx.fillRect(final_rect[0] + final_rect[2], final_rect[1], clip_canvas.width - (final_rect[0] + final_rect[2]), final_rect[3]);
        clip_ctx.fillRect(0, final_rect[1] + final_rect[3], clip_canvas.width, clip_canvas.height - (final_rect[1] + final_rect[3]));

        document.getElementById("clip_wh").innerHTML = `${final_rect[2]}x${final_rect[3]}`;
    }

    now_canvas_position = p_xy_to_c_xy(clip_canvas, e.offsetX, e.offsetY, e.offsetX, e.offsetY);
    document.getElementById("clip_xy").innerHTML = `${now_canvas_position[0] + 1},${now_canvas_position[1] + 1}`;
    color_pincker(final_rect, now_canvas_position[0] + 1, now_canvas_position[1] + 1);
};

clip_canvas.onmouseup = (e) => {
    clip_ctx.closePath();
    selecting = false;
    now_canvas_position = p_xy_to_c_xy(clip_canvas, e.offsetX, e.offsetY, e.offsetX, e.offsetY);
    final_rect = xywh = p_xy_to_c_xy(clip_canvas, canvas_rect[0], canvas_rect[1], e.offsetX, e.offsetY);
    follow_bar(o_position[0], o_position[1], e.screenX, e.screenY);
};

function color_pincker(final_rect, x, y) {
    x0 = final_rect[0];
    x1 = final_rect[0] + final_rect[2];
    y0 = final_rect[1];
    y1 = final_rect[1] + final_rect[3];
    color = main_canvas.getContext("2d").getImageData(x - 4, y - 4, 9, 9).data;
    color_g = [];
    for (var i = 0, len = color.length; i < len; i += 4) {
        color_g.push(color.slice(i, i + 4));
    }
    inner_html = "";
    for (i in color_g) {
        xx = (i % Math.sqrt(color_g.length)) + (x - (Math.sqrt(color_g.length) - 1) / 2);
        yy = parseInt(i / Math.sqrt(color_g.length)) + (y - (Math.sqrt(color_g.length) - 1) / 2);
        if (!(x0 <= xx && xx <= x1 && y0 <= yy && yy <= y1) && i != (color_g.length - 1) / 2) { // 框外
            inner_html += `<span id="point_color_t_b" style="background:rgba(${color_g[i][0]},${color_g[i][1]},${color_g[i][2]},${color_g[i][3]})"></span>`;
        } else if (i == (color_g.length - 1) / 2) { // 光标中心点
            inner_html += `<span id="point_color_t_c" style="background:rgba(${color_g[i][0]},${color_g[i][1]},${color_g[i][2]},${color_g[i][3]})"></span>`;
            document.getElementById('clip_color').innerHTML=`rgba(${color_g[i][0]},${color_g[i][1]},${color_g[i][2]},${color_g[i][3]})`
        } else {
            inner_html += `<span id="point_color_t" style="background:rgba(${color_g[i][0]},${color_g[i][1]},${color_g[i][2]},${color_g[i][3]})"></span>`;
        }
    }
    document.getElementById("point_color").innerHTML = inner_html;
}

// 误代码后恢复,奇迹再现
function follow_bar(sx, sy, x, y) {
    tool_bar = document.getElementById("tool_bar");

    if (x - sx >= 0) {
        // 向右
        if (x + tool_bar.offsetWidth + 10 <= window.screen.width) {
            tool_bar.style.left = x + 10 + "px"; // 贴右边
        } else {
            // 超出屏幕贴左边
            if (sx - tool_bar.offsetWidth - 10 >= 0) {
                tool_bar.style.left = sx - tool_bar.offsetWidth - 10 + "px";
            } else {
                // 还超贴右内
                tool_bar.style.left = x - tool_bar.offsetWidth - 10 + "px";
            }
        }
    } else {
        // 向左
        if (x - tool_bar.offsetWidth - 10 >= 0) {
            tool_bar.style.left = x - tool_bar.offsetWidth - 10 + "px"; // 贴左边
        } else {
            // 超出屏幕贴右边
            if (sx + tool_bar.offsetWidth + 10 <= window.screen.width) {
                tool_bar.style.left = sx + 10 + "px";
            } else {
                // 还超贴左内
                tool_bar.style.left = x + 10 + "px";
            }
        }
    }

    if (y - sy >= 0) {
        if (y - tool_bar.offsetHeight >= 0) {
            tool_bar.style.top = y - tool_bar.offsetHeight + "px";
        } else {
            tool_bar.style.top = sy + "px";
        }
    } else {
        if (y + tool_bar.offsetHeight <= window.screen.height) {
            tool_bar.style.top = y + "px";
        } else {
            tool_bar.style.top = window.screen.height - tool_bar.offsetHeight + "px";
        }
    }
}

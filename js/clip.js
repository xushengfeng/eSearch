// 鼠标框选坐标转画布坐标,鼠标坐标转画布坐标
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
tool_bar = document.getElementById("tool_bar");
draw_bar = document.getElementById("draw_bar");

clip_canvas.onmousedown = (e) => {
    selecting = true;
    o_position = [e.screenX, e.screenY]; // 用于跟随
    canvas_rect = [e.offsetX, e.offsetY]; // 用于框选
    draw_clip_rect(e);
};

clip_canvas.onmousemove = (e) => {
    // 画框
    draw_clip_rect(e);
};

clip_canvas.onmouseup = (e) => {
    clip_ctx.closePath();
    selecting = false;
    now_canvas_position = p_xy_to_c_xy(clip_canvas, e.offsetX, e.offsetY, e.offsetX, e.offsetY);
    final_rect = xywh = p_xy_to_c_xy(clip_canvas, canvas_rect[0], canvas_rect[1], e.offsetX, e.offsetY);
    // 抬起鼠标后工具栏跟随
    follow_bar(o_position[0], o_position[1], e.screenX, e.screenY);
};

function draw_clip_rect(e) {
    if (selecting) {
        final_rect = p_xy_to_c_xy(clip_canvas, canvas_rect[0], canvas_rect[1], e.offsetX, e.offsetY);
        clip_ctx.clearRect(0, 0, clip_canvas.width, clip_canvas.height);
        clip_ctx.beginPath();

        // 奇迹!!!
        // 框选为黑色遮罩
        clip_ctx.fillStyle = 遮罩颜色;
        clip_ctx.fillRect(0, 0, clip_canvas.width, final_rect[1]);
        clip_ctx.fillRect(0, final_rect[1], final_rect[0], final_rect[3]);
        clip_ctx.fillRect(
            final_rect[0] + final_rect[2],
            final_rect[1],
            clip_canvas.width - (final_rect[0] + final_rect[2]),
            final_rect[3]
        );
        clip_ctx.fillRect(
            0,
            final_rect[1] + final_rect[3],
            clip_canvas.width,
            clip_canvas.height - (final_rect[1] + final_rect[3])
        );

        clip_ctx.fillStyle = 选区颜色;
        clip_ctx.fillRect(final_rect[0], final_rect[1], final_rect[2], final_rect[3]);
        wh_bar(final_rect);
    }
}

hotkeys("ctrl+a, command+a", () => {
    final_rect = [0, 0, main_canvas.width, main_canvas.height];
    clip_ctx.clearRect(0, 0, clip_canvas.width, clip_canvas.height);
    clip_ctx.beginPath();
    clip_ctx.fillStyle = 选区颜色;
    clip_ctx.fillRect(final_rect[0], final_rect[1], final_rect[2], final_rect[3]);
});

// 大小栏
function wh_bar(final_rect) {
    dw = document.querySelector("#clip_wh").offsetWidth;
    dh = document.querySelector("#clip_wh").offsetHeight;
    var x;
    if (dw >= final_rect[2]) {
        if (dw + final_rect[0] <= window.screen.width) {
            x = final_rect[0]; // 对齐框的左边
        } else {
            x = final_rect[0] + final_rect[2] - dw; // 对齐框的右边
        }
    } else {
        x = final_rect[0] + final_rect[2] / 2 - dw / 2;
    }
    var y;
    if (final_rect[1] - (dh + 10) >= 0) {
        y = final_rect[1] - (dh + 10); // 不超出时在外
    } else {
        y = final_rect[1] + 10;
    }
    // 位置
    document.querySelector("#clip_wh").style.left = `${x}px`;
    document.querySelector("#clip_wh").style.top = `${y}px`;
    // 大小文字
    document.querySelector("#clip_wh").innerHTML = `${final_rect[2]} × ${final_rect[3]}`;
}

// 鼠标跟随栏
function mouse_bar(final_rect, x, y) {
    x0 = final_rect[0];
    x1 = final_rect[0] + final_rect[2];
    y0 = final_rect[1];
    y1 = final_rect[1] + final_rect[3];
    color = main_canvas.getContext("2d").getImageData(x - 5, y - 5, 11, 11).data; // 取色器密度
    // 分开每个像素的颜色
    color_g = [];
    for (var i = 0, len = color.length; i < len; i += 4) {
        color_g.push(color.slice(i, i + 4));
    }
    inner_html = "";
    for (i in color_g) {
        color_g[i][3] /= 255;
        xx = (i % Math.sqrt(color_g.length)) + (x - (Math.sqrt(color_g.length) - 1) / 2);
        yy = parseInt(i / Math.sqrt(color_g.length)) + (y - (Math.sqrt(color_g.length) - 1) / 2);
        if (!(x0 <= xx && xx <= x1 - 1 && y0 <= yy && yy <= y1 - 1) && i != (color_g.length - 1) / 2) {
            // 框外
            inner_html += `<span id="point_color_t_b" style="background:rgba(${color_g[i][0]},${color_g[i][1]},${color_g[i][2]},${color_g[i][3]})"></span>`;
        } else if (i == (color_g.length - 1) / 2) {
            // 光标中心点
            inner_html += `<span id="point_color_t_c" style="background:rgba(${color_g[i][0]},${color_g[i][1]},${color_g[i][2]},${color_g[i][3]})"></span>`;
            // 颜色文字
            clip_color_text(color_g[i][0], color_g[i][1], color_g[i][2], color_g[i][3]);
        } else {
            inner_html += `<span id="point_color_t" style="background:rgba(${color_g[i][0]},${color_g[i][1]},${color_g[i][2]},${color_g[i][3]})"></span>`;
        }
    }
    document.querySelector("#point_color").innerHTML = inner_html;

    if (光标 == "以(1,1)为起点") {
        document.querySelector("#clip_xy").innerHTML = `(${x + 1}, ${y + 1})`;
    } else {
        document.querySelector("#clip_xy").innerHTML = `(${x}, ${y})`;
    }
}

// 色彩空间转换
function color_conversion(rgba, type) {
    switch (type) {
        case "HEX":
            return `#${rgba[0].toString(16).padStart(2, 0).toUpperCase()}${rgba[1]
                .toString(16)
                .padStart(2, 0)
                .toUpperCase()}${rgba[2].toString(16).padStart(2, 0).toUpperCase()}`;

        case "RGB":
            return `rgb(${rgba[0]}, ${rgba[1]}, ${rgba[2]})`;

        case "RGBA":
            return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;

        case "HSL":
            h = rgb_2_hslsv(rgba)[0];
            s = rgb_2_hslsv(rgba)[1];
            l = rgb_2_hslsv(rgba)[2];
            return `hsl(${h}, ${s}%, ${l}%)`;

        case "HSLA":
            h = rgb_2_hslsv(rgba)[0];
            s = rgb_2_hslsv(rgba)[1];
            l = rgb_2_hslsv(rgba)[2];
            return `hsla(${h}, ${s}%, ${l}%, ${rgba[3]})`;

        case "HSV":
            h = rgb_2_hslsv(rgba)[0];
            s = rgb_2_hslsv(rgba)[3];
            v = rgb_2_hslsv(rgba)[4];
            return `hsv(${h}, ${s}%, ${v}%)`;

        case "HSVA":
            h = rgb_2_hslsv(rgba)[0];
            s = rgb_2_hslsv(rgba)[3];
            v = rgb_2_hslsv(rgba)[4];
            return `hsva(${h}, ${s}%, ${v}%, ${rgba[3]})`;

        case "CMYK":
            var r = rgba[0] / 255;
            var g = rgba[1] / 255;
            var b = rgba[2] / 255;
            var k = 1 - Math.max(r, g, b);
            var c = +((1 - r - k) / (1 - k)).toFixed(2) || 0;
            var m = +((1 - g - k) / (1 - k)).toFixed(2) || 0;
            var y = +((1 - b - k) / (1 - k)).toFixed(2) || 0;
            return `(${c}, ${m}, ${y}, ${k.toFixed(2)})`;
    }
}

// RGB转HSL或HSV
function rgb_2_hslsv(rgba) {
    var r = rgba[0] / 255;
    var g = rgba[1] / 255;
    var b = rgba[2] / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var Δ = max - min;

    l = (max + min) / 2;
    if (Δ == 0) {
        h = 0;
        s = 0;
    } else {
        switch (max) {
            case r:
                h = 60 * ((g - b) / Δ + 6);
                if (h > 360) h = h - 360;
                break;
            case g:
                h = 60 * ((b - r) / Δ + 2);
                break;
            case b:
                h = 60 * ((r - g) / Δ + 4);
                break;
        }
        s = l == 0 ? 0 : Δ / (1 - Math.abs(2 * l - 1)); // 防止得到无限大
        s2 = max == 0 ? 0 : Δ / max;
    }
    h = h.toFixed(0);
    s = (s * 100).toFixed(0);
    l = (l * 100).toFixed(0);
    s2 = (s2 * 100).toFixed(0);
    return [h, s, l, s2, max];
}

// 改变颜色文字和样式
function clip_color_text(r, g, b, a) {
    document.querySelector("#clip_color").innerHTML = color_conversion([r, g, b, a], 取色器默认格式);
    document.querySelector("#clip_color").style.background = `rgba(${r},${g},${b},${a})`;
    var r = r / 255;
    var g = g / 255;
    var b = b / 255;
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (y >= 0.5) {
        document.querySelector("#clip_color").style.color = "#000";
    } else {
        document.querySelector("#clip_color").style.color = "#fff";
    }
}

// 鼠标栏实时跟踪
document.onmousemove = (e) => {
    // 鼠标位置文字
    now_canvas_position = p_xy_to_c_xy(clip_canvas, e.offsetX, e.offsetY, e.offsetX, e.offsetY);

    // 鼠标跟随栏
    mouse_bar(final_rect, now_canvas_position[0], now_canvas_position[1]);

    var x = e.screenX + 35;
    var y = e.screenY + 35;
    var w = document.querySelector("#mouse_bar").offsetWidth;
    var h = document.querySelector("#mouse_bar").offsetHeight;
    var sw = window.screen.width;
    var sh = window.screen.height;
    if (x + w > sw) {
        x = x - w - 70;
    }
    if (y + h > sh) {
        y = y - h - 70;
    }

    document.querySelector("#mouse_bar").style.left = `${x}px`;
    document.querySelector("#mouse_bar").style.top = `${y}px`;

    if (draw_bar_moving) {
        draw_bar.style.left = e.screenX - draw_bar_moving_xy[0] + "px";
        draw_bar.style.top = e.screenY - draw_bar_moving_xy[1] + "px";
    }
};

// 误代码后恢复,奇迹再现
// 工具栏跟随
function follow_bar(sx, sy, x, y) {
    if (x - sx >= 0) {
        // 向右
        if (x + tool_bar.offsetWidth + 10 <= window.screen.width) {
            tool_bar.style.left = x + 10 + "px"; // 贴右边
        } else {
            if (工具栏跟随 == "展示内容优先") {
                // 超出屏幕贴左边
                if (sx - tool_bar.offsetWidth - 10 >= 0) {
                    tool_bar.style.left = sx - tool_bar.offsetWidth - 10 + "px";
                } else {
                    // 还超贴右内
                    tool_bar.style.left = x - tool_bar.offsetWidth - 10 + "px";
                }
            } else {
                // 直接贴右边,即使遮挡
                tool_bar.style.left = x - tool_bar.offsetWidth - 10 + "px";
            }
        }
    } else {
        // 向左
        if (x - tool_bar.offsetWidth - 10 >= 0) {
            tool_bar.style.left = x - tool_bar.offsetWidth - 10 + "px"; // 贴左边
        } else {
            if (工具栏跟随 == "展示内容优先") {
                // 超出屏幕贴右边
                if (sx + tool_bar.offsetWidth + 10 <= window.screen.width) {
                    tool_bar.style.left = sx + 10 + "px";
                } else {
                    // 还超贴左内
                    tool_bar.style.left = x + 10 + "px";
                }
            } else {
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

draw_bar_moving = false;
draw_bar_moving_xy = [];
document.getElementById("draw_move").onmousedown = (e) => {
    if (e.button == 2) {
        draw_bar_moving = true;
        draw_bar_moving_xy[0] = e.offsetX;
        draw_bar_moving_xy[1] = e.offsetY + document.getElementById("draw_move").offsetTop;
        console.log(draw_bar_moving_xy);
        draw_bar.style.transition = "0s";
    }
};
document.getElementById("draw_move").onmouseup = (e) => {
    if (e.button == 2) {
        draw_bar_moving = false;
        draw_bar_moving_xy = [];
        draw_bar.style.transition = "";
    }
};

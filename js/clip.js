// 初始化刷新
ipcRenderer.on("reflash", () => {
    draw_clip_rect();
    setTimeout(() => {
        wh_bar(final_rect);
    }, 100);
    right_key = false;
    change_right_bar(false);
});

const Color = require("color");

// 键盘控制光标
document.querySelector("body").onkeydown = (e) => {
    var o = {
        ArrowUp: "up",
        w: "up",
        ArrowRight: "right",
        d: "right",
        ArrowDown: "down",
        s: "down",
        ArrowLeft: "left",
        a: "left",
    };
    if (e.ctrlKey) {
        ipcRenderer.send("move_mouse", o[e.key], 5);
    } else if (e.shiftKey) {
        ipcRenderer.send("move_mouse", o[e.key], 10);
    } else {
        ipcRenderer.send("move_mouse", o[e.key], 1);
    }
};
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
right_key = false;
o_position = "";
canvas_rect = "";
in_rect = false;
moving = false;
oe = "";
o_final_rect = "";
the_color = null;
clip_ctx = clip_canvas.getContext("2d");
tool_bar = document.getElementById("tool_bar");
draw_bar = document.getElementById("draw_bar");

clip_canvas.onmousedown = (e) => {
    is_in_clip_rect(e);
    if (e.button == 0 && !in_rect) {
        selecting = true;
        o_position = [e.screenX, e.screenY]; // 用于跟随
        canvas_rect = [e.offsetX, e.offsetY]; // 用于框选
        final_rect = p_xy_to_c_xy(clip_canvas, canvas_rect[0], canvas_rect[1], e.offsetX, e.offsetY);
        draw_clip_rect();
        right_key = false;
        change_right_bar(false);
    }
    if (e.button == 2) {
        right_key = true;
        // 自由右键取色
        now_canvas_position = p_xy_to_c_xy(clip_canvas, e.offsetX, e.offsetY, e.offsetX, e.offsetY);
        mouse_bar(final_rect, now_canvas_position[0], now_canvas_position[1]);
        // 改成多格式样式
        change_right_bar(true);
    }
    if (in_rect) {
        is_in_clip_rect(e);
        oe = e;
        o_final_rect = final_rect;
        moving = true;
        move_rect(o_final_rect, oe, oe);
    }
};

clip_canvas.onmousemove = (e) => {
    if (e.button == 0 && selecting) {
        // 画框
        final_rect = p_xy_to_c_xy(clip_canvas, canvas_rect[0], canvas_rect[1], e.offsetX, e.offsetY);
        draw_clip_rect();
    }
    if (!selecting && !moving) {
        is_in_clip_rect(e);
    }

    if (moving) move_rect(o_final_rect, oe, e);
};

clip_canvas.onmouseup = (e) => {
    if (e.button == 0 && !in_rect) {
        clip_ctx.closePath();
        selecting = false;
        now_canvas_position = p_xy_to_c_xy(clip_canvas, e.offsetX, e.offsetY, e.offsetX, e.offsetY);
        final_rect = xywh = p_xy_to_c_xy(clip_canvas, canvas_rect[0], canvas_rect[1], e.offsetX, e.offsetY);
        draw_clip_rect();
        // 抬起鼠标后工具栏跟随
        follow_bar(o_position[0], o_position[1], e.screenX, e.screenY);
    }
    if (moving) {
        move_rect(o_final_rect, oe, e);
        moving = false;
        o_final_rect = "";
    }
};

// 画框(遮罩)
function draw_clip_rect() {
    clip_ctx.clearRect(0, 0, clip_canvas.width, clip_canvas.height);
    clip_ctx.beginPath();

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
    // 大小栏
    wh_bar(final_rect);
}

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
    if (四角坐标) {
        var x0, y0, x1, y1;
        d = 光标 == "以(1,1)为起点" ? 1 : 0;
        x0 = final_rect[0] + d;
        y0 = final_rect[1] + d;
        x1 = final_rect[0] + d + final_rect[2];
        y1 = final_rect[1] + d + final_rect[3];
        document.querySelector("#x0y0").style.display = "block";
        document.querySelector("#x1y1").style.display = "block";
        document.querySelector("#x0y0").innerHTML = `${x0}, ${y0}`;
        document.querySelector("#x1y1").innerHTML = `${x1}, ${y1}`;
    } else {
    }
    document.querySelector("#wh").innerHTML = `${final_rect[2]} × ${final_rect[3]}`;
}
// 回车更改x1y1 x1y2 wh
document.querySelector("#x0y0").onkeydown = (e) => {
    if (e.key == "Enter") {
        e.preventDefault();
        var xy = document.querySelector("#x0y0").innerHTML.match(/(\d+)\D+(\d+)/);
        d = 光标 == "以(1,1)为起点" ? 1 : 0;
        if (xy != null) {
            final_rect[0] = xy[1] - 0 - d;
            final_rect[1] = xy[2] - 0 - d;
            final_rect_fix();
            draw_clip_rect();
        } else {
            document.querySelector("#x0y0").innerHTML = `${final_rect[0] + d}, ${final_rect[1] + d}`;
        }
    }
};
document.querySelector("#x1y1").onkeydown = (e) => {
    if (e.key == "Enter") {
        e.preventDefault();
        var xy = document.querySelector("#x1y1").innerHTML.match(/(\d+)\D+(\d+)/);
        d = 光标 == "以(1,1)为起点" ? 1 : 0;
        if (xy != null) {
            final_rect[0] = xy[1] - 0 - final_rect[2] - d;
            final_rect[1] = xy[2] - 0 - final_rect[3] - d;
            final_rect_fix();
            draw_clip_rect();
        } else {
            document.querySelector("#x1y1").innerHTML = `${final_rect[0] + d + final_rect[2]}, ${
                final_rect[1] + d + final_rect[3]
            }`;
        }
    }
};
document.querySelector("#wh").onkeydown = (e) => {
    if (e.key == "Enter") {
        e.preventDefault();
        var wh = document.querySelector("#wh").innerHTML.match(/(\d+)\D+(\d+)/);
        if (wh != null) {
            final_rect[2] = wh[1] - 0;
            final_rect[3] = wh[2] - 0;
            final_rect_fix();
            draw_clip_rect();
        } else {
            document.querySelector("#wh").innerHTML = `${final_rect[2]} × ${final_rect[3]}`;
        }
    }
};

// 快捷键全屏选择
hotkeys("ctrl+a, command+a", () => {
    final_rect = [0, 0, main_canvas.width, main_canvas.height];
    clip_canvas.style.cursor = "crosshair";
    direction = "none";
    draw_clip_rect();
});

// 生成取色器
inner_html = "";
for (i = 1; i <= color_size ** 2; i++) {
    if (i == (color_size ** 2 + 1) / 2) {
        // 光标中心点
        inner_html += `<span id="point_color_t_c"></span>`;
    } else {
        inner_html += `<span id="point_color_t"></span>`;
    }
}
document.querySelector("#point_color").innerHTML = inner_html;
point_color_span_list = document.querySelectorAll("#point_color > span");

// 鼠标跟随栏
function mouse_bar(final_rect, x, y) {
    x0 = final_rect[0];
    x1 = final_rect[0] + final_rect[2];
    y0 = final_rect[1];
    y1 = final_rect[1] + final_rect[3];
    color = main_canvas
        .getContext("2d")
        .getImageData(x - (color_size - 1) / 2, y - (color_size - 1) / 2, color_size, color_size).data; // 取色器密度
    // 分开每个像素的颜色
    color_g = [];
    for (var i = 0, len = color.length; i < len; i += 4) {
        color_g.push(color.slice(i, i + 4));
    }
    for (i in color_g) {
        color_g[i][3] /= 255;
        xx = (i % Math.sqrt(color_g.length)) + (x - (Math.sqrt(color_g.length) - 1) / 2);
        yy = parseInt(i / Math.sqrt(color_g.length)) + (y - (Math.sqrt(color_g.length) - 1) / 2);
        if (!(x0 <= xx && xx <= x1 - 1 && y0 <= yy && yy <= y1 - 1) && i != (color_g.length - 1) / 2) {
            // 框外
            point_color_span_list[i].id = "point_color_t_b";
            point_color_span_list[i].style.background = Color.rgb(color_g[i]).string();
        } else if (i == (color_g.length - 1) / 2) {
            // 光标中心点
            point_color_span_list[i].id = "point_color_t_c";
            point_color_span_list[i].style.background = Color.rgb(color_g[i]).string();
            // 颜色文字
            the_color = color_g[i];
            document.querySelector("#clip_color").innerHTML = clip_color_text(the_color, 取色器默认格式);
        } else {
            point_color_span_list[i].id = "point_color_t_t";
            point_color_span_list[i].style.background = Color.rgb(color_g[i]).string();
        }
    }

    if (光标 == "以(1,1)为起点") {
        document.querySelector("#clip_xy").innerHTML = `(${x + 1}, ${y + 1})`;
    } else {
        document.querySelector("#clip_xy").innerHTML = `(${x}, ${y})`;
    }
}

// 色彩空间转换
function color_conversion(rgba, type) {
    var color = Color(rgba);
    switch (type) {
        case "HEX":
            return color.hex();
        case "RGB":
            return color.rgb().string();
        case "HSL":
            var [h, s, l] = color.hsl().round().array();
            return `hsl(${h}, ${s}%, ${l}%)`;
        case "HSV":
            var [h, s, v] = color.hsv().round().array();
            return `hsv(${h}, ${s}%, ${v}%)`;
        case "CMYK":
            var [c, m, y, k] = color.cmyk().round().array();
            return `cmyk(${c}, ${m}, ${y}, ${k})`;
    }
}

// 改变颜色文字和样式
function clip_color_text(l, type) {
    var color = Color.rgb(l);
    clip_color_text_color = null;
    if (color.isLight()) {
        clip_color_text_color = "#000";
    } else {
        clip_color_text_color = "#fff";
    }
    return `<div style="background-color:${color.hex()};color:${clip_color_text_color}">${color_conversion(
        l,
        type
    )}</div>`;
}

// 改变鼠标跟随栏形态，展示所有颜色格式
function change_right_bar(v) {
    var t = `<div>${final_rect[2]} × ${final_rect[3]}</div>`;
    var all_color_format = ["HEX", "RGB", "HSL", "HSV", "CMYK"];
    for (i in all_color_format) {
        t += clip_color_text(the_color, all_color_format[i]);
    }
    document.querySelector("#clip_copy").innerHTML = t;
    var nodes = document.querySelectorAll("#clip_copy > div");
    nodes.forEach((element) => {
        ((e) => {
            e.onclick = () => {
                clipboard.writeText(e.innerText);
                right_key = false;
                change_right_bar(false);
            };
        })(element);
    });
    if (v) {
        document.querySelector("#point_color").style.height = "0";
        document.querySelector("#clip_color").style.height = "0";
        document.querySelector("#clip_copy").style.height = `168px`;
        document.querySelector("#clip_copy").style.width = `200px`;
        setTimeout(() => {
            document.querySelector("#clip_copy").style.overflow = "inherit";
        }, 400);
    } else {
        document.querySelector("#clip_copy").style.width = `${getComputedStyle(
            document.documentElement
        ).getPropertyValue("--color-size")}`;
        document.querySelector("#point_color").style.height = "";
        document.querySelector("#clip_color").style.height = "";
        document.querySelector("#clip_copy").style.height = "";
        document.querySelector("#clip_copy").style.overflow = "hidden";
    }
}
change_right_bar(false);

// 鼠标栏实时跟踪
document.onmousemove = (e) => {
    if (!right_key) {
        // 鼠标位置文字
        now_canvas_position = p_xy_to_c_xy(clip_canvas, e.offsetX, e.offsetY, e.offsetX, e.offsetY);

        // 鼠标跟随栏
        document.querySelector("#mouse_bar").style.display = "flex";
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

        // 画板栏移动
        if (draw_bar_moving) {
            draw_bar.style.left = e.screenX - draw_bar_moving_xy[0] + "px";
            draw_bar.style.top = e.screenY - draw_bar_moving_xy[1] + "px";
        }
    }
};

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

// 移动画画栏
draw_bar_moving = false;
draw_bar_moving_xy = [];
document.getElementById("draw_move").onmousedown = (e) => {
    draw_bar_moving = true;
    draw_bar_moving_xy[0] = e.offsetX;
    draw_bar_moving_xy[1] = e.offsetY + document.getElementById("draw_move").offsetTop;
    draw_bar.style.transition = "0s";
};
document.getElementById("draw_move").onmouseup = (e) => {
    draw_bar_moving = false;
    draw_bar_moving_xy = [];
    draw_bar.style.transition = "";
};

// 修复final_rect负数
// 超出屏幕处理
function final_rect_fix() {
    var x0 = final_rect[0];
    var y0 = final_rect[1];
    var x1 = final_rect[0] + final_rect[2];
    var y1 = final_rect[1] + final_rect[3];
    x = Math.min(x0, x1);
    y = Math.min(y0, y1);
    w = Math.max(x0, x1) - x;
    h = Math.max(y0, y1) - y;
    // 移出去移回来保持原来大小
    if (x < 0) w = x = 0;
    if (y < 0) h = y = 0;
    if (x > main_canvas.width) x = x % main_canvas.width;
    if (y > main_canvas.height) y = y % main_canvas.height;
    if (x + w > main_canvas.width) w = main_canvas.width - x;
    if (y + h > main_canvas.height) h = main_canvas.height - y;
    final_rect = [x, y, w, h];
}

// 判断光标位置并更改样式
// 定义光标位置的移动方向
function is_in_clip_rect(event) {
    now_canvas_position = p_xy_to_c_xy(clip_canvas, event.offsetX, event.offsetY, event.offsetX, event.offsetY);
    x = now_canvas_position[0];
    y = now_canvas_position[1];
    x0 = final_rect[0];
    x1 = final_rect[0] + final_rect[2];
    y0 = final_rect[1];
    y1 = final_rect[1] + final_rect[3];
    // 如果全屏,那允许框选
    if (!(final_rect[2] == main_canvas.width && final_rect[3] == main_canvas.height)) {
        if (x0 <= x && x <= x1 && y0 <= y && y <= y1) {
            // 在框选区域内,不可框选,只可调整
            in_rect = true;
        } else {
            in_rect = false;
        }

        direction = "";

        var num = 8;

        // 光标样式
        switch (true) {
            case x0 <= x && x <= x0 + num && y0 <= y && y <= y0 + num:
                clip_canvas.style.cursor = "nw-resize";
                direction = "西北";
                break;
            case x1 - num <= x && x <= x1 && y1 - num <= y && y <= y1:
                clip_canvas.style.cursor = "se-resize";
                direction = "东南";
                break;
            case y0 <= y && y <= y0 + num && x1 - num <= x && x <= x1:
                clip_canvas.style.cursor = "ne-resize";
                direction = "东北";
                break;
            case y1 - num <= y && y <= y1 && x0 <= x && x <= x0 + num:
                clip_canvas.style.cursor = "sw-resize";
                direction = "西南";
                break;
            case x0 <= x && x <= x0 + num:
                clip_canvas.style.cursor = "w-resize";
                direction = "西";
                break;
            case x1 - num <= x && x <= x1:
                clip_canvas.style.cursor = "e-resize";
                direction = "东";
                break;
            case y0 <= y && y <= y0 + num:
                clip_canvas.style.cursor = "n-resize";
                direction = "北";
                break;
            case y1 - num <= y && y <= y1:
                clip_canvas.style.cursor = "s-resize";
                direction = "南";
                break;
            case x0 + num < x && x < x1 - num && y0 + num < y && y < y1 - num:
                clip_canvas.style.cursor = "move";
                direction = "move";
                break;
            default:
                clip_canvas.style.cursor = "crosshair";
                direction = "";
                break;
        }
    } else {
        // 全屏可框选
        clip_canvas.style.cursor = "crosshair";
        direction = "";
        in_rect = false;
    }
}

// 调整框选
function move_rect(o_final_rect, oe, e) {
    var op = p_xy_to_c_xy(clip_canvas, oe.offsetX, oe.offsetY, oe.offsetX, oe.offsetY);
    var p = p_xy_to_c_xy(clip_canvas, e.offsetX, e.offsetY, e.offsetX, e.offsetY);
    dx = p[0] - op[0];
    dy = p[1] - op[1];
    switch (direction) {
        case "西北":
            final_rect = [o_final_rect[0] + dx, o_final_rect[1] + dy, o_final_rect[2] - dx, o_final_rect[3] - dy];
            break;
        case "东南":
            final_rect = [o_final_rect[0], o_final_rect[1], o_final_rect[2] + dx, o_final_rect[3] + dy];
            break;
        case "东北":
            final_rect = [o_final_rect[0], o_final_rect[1] + dy, o_final_rect[2] + dx, o_final_rect[3] - dy];
            break;
        case "西南":
            final_rect = [o_final_rect[0] + dx, o_final_rect[1], o_final_rect[2] - dx, o_final_rect[3] + dy];
            break;
        case "西":
            final_rect = [o_final_rect[0] + dx, o_final_rect[1], o_final_rect[2] - dx, o_final_rect[3]];
            break;
        case "东":
            final_rect = [o_final_rect[0], o_final_rect[1], o_final_rect[2] + dx, o_final_rect[3]];
            break;
        case "北":
            final_rect = [o_final_rect[0], o_final_rect[1] + dy, o_final_rect[2], o_final_rect[3] - dy];
            break;
        case "南":
            final_rect = [o_final_rect[0], o_final_rect[1], o_final_rect[2], o_final_rect[3] + dy];
            break;
        case "move":
            final_rect = [o_final_rect[0] + dx, o_final_rect[1] + dy, o_final_rect[2], o_final_rect[3]];
            break;
    }
    if (final_rect[0] < 0) {
        final_rect[2] = final_rect[2] + final_rect[0];
        final_rect[0] = 0;
    }
    if (final_rect[1] < 0) {
        final_rect[3] = final_rect[3] + final_rect[1];
        final_rect[1] = 0;
    }
    if (final_rect[0] + final_rect[2] > main_canvas.width) final_rect[2] = main_canvas.width - final_rect[0];
    if (final_rect[1] + final_rect[3] > main_canvas.height) final_rect[3] = main_canvas.height - final_rect[1];

    final_rect_fix();
    draw_clip_rect();
}

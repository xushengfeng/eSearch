const fabric = require("fabric").fabric;

// 创建一个fabric实例
let canvas = new fabric.Canvas("draw_photo"); //可以通过鼠标方法缩小,旋转
// or
// let canvas = new fabric.StaticCanvas("canvas");//没有鼠标交互的fabric对象

// 创建一个矩形对象
let rect = new fabric.Rect({
    left: 10, //距离左边的距离
    top: 10, //距离上边的距离
    fill: "green", //填充的颜色
    width: 20, //矩形宽度
    height: 20, //矩形高度
});

// 将矩形添加到canvas画布上
canvas.add(rect);



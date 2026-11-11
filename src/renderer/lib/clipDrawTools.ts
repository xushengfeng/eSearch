import type { IconType } from "../../iconTypes";

export type ClipDrawToolMeta = {
    key: string;
    icon?: IconType;
    title: string;
};

export const clipDrawTools: ClipDrawToolMeta[] = [
    { key: "draw.free", icon: "draw", title: "画笔" },
    { key: "draw.eraser", icon: "eraser", title: "橡皮" },
    { key: "draw.spray", icon: "spray", title: "喷刷" },
    { key: "shape.line", icon: "line", title: "线条" },
    { key: "shape.circle", icon: "circle", title: "圆" },
    { key: "shape.rect", icon: "rect", title: "矩形" },
    { key: "shape.frame", icon: "frame", title: "框" },
    { key: "shape.polyline", icon: "polyline", title: "折线" },
    { key: "shape.polygon", icon: "polygon", title: "多边形" },
    { key: "shape.text", icon: "text", title: "文字" },
    { key: "shape.number", icon: "number", title: "序号" },
    { key: "shape.arrow", icon: "arrow", title: "箭头" },
    { key: "shape.mask", icon: "mask", title: "遮罩" },
    { key: "filter.pixelate", icon: "pixelate", title: "马赛克" },
    { key: "filter.blur", icon: "blur", title: "模糊" },
    { key: "filter.brightness", icon: "brightness", title: "亮度" },
    { key: "filter.contrast", icon: "contrast", title: "对比度" },
    { key: "filter.saturation", icon: "saturation", title: "饱和度" },
    { key: "filter.hue", icon: "hue", title: "色调" },
    { key: "filter.gamma", title: "伽马" },
    { key: "filter.noise", title: "噪点" },
    { key: "filter.gray_average", title: "平均灰度" },
    { key: "filter.gray_lightness", title: "亮度" },
    { key: "filter.gray_luminosity", title: "亮度" },
    { key: "filter.invert", title: "负片" },
    { key: "filter.sepia", title: "棕褐色" },
    { key: "filter.bw", title: "黑白" },
    { key: "filter.brownie", title: "布朗尼" },
    { key: "filter.vintage", title: "老式" },
    { key: "filter.koda", title: "柯达彩色胶片" },
    { key: "filter.techni", title: "特艺色彩" },
    { key: "filter.polaroid", title: "宝丽来" },
    { key: "position.front", icon: "position_front", title: "移动到最顶端" },
    {
        key: "position.forwards",
        icon: "position_forwards",
        title: "向上移动一层",
    },
    {
        key: "position.backwards",
        icon: "position_backwards",
        title: "向下移动一层",
    },
    { key: "position.back", icon: "position_back", title: "移动到最底端" },
    { key: "action.undo", icon: "left", title: "撤回" },
    { key: "action.redo", icon: "right", title: "重做" },
    { key: "action.copy", icon: "copy", title: "复制" },
    { key: "action.delete", icon: "clear", title: "删除" },
];

import { ele, view } from "dkh-ui";
import type { setting } from "../../ShareTypes";
import store from "../../../lib/store/renderStore";
const { ipcRenderer } = window.require("electron") as typeof import("electron");

const pz = store.get("高级图片编辑.配置");
const styleData: Omit<setting["高级图片编辑"]["配置"][0], "name"> = pz.find(
    (i) => i.name === store.get("高级图片编辑.默认配置"),
) || {
    raduis: 10,
    background: "",
    shardow: {
        x: 0,
        y: 0,
        blur: 0,
        color: "rgba(0,0,0,0.5)",
    },
    padding: "auto",
};

const preview = view();
const controls = view();
const canvas = ele("canvas");

preview.add(canvas);

let photo: HTMLImageElement | null = null;

function updatePreview() {
    if (photo) {
        const ctx = canvas.el.getContext("2d");

        const { naturalWidth: photoWidth, naturalHeight: photoHeight } = photo;
        const { raduis, shardow, padding, background } = styleData;
        const { x, y, blur, color } = shardow;
        const { x: padX, y: padY } =
            typeof padding === "string"
                ? { x: 0, y: 0 }
                : { x: padding.x, y: padding.y };

        const finalWidth = photoWidth + 2 * padX;
        const finalHeight = photoHeight + 2 * padY;

        canvas.el.width = finalWidth;
        canvas.el.height = finalHeight;

        if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, finalWidth, finalHeight);
        }

        // Draw the photo
        ctx.beginPath();
        ctx.roundRect(padX, padY, photoWidth, photoHeight, raduis);
        ctx.clip();
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.shadowOffsetX = x;
        ctx.shadowOffsetY = y;
        ctx.shadowBlur = blur;
        ctx.shadowColor = color;
        ctx.drawImage(photo, padX, padY);
        ctx.restore();
    }
}

document.body.appendChild(controls.el);
document.body.appendChild(preview.el);

ipcRenderer.on("img", (_e, data: string) => {
    const img = new Image();
    img.onload = () => {
        photo = img;
        updatePreview();
    };
    img.src = data;
});

updatePreview();

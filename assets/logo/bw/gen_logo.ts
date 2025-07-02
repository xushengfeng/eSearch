// biome-ignore format:
import { createCanvas, loadImage,ImageData } from "canvas";
import { writeFileSync } from "node:fs";

const img = await loadImage("./32x32.png");

const canvas = createCanvas(32, 32);
const ctx = canvas.getContext("2d");

ctx.drawImage(img, 0, 0);

const data = ctx.getImageData(0, 0, 32, 32).data;

const black = new Uint8ClampedArray(32 * 32 * 4);
const white = new Uint8ClampedArray(32 * 32 * 4);

for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    for (let j = 0; j < 4; j++) {
        black[i + j] = data[i + j];
        white[i + j] = data[i + j];
    }
    if (a !== 0)
        for (let j = 0; j < 3; j++) {
            black[i + j] = 255 - a;
        }
    if (a !== 0)
        for (let j = 0; j < 3; j++) {
            white[i + j] = a;
        }
}

const blackImg = new ImageData(black, 32, 32);
const whiteImg = new ImageData(white, 32, 32);

const blackCanvas = createCanvas(32, 32);
const whiteCanvas = createCanvas(32, 32);

blackCanvas.getContext("2d").putImageData(blackImg, 0, 0);
whiteCanvas.getContext("2d").putImageData(whiteImg, 0, 0);

writeFileSync("./32x32_black.png", blackCanvas.toBuffer("image/png"));
writeFileSync("./32x32_white.png", whiteCanvas.toBuffer("image/png"));

const clamp = (value: number, min: number, max: number) =>
    Math.max(Math.min(value, max), min);

type RGB = [number, number, number];

export default function floydSteinberg(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    palette: RGB[],
) {
    const data = new Uint8ClampedArray(pixels);
    const format = "rgb565";
    //  "rgb444" ? 4096 :
    const bincount = 65536;
    const cache: number[] = new Array(bincount);
    const error = [0, 0, 0];
    step(true);
    step(false);
    return data;

    function step(randomly: boolean) {
        for (let y = 0; y < height; y++) {
            let leftToRight = y % 2 === 0;
            for (let ox = 0; ox < width; ox++) {
                // const leftToRight = true;
                // const leftToRight = Math.random() > 0.5;
                if (randomly) leftToRight = Math.random() > 0.5;
                const x = leftToRight ? ox : width - ox - 1;

                const index = toIndex(x, y, width, height);

                // get the old color
                const oldR = data[index + 0];
                const oldG = data[index + 1];
                const oldB = data[index + 2];
                // reduce to our palette
                const key = rgb888_to_rgb565(oldR, oldG, oldB);
                let idx: number;
                if (key in cache) {
                    idx = cache[key];
                } else {
                    cache[key] = nearestColorIndexRGB(
                        oldR,
                        oldG,
                        oldB,
                        palette,
                    );
                    idx = cache[key];
                }
                const newRGB = palette[idx];
                // now we have a new RGB color for this pixel
                const newR = newRGB[0];
                const newG = newRGB[1];
                const newB = newRGB[2];
                error[0] = oldR - newR;
                error[1] = oldG - newG;
                error[2] = oldB - newB;

                const down = toIndex(x, y + 1, width, height);
                const rightDown = toIndex(x + 1, y + 1, width, height);
                const right = toIndex(x + 1, y, width, height);
                const left = toIndex(x - 1, y, width, height);
                const rightUp = toIndex(x + 1, y - 1, width, height);
                const leftDown = toIndex(x - 1, y + 1, width, height);

                data[index] = newR;
                data[index + 1] = newG;
                data[index + 2] = newB;
                data[index + 3] = 0xff;

                for (let c = 0; c < 3; c++) {
                    if (leftToRight) {
                        if (x >= 0 && y < height - 1)
                            data[down + c] =
                                data[down + c] + (error[c] * 5) / 16;
                        if (x < width - 1 && y < height - 1)
                            data[rightDown + c] =
                                data[rightDown + c] + (error[c] * 1) / 16;
                        if (y >= 0 && x < width - 1)
                            data[right + c] =
                                data[right + c] + (error[c] * 7) / 16;
                        if (x > 0 && y < height - 1)
                            data[leftDown + c] =
                                data[leftDown + c] + (error[c] * 3) / 16;
                    } else {
                        if (x >= 0 && y < height - 1)
                            data[down + c] =
                                data[down + c] + (error[c] * 5) / 16;
                        if (x > 0 && y < height - 1)
                            data[leftDown + c] =
                                data[leftDown + c] + (error[c] * 1) / 16;
                        if (y >= 0 && x > 0)
                            data[left + c] =
                                data[left + c] + (error[c] * 7) / 16;
                        if (x < width - 1 && y < height - 1)
                            data[rightDown + c] =
                                data[rightDown + c] + (error[c] * 3) / 16;
                    }
                }
            }
        }
    }
}

function rgb888_to_rgb565(r: number, g: number, b: number) {
    return ((r << 8) & 0xf800) | ((g << 2) & 0x03e0) | (b >> 3);
}

function nearestColorIndexRGB(r: number, g: number, b: number, palette: RGB[]) {
    let k = 0;
    let mindist = 1e100;
    for (let i = 0; i < palette.length; i++) {
        const px2 = palette[i];
        const r2 = px2[0];
        let curdist = sqr(r2 - r);
        if (curdist > mindist) continue;
        const g2 = px2[1];
        curdist += sqr(g2 - g);
        if (curdist > mindist) continue;
        const b2 = px2[2];
        curdist += sqr(b2 - b);
        if (curdist > mindist) continue;
        mindist = curdist;
        k = i;
    }
    return k;
}

function toIndex(_x: number, _y: number, width: number, height: number) {
    const x = clamp(Math.floor(_x), 0, width - 1);
    const y = clamp(Math.floor(_y), 0, height - 1);
    return (x + y * width) * 4;
}

function sqr(a: number) {
    return a * a;
}

type ort = typeof import("onnxruntime-node");

async function removeObj(op: {
    ort: ort;
    session: Awaited<ReturnType<ort["InferenceSession"]["create"]>>;
    img: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;
    mask: ImageData;
}) {
    const w =
        op.img instanceof HTMLImageElement ? op.img.naturalWidth : op.img.width;
    const h =
        op.img instanceof HTMLImageElement
            ? op.img.naturalHeight
            : op.img.height;
    const imputImg = new OffscreenCanvas(w, h).getContext("2d");
    if (!imputImg) throw new Error("imputImg is null");
    imputImg.drawImage(op.img, 0, 0);
    const imgData = imputImg.getImageData(0, 0, w, h);

    const ort = op.ort;

    const maskOrt = op.session;
    const r = new Uint8Array(w * h);
    const g = new Uint8Array(w * h);
    const b = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        r[i] = imgData.data[4 * i];
        g[i] = imgData.data[4 * i + 1];
        b[i] = imgData.data[4 * i + 2];
    }
    const input = new ort.Tensor("uint8", [...r, ...g, ...b], [1, 3, h, w]);
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        m[i] = op.mask.data[4 * i];
    }
    const maskInput = new ort.Tensor("uint8", m, [1, 1, h, w]);
    const output = await maskOrt.run({
        [maskOrt.inputNames[0]]: input,
        [maskOrt.inputNames[1]]: maskInput,
    });
    console.log(output);
    const outputData0 = output[maskOrt.outputNames[0]].data as Uint8Array;
    const outputData = new ImageData(w, h);
    const wh = w * h;
    for (let i = 0; i < w * h; i++) {
        outputData.data[4 * i] = outputData0[i];
        outputData.data[4 * i + 1] = outputData0[i + wh];
        outputData.data[4 * i + 2] = outputData0[i + wh * 2];
        outputData.data[4 * i + 3] = 255;
    }
    return outputData;
}

export default removeObj;

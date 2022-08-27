var cv = require("opencv.js");
const ort = require("onnxruntime-node");
const fs = require("fs");

module.exports = { ocr: x, init };

var dev = true;

var det, rec, dic;
var limit_side_len = 960,
    imgH = 48,
    imgW = 320;

/**
 * 初始化
 * @param {{det_path:string,rec_path:string,dic_path:string,
 * max_side:number,imgh:number;imgw:numberdev:boolean}} x
 * @returns
 */
async function init(x) {
    dev = x.dev;
    det = await ort.InferenceSession.create(x.det_path);
    rec = await ort.InferenceSession.create(x.rec_path);
    dic = fs.readFileSync(x.dic_path).toString().split("\n");
    if (x.max_side) limit_side_len = x.max_side;
    if (x.imgh) imgH = x.imgh;
    if (x.imgw) imgW = x.imgw;
    return new Promise((rs) => rs());
}

/**
 * 主要操作
 * @param {ImageData} img 图片
 * @param {ort.InferenceSession} det 检测器
 * @param {ort.InferenceSession} rec 识别器
 * @param {Array} dic 字典
 */
async function x(img) {
    let h = img.height,
        w = img.width;
    let transposedData;
    let resize_w;
    let image;
    ({ transposedData, resize_w, image, canvas } = 检测前处理(h, w, img));
    const det_results = await 检测(transposedData, image, det);

    let box = 检测后处理(det_results.data, det_results.dims[3], det_results.dims[2], canvas);

    let { b, imgH, imgW } = 识别前处理(resize_w, box);
    const rec_results = await 识别(b, imgH, imgW, rec);
    let line = 识别后处理(rec_results, dic);
    console.log(line);
    return line;
}

async function 检测(transposedData, image, det) {
    const det_data = Float32Array.from(transposedData.flat(Infinity));

    const det_tensor = new ort.Tensor("float32", det_data, [1, 3, image.height, image.width]);
    let det_feed = {};
    det_feed[det.inputNames[0]] = det_tensor;

    const det_results = await det.run(det_feed);
    return det_results[det.outputNames[0]];
}

async function 识别(b, imgH, imgW, rec) {
    const rec_data = Float32Array.from(b.flat(Infinity));

    const rec_tensor = new ort.Tensor("float32", rec_data, [b.length, 3, imgH, imgW]);
    let rec_feed = {};
    rec_feed[rec.inputNames[0]] = rec_tensor;

    const rec_results = await rec.run(rec_feed);
    return rec_results[rec.outputNames[0]];
}

/**
 *
 * @param {ImageData} data 原图
 * @param {number} w 输出宽
 * @param {number} h 输出高
 */
function resize_img(data, w, h) {
    let x = document.createElement("canvas");
    x.width = data.width;
    x.height = data.height;
    x.getContext("2d").putImageData(data, 0, 0);
    let src = document.createElement("canvas");
    src.width = w;
    src.height = h;
    src.getContext("2d").scale(w / data.width, h / data.height);
    src.getContext("2d").drawImage(x, 0, 0);
    return src.getContext("2d").getImageData(0, 0, w, h);
}

function 检测前处理(h, w, image) {
    let ratio = 1;
    if (Math.max(h, w) > limit_side_len) {
        if (h > w) {
            ratio = limit_side_len / h;
        } else {
            ratio = limit_side_len / w;
        }
    }
    let resize_h = h * ratio;
    let resize_w = w * ratio;

    resize_h = Math.max(Math.round(resize_h / 32) * 32, 32);
    resize_w = Math.max(Math.round(resize_w / 32) * 32, 32);
    image = resize_img(image, resize_w, resize_h);
    let src_canvas = document.createElement("canvas");
    src_canvas.width = resize_w;
    src_canvas.height = resize_h;
    let id = new ImageData(image.width, image.height);
    for (let i in id.data) id.data[i] = image.data[i];
    src_canvas.getContext("2d").putImageData(id, 0, 0);

    src0 = cv.imread(src_canvas);

    const transposedData = to_paddle_input(image, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]);
    console.log(image);
    if (dev) {
        document.body.append(src_canvas);
    }
    return { transposedData, resize_w, image, canvas: src_canvas };
}

function 检测后处理(data, w, h, src_canvas) {
    let canvas = document.createElement("canvas");

    var myImageData = new ImageData(w, h);
    for (let i in data) {
        let n = i * 4;
        myImageData.data[n] = myImageData.data[n + 1] = myImageData.data[n + 2] = data[i] * 255;
        myImageData.data[n + 3] = 255;
    }
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").putImageData(myImageData, 0, 0);

    let edge_rect = [];

    let src = cv.imread(canvas);

    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
    cv.threshold(src, src, 120, 200, cv.THRESH_BINARY);
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();

    cv.findContours(src, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    for (let i = 0; i < contours.size(); i++) {
        let cnt = contours.get(i);
        let bbox = cv.boundingRect(cnt);
        // TODO minAreaRect

        let box = [
            [bbox.x, bbox.y],
            [bbox.x + bbox.width, bbox.y],
            [bbox.x + bbox.width, bbox.y + bbox.height],
            [bbox.x, bbox.y + bbox.height],
        ];

        let min_size = 3;
        if (Math.min(bbox.width, bbox.height) >= min_size) {
            let c = document.createElement("canvas");
            let dx = bbox.width * 0.1,
                dy = bbox.height * 1.2;
            c.width = bbox.width + dx * 2;
            c.height = bbox.height + dy * 2;

            let ctx = c.getContext("2d");
            let c0 = src_canvas;
            ctx.drawImage(c0, -bbox.x + dx, -bbox.y + dy);
            if (dev) document.body.append(c);

            edge_rect.push({ box, img: c.getContext("2d").getImageData(0, 0, c.width, c.height) });
        }
    }

    console.log(edge_rect);

    src.delete();
    contours.delete();
    hierarchy.delete();

    src = dst = contours = hierarchy = null;

    return edge_rect;
}

function to_paddle_input(image, mean, std) {
    const imagedata = image.data;
    const [redArray, greenArray, blueArray] = new Array(new Array(), new Array(), new Array());
    let x = 0,
        y = 0;
    for (let i = 0; i < imagedata.length; i += 4) {
        if (!blueArray[y]) blueArray[y] = [];
        if (!greenArray[y]) greenArray[y] = [];
        if (!redArray[y]) redArray[y] = [];
        redArray[y][x] = (imagedata[i] / 255 - mean[0]) / std[0];
        greenArray[y][x] = (imagedata[i + 1] / 255 - mean[1]) / std[1];
        blueArray[y][x] = (imagedata[i + 2] / 255 - mean[2]) / std[2];
        x++;
        if (x == image.width) {
            x = 0;
            y++;
        }
    }

    return [blueArray, greenArray, redArray];
}

function 识别前处理(resize_w, box) {
    /**
     *
     * @param {ImageData} img
     */
    function resize_norm_img(img) {
        imgW = Math.floor(imgH * max_wh_ratio);
        let h = img.height,
            w = img.width;
        let ratio = w / h;
        let resized_w;
        if (Math.ceil(imgH * ratio) > imgW) {
            resized_w = imgW;
        } else {
            resized_w = Math.floor(Math.ceil(imgH * ratio));
        }
        let d = resize_img(img, resized_w, imgH);
        let cc = document.createElement("canvas");
        cc.width = imgW;
        cc.height = imgH;
        cc.getContext("2d").putImageData(d, 0, 0);
        if (dev) document.body.append(cc);
        return cc.getContext("2d").getImageData(0, 0, imgW, imgH);
    }

    let max_wh_ratio = 0;
    for (let r of box) {
        max_wh_ratio = Math.max(r.img.width / r.img.height, max_wh_ratio);
    }
    let b = [];
    for (let r of box) {
        b.push(to_paddle_input(resize_norm_img(r.img), [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]));
    }
    console.log(b);
    return { b, imgH, imgW };
}

function 识别后处理(data, character) {
    let pred_len = data.dims[2];
    let line = [];
    let ml = data.dims[0] - 1;
    for (let l = 0; l < data.data.length; l += pred_len * data.dims[1]) {
        const preds_idx = [];
        const preds_prob = [];

        for (let i = l; i < l + pred_len * data.dims[1]; i += pred_len) {
            const tmpArr = data.data.slice(i, i + pred_len - 1);
            const tmpMax = Math.max(...tmpArr);
            const tmpIdx = tmpArr.indexOf(tmpMax);
            preds_prob.push(tmpMax);
            preds_idx.push(tmpIdx);
        }
        line[ml] = decode(preds_idx, preds_prob, true);
        ml--;
    }
    function decode(text_index, text_prob, is_remove_duplicate) {
        const ignored_tokens = [0];
        const char_list = [];
        const conf_list = [];
        for (let idx = 0; idx < text_index.length; idx++) {
            if (text_index[idx] in ignored_tokens) {
                continue;
            }
            if (is_remove_duplicate) {
                if (idx > 0 && text_index[idx - 1] === text_index[idx]) {
                    continue;
                }
            }
            char_list.push(character[text_index[idx] - 1]);
            if (text_prob) {
                conf_list.push(text_prob[idx]);
            } else {
                conf_list.push(1);
            }
        }
        let text = "";
        let mean = 0;
        if (char_list.length) {
            text = char_list.join("");
            let sum = 0;
            conf_list.forEach((item) => {
                sum += item;
            });
            mean = sum / conf_list.length;
        }
        return { text, mean };
    }
    return line;
}

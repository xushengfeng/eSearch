import { type Border, detectBorders } from "edge_det";

type EdgeWorkerMessage = {
    id: number;
    buffer: ArrayBuffer;
    width: number;
    height: number;
    lowThreshold: number;
    highThreshold: number;
};

type EdgeWorkerResult = {
    id: number;
    borders: Border[];
};

const ctx = self as unknown as {
    onmessage: ((e: MessageEvent<EdgeWorkerMessage>) => void) | null;
    postMessage: (m: EdgeWorkerResult) => void;
};

ctx.onmessage = (e) => {
    const { id, buffer, width, height, lowThreshold, highThreshold } = e.data;
    const borders = detectBorders(new Uint8Array(buffer), width, height, {
        lowThreshold,
        highThreshold,
        minArea: 3,
    });
    ctx.postMessage({ id, borders });
};

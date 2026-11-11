import { renderSend } from "../../../lib/ipc";
import store from "../../../lib/store/renderStore";

export async function writeText(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
}

export async function readText(): Promise<string> {
    return await navigator.clipboard.readText();
}

export async function writeImage(blob: Blob): Promise<void> {
    const buffer = await blob.arrayBuffer();
    // 在复制时读取设置，保证修改后立即生效
    if (store.get("保存.复制为文件")) {
        renderSend("copy_image_file", [buffer, blob.type]);
        return;
    }
    // 通过主进程写入，窗口隐藏或失焦时也可以复制
    renderSend("copy_image", [buffer, blob.type]);
}

export async function readImage(): Promise<Blob | null> {
    try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
            for (const type of item.types) {
                if (type.startsWith("image/")) {
                    return await item.getType(type);
                }
            }
        }
    } catch {}
    return null;
}

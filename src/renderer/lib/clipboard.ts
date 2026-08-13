export async function writeText(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
}

export async function readText(): Promise<string> {
    return await navigator.clipboard.readText();
}

export async function writeImage(blob: Blob): Promise<void> {
    const item = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([item]);
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

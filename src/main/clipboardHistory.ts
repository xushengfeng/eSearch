import { Buffer } from "node:buffer";
import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
    randomUUID,
} from "node:crypto";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ClipboardItem, clipboard, nativeImage, safeStorage } from "electron";
import { t } from "../../lib/translate/translate";
import type { ClipItem } from "../ShareTypes";

export type ClipConfig = {
    dir: string;
    interval: number;
    maxCount: number;
    maxDays: number;
};

type Index = { v: 1; items: ClipItem[] };

type Payload =
    | { type: "text"; text: string; hash: string }
    | { type: "file"; files: string[]; hash: string }
    | { type: "image"; png: Buffer; w: number; h: number; hash: string };

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const DAY = 24 * 60 * 60 * 1000;
const IMAGE_MIMES = ["image/png", "image/jpeg"] as const;
/** 文件列表在系统剪贴板里的原始格式，按优先级排列 */
const FILE_FORMATS: { format: string; encoding: "utf16le" | "utf8" }[] =
    process.platform === "win32"
        ? [
              {
                  format: 'electron application/osclipboard;format="FileNameW"',
                  encoding: "utf16le",
              },
              // Windows 会把 FileNameW 规范化成 text/uri-list，
              // 且部分复制来源只提供 text/uri-list，所以必须一并识别。
              { format: "text/uri-list", encoding: "utf8" },
          ]
        : [{ format: "text/uri-list", encoding: "utf8" }];

function hashOf(data: Buffer | string): string {
    return createHash("sha1").update(data).digest("hex");
}

function encrypt(key: Buffer, data: Buffer): Buffer {
    const iv = randomBytes(IV_LEN);
    const c = createCipheriv(ALGO, key, iv);
    const body = Buffer.concat([c.update(data), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), body]);
}

function decrypt(key: Buffer, data: Buffer): Buffer {
    const iv = data.subarray(0, IV_LEN);
    const tag = data.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const body = data.subarray(IV_LEN + TAG_LEN);
    const d = createDecipheriv(ALGO, key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]);
}

/** 只接受本机路径，避免把复制来的网址当成文件记录 */
function isLocalPath(s: string): boolean {
    if (s.startsWith("file://")) return true;
    if (/^[a-zA-Z]:[\\/]/.test(s)) return true; // Windows 盘符
    if (s.startsWith("\\\\")) return true; // UNC
    return s.startsWith("/"); // POSIX 绝对路径
}

function parseFileList(raw: Buffer, encoding: "utf16le" | "utf8"): string[] {
    return raw
        .toString(encoding)
        .split(String.fromCharCode(0))
        .flatMap((s) => s.split(/\r?\n/))
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("#"))
        .map((s) => {
            if (!s.startsWith("file://")) return s;
            try {
                return fileURLToPath(s);
            } catch {
                return s;
            }
        })
        .filter(isLocalPath);
}

/**
 * 剪贴板历史：轮询采集、加密落盘、保留策略与去重。
 * 数据默认加密（AES-256-GCM），密钥由 safeStorage 保管；
 * safeStorage 不可用时降级为明文存储，并给出警告。
 */
export default class ClipboardHistory {
    private cfg: ClipConfig;
    private keyPath: string;
    private key: Buffer | null = null;
    private items: ClipItem[] = [];
    private byHash = new Map<string, ClipItem>();
    private timer: NodeJS.Timeout | null = null;
    private paused: boolean;
    private busy = false;
    /** 上一次采集到的剪贴板签名，用于判断「没有变化」 */
    private lastSeen = "";
    /** 最近一次由本程序写入剪贴板的签名，用于抑制回声 */
    private lastWritten = "";
    private warning: string | null = null;
    private listeners = new Set<() => void>();
    /** 暂停状态变化时通知外部持久化 */
    onPausedChange: ((paused: boolean) => void) | null = null;

    constructor(o: { userData: string; cfg: ClipConfig; paused: boolean }) {
        this.keyPath = join(o.userData, "clipboardHistory.key");
        this.cfg = o.cfg;
        this.paused = o.paused;
        this.loadKey();
        this.load();
    }

    /** safeStorage 不可用时的降级警告，null 表示已加密 */
    getWarning() {
        return this.warning;
    }

    isPaused() {
        return this.paused;
    }

    getConfig() {
        return this.cfg;
    }

    /** 更新采集配置（不含目录，目录变更走 setDir） */
    setConfig(cfg: Omit<ClipConfig, "dir">) {
        const intervalChanged = this.cfg.interval !== cfg.interval;
        this.cfg.interval = cfg.interval;
        this.cfg.maxCount = cfg.maxCount;
        this.cfg.maxDays = cfg.maxDays;
        if (intervalChanged && this.timer) {
            this.stop();
            this.start();
        }
        const before = this.items.length;
        this.evict();
        if (this.items.length !== before) this.save();
        this.emit();
    }

    onChange(cb: () => void) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private emit() {
        for (const cb of this.listeners) cb();
    }

    // ── 密钥与文件 ──────────────────────────────────────────────

    private loadKey() {
        if (!safeStorage.isEncryptionAvailable()) {
            this.key = null;
            this.warning = t("当前系统不支持加密存储，剪贴板历史将以明文保存");
            return;
        }
        if (existsSync(this.keyPath)) {
            try {
                const raw = safeStorage.decryptString(
                    readFileSync(this.keyPath),
                );
                const key = Buffer.from(raw, "base64");
                if (key.length === 32) {
                    this.key = key;
                    return;
                }
            } catch {}
        }
        const key = randomBytes(32);
        try {
            writeFileSync(
                this.keyPath,
                safeStorage.encryptString(key.toString("base64")),
            );
            this.key = key;
        } catch {
            this.key = null;
            this.warning = t("密钥保存失败，剪贴板历史将以明文保存");
        }
    }

    private writeFile(path: string, data: Buffer) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, this.key ? encrypt(this.key, data) : data);
    }

    private readFile(path: string): Buffer | null {
        if (!existsSync(path)) return null;
        const raw = readFileSync(path);
        if (!this.key) return raw;
        try {
            return decrypt(this.key, raw);
        } catch {
            return null;
        }
    }

    private indexPath() {
        return join(this.cfg.dir, "index.bin");
    }

    private imagePath(id: string) {
        return join(this.cfg.dir, "images", `${id}.bin`);
    }

    // ── 索引读写 ────────────────────────────────────────────────

    private load() {
        const raw = this.readFile(this.indexPath());
        if (!raw) return;
        try {
            const data = JSON.parse(raw.toString()) as Index;
            this.items = Array.isArray(data.items) ? data.items : [];
        } catch {
            this.items = [];
        }
        this.reindex();
    }

    private reindex() {
        this.byHash.clear();
        for (const it of this.items) this.byHash.set(it.hash, it);
    }

    private save() {
        const data = Buffer.from(
            JSON.stringify({ v: 1, items: this.items } satisfies Index),
        );
        try {
            this.writeFile(this.indexPath(), data);
        } catch (e) {
            console.error("剪贴板历史保存失败", e);
        }
    }

    // ── 采集 ────────────────────────────────────────────────────

    start() {
        if (this.timer) return;
        const run = () => {
            this.tick().catch((e) => console.error("剪贴板采集失败", e));
        };
        run();
        this.timer = setInterval(run, Math.max(100, this.cfg.interval));
    }

    stop() {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.timer = null;
    }

    setPaused(paused: boolean) {
        if (this.paused === paused) return;
        this.paused = paused;
        if (!paused) this.lastSeen = "";
        this.onPausedChange?.(paused);
        this.emit();
    }

    private async readFiles() {
        const items = await clipboard.read();
        for (const { format, encoding } of FILE_FORMATS) {
            const item = items.find((i) => i.types.includes(format));
            if (!item) continue;
            try {
                const blob = (await item.getType(format)) as Blob;
                if (!(blob instanceof Blob)) continue;
                const list = parseFileList(
                    Buffer.from(await blob.arrayBuffer()),
                    encoding,
                );
                if (list.length > 0) return list;
            } catch {}
        }
        return [];
    }

    private async readImage() {
        const items = await clipboard.read();
        for (const mime of IMAGE_MIMES) {
            const item = items.find((i) => i.types.includes(mime));
            if (!item) continue;
            const data = await item.getType(mime);
            if (!("arrayBuffer" in data)) continue;
            const buf = Buffer.from(await data.arrayBuffer());
            if (buf.length === 0) continue;
            const img = nativeImage.createFromBuffer(buf);
            if (img.isEmpty()) continue;
            const size = img.getSize();
            return {
                png: mime === "image/png" ? buf : img.toPNG(),
                w: size.width,
                h: size.height,
            };
        }
        return null;
    }

    private async readPayload(): Promise<Payload | null> {
        const files = await this.readFiles();
        if (files.length > 0)
            return { type: "file", files, hash: hashOf(files.join("\u0000")) };
        const image = await this.readImage();
        if (image)
            return {
                type: "image",
                png: image.png,
                w: image.w,
                h: image.h,
                hash: hashOf(image.png),
            };
        const text = await clipboard.readText();
        if (text) return { type: "text", text, hash: hashOf(text) };
        return null;
    }

    private async tick() {
        if (this.paused || this.busy) return;
        this.busy = true;
        try {
            const payload = await this.readPayload();
            if (!payload) {
                this.lastSeen = "";
                return;
            }
            if (payload.hash === this.lastSeen) return;
            this.lastSeen = payload.hash;
            // 回声抑制：本程序刚写进剪贴板的内容不再记录
            if (payload.hash === this.lastWritten) return;

            const exist = this.byHash.get(payload.hash);
            if (exist) {
                // 内容重复：移到最前并刷新时间，固定状态保持不变
                exist.time = Date.now();
                exist.deleted = false;
                this.save();
                this.emit();
                return;
            }
            this.add(payload);
        } finally {
            this.busy = false;
        }
    }

    private add(payload: Payload) {
        const item: ClipItem = {
            id: randomUUID().slice(0, 8),
            type: payload.type,
            time: Date.now(),
            pinned: false,
            deleted: false,
            hash: payload.hash,
        };
        if (payload.type === "text") item.text = payload.text;
        else if (payload.type === "file") item.files = payload.files;
        else {
            item.image = `${item.id}.bin`;
            item.w = payload.w;
            item.h = payload.h;
            try {
                this.writeFile(this.imagePath(item.id), payload.png);
            } catch (e) {
                console.error("剪贴板图片保存失败", e);
                return;
            }
        }
        this.items.unshift(item);
        this.byHash.set(item.hash, item);
        this.evict();
        this.save();
        this.emit();
    }

    /** 自动淘汰：固定条目豁免，回收站条目不参与计数 */
    private evict() {
        const now = Date.now();
        const drop: ClipItem[] = [];
        const sorted = [...this.items].sort((a, b) => b.time - a.time);
        let count = 0;
        for (const it of sorted) {
            if (it.pinned || it.deleted) continue;
            count++;
            const tooOld =
                this.cfg.maxDays > 0 && now - it.time > this.cfg.maxDays * DAY;
            const tooMany = this.cfg.maxCount > 0 && count > this.cfg.maxCount;
            if (tooOld || tooMany) drop.push(it);
        }
        if (drop.length === 0) return;
        for (const it of drop) this.removeFile(it);
        const dropSet = new Set(drop);
        this.items = this.items.filter((i) => !dropSet.has(i));
        this.reindex();
    }

    private removeFile(item: ClipItem) {
        if (!item.image) return;
        try {
            rmSync(this.imagePath(item.id), { force: true });
        } catch {}
    }

    // ── 对外操作 ────────────────────────────────────────────────

    /** 列表，默认不含回收站条目 */
    list(includeDeleted = false): ClipItem[] {
        return this.items
            .filter((i) => includeDeleted || !i.deleted)
            .sort(
                (a, b) =>
                    Number(b.pinned) - Number(a.pinned) || b.time - a.time,
            );
    }

    /** 回收站列表：只含已被删除的条目 */
    listTrash(): ClipItem[] {
        return this.items
            .filter((i) => i.deleted)
            .sort((a, b) => b.time - a.time);
    }

    getImage(id: string): Buffer | null {
        const item = this.items.find((i) => i.id === id);
        if (!item || item.type !== "image") return null;
        return this.readFile(this.imagePath(id));
    }

    setPinned(id: string, pinned: boolean) {
        const item = this.items.find((i) => i.id === id);
        if (!item) return;
        item.pinned = pinned;
        this.save();
        this.emit();
    }

    /** 软删除：移入回收站 */
    remove(id: string) {
        const item = this.items.find((i) => i.id === id);
        if (!item) return;
        item.deleted = true;
        this.save();
        this.emit();
    }

    restore(id: string) {
        const item = this.items.find((i) => i.id === id);
        if (!item) return;
        item.deleted = false;
        item.time = Date.now();
        this.save();
        this.emit();
    }

    /** 永久删除 */
    purge(id: string) {
        const item = this.items.find((i) => i.id === id);
        if (!item) return;
        this.removeFile(item);
        this.items = this.items.filter((i) => i !== item);
        this.reindex();
        this.save();
        this.emit();
    }

    emptyTrash() {
        for (const it of this.items) {
            if (it.deleted) this.removeFile(it);
        }
        this.items = this.items.filter((i) => !i.deleted);
        this.reindex();
        this.save();
        this.emit();
    }

    /** 清空：只清未固定的条目（移入回收站） */
    clear() {
        let changed = false;
        for (const it of this.items) {
            if (it.pinned || it.deleted) continue;
            it.deleted = true;
            changed = true;
        }
        if (!changed) return;
        this.save();
        this.emit();
    }

    /** 把某条内容写回系统剪贴板 */
    async copyBack(id: string) {
        const item = this.items.find((i) => i.id === id);
        if (!item) return;
        if (item.type === "text") {
            await clipboard.writeText(item.text ?? "");
        } else if (item.type === "file") {
            const files = item.files ?? [];
            const entries: Record<string, Blob> = {
                "text/uri-list": new Blob(
                    [files.map((f) => pathToFileURL(f).href).join("\r\n")],
                    { type: "text/uri-list" },
                ),
                "text/plain": new Blob([files.join("\n")], {
                    type: "text/plain",
                }),
            };
            if (process.platform === "win32") {
                const raw = Buffer.from(
                    `${files.join("\u0000")}\u0000`,
                    "utf16le",
                );
                entries['electron application/osclipboard;format="FileNameW"'] =
                    new Blob([raw]);
            }
            try {
                await clipboard.write([new ClipboardItem(entries)]);
            } catch {
                await clipboard.writeText(files.join("\n"));
            }
        } else {
            const png = this.getImage(id);
            if (!png) return;
            await clipboard.write([
                new ClipboardItem({
                    "image/png": new Blob([png], { type: "image/png" }),
                }),
            ]);
        }
        this.lastWritten = item.hash;
        this.lastSeen = item.hash;
    }

    // ── 目录迁移 ────────────────────────────────────────────────

    /** 更换存储目录：把已有数据搬过去 */
    setDir(dir: string) {
        if (dir === this.cfg.dir) return;
        const oldDir = this.cfg.dir;
        const raw = this.readFileFrom(oldDir, "index.bin");
        const images = new Map<string, Buffer>();
        for (const it of this.items) {
            if (!it.image) continue;
            const data = this.readFileFrom(oldDir, `images/${it.id}.bin`);
            if (data) images.set(it.id, data);
        }
        this.cfg.dir = dir;
        try {
            if (raw) this.writeFile(this.indexPath(), raw);
            for (const [id, data] of images)
                this.writeFile(this.imagePath(id), data);
        } catch (e) {
            // 新目录写失败：保留旧目录与旧配置，避免数据两头落空
            console.error("剪贴板历史目录迁移失败", e);
            this.cfg.dir = oldDir;
            this.emit();
            return;
        }
        this.cleanupOldDir(oldDir);
        this.emit();
    }

    /**
     * 清理旧目录。存储目录可以由用户指定为任意路径，
     * 因此这里**只删除本程序自己创建的文件**（index.bin 与 images/<本程序生成的 id>.bin），
     * 绝不做递归删除，目录非空时也不会移除目录本身。
     */
    private cleanupOldDir(dir: string) {
        try {
            rmSync(join(dir, "index.bin"), { force: true });
            for (const it of this.items) {
                if (!it.image) continue;
                rmSync(join(dir, "images", `${it.id}.bin`), { force: true });
            }
            // 只在本程序独占的 images 子目录已空时才移除它
            rmSync(join(dir, "images"), { recursive: false, force: true });
            // 目录已空才移除；非空说明里面还有用户的其他内容，保持原样
            rmSync(dir, { recursive: false, force: true });
        } catch {}
    }

    private readFileFrom(dir: string, rel: string): Buffer | null {
        const p = join(dir, rel);
        if (!existsSync(p)) return null;
        const raw = readFileSync(p);
        if (!this.key) return raw;
        try {
            return decrypt(this.key, raw);
        } catch {
            return null;
        }
    }

    dispose() {
        this.stop();
        this.listeners.clear();
    }
}

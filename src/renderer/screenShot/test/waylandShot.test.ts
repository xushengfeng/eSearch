import * as fs from "node:fs";
import { waylandShotInit } from "../waylandShot";

const TIMEOUT = 30000;

async function main() {
    if (process.env.XDG_SESSION_TYPE !== "wayland") {
        console.log("跳过: 需要 Wayland 环境");
        process.exit(0);
    }

    console.log("初始化 waylandShot...");
    const { capture } = await waylandShotInit();

    console.log("调用 capture...");
    console.log("如果弹出截屏界面，请直接按 Esc 取消或选择区域");

    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("超时")), TIMEOUT),
    );

    try {
        const path = await Promise.race([capture(), timeoutPromise]);

        if (!path) {
            console.log("返回 undefined (用户可能取消了)");
            process.exit(0);
        }

        console.log("截图路径:", path);

        if (!fs.existsSync(path)) {
            console.error("失败: 文件不存在");
            process.exit(1);
        }

        const stats = fs.statSync(path);
        console.log("文件大小:", stats.size, "bytes");

        // fs.unlinkSync(path);
        console.log("测试通过");
        process.exit(1);
    } catch (err: unknown) {
        if (err instanceof Error && err.message === "超时") {
            console.error(`失败: ${TIMEOUT / 1000}秒内未响应`);
            console.log("可能原因: xdg-desktop-portal 后端需要用户交互");
        } else {
            console.error("失败:", err);
        }
        process.exit(1);
    }
}

main();

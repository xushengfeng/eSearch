import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // 这个文件是手动运行的 Wayland 截图脚本，不是 vitest 用例
        exclude: ["**/node_modules/**", "src/renderer/screenShot/test/**"],
    },
});

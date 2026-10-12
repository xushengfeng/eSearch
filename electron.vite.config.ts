import { tmpdir } from "node:os";
import * as path from "node:path";
import { defineConfig } from "electron-vite";
import { analyzer } from "vite-bundle-analyzer";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

export default defineConfig(({ mode }) => ({
    main: {
        build: {
            minify: false,
        },
    },
    renderer: {
        build: {
            rollupOptions: {
                input: {
                    editor: path.resolve(__dirname, "src/renderer/editor.html"),
                    clip: path.resolve(__dirname, "src/renderer/capture.html"),
                    setting: path.resolve(
                        __dirname,
                        "src/renderer/setting.html",
                    ),
                    ding: path.resolve(__dirname, "src/renderer/ding.html"),
                    recorder: path.resolve(
                        __dirname,
                        "src/renderer/recorder.html",
                    ),
                    recorderTip: path.resolve(
                        __dirname,
                        "src/renderer/recorderTip.html",
                    ),
                    browser_bg: path.resolve(
                        __dirname,
                        "src/renderer/browser_bg.html",
                    ),
                    translator: path.resolve(
                        __dirname,
                        "src/renderer/translator.html",
                    ),
                    translate: path.resolve(
                        __dirname,
                        "src/renderer/translate.html",
                    ),
                    photoEditor: path.resolve(
                        __dirname,
                        "src/renderer/photoEditor.html",
                    ),
                    videoEditor: path.resolve(
                        __dirname,
                        "src/renderer/videoEditor.html",
                    ),
                    aiVision: path.resolve(
                        __dirname,
                        "src/renderer/aiVision.html",
                    ),
                    clipboardHistory: path.resolve(
                        __dirname,
                        "src/renderer/clipboardHistory.html",
                    ),
                },
            },
            assetsInlineLimit: 0,
            minify: false,
            sourcemap: true,
        },
        plugins: [
            ViteImageOptimizer({
                cache: true,
                cacheLocation: path.join(tmpdir(), "eSearch_build"),
                logStats: false,
                include: /.*\svg$/,
            }),
            mode === "analyze" ? analyzer() : undefined,
        ],
        define: {
            "process.platform": "process.platform",
        },
    },
}));

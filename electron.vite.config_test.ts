import { defineConfig } from "electron-vite";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import * as path from "node:path";
import { tmpdir } from "node:os";

export default defineConfig({
    main: {
        build: {
            minify: "esbuild",
        },
    },
    renderer: {
        build: {
            rollupOptions: {
                input: {
                    editor: path.resolve(__dirname, "src/renderer/ui_test.html"),
                },
            },
            assetsInlineLimit: 0,
            minify: "esbuild",
            sourcemap: true,
        },
        plugins: [
            ViteImageOptimizer({
                cache: true,
                cacheLocation: path.join(tmpdir(), "eSearch_build"),
                logStats: false,
            }),
        ],
    },
});

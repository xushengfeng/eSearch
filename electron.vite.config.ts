import { defineConfig } from "electron-vite";
import path from "path";

export default defineConfig({
    main: {
        build: {
            rollupOptions: {
                external: ["@electron-toolkit/utils"],
            },
        },
    },
    renderer: {
        build: {
            rollupOptions: {
                input: {
                    index: path.resolve(__dirname, "src/renderer/index.html"),
                    clip: path.resolve(__dirname, "src/renderer/capture.html"),
                    setting: path.resolve(__dirname, "src/renderer/setting.html"),
                    help: path.resolve(__dirname, "src/renderer/help.html"),
                    ding: path.resolve(__dirname, "src/renderer/ding.html"),
                    recorder: path.resolve(__dirname, "src/renderer/recorder.html"),
                    browser_bg: path.resolve(__dirname, "src/renderer/browser_bg.html"),
                },
            },
        },
    },
});

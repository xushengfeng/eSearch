/**
 * @type import("electron-builder").Configuration
 */
let build = {
    appId: "com.esearch.app",
    directories: {
        output: "build",
    },
    compression: "maximum",
    icon: "./assets/logo",
    electronDownload: {
        mirror: "https://npmmirror.com/mirrors/electron/",
    },
    npmRebuild: false,
    fileAssociations: [
        {
            ext: "svg",
            mimeType: "image/svg+xml",
            role: "Editor",
        },
        {
            ext: "png",
            mimeType: "image/png",
            role: "Editor",
        },
        {
            ext: "jpg",
            mimeType: "image/jpeg",
            role: "Editor",
        },
    ],
    asar: false,
    artifactName: "${productName}-${version}-${platform}-${arch}.${ext}",
    beforePack: "./before_pack.js",
    linux: {
        category: "Utility",
        target: ["tar.gz", "deb", "rpm", "AppImage"],
        files: [
            "!.vscode",
            "!.github",
            "!assets/logo/icon.icns",
            "!assets/logo/icon.ico",
            "!src",
            "!node_modules/onnxruntime-node/bin/napi-v3/win32",
            "!node_modules/onnxruntime-node/bin/napi-v3/darwin",
            "!node_modules/onnxruntime-web",
        ],
    },
    deb: {
        depends: ["ffmpeg"],
    },
    rpm: {
        depends: ["ffmpeg"],
    },
    mac: {
        files: [
            "!lib/gtk-open-with",
            "!lib/kde-open-with",
            "!.vscode",
            "!.github",
            "!assets/logo/1024x1024.png",
            "!assets/logo/512x512.png",
            "!assets/logo/icon.ico",
            "!src",
            "!node_modules/onnxruntime-node/bin/napi-v3/win32",
            "!node_modules/onnxruntime-node/bin/napi-v3/linux",
            "!node_modules/onnxruntime-web",
        ],
        target: [
            {
                target: "dmg",
                arch: ["x64", "arm64"],
            },
            {
                target: "zip",
                arch: ["x64", "arm64"],
            },
        ],
    },
    win: {
        icon: "./assets/logo/icon.ico",
        target: [
            {
                target: "nsis",
                arch: ["x64", "arm64"],
            },
            {
                target: "zip",
                arch: ["x64", "arm64"],
            },
        ],
        files: [
            "!lib/gtk-open-with",
            "!lib/kde-open-with",
            "!.vscode",
            "!.github",
            "!assets/logo/icon.icns",
            "!assets/logo/1024x1024.png",
            "!assets/logo/512x512.png",
            "!src",
            "!node_modules/onnxruntime-node/bin/napi-v3/linux",
            "!node_modules/onnxruntime-node/bin/napi-v3/darwin",
            "!node_modules/onnxruntime-web",
        ],
    },
    nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
    },
};

module.exports = build;

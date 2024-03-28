const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

var arch = (process.env["npm_config_arch"] || process.env["M_ARCH"] || process.arch) == "arm64" ? ["arm64"] : ["x64"];
/**
 * @type import("electron-builder").Configuration
 */
let build = {
    appId: "com.esearch.app",
    executableName: "e-search",
    directories: {
        output: "build",
    },
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
    artifactName: "${productName}-${version}-${platform}-" + arch[0] + ".${ext}",
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
                arch: arch,
            },
            {
                target: "zip",
                arch: arch,
            },
        ],
    },
    dmg: {
        writeUpdateInfo: false,
    },
    win: {
        icon: "./assets/logo/icon.ico",
        target: [
            {
                target: "nsis",
                arch: arch,
            },
            {
                target: "zip",
                arch: arch,
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
        differentialPackage: false,
    },
    afterPack: async (c) => {
        const appPath = path.join(c.appOutDir, "resources/app");

        const outputFilePath = path.join(c.outDir, `app-${process.platform}-${process.arch}`);

        const output = fs.createWriteStream(outputFilePath);
        const archive = archiver("zip", {
            zlib: { level: 9 },
        });

        archive.pipe(output);
        archive.directory(appPath, false);
        archive.finalize();

        return new Promise((rj) => {
            output.on("close", () => {
                console.log("生成核心包");
                rj();
            });
        });
    },
};

let onnxFilter = arch[0] === "arm64" ? "x64" : "arm64";
if (process.platform === "linux") {
    build.linux.files.push(`!node_modules/onnxruntime-node/bin/napi-v3/linux/${onnxFilter}`);
} else if (process.platform === "win32") {
    build.win.files.push(`!node_modules/onnxruntime-node/bin/napi-v3/win32/${onnxFilter}`);
} else if (process.platform === "darwin") {
    build.mac.files.push(`!node_modules/onnxruntime-node/bin/napi-v3/darwin/${onnxFilter}`);
}

module.exports = build;

const release: Record<string, Record<string, string[]>> = {
    win32: { gh: ["exe", "zip"], arch: ["x64", "arm64"] },
    linux: { gh: ["AppImage", "deb", "rpm", "tar.gz"], arch: ["x64", "arm64"] },
    darwin: { gh: ["dmg", "zip"], arch: ["x64", "arm64"] },
};

function getUrl(url: string) {
    const version = require("../package.json").version;
    let t = "| | Windows | macOS | Linux|\n| --- | --- | --- | --- |\n";
    for (const arch of ["x64", "arm64"]) {
        t += `|${arch}| `;
        for (const p of ["win32", "darwin", "linux"]) {
            if (!release[p].arch.includes(arch)) continue;
            t += `${(release[p].gh || []).map((i) => `[${i}](${url.replaceAll("$v", version).replace("$arch", arch).replace("$p", p).replace("$h", i)})`).join(" ")}|`;
        }
        t += "\n";
    }
    return t;
}

console.log(
    "⚡镜像下载：\n",
    getUrl(
        "https://gh-proxy.com/https://github.com/xushengfeng/eSearch/releases/download/$v/eSearch-$v-$p-$arch.$h",
    ),
);

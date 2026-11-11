export { githubMirrorList };

// 用 pnpm check:github-mirror 定期检查可用性
const githubMirrorList = {
    api: [
        "https://gh-proxy.org/https://api.github.com/",
        "https://gh.2i.gs/https://api.github.com/",
    ],
    base: [
        "https://gh-proxy.com/https://github.com/",
        "https://ghfast.top/https://github.com/",
        "https://gh.2i.gs/https://github.com/",
        "https://gh-proxy.org/https://github.com/",
        "https://ghproxy.net/https://github.com/",
        "https://ghfile.geekertao.top/https://github.com/",
    ],
};

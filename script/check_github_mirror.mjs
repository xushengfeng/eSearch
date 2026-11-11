// 用法: pnpm check:github-mirror [--api|--base] [--json] [--timeout 15000]
import { githubMirrorList } from "../lib/github_mirror.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const only = args.includes("--api")
    ? "api"
    : args.includes("--base")
      ? "base"
      : null;

const timeoutIndex = args.indexOf("--timeout");
const timeoutArg =
    timeoutIndex >= 0 ? Number(args[timeoutIndex + 1]) : Number.NaN;
const timeout =
    Number.isFinite(timeoutArg) && timeoutArg > 0 ? timeoutArg : 15_000;

const apiTarget = "repos/xushengfeng/eSearch/releases/latest";
const baseTarget =
    "xushengfeng/eSearch-OCR/releases/download/4.0.0/ppocr_v6_tiny.zip";
const userAgent = "eSearch-github-mirror-check";

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

async function checkApi(mirror) {
    const started = performance.now();
    try {
        const response = await fetch(`${mirror}${apiTarget}`, {
            headers: {
                Accept: "application/vnd.github+json",
                "User-Agent": userAgent,
            },
            signal: AbortSignal.timeout(timeout),
        });
        const text = await response.text();
        const ms = Math.round(performance.now() - started);
        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                ms,
                error: `HTTP ${response.status} ${response.statusText}`,
            };
        }
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            return {
                ok: false,
                status: response.status,
                ms,
                error: "响应不是 JSON",
            };
        }
        if (typeof data?.tag_name !== "string") {
            return {
                ok: false,
                status: response.status,
                ms,
                error: "响应不是 GitHub Release",
            };
        }
        return {
            ok: true,
            status: response.status,
            ms,
            detail: data.tag_name,
        };
    } catch (error) {
        return {
            ok: false,
            status: undefined,
            ms: Math.round(performance.now() - started),
            error: errorMessage(error),
        };
    }
}

async function checkBase(mirror) {
    const started = performance.now();
    try {
        const response = await fetch(`${mirror}${baseTarget}`, {
            headers: {
                Range: "bytes=0-0",
                "User-Agent": userAgent,
            },
            redirect: "follow",
            signal: AbortSignal.timeout(timeout),
        });
        const ms = Math.round(performance.now() - started);
        const type = response.headers.get("content-type") ?? "";
        const range =
            response.headers.get("content-range") ??
            response.headers.get("content-length") ??
            "";
        await response.body?.cancel();
        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                ms,
                error: `HTTP ${response.status} ${response.statusText}`,
            };
        }
        if (type.includes("text/html")) {
            return {
                ok: false,
                status: response.status,
                ms,
                error: "返回了 HTML，可能不是文件代理",
            };
        }
        return {
            ok: true,
            status: response.status,
            ms,
            detail: range || type,
        };
    } catch (error) {
        return {
            ok: false,
            status: undefined,
            ms: Math.round(performance.now() - started),
            error: errorMessage(error),
        };
    }
}

async function check(type) {
    const list = githubMirrorList[type];
    const checker = type === "api" ? checkApi : checkBase;
    return Promise.all(
        list.map(async (mirror) => ({ mirror, ...(await checker(mirror)) })),
    );
}

const types = only ? [only] : ["api", "base"];
const results = Object.fromEntries(
    await Promise.all(types.map(async (type) => [type, await check(type)])),
);

if (json) {
    console.log(JSON.stringify(results, null, 2));
} else {
    for (const type of types) {
        console.log(
            `\n${type === "api" ? "GitHub API 镜像" : "GitHub 文件镜像"}`,
        );
        for (const result of results[type]) {
            if (result.ok) {
                console.log(
                    `  ✔ ${result.mirror}  ${result.status} ${(result.ms / 1000).toFixed(1)}s ${result.detail}`,
                );
            } else {
                console.log(
                    `  ✘ ${result.mirror}  ${result.status ?? "-"} ${(result.ms / 1000).toFixed(1)}s ${result.error}`,
                );
            }
        }
    }
}

const failed = types.flatMap((type) =>
    results[type].filter((result) => !result.ok),
);
if (failed.length > 0) {
    console.error(`\n有 ${failed.length} 个镜像不可用`);
    process.exitCode = 1;
} else if (!json) {
    console.log("\n全部镜像可用");
}

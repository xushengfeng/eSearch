import { dbusClient, dbusIO, type dbusMessage, MessageType } from "myde-dbus";

const net = require("node:net") as typeof import("node:net");
const { randomUUID } = require("node:crypto") as typeof import("node:crypto");
const { fileURLToPath } = require("node:url") as typeof import("node:url");

const destination = "org.freedesktop.portal.Desktop";
const requestInterface = "org.freedesktop.portal.Request";
const responseMatch = `type='signal',sender='${destination}',interface='${requestInterface}',member='Response'`;
const responseTimeout = 60_000;

/** 从 Response 信号中取出截图文件 uri */
function responseUri(body: unknown[]) {
    const [code, results] = body as [
        number,
        [string, { value?: unknown }][] | undefined,
    ];
    if (code !== 0 || !results) return;
    for (const [key, value] of results) {
        if (key !== "uri") continue;
        const uri = Array.isArray(value.value) ? value.value[0] : value.value;
        return typeof uri === "string" ? uri : undefined;
    }
}

export async function waylandShotInit(sessionBusPath: string) {
    const socket = new net.Socket();

    await new Promise<void>((resolve, reject) => {
        socket.once("error", reject);
        socket.connect(sessionBusPath, () => resolve());
    });

    const io = new dbusIO({ socket: socket });
    await io.connect();

    const client = new dbusClient({ io });
    const meta = await client.getMetaInterface();
    const screenshot = await (await client.getService(destination)).getObject(
        "/org/freedesktop/portal/desktop",
    );
    const screenshotIface = await screenshot.getInterface(
        "org.freedesktop.portal.Screenshot",
    );

    // 在发请求前订阅，Portal 请求可能在 Screenshot 返回前就已完成
    await meta.AddMatch(responseMatch);

    return {
        capture: async (): Promise<string | undefined> => {
            // Portal 用 sender + handle_token 组成 Request 路径，token 不能重复
            const token = `esearch_${randomUUID().replaceAll("-", "")}`;

            let requestPath: string | undefined;
            const earlyResponses = new Map<string, unknown[]>();
            let resolveResponse: (body: unknown[] | undefined) => void =
                () => {};
            const response = new Promise<unknown[] | undefined>((resolve) => {
                resolveResponse = resolve;
            });
            const timer = setTimeout(
                () => resolveResponse(undefined),
                responseTimeout,
            );
            const onMessage = (message: dbusMessage) => {
                if (
                    message.getType() !== MessageType.Signal ||
                    message.getInterface() !== requestInterface ||
                    message.getMember() !== "Response"
                )
                    return;
                const path = message.getPath();
                if (!path) return;
                if (path === requestPath) resolveResponse(message.getBody());
                else if (!requestPath)
                    earlyResponses.set(path, message.getBody());
            };
            io.addMessageHandler(onMessage);

            try {
                const [handle] = await screenshotIface
                    .call("Screenshot", "sa{sv}", "", [
                        ["handle_token", { signature: "s", value: token }],
                        ["interactive", { signature: "b", value: false }],
                    ])
                    .as<"o">();
                requestPath = handle;
                const early = earlyResponses.get(handle);
                earlyResponses.clear();
                if (early) resolveResponse(early);

                const body = await response;
                const uri = body && responseUri(body);
                if (!uri) return;
                return uri.startsWith("file://") ? fileURLToPath(uri) : uri;
            } catch (error) {
                console.error("Wayland screenshot failed:", error);
                return undefined;
            } finally {
                clearTimeout(timer);
                io.removeMessageHandler(onMessage);
            }
        },
    };
}

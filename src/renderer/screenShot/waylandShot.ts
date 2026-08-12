import { dbusClient, dbusIO } from "myde-dbus";
const net = require("node:net") as typeof import("node:net");

export async function waylandShotInit() {
    const socket = new net.Socket();

    await new Promise((resolve) =>
        socket.connect("/run/user/1000/bus", () => resolve(0)),
    );

    const io = new dbusIO({ socket: socket });
    await io.connect();

    const client = new dbusClient({ io });

    return {
        capture: async (): Promise<string | undefined> => {
            try {
                const service = await client.getService(
                    "org.freedesktop.portal.Desktop",
                );

                let screenshotUri: string | undefined;
                let responseReceived = false;

                // 调用 Screenshot 方法，返回 Request 对象路径
                const screenshotObj = await service.getObject(
                    "/org/freedesktop/portal/desktop",
                );
                const screenshotIface = await screenshotObj.getInterface(
                    "org.freedesktop.portal.Screenshot",
                );

                // 获取返回的 Request 对象路径
                const result = await screenshotIface
                    .call("Screenshot", "sa{sv}", "", [
                        ["handle_token", { signature: "s", value: "esearch" }],
                        ["interactive", { signature: "b", value: false }],
                    ])
                    .as<"o">();

                const requestPath = result[0];

                // 在 Request 对象上监听 Response 信号
                const requestObj = await service.getObject(requestPath);
                const requestIface = await requestObj.getInterface(
                    "org.freedesktop.portal.Request",
                );

                const unsubscribe = await requestIface.on(
                    "Response",
                    (...args: unknown[]) => {
                        const responseCode = args[0] as number;
                        const results = args[1] as
                            | [string, { signature: string; value: unknown }][]
                            | undefined;

                        if (responseCode === 0 && results) {
                            for (const [key, val] of results) {
                                if (key === "uri") {
                                    // val.value 可能是字符串或数组
                                    screenshotUri = Array.isArray(val.value)
                                        ? (val.value[0] as string)
                                        : (val.value as string);
                                }
                            }
                        }
                        responseReceived = true;
                    },
                );

                const timeout = 3000;
                const startTime = Date.now();
                while (!responseReceived && Date.now() - startTime < timeout) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }

                unsubscribe();

                if (screenshotUri) {
                    if (screenshotUri.startsWith("file://")) {
                        return screenshotUri.slice(7);
                    }
                    return screenshotUri;
                }

                return undefined;
            } catch (error) {
                console.error("Wayland screenshot failed:", error);
                return undefined;
            }
        },
    };
}

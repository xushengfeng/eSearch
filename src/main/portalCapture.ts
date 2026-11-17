import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Message, Variant } from "dbus-next";
import { desktopCapturer, nativeImage, screen } from "electron";
import type { PortalCapture } from "../../lib/ipc";
import { isWaylandSession } from "../../lib/wayland";

const destination = "org.freedesktop.portal.Desktop";
const path = "/org/freedesktop/portal/desktop";
const requestInterface = "org.freedesktop.portal.Request";

async function screenshotUri(): Promise<string> {
    const { Message, MessageType, sessionBus, Variant } =
        require("dbus-next") as typeof import("dbus-next");
    const bus = sessionBus();
    const token = `esearch_${randomUUID().replaceAll("-", "")}`;
    let handle: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onMessage: ((message: Message) => void) | undefined;
    try {
        return await new Promise<string>((resolve, reject) => {
            timer = setTimeout(() => {
                reject(
                    new Error("Screenshot Portal timed out after 60 seconds"),
                );
            }, 60000);
            const responses = new Map<string, Message>();
            function respond(message: Message) {
                const [response, results] = message.body as [
                    number,
                    { uri?: Variant<string> },
                ];
                if (response !== 0) {
                    reject(
                        new Error(
                            response === 1
                                ? "Screenshot Portal request was cancelled (response 1)"
                                : `Screenshot Portal request failed (response ${response})`,
                        ),
                    );
                } else if (typeof results.uri?.value !== "string") {
                    reject(
                        new Error("Screenshot Portal returned no image URI"),
                    );
                } else {
                    resolve(results.uri.value);
                }
            }
            onMessage = (message) => {
                if (
                    message.type !== MessageType.SIGNAL ||
                    message.interface !== requestInterface ||
                    message.member !== "Response"
                )
                    return;
                if (message.path === handle) respond(message);
                else if (!handle) responses.set(message.path, message);
            };
            bus.on("message", onMessage);
            bus.on("error", reject);
            void (async () => {
                // Subscribe before Screenshot: a permitted request can finish immediately.
                await bus.call(
                    new Message({
                        destination: "org.freedesktop.DBus",
                        path: "/org/freedesktop/DBus",
                        interface: "org.freedesktop.DBus",
                        member: "AddMatch",
                        signature: "s",
                        body: [
                            `type='signal',sender='${destination}',interface='${requestInterface}',member='Response'`,
                        ],
                    }),
                );
                const reply = await bus.call(
                    new Message({
                        destination,
                        path,
                        interface: "org.freedesktop.portal.Screenshot",
                        member: "Screenshot",
                        signature: "sa{sv}",
                        body: [
                            isWaylandSession() ? "wayland:" : "",
                            {
                                handle_token: new Variant("s", token),
                                interactive: new Variant("b", false),
                            },
                        ],
                    }),
                );
                handle = reply?.body[0];
                if (
                    typeof handle !== "string" ||
                    !handle.startsWith(`${path}/request/`)
                ) {
                    throw new Error(
                        "Screenshot Portal returned an invalid request handle",
                    );
                }
                const response = responses.get(handle);
                responses.clear();
                if (response) respond(response);
            })().catch(reject);
        });
    } finally {
        clearTimeout(timer);
        if (handle)
            bus.send(
                new Message({
                    destination,
                    path: handle,
                    interface: requestInterface,
                    member: "Close",
                    flags: 1,
                }),
            );
        if (onMessage) bus.off("message", onMessage);
        bus.disconnect();
    }
}

export function createPortalCapture() {
    let pending: Promise<PortalCapture[]> | undefined;

    async function capture(): Promise<PortalCapture[]> {
        const displays = screen.getAllDisplays();
        if (!isWaylandSession()) {
            const sources = await desktopCapturer.getSources({
                types: ["screen"],
                thumbnailSize: {
                    width: Math.max(...displays.map((d) => d.size.width), 1),
                    height: Math.max(...displays.map((d) => d.size.height), 1),
                },
            });
            const captures = sources
                .filter((source) => !source.thumbnail.isEmpty())
                .map((source) => ({
                    displayId: source.display_id,
                    name: source.name,
                    dataUrl: source.thumbnail.toDataURL(),
                    size: source.thumbnail.getSize(),
                }));
            if (!captures.length)
                throw new Error("No screen thumbnails available");
            return captures;
        }
        const filename = fileURLToPath(await screenshotUri());
        let buffer: Buffer;
        try {
            buffer = await readFile(filename);
        } finally {
            await unlink(filename).catch((error) =>
                console.warn("Cannot remove Portal screenshot:", error),
            );
        }
        const image = nativeImage.createFromBuffer(buffer);
        if (image.isEmpty())
            throw new Error("Screenshot Portal returned an empty image");
        const size = image.getSize();
        const left = Math.min(...displays.map((d) => d.bounds.x));
        const top = Math.min(...displays.map((d) => d.bounds.y));
        const width =
            Math.max(...displays.map((d) => d.bounds.x + d.bounds.width)) -
            left;
        const height =
            Math.max(...displays.map((d) => d.bounds.y + d.bounds.height)) -
            top;
        if (!displays.length || width <= 0 || height <= 0)
            throw new Error("No displays available for Portal screenshot");
        const scale = size.width / width;
        if (Math.abs(size.height - height * scale) > 2)
            throw new Error(
                `Screenshot Portal image ${size.width}x${size.height} does not match desktop ${width}x${height}`,
            );
        return displays.map((display) => {
            const cropped =
                displays.length === 1
                    ? image
                    : image
                          .crop({
                              x: Math.round((display.bounds.x - left) * scale),
                              y: Math.round((display.bounds.y - top) * scale),
                              width: Math.round(display.bounds.width * scale),
                              height: Math.round(display.bounds.height * scale),
                          })
                          .resize({
                              width: Math.round(
                                  display.bounds.width * display.scaleFactor,
                              ),
                              height: Math.round(
                                  display.bounds.height * display.scaleFactor,
                              ),
                              quality: "best",
                          });
            if (cropped.isEmpty())
                throw new Error(
                    `Screenshot Portal returned no image for display ${display.id}`,
                );
            return {
                displayId: String(display.id),
                name: display.label,
                dataUrl: cropped.toDataURL(),
                size: cropped.getSize(),
            };
        });
    }

    return {
        capture: () => {
            if (!pending)
                pending = capture().finally(() => {
                    pending = undefined;
                });
            return pending;
        },
    };
}

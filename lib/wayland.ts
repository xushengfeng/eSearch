/** 会话 D-Bus 总线地址，渲染进程通过主进程获取 */
export function getSessionBusPath() {
    const unix = process.env.DBUS_SESSION_BUS_ADDRESS?.split(";").find((i) =>
        i.startsWith("unix:"),
    );
    if (unix) {
        const options = new URLSearchParams(
            unix.slice("unix:".length).replaceAll(",", "&"),
        );
        const path = options.get("path");
        if (path) return path;
        const abstract = options.get("abstract");
        if (abstract) return `\0${abstract}`;
    }
    return `${process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 0}`}/bus`;
}

/** 当前进程是否运行在 Wayland 会话下 */
export function isWaylandSession() {
    if (process.platform !== "linux") return false;
    const ozone = process.argv.find((a) => a.startsWith("--ozone-platform="));
    if (ozone) return ozone === "--ozone-platform=wayland";
    return (
        process.env.XDG_SESSION_TYPE === "wayland" ||
        !!process.env.WAYLAND_DISPLAY
    );
}

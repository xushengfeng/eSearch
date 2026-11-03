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

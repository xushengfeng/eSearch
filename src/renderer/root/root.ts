function initStyle(
    store: typeof import("../../../lib/store/renderStore")["default"],
) {
    function setCSSVar(name: string, value: string) {
        if (value) document.documentElement.style.setProperty(name, value);
    }
    const 模糊 = store.get("全局.模糊");
    if (模糊 !== 0) {
        document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
    } else {
        document.documentElement.style.setProperty("--blur", "none");
    }

    document.documentElement.style.setProperty(
        "--alpha",
        `${store.get("全局.不透明度") * 100}%`,
    );

    const theme = store.get("全局.主题");
    setCSSVar(
        "--bar-bg",
        `color-mix(in srgb, ${theme.light.barbg} var(--alpha), #0000)`,
    );
    setCSSVar("--bg", theme.light.bg);
    setCSSVar("--hover-color", theme.light.emphasis);
    setCSSVar(
        "--d-bar-bg",
        `color-mix(in srgb, ${theme.dark.barbg} var(--alpha), #0000)`,
    );
    setCSSVar("--d-bg", theme.dark.bg);
    setCSSVar("--d-hover-color", theme.dark.emphasis);
    setCSSVar("--font-color", theme.light.fontColor);
    setCSSVar("--d-font-color", theme.dark.fontColor);
    setCSSVar("--icon-color", theme.light.iconColor);
    setCSSVar("--d-icon-color", theme.dark.iconColor);

    const 字体 = store.get("字体");
    document.documentElement.style.setProperty("--main-font", 字体.主要字体);
    document.documentElement.style.setProperty("--monospace", 字体.等宽字体);
}

export default initStyle;

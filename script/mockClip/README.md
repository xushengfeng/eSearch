# 截屏编辑器 mock

用隐藏的普通窗口加载 `capture.html`，发送一张模拟截图，不启动真实截屏流程，不会全屏覆盖桌面。

## 运行

```bash
pnpm run mock:clip
```

默认窗口隐藏，只在后台渲染。需要手动查看界面时：

```bash
pnpm run mock:clip:visible
```

需要 CDP 时：

```bash
pnpm run mock:clip:debug
```

然后连接 `http://127.0.0.1:9224`。也可以直接运行：

```bash
npx electron script/mockClip/main.cjs --remote-debugging-port=9224
```

## 说明

- 模拟图片在 `main.cjs` 里生成，尺寸 `960x640`，带网格和色块。
- `store` 使用 `defaults.cjs` 中的最小默认值，读写落到 `/tmp/opencode/mockClip-config.json`，不会修改真实用户配置。
- `clip_show`、`clip_save`、`clip_hide` 等主进程消息在 `main.cjs` 中做了 stub。
- 改完 renderer 代码后重新执行 `pnpm run mock:clip`。

## 自动化输入

窗口隐藏时，CDP 的鼠标事件可能因为窗口没有焦点而丢失。可以在 renderer 里通过 `mock-input` 发送 Electron 输入事件：

```js
require("electron").ipcRenderer.send("mock-input", [
    { type: "mouseDown", x: 300, y: 200, button: "left", clickCount: 1 },
    { type: "mouseMove", x: 500, y: 400, delay: 50 },
    { type: "mouseUp", x: 500, y: 400, button: "left", clickCount: 1 },
]);
```

`delay` 是相对上一条事件的毫秒数，默认 20。事件格式与 `webContents.sendInputEvent` 一致。

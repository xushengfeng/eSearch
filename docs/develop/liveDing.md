# 动态贴图

动态贴图把框选区域变成某个窗口的实时镜像，交互类似 PowerToys 的 Crop and Lock。它复用普通贴图的窗口、工具栏、缩放、透明度和鼠标穿透，只把媒体从静态图片换成窗口视频流。

## 基本约束

- 只捕获窗口级视频流（`desktopCapturer.getSources({ types: ["window"] })`），不捕获桌面流。窗口流不包含贴图自身和遮挡在窗口上的其他内容，源窗口移动时也不需要重新计算屏幕坐标。
- 一张贴图对应一个窗口源。框选跨多个窗口时，取覆盖最多的窗口，贴图收缩到与这个窗口的交集。
- 能否用屏幕坐标自动定位，取决于窗口几何信息是否可用，而不是平台。几何信息不可用，或者窗口与视频源匹配失败时，进入选源页。选源页用原截屏选区在各窗口实时画面里做图像匹配，自动选中窗口和裁剪框，用户再微调。能一次枚举多个窗口时排列全部实时画面；只能通过系统门户选一个窗口时（如 KDE/Wayland），只放大这一个窗口的画面。
- 静态截图始终保留为 poster。视频首帧、断流、暂停，以及复制、保存、OCR、翻译、再次编辑都依赖它或由它生成的快照。

## 复用的现有能力

| 能力 | 位置 |
| --- | --- |
| 框选结果、显示器坐标 | `src/renderer/clip/clip_window.ts`，`finalRect` 与 `getNowScreen()` |
| 窗口枚举 | `node-screenshots` 的 `Window.all()`，已用于框选吸附 |
| 窗口视频流 | `desktopCapturer` 与 `getUserMedia` 的 `chromeMediaSourceId`，录制已在用 |
| 贴图绘制与管理 | `src/renderer/ding/item.ts`、`overlay.ts`、`single.ts` |
| 贴图 IPC | `lib/ipc.ts` 的 `addDing`、`dingInit`、`dingShare` |
| 窗口创建 | `src/main/main.ts` 的 `createDingWindow()`、`createDingOverlay()`、`createDingSingle()` |

`node-screenshots` 的窗口对象已经提供 `id`、`pid`、`appName`、`title`、`x`、`y`、`width`、`height`、`z`、`isMinimized` 和 `currentMonitor()`，现在只是没有传完整。

## 数据模型

```ts
/** 与 desktopCapturer 的窗口源对应 */
type WindowInfo = {
    id: number;
    pid: number;
    appName: string;
    title: string;
    /** node-screenshots 的原始坐标，通常为物理像素 */
    rect: { x: number; y: number; w: number; h: number };
    /** 虚拟桌面 DIP 坐标，由 rect 和 currentMonitor 换算 */
    dipRect: { x: number; y: number; w: number; h: number };
    displayId: number | null;
    z: number;
    minimized: boolean;
};

/** 相对视频帧的归一化裁剪 */
type NormRect = { x: number; y: number; w: number; h: number };

type LiveDing = {
    /** 创建时的 desktopCapturer 源 id，如 window:12345:0 */
    sourceId: string;
    windowId?: number;
    appName?: string;
    title?: string;
    /** 0 到 1，相对视频帧 */
    crop: NormRect;
    fps: number;
};

type DingItemData = {
    // 现有字段
    id: string;
    rect: [number, number, number, number];
    url: string; // 始终是 poster
    translation: string;
    isTranslate: boolean;
    // 新增
    live?: LiveDing;
};
```

`DingItemData.url` 继续表示静态画面，其他模块不必知道视频。动态能力由 `live` 存在与否决定。

## 坐标换算

框选结果在截屏画布上是物理像素，显示器 `bounds` 是 DIP。窗口矩形与截屏库的 `Monitor` 处在同一套坐标里，所以用 `currentMonitor()` 换算，不直接假设平台：

```ts
// U 是 node-screenshots 的坐标单位，DIP 是 Electron 的屏幕坐标单位
const monitor = win.currentMonitor();
const display = matchDisplay(monitor, screen.getAllDisplays());
const f = monitor.width() / display.bounds.width;

const dipRect = {
    x: display.bounds.x + (win.rect.x - monitor.x()) / f,
    y: display.bounds.y + (win.rect.y - monitor.y()) / f,
    w: win.rect.w / f,
    h: win.rect.h / f,
};
```

- `f` 通常等于 `display.scaleFactor`，但混合缩放、macOS 的点坐标和 X11 的像素都能用同一个公式覆盖。
- 窗口跨屏时用相交面积最大的 `Monitor`。
- `dipRect` 必须至少落在某个显示器范围内、宽高大于 0。换算结果不合法就当作没有几何信息。

框选矩形：

```ts
const selDip = {
    x: finalRect[0] / ratio + display.bounds.x,
    y: finalRect[1] / ratio + display.bounds.y,
    w: finalRect[2] / ratio,
    h: finalRect[3] / ratio,
};
```

### 选择窗口

1. 过滤自身窗口：主进程把所有 `BrowserWindow` 创建在主进程，所以窗口的 `pid` 是主进程 pid，不是截屏页渲染进程的 `process.pid`。由主进程把 `mainPid` 随 `clip_init` 传给截屏页，并补充标题兜底；`desktopCapturer` 源 id 以 `:1` 结尾的项也要过滤。截屏窗口、贴图窗口、选源窗口都不能成为源。
2. 过滤最小化、尺寸为 0、完全在虚拟桌面之外的窗口。
3. 计算每个窗口与 `selDip` 的交集面积。
4. 交集中心所在的最上层窗口，如果交集面积达到最大值的 60%，选它；否则选交集面积最大的窗口。这样既能选中用户框住的大块区域，也能在这个区域里有一个更靠前的小窗口时选中小窗口。
5. 贴图矩形收缩为 `selDip` 与目标窗口的交集，poster 同步裁掉框外部分。

最大的交集面积小于框选面积的 20% 时视为不可靠，直接进入选源页。

### 裁剪归一化

```ts
const crop = {
    x: (stickerRect.x - win.dipRect.x) / win.dipRect.w,
    y: (stickerRect.y - win.dipRect.y) / win.dipRect.h,
    w: stickerRect.w / win.dipRect.w,
    h: stickerRect.h / win.dipRect.h,
};
```

视频帧与窗口矩形不一致时（窗口阴影、标题栏、客户端区域差异），归一化会整体偏移或缩放。处理方式见[对齐](#对齐)。

## 源匹配

源来自 `desktopCapturer`，只有 `id`、`name`（窗口标题）、`thumbnail`、`appIcon`，没有进程 id。窗口来自 `node-screenshots`，有标题、应用名和几何信息。按可信度依次匹配：

1. **窗口 id**：`Number(source.id.split(":")[1]) === win.id`。Windows 的 HWND、macOS 的 CGWindowID、X11 的 Window 在同一平台内一致，这一层直接采用。
2. **标题**：归一化后比较窗口标题和 `source.name`。去掉首尾空格、修改标记、` - 应用名` 后缀，折叠空白，大小写不敏感。只有唯一完全匹配才采用，并标记为需要确认。
3. **标题 + 几何**：多个同名窗口时，比较源缩略图与窗口矩形的宽高比；仍不唯一就进入选源页，由图像匹配自动选中窗口和裁剪。
4. 仍不唯一或没有候选，进入选源页。

自动匹配成功后，贴图上显示一个短暂的来源条：应用名或标题，加一个“换源”按钮。名称匹配可能错，用户随时可以改。这个按钮和选源页共用同一个入口。

## 流程 A：有窗口几何信息

1. 用户框选，点击“动态贴图”。
2. 截屏页重新调用一次窗口枚举（`Window.all()` 是同步的，开销小），按上述规则得到目标窗口。
3. 同时向主进程请求窗口源列表。主进程调用 `desktopCapturer.getSources({ types: ["window"], thumbnailSize })`，返回 `id`、`name`、`thumbnail`、`appIcon`，并滤掉自己。
4. 源匹配成功：计算裁剪，裁好 poster，发送 `clip_ding_live`，带上 `sourceId`、`crop`、贴图矩形、`displayId`。
5. 源匹配失败或几何不可用：发送不带源的请求，主进程打开选源页。

判断“几何可用”不能写死平台：

```ts
const usable = windows.filter(isUsable);
const autoLocate =
    usable.length >= 2 ||
    (usable.length === 1 &&
        intersects(selDip, usable[0].dipRect) &&
        isSane(usable[0].dipRect));
```

窗口数大于 1 时信任位置；只有 1 个时用几何合理性兜底；没有窗口时直接走选源页。Wayland 下窗口通常不可枚举或矩形为 0，会自然落到选源页，不需要判断 `process.platform`。

## 流程 B：选源页

选源页是覆盖目标显示器的正常窗口。

- 能一次枚举多个窗口时，页面内容是所有可捕获窗口的实时画面，每个窗口一张卡片。卡片先用 `desktopCapturer` 缩略图占位，进入视口或悬停后再启动 `getUserMedia`，避免同时开几十路流。
- 门户平台只能拿到一个源时（KDE/Wayland），系统选择框已经让用户选了窗口，选源页只显示这一个窗口的大画面。此时不存在“排列所有窗口”的界面，头部提供“重新选择窗口”重新触发门户。
- 排除自己的进程和选源页自身；卡片按最可能的目标排序，其次是 z 序。
- 实时画面启动后，选源页自动做图像匹配：把原选区按截屏/视频像素比例缩放，放到窗口画面左上角做 padding，用 `picture_match` 的 `findOffset()` 求偏移，再用 NCC 校验。单窗口直接预选裁剪；多窗口选分数最高且明显高于第二的卡片。用户一旦开始点击/拖动/滚轮，自动匹配停止，不覆盖手动框选。
- 匹配失败或分数低于阈值时保持未选中，由用户手动框选；选框可以拖动、四角拉伸微调。
- 确认时从当前视频帧截一张图作为 poster，把 crop 按比例放进原来的框选矩形（保持宽高比，居中，不超出选区），然后把 `sourceId`、`crop`、poster、矩形发回主进程。
- 主进程收到后创建贴图，并关闭选源页。取消则只关页面。

选源页同时是“换源”的入口：已有贴图点击换源时，带上当前 crop 作为初始选框。

### 没有可枚举窗口源时

Linux 使用 PipeWire 时，`getSources()` 只能返回一个源，而且会先弹出系统选择框，由用户选择要共享的窗口或屏幕，无法静默枚举全部窗口。选源页因此不假设拿到完整列表：

1. 进入选源页时请求一次窗口源，系统弹出选择框。请求发生在创建全屏置顶窗口之前。
2. 用户选中后，返回的那一个源作为卡片显示，用户直接在实时画面上框选。
3. 用户取消，或返回的是整个屏幕时，显示空状态和“重新选择窗口”，再次请求；请求期间隐藏选源页。
4. 如果自动流程已经请求过窗口源，把结果一并传给选源页，避免重复弹框。
5. 卡片启动流时临时取消选源页置顶，避免系统的第二次选择框被盖住，启动完成后再恢复。

这条路的代价是用户要在系统框里选一次窗口，选源页再框一次区域。同一个源 id 交给贴图窗口启动流时，是否再次弹框取决于 PipeWire 门户会话能否复用，需要在目标桌面上验证。

## 贴图端播放

### 启动

贴图窗口从主进程拿到 `live` 后，用 `getUserMedia` 打开源：

```ts
navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
        // @ts-ignore
        mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: live.sourceId,
            maxFrameRate: live.fps,
        },
    },
});
```

全屏覆盖层里，同一 `sourceId` 的流放进一个 `Map` 复用，多个贴图共用一个 `MediaStream` 和多个 `<video>`。独立窗口模式每个窗口各自一条流，所以大量动态贴图建议用覆盖层模式。

### 裁剪

`imageP` 作为裁剪容器，`<video>` 放进去：

```ts
// W、H 是贴图内容尺寸，frameW、frameH 是视频帧尺寸
const videoW = W / crop.w;
const videoH = videoW * (frameH / frameW); // 保持视频自身宽高比
video.style.width = `${videoW}px`;
video.style.height = `${videoH}px`;
video.style.left = `${-crop.x * videoW}px`;
video.style.top = `${-crop.y * videoH}px`;
```

贴图初始宽高比等于裁剪区域的宽高比。源窗口尺寸变化后比例不一致时允许留黑边，不拉伸画面。

### 快照

复制、保存、OCR、翻译、编辑、停止动态都取当前帧：

```ts
const canvas = document.createElement("canvas");
canvas.width = crop.w * video.videoWidth;
canvas.height = crop.h * video.videoHeight;
ctx.drawImage(
    video,
    crop.x * video.videoWidth,
    crop.y * video.videoHeight,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
);
```

`DingItem` 增加 `snapshot(): string`。`item.ts` 内现有直接读 `data.url` 的动作改成 `item.snapshot()`；静态贴图直接返回 `data.url`。

### 交互

- 工具栏增加暂停/继续、调整裁剪、换源、转为静态、重新连接。暂停后保留当前帧；转为静态会取当前帧并释放视频流；换源重新打开选源页；重新连接会重新枚举源，先按 `windowId` 再按标题匹配。
- 关闭贴图或切回静态时停止流；覆盖层里同一源没有引用后再 `track.stop()`。
- `track.onended` 或 `video` 报错时显示 poster 和“已断开”提示，提供重连。重连失败时保留错误提示。
- 源窗口最小化时流可能变黑或停在最后一帧，不做特殊处理。
- 透明度作用于整个 `imageP`，现有变换（`tran*` CSS）和缩放继续作用于视频。
- 覆盖层只允许指针落在内容或工具栏上，视频设 `pointer-events: none`。拖动判断从 `el.tagName === "IMG"` 改为判断元素是否在贴图内容区，避免视频挡住拖动命中。

### 对齐

贴图端不做图像匹配，初始裁剪来自选源页或截屏。窗口边框造成偏移时，进入“调整裁剪”：暂停画面，拖动画面平移 `crop`，滚轮缩放范围，四周自动夹紧在视频帧内，点“完成”恢复播放。

## 数据流与 IPC

新增消息：

```ts
type Message = {
    /** 截屏页请求窗口源，主进程异步返回 */
    getCaptureSources: (requestId: number) => void;
    captureSources: (
        requestId: number,
        sources: {
            id: string;
            name: string;
            thumbnail: string;
            appIcon: string;
            displayId: string;
        }[],
    ) => void;

    /** 动态贴图；target 为空表示需要选源页 */
    clip_ding_live: (data: {
        poster: string;
        rect: { x: number; y: number; w: number; h: number };
        displayId: number;
        target: {
            sourceId: string;
            crop: NormRect;
            windowId?: number;
            appName?: string;
            title?: string;
        } | null;
    }) => void;

    /** 选源页结果 */
    dingLivePick: (data: {
        sourceId: string;
        crop: NormRect;
        poster: string;
        rect: { x: number; y: number; w: number; h: number };
        appName?: string;
        title?: string;
    }) => void;
    dingLiveCancel: () => void;
    /** 转为静态，释放数量额度 */
    dingLiveStop: (id: number) => void;
    /** 已有贴图换源 */
    dingLiveChangeSource: (data: {
        id: number;
        rect: { x: number; y: number; w: number; h: number };
        poster: string;
        displayId?: number;
    }) => void;
    /** 主进程通知贴图切换源 */
    dingLiveSwitch: (id: number, live: LiveDingData, poster: string) => void;
};
```

`addDing` 和 `dingInit` 增加可选的 `live`、`displayId` 参数。覆盖层广播时只让目标显示器的窗口创建贴图，其他显示器忽略，否则每块屏幕都会各开一路相同的流。

主进程新增：

- `getCaptureSources` 处理器：枚举窗口源，缩略图转 data URL，过滤自身，按 `requestId` 回复。
- `createLiveDingWindow()`：创建普通贴图窗口或覆盖层条目，带上 `live` 和 poster。
- `createLiveDingPicker()`：在目标显示器创建选源窗口，保存待处理任务（poster、矩形、displayId）。收到 `dingLivePick` 后创建贴图；取消或窗口关闭时清理任务。
- 动态贴图计数：超过设置上限时拒绝并提示，避免一次开太多流。

`clip_ding_live` 与现有 `clip_ding` 分开，避免静态贴图路径被大量可选参数污染。

## 设置

```ts
贴图: {
    // 现有
    窗口: { 变换: string[]; 双击: "归位" | "关闭"; 提示: boolean; 独立窗口: boolean };
    强制鼠标穿透: string;
    // 新增
    动态: {
        帧率: number; // 默认 30
        最大数量: number; // 默认 4
    };
};
```

截屏工具栏增加“动态贴图”按钮，`功能列表` 增加 `dingLive`，与 `ding` 并列，这样快捷键和“框选后默认操作”都能直接使用。图标新增一个带播放标记的贴图图标。

## 失败与边界

| 情况 | 处理 |
| --- | --- |
| 源窗口关闭、流结束 | 保留 poster，标记已断开，提供重连或转为静态 |
| 源窗口最小化 | 流可能变黑或冻结，保持现状 |
| 窗口移动 | 窗口级捕获不受影响，crop 相对窗口不变 |
| 窗口缩放 | crop 使用归一化坐标，跟随窗口；比例变化时留黑边 |
| 框选覆盖多个窗口 | 取覆盖最多的窗口，贴图收缩到交集，其余部分不显示 |
| 框选主要落在桌面 | 交集比例过低，进入选源页 |
| 贴图自身被捕获 | 过滤自身 pid 和源 id `:1`，并且只使用窗口流 |
| 同名窗口 | 不直接采用名称匹配，用几何或视觉匹配，失败进选源页 |
| 标题栏、窗口阴影导致裁剪偏移 | 自动/手动图像对齐，按应用记录修正量 |
| 混合 DPI、多显示器 | 用 `currentMonitor` 与显示器 bounds 的比例逐窗口换算 |
| Wayland 无窗口位置 | 走选源页；PipeWire 由系统选择框返回单个窗口源 |
| Wayland 每次取流弹选择框 | 选源页明确提示；自动流程已取到的源直接复用，避免重复请求 |
| DRM 内容 | 捕获为黑屏，不做特殊处理 |
| 流分辨率低于贴图尺寸 | 放大后模糊，属于预期，可在提示中说明 |
| 同一窗口多张贴图 | 覆盖层内共用一条流；独立窗口模式各开一条，受最大数量限制 |
| 选源页自身出现在列表 | 过滤自身进程，源 id `:1` |
| 贴图被最小化或鼠标穿透 | 保留流，避免恢复时重新弹权限或选择器 |

## 文件改动

- `src/renderer/screenShot/screenShot.ts`：窗口信息补全，增加 DIP 换算，导出可重复调用的窗口枚举。
- `src/renderer/clip/clip_window.ts`：动态贴图按钮、窗口选择、源匹配、裁剪、poster 裁剪、选源页入口。
- `src/renderer/ding/item.ts`：`DingItemData.live`、视频元素、流复用、快照、暂停/对齐/换源工具栏，动作改用快照。
- `src/renderer/ding/overlay.ts`、`single.ts`：`live` 初始化、视频拖动命中、覆盖层按显示器过滤。
- `src/renderer/ding/picker.ts`、`src/renderer/ding/align.ts`、`src/renderer/dingPicker.html`：选源页与基于 `picture_match` 的自动窗口/裁剪匹配。
- `src/main/main.ts`：窗口源枚举、选源页窗口、待处理任务、动态贴图创建与数量限制。
- `lib/ipc.ts`：上述消息与类型。
- `src/ShareTypes.d.ts`：`NormRect`、`LiveDing`、`功能列表`、`setting.贴图.动态`。
- `electron.vite.config.ts`：注册 `dingPicker.html`。
- `src/renderer/setting/setting.ts`：设置项。
- `src/iconTypes.d.ts`、`src/renderer/assets/icons/`：新图标。
- `docs/use/ding.md`、`lib/translate/source.json`：用户文档与翻译。

## 分期

1. **P0**：窗口信息与 DIP 换算、源枚举、id/名称匹配、贴图播放与裁剪、快照动作、自身过滤。覆盖 Windows、macOS、X11。
2. **P1**：选源页、用户框选、PipeWire 单源选择与重试、换源。
3. **P2**：手动调整、同源流复用、暂停/重连/转为静态/换源、数量限制。

本功能只捕获窗口视频流做实时显示，不包含录制、音频或多窗口拼接。

## 待验证

- Electron 44 在 Wayland 下 `desktopCapturer.getSources` 的实际返回：PipeWire 门户返回单个用户选择的源。
- 同一个源 id 在选源页关闭后，贴图窗口重新取流是否再次弹出系统选择框。
- `picture_match` 在窗口缩放、动态内容下做平移校正的准确率，以及需要限制的最大偏移量。
- `node-screenshots` 在 macOS 上窗口和监视器坐标是点还是像素，是否与 `Monitor` 同单位。
- 各平台窗口捕获是否包含标题栏、阴影，和 `Window` 的矩形差多少。
- `getUserMedia` 对单个窗口源的分辨率上限和帧率上限。
- 源 `id` 在 `getSources` 与 `getUserMedia` 之间的有效期，窗口重建后是否复用。

# Firefox 本地翻译

翻译器类型为 `bergamot`，使用 Firefox Translations 的 Bergamot 模型在本地运行。

## 数据来源

- 模型和运行时托管在 eSearch 的 GitHub Release：`bergamot-v1`
- `manifest.json` 固定每个语言对使用的模型版本和文件哈希
- 模型文件为 zstd 压缩的 3.x 模型，使用前在内存中解压
- wasm 为 Bergamot `v0.6.0` / `4.0`，在打包时下载并内置
- 模型和运行时均为 MPL-2.0

## 下载

设置 → 翻译 → 本地模型 → “下载/管理模型”：

- 弹出的面板从上到下是方向选择、下载进度、已下载模型支持的方向、已下载模型
- 方向选择是临时的，不写入设置
- 点击“下载”下载对应模型；非英语语言对会同时下载两段中转模型
- 已下载模型会列出所有缓存的模型，包括 `de→en` 这类中间模型，可以单独删除
- 翻译时只使用已下载的模型，不会自动下载；未下载会提示去设置中下载
- “清除缓存”会删除 `userData/bergamot` 下的模型

## 实现

- `src/main/bergamot.ts`：下载、校验、模型选择、worker 管理、IPC
- `src/main/bergamot-worker.cjs`：Bergamot worker，解压并加载模型
- `src/main/bergamot-translator.js`：Firefox 的 wasm 加载器
- `src/renderer/lib/translate.ts`：渲染进程的 `BergamotTranslator`
- `script/bergamot_assets.mjs`：一次性同步模型到 GitHub Release
- `script/bergamot-records-v1.json`：固定的模型快照
- `electron-builder.config.js`：打包时下载 wasm 到 `assets/bergamot`

缓存目录为 `app.getPath("userData")/bergamot`：

```text
bergamot/
  runtime/
    manifest.json
  models/<from>-<to>/<version>/
    manifest.json
```

下载完成后会写入 `manifest.json`；翻译和状态检查优先读取本地清单，下载后离线也能使用。wasm 优先使用打包内置的 `assets/bergamot`。

每个语言对使用独立 worker；同时只保留一个路由，切换语言对时会释放旧 worker。非英语语言对经英语中转。

## 发布资源

- 资源通过 `workflow_dispatch` 手动运行 `Bergamot assets` 工作流上传
- 工作流使用 `script/bergamot-records-v1.json` 固定快照，不会跟随 Mozilla 最新版本
- 已存在的 release 资源不会覆盖，只补传缺失文件
- 更新模型时新建 `bergamot-v2` release，并同步修改应用里的 `RELEASE_TAG`

## 注意

- 只支持 Firefox 发布的 `X ↔ en` 模型，其他语言对自动 pivot
- 单个语言对常驻内存约 400MB，pivot 约 550MB
- 模型约 11–48MB（压缩），手动下载时需要联网
- 下载使用 eSearch 的 GitHub 镜像设置
- Firefox 后续升级模型或 wasm 主版本时需要同步更新快照和 release

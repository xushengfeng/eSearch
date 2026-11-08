# Firefox 本地翻译

翻译器类型为 `bergamot`，使用 Firefox Translations 的 Bergamot 模型在本地运行。

## 数据来源

- 模型列表：`translations-models-v2`（Mozilla Remote Settings）
- 运行时：`translations-wasm-v2`，Bergamot `v0.6.0` / wasm `4.0`
- 模型文件为 zstd 压缩的 3.x 模型，使用前在内存中解压
- 模型和运行时均为 MPL-2.0，在设置中手动下载，不随应用分发

## 下载

设置 → 翻译 → 本地模型 → “下载/管理模型”：

- 弹出的面板从上到下是方向选择、下载进度、已支持语言方向、已下载模型
- 方向选择是临时的，不写入设置
- 点击“下载”下载运行时和对应模型；非英语语言对会同时下载两段中转模型
- 已下载模型会列出所有缓存的模型，包括 `de→en` 这类中间模型，可以单独删除
- 翻译时只使用已下载的模型，不会自动下载；未下载会提示去设置中下载
- “清除缓存”会删除 `userData/bergamot` 下的运行时和模型

## 实现

- `src/main/bergamot.ts`：下载、校验、模型选择、worker 管理、IPC
- `src/main/bergamot-worker.cjs`：Bergamot worker，解压并加载模型
- `src/main/bergamot-translator.js`：Firefox 的 wasm 加载器
- `src/renderer/lib/translate.ts`：渲染进程的 `BergamotTranslator`

缓存目录为 `app.getPath("userData")/bergamot`：

```text
bergamot/
  runtime/
    manifest.json
  models/<from>-<to>/<version>/
    manifest.json
```

下载完成后会写入 `manifest.json`；翻译和状态检查优先读取本地清单，下载后离线也能使用。

每个语言对使用独立 worker；同时只保留一个路由，切换语言对时会释放旧 worker。非英语语言对经英语中转。

## 注意

- 只支持 Firefox 发布的 `X ↔ en` 模型，其他语言对自动 pivot
- 单个语言对常驻内存约 400MB，pivot 约 550MB
- 模型约 11–48MB（压缩），手动下载时需要联网
- 大陆网络访问 Mozilla CDN 可能不稳定，可替换 `RECORDS_URL` / `ATTACHMENTS_URL` 或在外部准备缓存
- Firefox 后续升级模型或 wasm 主版本时需要同步更新本模块

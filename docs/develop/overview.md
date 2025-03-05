# 整体说明

## 技术选型

使用 Electron 开发。高情商：JS 适合快速开发，低情商：我不擅长 C++和 Rust。

跨平台方案的体积和内存自然是很大，所以我尽量让功能对得上他的体积。tauri 也不错，只能希望以后 Windows 和 macOS 下也有类似 ArchLinux 下 Electron 共享运行时的方案。

使用 Biome 作为格式化和检查工具，使用 vite 作为打包工具。

前端：

使用 TypeScript，很少使用类型体操，仅作为简单的类型标注。主进程开启了 strict 模式，但渲染进程没有，历史遗留问题太多。

框架：

使用自己开发的[dkh-ui](https://github.com/xushengfeng/dkh-ui)，只是对 JQuery 的拙劣模仿。我学不会`vue`和`react`，搞不懂 hook，ref 这些概念，所以你可以在代码里看到直接使用`document`和`HTML`的操作，当然也在逐步转为 dkh。

库：

截屏库： [node-screenshots](https://github.com/nashaofu/node-screenshots)

图片编辑库：[fabric.js](https://github.com/fabricjs/fabric.js)

本地文字识别：[eSearch-OCR](https://github.com/xushengfeng/eSearch-OCR)，基于`onnx`和`paddleOCR`实现。

其他库可以参考`package.json`文件。

## 文件说明

`electron-builder.config.js` electron-builder 配置文件，用于打包\
`assets` 程序图标\
`src` 项目源码

`src/main/main.ts` 主进程 处理 cli，窗口管理

`src/renderer/assets` 渲染进程资源，如图标\
`src/renderer/browser_bg` 主页面浏览器错误提示\
`src/renderer/clip` 截屏界面\
`src/renderer/css` 样式文件\
`src/renderer/ding`贴图界面，贴图屏幕翻译\
`src/renderer/editor` 主页面，编辑器，OCR、以图搜图和二维码识别也在此运行\
`src/renderer/photoEditor` 高级图片编辑器\
`src/renderer/recorder` 录屏提示栏、录屏编辑\
`src/renderer/recorderTip` 录屏框选、光标和按键提示\
`src/renderer/root` 初始化样式，保持各个页面的统一\
`src/renderer/screenShot` 简单封装的截屏库，用于 cli 截屏、截屏界面截屏和屏幕翻译截屏\
`src/renderer/setting` 设置界面\
`src/renderer/translate` 主页面翻译，封装了常用 API\
`src/renderer/translator` 实时屏幕翻译\
`src/renderer/videoEditor` 高级录屏编辑器\

`src/renderer/capture.html` 截屏页面

`src/ShareTypes.d.ts` 配置类型定义，主进程和渲染进程 ipc 时类型定义，在这种多页面的项目中很方便

`lib/store` 自己写的设置存储库，参考了`electron-store`，但直接使用 ts 进行类型定义，不依赖`ajv`\
`lib/translate` 翻译库，用于多语言国际化

OCR 模型和人像抠图模型在打包或编译时下载，不放在 git 里了，见`electron-builder.config.js`

## 其他

图标：

使用 svg 图标，通过 `<img>` 显示。

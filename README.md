# eSearch

(中文 | [English](README_en.md))

![LOGO](https://esearch-app.netlify.app/readme/title_photo.svg)

[![license](https://img.shields.io/github/license/xushengfeng/eSearch)](LICENSE)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)
![commit-activity](https://img.shields.io/github/commit-activity/m/xushengfeng/eSearch)
[![release-date](https://img.shields.io/github/release-date/xushengfeng/eSearch)](https://github.com/xushengfeng/eSearch/releases/latest)
[![release](https://img.shields.io/github/v/release/xushengfeng/eSearch)](https://github.com/xushengfeng/eSearch/releases/latest)
[![](https://img.shields.io/github/downloads/xushengfeng/eSearch/total?color=brightgreen&label=总下载量)](https://github.com/xushengfeng/eSearch/releases/latest)
[![aur](https://img.shields.io/badge/aur-e--search-blue?logo=archlinux)](https://aur.archlinux.org/packages/e-search)
[![aur1](https://img.shields.io/badge/aur-e--search--git-blue?logo=archlinux)](https://aur.archlinux.org/packages/e-search-git)

## 简介

eSearch 是[Information-portal](https://github.com/xushengfeng/Information-portal.git)的:electron:重写版(顺便加了亿些功能)

主要是想在 Linux 上(win 和 mac 上也能用)实现[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的**屏幕搜索**功能，当然也是一款方便的**截屏软件**。

经过数次版本迭代，eSearch 的功能愈加丰富

即拥有 **截屏+OCR+搜索+翻译+贴图+屏幕翻译+以图搜图+滚动截屏+录屏**

![截屏界面](https://esearch-app.netlify.app/readme/1.webp)

> 字体是[FiraCode](https://github.com/tonsky/FiraCode)，字体可在设置里设置

![识别文字主页面](https://esearch-app.netlify.app/readme/8.webp)

## 下载安装

到网站[eSearch](https://esearch-app.netlify.app/#download)下载

或在右侧 [releases](https://github.com/xushengfeng/eSearch/releases) 打开标签，选择符合你系统的包并下载安装

国内可以用[GitHub Proxy](https://mirror.ghproxy.com)加速下载

ArchLinux 可在 AUR 查找安装 `e-search`或`e-search-git`

winget `winget install esearch`

## 启动

在你的启动器打开 eSearch，他将出现在托盘。

默认快捷键为 <kbd>Alt</kbd>+<kbd>C</kbd>(你也可以在设置里设置快捷键)

## 功能

更多介绍见[文档](./docs/use/start.md)

### 截屏

框选裁切、取色器、自由画笔、几何、马赛克、模糊

框选除了通过方向键调节，还支持输入四则运算式调整

支持自定义框选后立马执行操作，如框选后自动 OCR

还支持滚动截屏，横向、竖向、任意方向都可以拼接

### 截屏美化

可为截屏设置背景（渐变、图片）、圆角、阴影

改变图像分辨率导出

抹除物体并修补图像

### 录屏

录制屏幕、自定义大小、摄像头

可提示光标位置和键盘击键

可设置虚拟背景

### 屏幕贴图

滚轮缩放、透明度、自动归位、鼠标穿透

支持放大图像且不改变窗口大小，防止遮挡其他内容

可通过 CSS 设置滤镜、变换（如镜像）

### OCR（文字识别）

开箱即用的离线 OCR（[eSearch-OCR](https://github.com/xushengfeng/eSearch-OCR)），框选文字后按下回车键即可

离线 OCR 支持段落识别，也可以使用基于标点符号的分段算法

同时也支持百度、有道的在线 OCR

可后期编辑文字，在图片上选择文字，同步选区到编辑区，方便校对

支持多语言（需要在设置额外下载）

### 以图搜图

谷歌、百度、Yandex 的以图搜图引擎

可自定义多模态大模型接口，与 AI 交流图片

### 翻译

OCR 后可调用翻译，支持选词翻译

支持免费的翻译引擎，如谷歌翻译等，也可以自己设置其他翻译引擎的 API，如 DeepL、百度等，可以使用 ChatGPT 等 AI 翻译，甚至可以自定义本地 AI 翻译

可多个引擎同时翻译，择其善者

可以保存翻译结果到本地文件或通过网络保存到 Anki 等记忆软件

### 屏幕翻译

生成一个贴图窗口，并把图片文字替换成翻译后的文本

可设置定时翻译，适合视频、游戏等

### 其他

二维码识别

## 展示

https://user-images.githubusercontent.com/28475549/155870834-34ffa59f-9eac-4eea-9d82-135681d7dfa9.mp4

> 截屏，自由调整框选大小（视频约 2.6MB）

https://user-images.githubusercontent.com/28475549/155870857-99c7d6d0-a90b-4558-872a-85f2603225d6.mp4

> 取色器（视频约 1MB）

https://user-images.githubusercontent.com/28475549/155870867-fb0d31f0-2e06-431c-9ae9-ee3af5a5c08e.mp4

> Ding 在屏幕上，透明度调节、归位以及鼠标操作（视频约 1.8MB）

![3](https://esearch-app.netlify.app/readme/3.webp)

> 绘图界面

https://user-images.githubusercontent.com/28475549/155870881-9b2fc1b3-77de-4a99-8076-ed49b7b5c4c0.mp4

> 主页面搜索和其他应用编辑（视频约 1.6MB）

![3](https://esearch-app.netlify.app/readme/4.webp)

> 主页面查找替换（支持正则）

## 国际化

大多数按钮使用图标，简少了不必要的翻译

[+添加新语言](./lib/translate/readme.md)

- [x] 简体中文
- [x] 繁体中文
- [x] 世界语（Esperanto）
- [x] 西班牙语（Español）
- [x] 阿拉伯语（عربي）
- [x] 英语（English）
- [x] 法语（Français）
- [x] 俄语（Русский）

## 源码运行&编译

```shell
git clone https://github.com/xushengfeng/eSearch.git
cd eSearch
npm install
# 编译
npm run dist
# 将在build目录产生安装包和解压的目录
```

```shell
# 运行
npm run start
# 调试
npm run dev
```

[具体技术说明](docs/develop/readme.md)

## 测试

在 ArchLinux,KDE plasma,Xorg 下测试通过

Windows10 和 Windows11 测试通过

macOS Catalina 测试通过

## Q&A

### Gnome 点击后无响应

Gnome 用户需要安装[appindicator](https://extensions.gnome.org/extension/615/appindicator-support/)插件来使用托盘。

### 为什么选择 electron

- 跨平台需要，本来我是想在 Linux 上也能体验 Windows 下优秀的截屏工具，Linux 独占也不好，所以选择跨平台。
- qt 依赖 c++，学习成本太高。flutter 桌面版还不太成熟。我更擅长 js 开发。
- 截屏依赖本地系统，这是目前浏览器做不到的。
- 最后只有 js 类跨平台方案，我选择了较为成熟，使用最多的 electron。

### A JavaScript error occurred in the main process

这是主进程报错，可能由于各种原因导致，真正有用的错误信息是下面的具体错误，并且是代码错误。因此直接搜索“A JavaScript error occurred in the main process”很难解决问题。

一般来说，重装软件，恢复设置能解决 99%的问题。最好的办法是记录详细报错信息，提交一个[issue](https://github.com/xushengfeng/eSearch/issues/new?assignees=&labels=bug&template=bug_report.md&title=%E2%80%A6%E2%80%A6%E5%AD%98%E5%9C%A8%E2%80%A6%E2%80%A6%E9%94%99%E8%AF%AF)进行反馈。

积累的错误及其讨论、解决方案：[#123](https://github.com/xushengfeng/eSearch/issues/123) [#133](https://github.com/xushengfeng/eSearch/issues/133)

### 更新版本后出现了以前没有的错误

一般是因为不同版本的配置不兼容，可以尝试在 设置-高级-高级设置 里 恢复默认设置。

若未能解决问题，请提交 issue

### 不再支持 Win7、Win8

Electron 官方不再支持 Win7、Win8，所以 eSearch 也不再支持。

但可以自己编译，见[文档](./docs/use/qa.md#兼容性)，部分功能可能无法使用。

## 贡献

请查看[贡献指南](CONTRIBUTING.md)

## 开发原因

我在用 Windows 时一直用这个好用的截屏软件：[Snipaste - 截图 + 贴图](https://zh.snipaste.com/)，但我切换到 Linux，Snipaste 不支持（2019 年，现在已支持），所以我选择了[Flameshot](https://flameshot.org/)，很可惜它没有直观的取色器。

促使我开发 eSearch 的另一个契机是我很享受在手机上使用[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的即时信息搜索工具，但我没有找到电脑上类似的代替品。

所以我干脆自己开发一个“截屏+OCR+搜索+贴图”的软件。最开始用 python+pyqt 开发出[Information-portal](https://github.com/xushengfeng/Information-portal.git)，但因为我不熟悉 pyqt，所以我转战:electron:，开发出本软件。😄

## 赞赏与支持

精神支持：点亮右上角 star 星标 🌟

物质支持：[个人主页赞赏](https://github.com/xushengfeng)

行动：反馈 bug、提供新功能点子、[参与开发](CONTRIBUTING.md)

## License

[GPL-3.0](LICENSE) © xushengfeng

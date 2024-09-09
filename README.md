# eSearch

(中文 | [English](README_en.md))

![LOGO](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/title_photo.svg)

[![license](https://img.shields.io/github/license/xushengfeng/eSearch)](LICENSE)
![](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)
[![release-date](https://img.shields.io/github/release-date/xushengfeng/eSearch)](https://github.com/xushengfeng/eSearch/releases/latest)
[![release](https://img.shields.io/github/v/release/xushengfeng/eSearch)](https://github.com/xushengfeng/eSearch/releases/latest)
[![](https://img.shields.io/github/downloads/xushengfeng/eSearch/total?color=brightgreen&label=总下载量)](https://github.com/xushengfeng/eSearch/releases/latest)
[![aur](https://img.shields.io/badge/aur-e--search-blue?logo=archlinux)](https://aur.archlinux.org/packages/e-search)
[![aur1](https://img.shields.io/badge/aur-e--search--git-blue?logo=archlinux)](https://aur.archlinux.org/packages/e-search-git)

## 简介

eSearch 是[Information-portal](https://github.com/xushengfeng/Information-portal.git)的:electron:重写版(顺便加了亿些功能)

主要是想在 Linux 上(win 和 mac 上也能用)实现[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的**屏幕搜索**功能，当然也是一款方便的**截屏软件**。

经过数次版本迭代，eSearch 的功能愈加丰富

即拥有 **截屏+OCR+搜索+翻译+贴图+以图搜图+录屏**

![截屏界面](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/1.webp)

> 字体是[FiraCode](https://github.com/tonsky/FiraCode)，字体可在设置里设置

![识别文字主页面](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/8.webp)

## 下载安装

到网站[eSearch](https://esearch-app.netlify.app/#download)下载

或在右侧 releases 打开标签，选择符合你系统的包并下载安装

国内可以用[GitHub Proxy](https://mirror.ghproxy.com)加速下载

ArchLinux 可在 AUR 查找安装 `e-search`或`e-search-git`

winget `winget install esearch`

## OCR 服务

本地 OCR 由[PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)的模型提供支持。开箱即用。

默认启用本地 OCR 服务，若想使用在线 OCR，目前提供了百度在线 OCR，需要依据[教程](https://cloud.baidu.com/doc/OCR/s/dk3iqnq51)获取*API KEY* 以及 _Secret KEY_，截止 2022 年 1 月，百度 OCR 还是可以[免费领取服务](https://cloud.baidu.com/doc/OCR/s/dk3iqnq51)。将获取到的*API KEY* 和*Secret KEY* 以及相应的你选择的文字识别服务[_URL_](https://cloud.baidu.com/doc/OCR/s/zk3h7xz52#%E8%AF%B7%E6%B1%82%E8%AF%B4%E6%98%8E) 填入软件设置，去掉离线 OCR 的勾选即可使用在线 OCR。

## 启动

在你的启动器打开 eSearch，他将出现在托盘。

默认快捷键为 <kbd>Alt</kbd>+<kbd>C</kbd>(你也可以在设置里设置快捷键)

### CLI

**eSearch**支持 cli，可以通过命令行进行简单的操作。见[文档](./docs/use/main.md#cli)

## 功能

已经勾选的功能是开发过程最新功能，但可能还没发布在最新版本

更多介绍见[文档](./docs/use/start.md)

- [x] 截屏
  - [x] 框选裁切，快捷键调整
  - [x] 框选大小栏可输入四则运算式调整
  - [x] 取色器/放大镜
  - [x] 画笔（自由画笔）
  - [x] 几何形状（边框填充支持调节）
  - [x] 图像滤镜（支持局部马赛克模糊和色彩调节）
  - [x] 自定义框选松开后的操作（如框选后自动 OCR）
  - [x] 快速截取全屏到剪贴板或自定义的目录
  - [x] 窗口和控件选择（使用 OpenCV 边缘识别）
  - [x] 长截屏（即滚动截屏）
  - [x] 多屏幕（分开屏幕截屏，目前不支持合成一张图的跨屏截屏）
- [x] 录屏
  - [x] 录制全屏/自定义大小
  - [x] 按键提示
  - [x] 光标位置提示
  - [x] 录音
  - [x] 录制摄像头
  - [x] 自定义比特率
  - [x] 可后期裁剪
  - [x] gif、webm、mp4 等格式
  - [x] 虚拟背景
- [x] 保存（可选保存为 SVG 可编辑文件）
- [x] 其他应用打开
- [x] 复制到剪贴板
- [x] 屏幕贴图
  - [x] 滚轮缩放
  - [x] 恢复默认大小位置
  - [x] 透明度
  - [x] 鼠标穿透
- [x] 二维码识别
- [x] OCR 识别
  - [x] 离线 OCR（[eSearch-OCR](https://github.com/xushengfeng/eSearch-OCR)）
  - [x] 自定义离线 OCR 模型和字典
  - [x] 其他在线 OCR
  - [x] 在线公式识别
  - [x] 支持自己申请秘钥
  - [x] 表格识别（在线）
- [x] 以图搜图
- [x] 划词句来搜索
- [x] 识别展示
  - [x] 自动搜索翻译
  - [x] 搜索
  - [x] 翻译
  - [x] 自定义搜索翻译引擎
  - [x] 软件自带浏览器打开
  - [x] 失焦关闭
  - [x] 系统浏览器打开
  - [x] 链接识别
  - [x] 历史记录
  - [x] 自动删除换行（用于自动排版）
  - [x] 查找替换（支持正则匹配）
  - [x] 其他编辑器编辑（支持自动重载）
  - [x] 行号
  - [x] 拼写检查
- [x] Wayland 桌面

https://user-images.githubusercontent.com/28475549/155870834-34ffa59f-9eac-4eea-9d82-135681d7dfa9.mp4

> 截屏，自由调整框选大小（视频约 2.6MB）

https://user-images.githubusercontent.com/28475549/155870857-99c7d6d0-a90b-4558-872a-85f2603225d6.mp4

> 取色器（视频约 1MB）

https://user-images.githubusercontent.com/28475549/155870867-fb0d31f0-2e06-431c-9ae9-ee3af5a5c08e.mp4

> Ding 在屏幕上，透明度调节、归位以及鼠标操作（视频约 1.8MB）

![3](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/3.webp)

> 绘图界面

https://user-images.githubusercontent.com/28475549/155870881-9b2fc1b3-77de-4a99-8076-ed49b7b5c4c0.mp4

> 主页面搜索和其他应用编辑（视频约 1.6MB）

![3](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/4.webp)

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

[具体技术说明](docs/index.md)

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

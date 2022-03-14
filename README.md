# eSearch

![LOGO](https://esearch.vercel.app/readme/title_photo.svg)

## 简介

eSearch 是[Information-portal](https://github.com/xushengfeng/Information-portal.git)的:electron:重写版(顺便加了亿些功能)

主要是想在 Linux 上(win 和 mac 上也能用)实现[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的**屏幕搜索**功能，当然也是一款方便的**截图软件**。

即 **截屏+OCR+搜索+贴图**

![截屏界面](https://esearch.vercel.app/readme/1.png)

> 字体是[FiraCode](https://github.com/tonsky/FiraCode)，字体可在设置里设置

![识别文字主界面](https://esearch.vercel.app/readme/2.png)

## 下载安装

到网站[eSearch](https://esearch.vercel.app/#download)下载

或在右侧 releases 打开标签，选择符合你系统的包并下载安装

国内快速下载链接：[Releases · xushengfeng/eSearch · fastgit](https://hub.fastgit.xyz/xushengfeng/eSearch/releases)

ArchLinux 可在 AUR 查找安装 `e-search`或`e-search-git`

## OCR 服务

确保你的电脑安装了 python<=3.9

下载[eSearch-service](https://github.com/xushengfeng/eSearch-service)并安装运行

```shell
git clone https://github.com/xushengfeng/eSearch-service.git
cd eSearch-service
python setup.py
python serve.py
```

或使用 Docker：[Docker 安装指南](https://github.com/xushengfeng/eSearch-service#Docker)

## 源码运行&编译

编译需要`python` 和 `C++`环境，Windows 下编译需要 `python` 和`visual studio`（安装 C++）

```shell
git clone https://github.com/xushengfeng/eSearch.git
cd eSearch
npm install
# 运行
npm start
# 编译
npm run make
```

## 启动

在你的启动器打开 eSearch，他将出现在托盘。Gnome 用户需要安装[appindicator](https://extensions.gnome.org/extension/615/appindicator-support/)插件

默认快捷键为 <kbd>Ctrl </kbd>+<kbd>Shift </kbd>+<kbd>Z </kbd>(你也可以在设置里设置快捷键)

### Linux 下的快捷键

大多数 Linux 桌面环境支持自定义快捷键，**eSearch**支持 cli，这也意味着你可以进行系统级设置快捷键

```shell
e-search
	-a # 自动搜索
	-c # 截图搜索
	-s # 选中搜索
	-b # 剪贴板搜索
	-q # 快速截屏
	-r # 不显示启动通知
```

不建议在终端进行自动或选中搜索，否则**eSearch**会执行<kbd>Ctrl</kbd>+<kbd>C</kbd>，从而导致终止终端程序

## 功能

-   [x] 截屏
    -   [x] 框选裁切
    -   [x] 框大小位置可调整(支持方向键或 WASD)
    -   [x] 取色器
    -   [x] 放大镜
    -   [x] 画笔（自由画笔）
    -   [x] 几何形状（边框填充支持调节）
    -   [x] 高级画板设置（使用 Fabric.js 的 api）
    -   [x] 图像滤镜（支持局部马赛克模糊和色彩调节）
    -   [x] 自定义框选松开后操作
    -   [x] 快速截取全屏到剪贴板或自定义的目录
    -   [ ] 窗口选择
    -   [ ] 控件选择
    -   [ ] 多屏幕
-   [x] 保存（可选保存为 SVG 可编辑文件）
-   [x] 其他应用打开
-   [x] 复制到剪贴板
-   [x] 钉在屏幕上
    -   [x] 滚轮缩放
    -   [x] 恢复默认大小位置
    -   [x] 透明度
    -   [x] 鼠标穿透
-   [x] 二维码识别
-   [x] OCR 识别
    -   [x] 本地 OCR
    -   [x] 其他 OCR（在[eSearch-service](https://github.com/xushengfeng/eSearch-service)实现）
-   [ ] 以图搜图
-   [x] 托盘
-   [x] 划词句来搜索
-   [x] 识别展示
    -   [x] 自动搜索翻译
    -   [x] 搜索
    -   [x] 翻译
    -   [x] 自定义搜索翻译引擎
    -   [x] 软件自带浏览器打开
    -   [x] 跟随关闭、失焦关闭
    -   [x] 系统浏览器打开
    -   [x] 链接识别
    -   [x] 历史记录
    -   [x] 自动删除换行（用于自动排版）
    -   [x] 查找替换（支持正则匹配）
    -   [x] 其他编辑器编辑（支持自动重载）
-   [ ] Wayland 桌面(为什么 electron 截不了 wayland!)
-   [ ] 独立于 electron 的截图 api

https://user-images.githubusercontent.com/28475549/155870834-34ffa59f-9eac-4eea-9d82-135681d7dfa9.mp4

> 截图，自由调整框选大小（视频约 2.6MB）

https://user-images.githubusercontent.com/28475549/155870857-99c7d6d0-a90b-4558-872a-85f2603225d6.mp4

> 取色器（视频约 1MB）

https://user-images.githubusercontent.com/28475549/155870867-fb0d31f0-2e06-431c-9ae9-ee3af5a5c08e.mp4

> Ding 在屏幕上，透明度调节、归位以及鼠标操作（视频约 1.8MB）

![3](https://esearch.vercel.app/readme/3.png)

> 绘图界面

https://user-images.githubusercontent.com/28475549/155870881-9b2fc1b3-77de-4a99-8076-ed49b7b5c4c0.mp4

> 主界面搜索和其他应用编辑（视频约 1.6MB）

![3](https://esearch.vercel.app/readme/4.png)

> 主界面查找替换（支持正则）

https://user-images.githubusercontent.com/28475549/155870885-d41bcbda-6124-4e29-ac19-694d27f6dba1.mp4

> 其他应用打开（Linux 可以列出诸多应用，Win 和 mac 不会列出，但可以自选打开更多应用）（视频约 1.6MB）

## 测试

在 ArchLinux,KDE plasma,Xorg 下测试通过

Windows10 和 Windows11 测试通过

macOS Catalina 测试通过

Wayland 桌面环境暂时不支持

## 开发原因

我在用 Windows 时一直用这个好用的截图软件：[Snipaste - 截图 + 贴图](https://zh.snipaste.com/)，但我现在切换到 Linux，Snipaste 不支持，所以我选择了[Flameshot](https://flameshot.org/)，很可惜它没有直观的取色器。

促使我开发 eSearch 的另一个契机是我很享受在手机上使用[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的即时信息搜索工具，但我没有找到电脑上类似的代替品。

所以我干脆自己开发一个“截图+OCR+搜索+贴图”的软件。最开始用 python+pyqt 开发出[Information-portal](https://github.com/xushengfeng/Information-portal.git)，但因为我不熟悉 pyqt，所以我转战:electron:，开发出本软件。😄

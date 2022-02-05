# eSearch

![LOGO](readme/title_photo.svg)

## 简介

eSearch是[Information-portal](https://github.com/xushengfeng/Information-portal.git)的:electron:重写版(顺便加了亿些功能)

主要是想在Linux上(win,mac理论上能用)实现[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的屏幕搜索功能，当然也是一款方便的截图软件

![截屏界面](https://raw.fastgit.org/xushengfeng/eSearch-website/master/readme/1.png)

> 字体是[FiraCode](https://github.com/tonsky/FiraCode)，对角坐标默认不显示，对角坐标和字体均可在设置里设置

![识别文字主界面](https://raw.fastgit.org/xushengfeng/eSearch-website/master/readme/2.png)

## 下载安装

到网站[eSearch](https://esearch.vercel.app/#download)下载

或在右侧releases打开标签，选择符合你系统的包并下载安装

国内快速下载链接：[Releases · xushengfeng/eSearch · fastgit](https://hub.fastgit.org/xushengfeng/eSearch/releases)

## OCR服务

确保你的电脑安装了python

下载[eSearch-service](https://github.com/xushengfeng/eSearch-service)并安装运行

```shell
git clone https://github.com/xushengfeng/eSearch-service.git
cd eSearch-service
pip install -r requirements.txt
python serve.py
```

## 源码运行&编译

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

在你的启动器打开eSearch,他将出现在托盘.Gnome用户需要安装[appindicator](https://extensions.gnome.org/extension/615/appindicator-support/)插件

默认快捷键为 <kbd>Ctrl </kbd>+<kbd>Shift </kbd>+<kbd>Z </kbd>(你也可以在设置里设置快捷键)

### Linux下的快捷键

大多数Linux桌面环境支持自定义快捷键，**eSearch**支持cli，这也意味着你可以进行系统级设置快捷键

```shell
e-search
	-a # 自动搜索
	-c # 截图搜索
	-s # 选中搜索
	-b # 剪贴板搜索
```

不建议在终端进行自动或选中搜索，否则**eSearch**会执行<kbd>Ctrl</kbd>+<kbd>C</kbd>，从而导致终止终端程序

## 功能

- [x] 截屏
  - [x] 框选裁切
  - [x] 框大小位置可调整(支持方向键或WASD)
  - [x] 取色器
  - [x] 放大镜
  - [x] 画笔
  - [x] 画笔撤销
  - [x] 色板
  - [x] 画笔粗细
  - [x] 高级画板设置
  - [x] 图像滤镜
  - [ ] 窗口选择
  - [ ] 控件选择
  - [ ] 多屏幕
- [x] 保存
- [x] 复制到剪贴板
- [x] 钉在屏幕上
  - [x] 滚轮缩放
  - [x] 恢复默认大小位置
  - [x] 透明度
  - [x] 鼠标穿透
- [x] 二维码识别
- [x] OCR识别
  - [x] 本地OCR
  - [x] OCR插件（在[eSearch-service](https://github.com/xushengfeng/eSearch-service)实现）
- [ ] 以图搜图
- [x] 托盘
- [x] 系统选中搜索
- [x] 识别展示
  - [x] 自动搜索翻译
  - [x] 搜索
  - [x] 翻译
  - [x] 内部打开
  - [x] 浏览器打开
  - [x] 链接识别
  - [x] 历史记录
- [ ] Wayland桌面(为什么electron截不了wayland!)
- [ ] 独立于electron的截图api

![4](https://raw.fastgit.org/xushengfeng/eSearch-website/master/readme/4.gif)

> 截图，自由调整框选大小

![5](https://raw.fastgit.org/xushengfeng/eSearch-website/master/readme/5.gif)

> 取色器

![6](https://raw.fastgit.org/xushengfeng/eSearch-website/master/readme/6.gif)

> ding在屏幕上

![3](https://raw.fastgit.org/xushengfeng/eSearch-website/master/readme/3.png)

> 绘图界面

## 测试

在ArchLinux,KDE plasma,Xorg下测试通过

win7截图出现白屏，win10能达到大部分效果

Wayland无法运行

## 开发原因

我在用Windows时一直用这个好用的截图软件：[Snipaste - 截图 + 贴图](https://zh.snipaste.com/)，但我现在切换到Linux，Snipaste不支持，所以我选择了[Flameshot](https://flameshot.org/)，很可惜它不支持取色器。

促使我开发eSearch的另一个契机是我很享受在手机上使用[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的即时信息搜索工具，但我没有找到电脑上类似的代替品。

所以我干脆自己开发一个“截图+OCR+搜索+贴图”的软件。最开始用python+pyqt开发出[Information-portal](https://github.com/xushengfeng/Information-portal.git)，但因为我不熟悉pyqt，所以我转战:electron:，开发出本软件。😄


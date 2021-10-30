# eSearch

![](readme/title_photo.svg)

## 简介

eSearch是[Information-portal](https://github.com/xushengfeng/Information-portal.git)的:electron:重写版(顺便加了些功能)

主要是想在Linux上(win,mac理论上能用)实现[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的屏幕搜索功能

![1](readme/1.png)

![1](readme/2.png)

## 运行

```shell
git clone https://github.com/xushengfeng/eSearch.git
cd eSearch
npm install
npm start
```

## 功能

- [x] 截屏
  - [x] 多窗口
  - [x] 框选裁切
  - [ ] 框可移动
  - [x] 十字标
  - [ ] 其他光标
  - [x] 框大小
  - [x] 取色器
  - [x] 放大镜
  - [x] 画笔
  - [x] 画笔二次编辑
  - [ ] 画笔撤销
  - [ ] 画画鼠标跟随
  - [ ] 马赛克
- [x] 保存
- [x] 复制到剪贴板
- [x] 钉在屏幕上
  - [ ] 展示缩放百分比
  - [ ] 滚轮缩放
  - [ ] 恢复默认大小
- [x] 二维码识别
- [x] OCR识别
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

## 开发原因

我在用Windows时一直用这个好用的截图软件：[Snipaste - 截图 + 贴图](https://zh.snipaste.com/)，但我现在切换到Linux，Snipaste不支持，所以我选择了[Flameshot](https://flameshot.org/)，很可惜它不支持取色器。

促使我开发eSearch的另一个契机是我很享受在手机上使用[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的即时信息搜索工具，但我没有找到电脑上类似的代替品。

所以我干脆自己开发一个“截图+OCR+搜索+贴图”的软件。最开始用python+pyqt开发出[Information-portal](https://github.com/xushengfeng/Information-portal.git)，但因为我不熟悉pyqt，所以我转战:electron:，开发出本软件。:smile:


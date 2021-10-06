#  Information-portal-js

## 简介

Information-portal-js是[Information-portal](https://github.com/xushengfeng/Information-portal.git)的:electron:重写版(顺便加了些功能)

主要是想在Linux上(win,mac理论上能用)实现[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的屏幕搜索功能

但现在主程序GUI没搞好,只完成了截屏功能

## 运行

```shell
git clone https://github.com/xushengfeng/Information-portal-js.git
cd Information-portal-js
npm install
npm start
```

## 功能

- [x] 截屏
  - [x] 多窗口
  - [x] 框选裁切
  - [ ] 框可移动
  - [ ] 框大小
  - [ ] 取色器
  - [ ] 放大镜
  - [ ] 画笔
  - [ ] 画笔二次编辑
  - [ ] 画笔撤销
- [x] 保存
- [x] 复制到剪贴板
- [x] 钉在屏幕上
  - [ ] 展示缩放百分比
  - [ ] 滚轮缩放
  - [ ] 恢复默认大小
- [x] 二维码识别
- [x] OCR识别
- [x] 托盘
- [ ] 从剪贴板打开
- [x] 识别展示
  - [ ] 搜索
  - [ ] 翻译
  - [ ] 内部打开
  - [ ] 浏览器打开
  - [ ] 链接识别

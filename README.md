#  eSearch

## 简介

eSearch是[Information-portal](https://github.com/xushengfeng/Information-portal.git)的:electron:重写版(顺便加了些功能)

主要是想在Linux上(win,mac理论上能用)实现[锤子大爆炸](https://www.smartisan.com/pr/videos/bigbang-introduction)或[小米传送门](https://www.miui.com/zt/miui9/index.html)这样的屏幕搜索功能

但现在主程序GUI没搞好,只完成了截屏功能

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
- [x] 系统选中搜索
- [x] 识别展示
  - [x] 自动搜索翻译
  - [x] 搜索
  - [x] 翻译
  - [x] 内部打开
  - [x] 浏览器打开
  - [x] 链接识别

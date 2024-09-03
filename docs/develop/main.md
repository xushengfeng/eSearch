# 主进程

## 异形窗口

[electron 讨论](https://github.com/electron/electron/issues/1335)

贴图、广截屏、屏幕翻译都使用了异形透明窗口，部分区域接收鼠标和键盘事件，其他区域只负责显示。

通过`screen.getCursorScreenPoint()`获取鼠标位置，通过减去窗口位置，计算出相对位置，把相对位置发送到渲染进程。

渲染进程根据相对位置，通过`elementFromPoint(s)()`获取鼠标所在元素，这里可以通过 js 判断是否为可点击元素，再把`boolean`发送给主进程，主进程根据`boolean`设置鼠标穿透`setIgnoreMouseEvents`。

然而 macOS 和 Wayland 不支持在窗口外获取鼠标位置，当窗口鼠标穿透时就再也无法获取鼠标位置了。广截屏操作不多，使用了全局快捷键代替鼠标点击，其他的暂时没有解决方案。

## 运行目录

根据编译出来的 js 文件深度，可以通过`path.join(__dirname, 向上目录深度)`获取你想要的运行目录，**eSearch**编译的目录为`eSearch/out/main/main.js`和`eSearch/out/renderer/*.html`，定义的`runPath`为`join(__dirname, '../../')`也就是项目目录。

需要注意**eSearch**不使用 asar 打包，`app.isPackaged`时的`__dirname`应该有所不同，具体请自己实验。

## 系统语言

一般可以通过`app.getLocale()`获取当前语言。然而，为了减小打包体积，**eSearch**移除了`locales`目录，而`app.getLocale()`依赖于`locales`目录。更好的方法是`app.getPreferredSystemLanguages()`，这是真正的获取系统语言的 api。

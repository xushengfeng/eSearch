# 常见问题

## 反馈&建议

在[github](https://github.com/xushengfeng/eSearch/issues)提交反馈

## 兼容性

由于 eSearch 框架使用 Electron，将不再支持 Win7、Win8

但仍然可以运行在 Win10、MacOS、Linux 等平台上。

最后支持 Win7 等的版本为 1.12.4，但支持 OCR 的版本是 1.8.0

可以自己[编译 eSearch](../develop/start.md) ，把一些库降级，并且还能使用新版本的功能（当然肯定不完整了）

降级的库有：

```
electron -> 22.3.27
onnxruntime-node -> 1.12.0或更低版本
```

编辑`package.json`文件，找到`dependencies`和`devDependencies`下的`electron`和`onnxruntime-node`，更改版本号，然后运行`pnpm install`命令重新安装依赖。

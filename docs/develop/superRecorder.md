# 超级录屏

通过记录鼠标的坐标和点击，自动运镜。

核心是视频裁切。使用 FFmpeg 是自然的选择，wasm 太慢，普通录屏的裁剪是通过命令控制 FFmpeg 二进制来实现的。

观察 Electron（Chrome）的运行目录，我们可以发现有一个`ffmpeg.dll`或`libffmpeg.so`库，用于浏览器的媒体解码和渲染。浏览器有的，我们就不需要额外引入 FFmpeg 了，现在有一个新的 web api：[WebCodecs](https://developer.mozilla.org/zh-CN/docs/Web/API/WebCodecs_API)，可以调用浏览器的媒体解码编码能力。

在这之前，我先说明媒体编码的重要性，如果我们用连续截屏的方式代替录屏，虽然 ImageData 可以很方便地进行图片截取，但内存会被迅速占用：

> 单帧全彩色高清（1920x1080）视频（每像素 4 字节）为 8,294,400 字节。
>
> 在典型的每秒 30 帧的情况下，每秒高清视频将占用 248,832,000 字节（~249 MB）。
>
> 一分钟的高清视频需要 14.93 GB 的存储空间。

视频编码其实就是一个压缩过程，把相同像素合并，还有其他高级的压缩操作。这样，我们借助视频编码压缩存储帧，编辑时解码成 ctx，编辑后再次编码压缩，导出时也使用了编码。

## WebCodecs

具体请见[MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/WebCodecs_API)、[chrome dev 博客](https://developer.chrome.google.cn/docs/web-platform/best-practices/webcodecs?hl=zh-cn)、[w3c](https://w3c.github.io/webcodecs)等文档，或者学习[WebAV](https://github.com/bilibili/WebAV)这个项目，由于这个 API 复杂且新，网络上的文档不多，我也在学习中，下面是我的部分总结。

这里主要使用`VideoDecoder`和`VideoEncoder`，通过`new`确定回调（类似`reader`之类的 api），然后必须`configure`。使用时调用各自的`decode`和`encode`即可。

`VideoFrame`是原始帧数据，需要及时`close`。

`flush`方法可以理解为 Promise `onend`之类的方法，需要注意的是，`for`循环后用`flush`能正常等待完成操作，但其他异步的循环会提前结束（与其是结束，其实的处理队列*暂时*为空），所以要确保异步循环完毕再`flush`。

`close`也要注意调用。

## 转换（编辑）

我们处理一个视频，需要解码（解压缩）->编辑处理->编码（压缩）

```ts
const decoder = new VideoDecoder({
  output: (frame: VideoFrame) => {
    // 解码 处理 编码
    const nFrame = transformX(frame);
    encoder.encode(nFrame);
    nFrame.close();
  },
  error: (e) => console.error("Decode error:", e),
});
```

`decoder`解码后再编码，`output`可以视为异步循环，所以要注意`flush`的调用问题。

```ts
for (const chunk of src) {
  decoder.decode(chunk);
}
await decoder.flush();
await encoder.flush();
```

这里先对`decoder` `flush`，因为 decode 用的是`for`同步循环，确保把所有任务都放到 encode 处理队列后，再对`encoder`进行`flush`。不能交换两者顺序，否则导致提前结束，代码提交 [944a8a0](https://github.com/xushengfeng/eSearch/commit/944a8a0f27cb488a6c6b62d61c74901dfa7b812a)就是解决这个 bug 的。

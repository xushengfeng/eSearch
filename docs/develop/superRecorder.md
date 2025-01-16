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

GOP，指一个关键帧到下一个关键帧前的所有帧序列。

大部分编码模式在解码时除了必要的关键帧，还要前面的所有帧（对于一个 GOP 来说），所以，对于不是连续获取帧的操作（也就是除了播放），我们需要`flush`，并重新解码一遍。

```ts
await decoder.flush();
for (let i = keyFrameIndex; i <= thisIndex; i++) {
  decoder.decode(chunks[i]);
}
await decoder.flush();
```

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

为了防止一下子往处理队列里加入太多数据导致卡顿，在 decode 循环中可以提取`flush`：

```ts
for (const chunk of src) {
  if (chunk.type === "key") {
    await decoder.flush();
    await encoder.flush();
  }
  decoder.decode(chunk);
}
await decoder.flush();
await encoder.flush();
```

如果 encode 和 decode 的关键帧索引不同，理论上会错位，但 encoder 即使 `flush` 也能正确编码，似乎 `flush` 不会清空相关的帧，而 decoder 在 `flush` 后需要重新传入 keyFrame。在规范中 decoder 有[key chunk required](https://www.w3.org/TR/webcodecs/#dom-videodecoder-key-chunk-required-slot)这一说法，但 encode 确实没有，也没有规定。

## 优化

处理视频的成本很高，所以我们需要进行优化。

注意到我们的编辑（如改变运镜）只会影响一部分的帧，其他帧的画面是不变的，所以我们可以考虑复用数据。这是从看得见的画面上考虑。我们还有考虑编码中的复用情况。考虑到帧依赖前面的帧，所以某个帧变化，在 GOP 中其后面的所有帧都要改变。解编码时需要前面的帧。索引，一个 GOP 里面的帧变化，整个 GOP 都要重新渲染，但这比所有帧重新渲染性能高很多。

在 eSearch 中，存储了原始录屏数据，同时存储了每个帧的操作，比如裁切的矩形。然后我们对比每个帧的操作，得到变化的帧。再填充变化帧所属的 GOP 帧索引，只需要重新渲染他们就可以了。这有点像前端的虚拟 DOM。

由于我们只需要处理部分帧，所以需要帧的标识，在 eSearch 中使用的是时间戳。变速操作最后再改变时间戳。

删除帧也是可以优化的。比如某个 GOP 后面全是要删除的帧，那他们就不会被这个 GOP 里的帧所依赖，我们在解码时就可以直接忽略他们。

视频数据十分容易膨胀，所以我们要关注内存，分析是否有未回收的数据。

## 打包

我们平时接触的视频格式：mp4、webm 等记录了不止视频，还有帧率、声音、甚至字幕等信息。他们被成为容器。

不同容器支持的视频格式也不同，参考[mdn](https://developer.mozilla.org/zh-CN/docs/Web/Media/Formats/Video_codecs#%E7%BC%96%E8%A7%A3%E7%A0%81%E5%99%A8%E8%AF%A6%E7%BB%86%E4%BF%A1%E6%81%AF)

浏览器并没有提供容器包装器，只提供了编码器，所以我们需要其他的库，如 mp4box.js，我使用 mp4-muxer 和 wemb-muxer。

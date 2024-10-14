# 翻译

包括屏幕翻译和主页面的翻译。

软件可以通过各大翻译平台的 API 来实现翻译功能，大部分翻译引擎需要提供 Key（密钥）等信息才能使用，设置中提供了相关链接，你在添加翻译器时可以看到，大部分需要付费才能使用，下面也会介绍一些免费的用法。

> [!IMPORTANT]
>
> 请注意，翻译引擎的准确度和翻译质量都取决于翻译平台的质量，请根据自己的需求选择合适的翻译平台。
> 翻译的结果仅供参考，本软件提供的翻译功能仅供学习交流使用，软件作者不对翻译结果负责。

在设置添加翻译器，在弹出的对话框里为翻译器命名（可重名，可不填）、选择翻译引擎类型，并根据链接指引在第三方平台创建 API，填入对话框。

点击测试，若提示测试通过，则可以完成添加。

如果填写的信息有所缺失，则无法点击完成。

可以添加同种翻译引擎的不同翻译器。

主页面翻译将显示翻译器名称。

可在设置调节翻译器顺序，第一个翻译器将作为*屏幕翻译*的翻译引擎，主页面翻译的多个翻译器显示也根据设置的顺序。

目前无法在屏幕翻译直接设置翻译语言，需要在设置中设置目标语言，一般已经自动设置为软件显示语言。

## 主页面翻译

你可以使用搜索引擎的方式进行翻译。自定义翻译引擎搜索 URL，翻译时打开在线翻译页面，自动填入文字翻译。

<details>
<summary>一些翻译URL</summary>
<pre>
Google, https://translate.google.com/?op=translate&text=%s
Deepl, https://www.deepl.com/translator#any/any/%s
金山词霸, http://www.iciba.com/word?w=%s
百度, https://fanyi.baidu.com/#auto/auto/%s
腾讯, https://fanyi.qq.com/?text=%s
</pre>
</details>

这些翻译需要打开他们的网站，页面大部分不简洁，因此**eSearch**提供了自定义翻译 API 的方式。

主页面翻译引擎列表里已经添加名为`翻译`的翻译引擎，你可以在设置中更改名字，调节顺序。

这个引擎可以打开软件内置翻译界面，通过读取设置好的翻译器，**同时**启用多个翻译器进行并行翻译。你可以方便地进行对照，并一键复制。

## 屏幕翻译

屏幕翻译将自动识别屏幕区域的文字，并翻译成目标语言。

适合科研图片、视频或游戏翻译。

在截屏工具栏按钮右上角可以切换屏幕翻译模式：贴图或自动翻译。

对于一些图片，除了需要翻译文字，还要同时关注图标原本的形状、结构等，可以使用贴图模式。就像[贴图](ding.md)一样，生成一个覆盖在原图上的窗口，同时把文字也翻译了。

贴图翻译拥有和贴图一样的功能：缩放、保存、复制等，区别是把图片的文字翻译了。

而对于需要不停翻译的地方，如视频或游戏，可以使用自动翻译模式，定时截取屏幕并翻译。

---

高级技巧：

## 生词本

设置生词本，在主页面翻译时，把翻译结果添加到生词本。

生词本分为文件生词本和网络生词本。文件生词本可以把生词和翻译添加到指定文件，网络生词本可以把生词和翻译上传到网络服务器，与 Anki 的记忆软件联动。

模板用来格式化生词本的输出，`${from}`表示原始语言，`${to}`表示目标语言，`${fromT}`表示翻译前的文字，`${toT}`表示翻译后的文字，`${engine}`表示使用的翻译引擎。

模板示例：

```
${fromT} -> ${toT} (${engine})
```

以`Hello World`为例，翻译结果为`你好，世界`，模板输出为：

```
Hello World -> 你好，世界 (ChatGPT)
```

注意在一些格式中，如 JSON，请不要忘了双引号。

### 文件生词本

文件生词本只需要指定路径`path`和模板`template`。由于文件生词本使用文本追加模式，所以不支持 JSON 格式，可以使用 JSONL、csv、txt 等格式。

csv 格式示例：

```csv
"${fromT}", "${from}", "${toT}", "${to}", "${engine}"
```

文件示例内容如下，可以使用 Excel 等表格软件打开：

```csv
...
"Hello World", "en", "你好，世界", "zh", "ChatGPT"
...
```

### 网络生词本

Url 和请求体(body)可以使用模板。

以 Anki 为例：

安装 AnkiConnect 插件，并在 Anki 中启用插件。

URL：`http://127.0.0.1:8765`

请求体（`body`）

```json
{
  "action": "addNote",
  "version": 6,
  "params": {
    "note": {
      "deckName": "你的牌组",
      "modelName": "类型名称",
      "fields": {
        "Front": "${fromT}",
        "Back": "${toT}"
      },
      "options": {
        "allowDuplicate": false
      }
    }
  }
}
```

## 使用本地 LLM 模型翻译

你可以使用任何技术栈部署 LLM，但需要兼容 OpenAI 的 API。下面以 ollama 为例。

你需要在[ollama 官网](https://ollama.com/)下载并安装 ollama，添加模型。

在设置中添加翻译器，翻译引擎选择“ChatGPT”，填入 url：`http://localhost:11434/api/chat` ，config 则填入`{"model":"你的模型"}`，测试通过后，点击完成。拖动翻译器到第一个来默认启用。

注意 config 的冒号、引号均为英文，可以复制上面的 config 再修改。

### 其他免费 LLM 翻译服务

翻译引擎类型均为“ChatGPT”，记得设置 model。

[SiliconCloud](https://siliconflow.cn/zh-cn/siliconcloud)，需要注册

url: `https://api.siliconflow.cn/v1/chat/completions`

[GPT_API_free](https://github.com/chatanywhere/GPT_API_free)，需要 GitHub 账号绑定

url: `https://api.chatanywhere.tech/v1/chat/completions`

## 其他免费翻译服务

谷歌翻译、Yandex 翻译、腾讯交互式翻译，直接在软件设置中添加翻译器，测试通过即可。

[DeeplX](https://deeplx.owo.network/)

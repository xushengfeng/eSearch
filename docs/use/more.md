# 使用技巧

## 撤销

#### 时间线模式撤销

任何编辑历史都不会在撤销或重做过程丢失，而是以时间为顺序记录当前状态。下面的字母只是比喻。

<table><tbody><tr><td>假设你的编辑过程</td><td>A =&gt; AB =&gt; <strong>ABC</strong></td></tr><tr><td>撤销</td><td>A =&gt; <strong>AB</strong> =&gt; ABC</td></tr><tr><td>在“AB”基础上编辑，如添加D</td><td>A =&gt; AB =&gt; ABC =&gt; AB =&gt; <strong>ABD</strong></td></tr></tbody></table>

#### 撤销&重做

撤销是恢复到当下之前的状态，可以看成回到过去。重做是在撤销后恢复到之后的状态，可以看成回到现在。

<table><tbody><tr><td>假设你的编辑过程</td><td>A =&gt; AB =&gt; <strong>ABC</strong></td></tr><tr><td>撤销</td><td>A =&gt; <strong>AB</strong> =&gt; ABC</td></tr><tr><td>再次撤销</td><td><strong>A</strong> =&gt; AB =&gt; ABC</td></tr><tr><td>重做</td><td>A =&gt; <strong>AB</strong> =&gt; ABC</td></tr></tbody></table>

## 离线 OCR

若想添加自己训练的模型或其他语种的模型，请将其转换为 onnx 格式，并将检测模型（文件名包含 det）、识别模型（文件名包含 rec）、字典文件一起选中，拖拽进设置的离线 OCR 设置项中。

## 翻译

软件可以通过各大翻译平台的 API 来实现翻译功能，在屏幕翻译和主页面翻译引擎的“翻译”中适用。

在设置添加翻译器，在弹出的对话框里为翻译器命名、选择翻译引擎类型，并根据链接指引在第三方平台创建 API，填入对话框。

点击测试，若提示测试通过，则可以完成添加。

### 使用本地 LLM 模型翻译

你可以使用任何技术栈部署 LLM，但需要支持网络访问。下面以 ollama 为例。

你需要在[ollama 官网](https://ollama.com/)下载并安装 ollama，添加模型。

在设置中添加翻译器，翻译引擎选择“ChatGPT”，填入 url：`http://localhost:11434/api/chat` ，config 则填入`{"model":"你的模型"}`，测试通过后，点击完成。拖动翻译器到第一个来默认启用。

注意 config 的冒号、引号均为英文，可以复制上面的 config 再修改。

### 其他免费 LLM 翻译服务

[GPT_API_free](https://github.com/chatanywhere/GPT_API_free)

url: `https://api.chatanywhere.tech/v1/chat/completions`

[SiliconCloud](https://siliconflow.cn/zh-cn/siliconcloud)

url: `https://api.siliconflow.cn/v1/chat/completions`

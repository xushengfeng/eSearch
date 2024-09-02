# 软件主体

**eSearch** 并不像其他软件一样有一个主要窗口，比如音乐软件就有一个主要的音乐播放窗口。

你最常使用的应该是*截屏窗口*，框选屏幕内容。而文字识别又会打开另一个窗口，我一般称他为*主页面*，你也可以叫他编辑器，不管怎样，我们都知道这是用来编辑文字的。还有*录屏窗口*、_贴图窗口_、_屏幕翻译窗口_、*高级图片编辑窗口*和*设置窗口*。这些窗口可能有小窗口，可能不止一个，但这不是我们在使用时说关心的，我们只需要知道 **eSearch** 功能丰富，基本一个功能有一个窗口界面。而这些窗口基本可以在截屏窗口中打开。

你运行**eSearch**时，除了弹出的通知提醒程序已运行，在*托盘*（一般在桌面右下角或右上角，看时间的地方）处会显示一个图标。你可以右键点击它，进行图片搜索、打开设置或退出程序。

除了通过托盘截屏，你还可以通过快捷键（默认是<kbd>Alt</kbd>+<kbd>C</kbd>或<kbd>⌥</kbd><kbd>C</kbd>）打开截屏窗口。

## 自动搜索

当你选中一段文字时，**eSearch** 在主页面打开这个文字。如果没有选中文字，**eSearch** 会打开截屏。

<details>
<summary>Wayland</summary>
Wayland 环境下无法获取选中文字，在KDE下甚至会造成按键锁定，见 https://github.com/xushengfeng/eSearch/issues/248#issuecomment-2236211435"> GitHub issue
</details>

---

下面是复杂用法，一般很少接触。

## cli

**eSearch** 提供了一个命令行界面，你可以在命令行中输入命令来执行一些操作。Linux 和 macOS 都可以直接在命令行运行`e-search`（如果没有，请尝试`esearch`），Windows 需要定义环境变量才可以在 powershell 中运行。

`--`加上命令表示表示命令名，`-`表示缩写，我会把他们写在一起，两者等效，有的命令无缩写。参数可以这样表示：` -t Hello``-t "Hello World" `或`-t="Hello World"`。

`-h,--help`（帮助），`-v,--version`（版本），`--config`（打开配置文件）,`--dev`（调试模式/开发者模式）

如：
`e-search --help`或`e-search -v`

可以在不打开截屏界面的情况下使用部分功能，这时可以指定图片位置，否则自动截取全屏。

通过`-i,--input`指定图片位置（可选）。

`--delay`指定截屏延迟时间（毫秒）

### 保存

`-s,--save`保存到路径或剪贴板。

后面可以跟`-p,--path`指定保存路径，`--clipboard`保存到剪贴板。

如果不指定路径，依次尝试快速截屏位置、上次保存位置。文件名在设置中指定。

不会自动创建路径中不存在的文件夹。

如：

```shell
e-search --save --path /path/to/save
e-search -s --clipboard
e-search --save --path /path/to/save --delay 500
```

<!-- todo 可指定文件名 -->

后面可跟`-n`，指定连拍次数。`--dt`指定间隔时间，单位为毫秒，默认 100 毫秒。

如：

```shell
# 连拍 3 次，间隔 500 毫秒，保存到 /path/to/save/默认文件名 文件夹中，文件名用序号表示
e-search --save --path /path/to/save -n 3 --dt 500
```

### 文字识别

`-o,--ocr`

后面可跟`--engine`指定引擎。

可跟`--search`或`--trans`指定打开主页面时进行搜索还是翻译。不指定时自动判断。

如：

```shell
e-search --ocr --engine 默认 --trans
```

### 以图搜图

`-m,--img`

后面参数同文字识别。

### 贴图

`-d,--ding`

在光标位置贴图。

### 打开主页面并显示文字

`-t,--text`

可指定`--search`或`--trans`。

如：

```shell
e-search --text="Hello World" --trans
```

## 框选后默认操作

见[截屏](clip.md#框选后默认操作)

这些操作不仅可以设置为默认，还可以通过快捷键设置临时操作。

默认情况下，按下<kbd>Alt</kbd>+<kbd>C</kbd>打开截屏窗口，我们手动框选，手动点击功能按钮。

设置好快捷键后，比如我设置复制为<kbd>Alt</kbd>+<kbd>X</kbd>，按下快捷键后，框选，自动复制。

在 设置-快捷键 中设置，注意与截屏界面*功能快捷键*的区别。截屏*功能快捷键*在截屏界面显示后才使用（比如<kbd>Alt</kbd>+<kbd>C</kbd>打开窗口、框选、<kbd>Ctrl+C</kbd>复制），框选后默认操作快捷键全局生效，一步到位（直接<kbd>Alt</kbd>+<kbd>X</kbd>，复制）。他们都在 设置-快捷键 中设置，请小心区分。
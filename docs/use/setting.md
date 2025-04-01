# 设置

更改设置后，左下角会显示操作历史。如果误触，或者想放弃本次设置修改，你可以通过点击列表项目撤销。

---

高级功能

## 源文件配置

设置使用 [JSON](https://developer.mozilla.org/zh-CN/docs/Learn/JavaScript/Objects/JSON) 格式进行配置，你可以在设置里打开源文件进行编辑。关于 JSON，你需要注意英文符号、双引号、逗号的使用。最好使用 VSCode 等编辑器进行编辑，它有语法检查、自动完成等方便功能。错误格式的 JSON 会导致程序恢复默认设置。

## 自定义配置目录

默认配置存储在`appData`目录下，在不同平台中：

- Windows: `%AppData%/eSearch`
- macOS: `~/Library/Application Support/eSearch`
- Linux: `~/.config/eSearch`

你可以在设置里设置自定义配置目录，这个选项是配置的配置，会自动生成`preload_config`保存在运行目录下。支持相对路径和绝对路径。

如果你想要便携版，保存配置到运行目录，可以参考[另一篇文档](main.md#便携版绿色版)。

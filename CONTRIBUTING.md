# 贡献指南

主要是关于 pr 的指南

-   [fork 本仓库](https://github.com/xushengfeng/eSearch/fork)
-   clone 到本地或直接在线上编辑器修改
-   提交一个 Pull Request

## 编辑代码

首先这个项目最开始是我一拍脑袋写的，并且跨度有点大，存在大量中文变量、拼音变量、语法糖、if 嵌套等乱象，还望海涵。

-   命名规则、函数习惯等都无所谓，还望写注释
-   如果原来的代码过于抽象，可以联系我一起理解
-   electron 版本一般不会太旧，我还开启了"enable-experimental-web-platform-features"，用些新语法能减轻心智负担
-   记得格式化代码，仓库中包含了`.prettierrc.json`，可用于 prettier 配置

## 测试

首先要安装 nodejs 运行环境，npm 管理器我建议用 pnpm，把后面的命令中的`pnpm`改成`npm`也是可以运行的

运行`pnpm install`安装依赖

渲染进程可以运行`pnpm run dev`调试
主进程可以在 vscode 侧栏运行中点击“Debug Main Process”或直接按<kbd>F5</kbd>进行热重载调试，`pnpm run dev`也是可以的

若新加的功能测试正常，与之有关的功能也能正常运行，那就可以提交 commit 了

## 提交

commit 命名我习惯使用`范围 修复/添加某某功能`，比如`截屏 修复创建图形坐标错误`

## 合并

请耐心等待我的合并:)

## 感谢

最后提前感谢你的贡献！

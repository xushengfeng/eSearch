# 开始

## 准备工作

- vscode
- npm
- node.js
- git

大陆用户为了方便访问 GitHub，可以使用[Watt Toolkit](https://steampp.net/)进行免费的 GitHub 加速。

建议使用`pnpm`作为包管理工具，同时设置镜像源为 npmmirror.com：

```shell
pnpm config set registry https://registry.npmmirror.com/
```

设置 Electron 的镜像源：

```shell
pnpm config set electron_mirror https://npmmirror.com/mirrors/electron/
```

克隆项目到本地：

```shell
git clone https://github.com/xushengfeng/eSearch.git
# 如果不需要代码回溯
git clone --depth=1 https://github.com/xushengfeng/eSearch.git
```

使用 vscode 打开`eSearch`文件夹，安装依赖：

```shell
pnpm install
```

> [!TIP]
> 如果不需要 cuda，或者网络问题，可以设置环境变量 `ONNXRUNTIME_NODE_INSTALL_CUDA="skip"`

## 运行与编译

运行：

```shell
pnpm run start
```

由于我还没配置好 vite 下调试带有`.node`的库，所以无法使用`pnpm run dev`。

打包：

```shell
pnpm run pack
```

编译：

```shell
pnpm run dist
```

打包后的文件位于`build`文件夹下，已经有可执行文件，编译则生成安装包。

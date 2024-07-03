# eSearch

( [中文](README.md) | English )

![LOGO](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/title_photo.svg)

[![license](https://img.shields.io/github/license/xushengfeng/eSearch)](LICENSE)
![](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)
[![release-date](https://img.shields.io/github/release-date/xushengfeng/eSearch)](https://github.com/xushengfeng/eSearch/releases/latest)
[![release](https://img.shields.io/github/v/release/xushengfeng/eSearch)](https://github.com/xushengfeng/eSearch/releases/latest)
[![](https://img.shields.io/github/downloads/xushengfeng/eSearch/total?color=brightgreen&label=Total%20downloads)](https://github.com/xushengfeng/eSearch/releases/latest)
[![aur](https://img.shields.io/badge/aur-e--search-blue?logo=archlinux)](https://aur.archlinux.org/packages/e-search)
[![aur1](https://img.shields.io/badge/aur-e--search--git-blue?logo=archlinux)](https://aur.archlinux.org/packages/e-search-git)

## Introduction

eSearch is a :electron: rewrite of [Information-portal](https://github.com/xushengfeng/Information-portal.git) with many additional features.

The main purpose is to implement a **screen search** function similar to [Smartisan Big Bang](https://www.smartisan.com/pr/videos/bigbang-introduction) or [Xiaomi Portal](https://www.miui.com/zt/miui9/index.html) on Linux (also available on Windows and macOS), and it is also a convenient **screenshot software**.

After several iterations, eSearch's functionality has become more and more enriched.

Including **screenshot+OCR+search+translation+pasting+reverse image search+screen recording**.

![Screenshot interface](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/1.webp)

> The font used is [FiraCode](https://github.com/tonsky/FiraCode), and the font can be set in the settings.

![Text recognition main page](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/2.webp)

## Download and Installation

Download from the website [eSearch](https://esearch-app.netlify.app/#download)

or open the releases tab on the right, select the package that suits your system, and download and install it.

For users in China, you can use [GitHub Proxy](https://mirror.ghproxy.com) to accelerate the download.

For ArchLinux, you can search and install `e-search` or `e-search-git` from the AUR.

Using winget: `winget install esearch`

## OCR Service

Local OCR is supported by the model from [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), and it works out of the box.

The local OCR service is enabled by default. If you want to use online OCR, currently it provides support for Baidu online OCR. You need to obtain an _API KEY_ and _Secret KEY_ according to the [tutorial](https://cloud.baidu.com/doc/OCR/s/dk3iqnq51). As of January 2022, Baidu OCR can still be [obtained for free](https://cloud.baidu.com/doc/OCR/s/dk3iqnq51). Enter the obtained _API KEY_ and _Secret KEY_, as well as the corresponding OCR service [_URL_](https://cloud.baidu.com/doc/OCR/s/zk3h7xz52#%E8%AF%B7%E6%B1%82%E8%AF%B4%E6%98%8E) in the software settings, and uncheck the offline OCR option to use online OCR.

## Launch

Open eSearch from your launcher, and it will appear in the system tray.

The default shortcut key is <kbd>Alt</kbd>+<kbd>C</kbd> (you can also set the shortcut key in the settings).

### CLI

**eSearch** supports cli, allowing for simple screenshot operations through command line.

```shell
esearch (if not found, try e-search)
	-a # Automatic recognition
	-c # Screenshot search
	-s # Select and search
	-b # Clipboard search
	-q # Quick screenshot
```

It is not recommended to use automatic or selection search in the terminal, as **eSearch** will execute <kbd>Ctrl</kbd>+<kbd>C</kbd, which can terminate the terminal program.

## Features

The checked features are the latest features in the development process, but may not yet be released in the latest version.

-   [x] Screenshot
    -   [x] Select and crop, shortcut key adjustment
    -   [x] Input arithmetic expressions in the select and crop size bar to adjust
    -   [x] Color picker/magnifier
    -   [x] Pen (freehand drawing)
    -   [x] Geometric shapes (support adjustable border fill)
    -   [x] Image filters (supports local mosaic blur and color adjustment)
    -   [x] Customize the operation after releasing the select box (such as automatic OCR after selection)
    -   [x] Quickly capture full screen to clipboard or custom directory
    -   [x] Window and control selection (using OpenCV edge recognition)
    -   [x] Long screenshot (i.e. scrolling screenshot)
    -   [x] Multiple screens (screenshot separately, but currently does not support cross-screen screenshots)
-   [x] Screen recording
    -   [x] Record full screen/custom size
    -   [x] Key prompts
    -   [x] Cursor position prompt
    -   [x] Audio recording
    -   [x] Record camera
    -   [x] Custom bitrate
    -   [x] Can be cropped later
    -   [x] Formats such as gif, webm, mp4
    -   [x] Virtual background
-   [x] Save (optional save as SVG editable file)
-   [x] Open in other applications
-   [x] Copy to clipboard
-   [x] Screen pasting
    -   [x] Zoom with scroll wheel
    -   [x] Restore default size and position
    -   [x] Transparency
    -   [x] Mouse penetration
-   [x] QR code recognition
-   [x] OCR recognition
    -   [x] Offline OCR ([eSearch-OCR](https://github.com/xushengfeng/eSearch-OCR))
    -   [x] Custom offline OCR model and dictionary
    -   [x] Other online OCR
    -   [x] Online formula recognition
    -   [x] Support for applying for your own key
    -   [x] Table recognition (online)
-   [x] Reverse image search
-   [x] Select and search by swiping words or sentences
-   [x] Recognition display
    -   [x] Automatic search and translation
    -   [x] Search
    -   [x] Translation
    -   [x] Custom search and translation engines
    -   [x] Open in built-in browser
    -   [x] Defocus close
    -   [x] Open in system browser
    -   [x] Link recognition
    -   [x] History
    -   [x] Automatic line break deletion (for automatic typesetting)
    -   [x] Find and replace (supports regular expression matching)
    -   [x] Editing in other editors (supports automatic reload)
    -   [x] Line number
    -   [x] Spell check
-   [x] Wayland desktop

https://user-images.githubusercontent.com/28475549/155870834-34ffa59f-9eac-4eea-9d82-135681d7dfa9.mp4

> Screenshot, freely adjust the selection box size (video about 2.6MB)

https://user-images.githubusercontent.com/28475549/155870857-99c7d6d0-a90b-4558-872a-85f2603225d6.mp4

> Color picker (video about 1MB)

https://user-images.githubusercontent.com/28475549/155870867-fb0d31f0-2e06-431c-9ae9-ee3af5a5c08e.mp4

> Ding on the screen, opacity adjustment, reset, and mouse operation (video about 1.8MB)

![3](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/3.webp)

> Drawing interface

https://user-images.githubusercontent.com/28475549/155870881-9b2fc1b3-77de-4a99-8076-ed49b7b5c4c0.mp4

> Main page search and editing in other applications (video about 1.6MB)

![3](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/4.webp)

> Main page find and replace (supports regular expression)

## Internationalization

Most buttons use icons, reducing unnecessary translation.

[Add new language](./lib/translate/readme.md)

-   [x] Simplified Chinese
-   [x] Traditional Chinese
-   [x] Esperanto
-   [x] Spanish
-   [x] Arabic
-   [x] English
-   [x] French
-   [x] Russian

## Running & Compiling from Source Code

```shell
git clone https://github.com/xushengfeng/eSearch.git
cd eSearch
npm install
# Compile
npm run dist
# The install package and unpacked directory will be created in the build directory
```

```shell
# Run
npm run start
# Debug
npm run dev
```

## Testing

Tested successfully on ArchLinux, KDE plasma, Xorg.

Tested successfully on Windows 10 and Windows 11.

Tested successfully on macOS Catalina.

## Q&A

### No response when clicking on Gnome

Gnome users need to install the [appindicator](https://extensions.gnome.org/extension/615/appindicator-support/) plugin to use the system tray.

### Why choose electron

-   The need for cross-platform support. I wanted to experience the excellent screenshot tools on Windows on Linux, and it's not good for Linux to be left out, so I chose cross-platform support.
-   Qt relies on c++, and the learning cost is too high. Flutter for desktop is not yet mature. I am more proficient in js development.
-   Screenshot relies on the local system, which is something current browsers cannot do.
-   Ultimately, there is only one cross-platform solution similar to JavaScript. I chose the more mature and widely used electron.

### A JavaScript error occurred in the main process

This is a main process error, which may be caused by various reasons. The specific error below is the real useful error information, and it is a code error. Therefore, searching "A JavaScript error occurred in the main process" is difficult to solve the problem.

Generally, reinstalling the software and restoring settings can solve 99% of the problems. The best way is to record detailed error information and submit an [issue](https://github.com/xushengfeng/eSearch/issues/new?assignees=&labels=bug&template=bug_report.md&title=%E2%80%A6%E2%80%A6%E5%AD%98%E5%9C%A8%E2%80%A6%E2%80%A6%E9%94%99%E8%AF%AF) for feedback.

Accumulated errors and their discussions and solutions: [#123](https://github.com/xushengfeng/eSearch/issues/123) [#133](https://github.com/xushengfeng/eSearch/issues/133)

### After updating, new errors appear that didn't exist before

This is generally due to the incompatibility of configurations in different versions. You can try to restore the default settings in Settings-Advanced-Advanced settings.

If the problem is not solved, please submit an issue.

## Contributions

Please refer to the [contributing guidelines](CONTRIBUTING.md)

## Development Reason

When I was using Windows, I always used the handy screenshot software: [Snipaste - Screenshot + Pasting](https://zh.snipaste.com/). But when I switched to Linux, Snipaste was not supported (in 2019, it is now supported), so I chose [Flameshot](https://flameshot.org/), but unfortunately it does not have an intuitive color picker.

Another reason I developed eSearch is that I enjoy using the "Immediate Information Search" tool on my phone such as [Smartisan Big Bang](https://www.smartisan.com/pr/videos/bigbang-introduction) or [Xiaomi Portal](https://www.miui.com/zt/miui9/index.html), but I couldn't find a similar alternative on my computer.

So I simply developed my own "screenshot+OCR+search+pasting" software. I initially developed it with python+pyqt and created [Information-portal](https://github.com/xushengfeng/Information-portal.git), but because I am not familiar with pyqt, I switched to :electron: and developed this software. 😄

## Appreciation and support

Spiritual support: Light up the star🌟 in the upper right corner

Material support: [Personal homepage Appreciation](https://github.com/xshengfeng)

Actions: Feedback bugs, provide new function ideas,[Participate in development](CONTRIBUTING.md)

## License

[GPL-3.0](LICENSE) © xushengfeng

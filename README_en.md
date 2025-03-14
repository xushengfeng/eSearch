# eSearch

( [中文](README.md) | English )

![LOGO](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/title_photo.svg)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fxushengfeng%2FeSearch.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fxushengfeng%2FeSearch?ref=badge_shield)
[![license](https://img.shields.io/github/license/xushengfeng/eSearch)](LICENSE)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)
![commit-activity](https://img.shields.io/github/commit-activity/m/xushengfeng/eSearch)
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

![Text recognition main page](https://raw.githubusercontent.com/xushengfeng/eSearch-website/master/public/readme/8.webp)

## Download and Installation

Download from the website [eSearch](https://esearch-app.netlify.app/#download)

or open the [releases](https://github.com/xushengfeng/eSearch/releases) tab on the right, select the package that suits your system, and download and install it.

For users in China, you can use [GitHub Proxy](https://ghfast.top/) to accelerate the download.

For ArchLinux, you can search and install `e-search` or `e-search-git` from the AUR.

Using winget: `winget install esearch`

There is no Homebrew package available at the moment, and we welcome volunteer maintainers to provide support.

## Launch

Open eSearch from your launcher, and it will appear in the system tray.

The default shortcut key is <kbd>Alt</kbd>+<kbd>C</kbd> (you can also set the shortcut key in the settings).

## Features

For more introduction, see [Documentation](./docs/use/start.md)

### Screenshot

Select and crop, color picker, freehand brush, geometry, mosaic, blur

In addition to adjusting with arrow keys, selection also supports inputting arithmetic expressions for adjustment

Supports executing operations immediately after custom selection, such as automatically performing OCR after selection

Also supports scrolling screenshots, can stitch together horizontally, vertically, or in any direction

### Screenshot Beautification

You can set backgrounds (gradient, image), rounded corners, shadows for screenshots.

Change image resolution for export.

Erase objects and repair images.

### Screen Recording

Record screen, custom size, camera

Can indicate cursor position and keyboard keystrokes

Can set a virtual background

### Super Screen Recording

Automatically zoom and focus to the mouse position for more vivid screen recording

Accelerate, delete, operate every frame

### Screen Overlay

Scroll zooming, opacity, auto repositioning, mouse transparency

Supports magnifying images without changing window size to prevent obscuring other content

Can set filters and transformations (such as mirroring) through CSS

### OCR (Optical Character Recognition)

Out-of-the-box offline OCR ([eSearch-OCR](https://github.com/xushengfeng/eSearch-OCR)), just select the text and press Enter

Offline OCR supports paragraph recognition and can use punctuation-based segmentation algorithms

Also supports online OCR from Baidu and Youdao

Can edit text later, select text on images, and sync selection to the editing area for easy proofing

Supports multiple languages (extra download required in settings)

### Image Search

Image search engines from Google, Baidu, and Yandex

Can customize multi-modal large model interfaces to interact with AI using images

### Translation

Can call translation after OCR, supports word selection translation

Supports free translation engines like Google Translate, and can also set APIs for other translation engines such as DeepL and Baidu, can use AI translations like ChatGPT, and even customize local AI translations

Can translate with multiple engines simultaneously, choosing the best

Can save translation results to local files or online to memory software like Anki

### Screen Translation

Generates an overlay window and replaces image text with translated text

Can set timed translation, suitable for videos, games, etc.

### Others

QR code recognition

## Show

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

[+Add new language](./lib/translate/readme.md)

- [x] Simplified Chinese
- [x] Traditional Chinese
- [x] Esperanto（Esperanto）
- [x] Spanish（Español）
- [x] Arabic（عربي）
- [x] English
- [x] French（Français）
- [x] Russian（Русский）

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

[Specific technical instructions](docs/develop/readme.md)

## Testing

Tested successfully on ArchLinux, KDE plasma, Xorg.

Tested successfully on Windows 10 and Windows 11.

Tested successfully on macOS Catalina.

## Q&A

### Win7 and Win8 are no longer supported

Electron officially no longer supports Win7 and Win8, so eSearch no longer supports it either.

But you can compile it yourself, see [Documentation](./docs/use/qa.md#兼容性), some features may not be available.

### Download the dependency library

Most Windows will prompt you to download the dependent library after installation. This is because the screenshot library is needed. Clicking Download will automatically open Microsoft's official website for download. It may need to be restarted after installation is complete.

### No response when clicking on Gnome

Gnome users need to install the [appindicator](https://extensions.gnome.org/extension/615/appindicator-support/) plugin to use the system tray.

### mac alert file is corrupt

Mac has put some restrictions on dmg downloads from the Internet.

You can search for keywords such as "mac" and "file corruption" on the Internet. Different versions of the system apply different methods.

### Why choose electron

- The need for cross-platform support. I wanted to experience the excellent screenshot tools on Windows on Linux, and it's not good for Linux to be left out, so I chose cross-platform support.
- Qt relies on c++, and the learning cost is too high. Flutter for desktop is not yet mature. I am more proficient in js development.
- Screenshot relies on the local system, which is something current browsers cannot do.
- Ultimately, there is only one cross-platform solution similar to JavaScript. I chose the more mature and widely used electron.

In the case that other platforms do not have a separate package as a library like Arch Linux, the software occupies a lot of storage space, but the increase in dozens of js scripts is not much, but the functions brought are significantly felt, so I will try my best to give full play to its potential to achieve a more beautiful UI and richer features.

### Why is the installation package so big

In addition to the use of Electron, there are also onnx runtime libraries (used to run AI models), offline Optical Character Recognition models, screen recording portrait recognition models, object removal models for advanced editing, FFmpeg (used for screen recording format conversion, Linux has libraries so it is not included), etc.

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

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fxushengfeng%2FeSearch.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fxushengfeng%2FeSearch?ref=badge_large)

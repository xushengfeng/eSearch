# eSearch

([中文](README.md) | English)

![LOGO](https://esearch.vercel.app/readme/title_photo.svg)

[![license](https://img.shields.io/github/license/xushengfeng/eSearch)](LICENSE)
![](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)
[![release-date](https://img.shields.io/github/release-date/xushengfeng/eSearch)](https://github.com/xushengfeng/eSearch/releases/latest)
[![release](https://img.shields.io/github/v/release/xushengfeng/eSearch)](https://github.com/xushengfeng/eSearch/releases/latest)
[![](https://img.shields.io/github/downloads/xushengfeng/eSearch/total?color=brightgreen)](https://github.com/xushengfeng/eSearch/releases/latest)
[![aur](https://img.shields.io/badge/aur-e--search-blue?logo=archlinux)](https://aur.archlinux.org/packages/e-search)
[![aur1](https://img.shields.io/badge/aur-e--search--git-blue?logo=archlinux)](https://aur.archlinux.org/packages/e-search-git)

## Introduction

eSearch is a :electron: rewrite of [information-portal](https://github.com/xushengfeng/Information-portal.git) (with a bi~~t~~llion features added by the way)

The main idea is to implement [Smartisan bigbang](https://www.smartisan.com/pr/videos/bigbang-introduction) or [Xiaomi portal](https://www.miui.com/zt/miui9/index.html) on Linux (it works on win and mac too) like **Screen Search** and of course a handy **Screenshot Software**.

After several version iterations, eSearch has become more and more functional

That is to have **Screenshot+OCR+Search+Translate+Paste Image +Search by Image+Screen Recorder**

![Screenshot screen](https://esearch.vercel.app/readme/1.webp)

> The font is [FiraCode](https://github.com/tonsky/FiraCode), the font can be set in the settings

![Main screen for text recognition](https://esearch.vercel.app/readme/2.webp)

## Download and install

Go to the website [eSearch](https://esearch-app.netlify.app/#download) to download

Or open the releases tab on the right, select the package that matches your system and download and install it

Quick download link in China: [Releases - xushengfeng/eSearch - fastgit](https://hub.fastgit.xyz/xushengfeng/eSearch/releases)

ArchLinux can be found at AUR to install `e-search` or `e-search-git`.

winget `winget install esearch`

## OCR Services

Local OCR is supported by [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)'s model.

The local OCR service is enabled by default, but if you wish to use the online OCR, Baidu Online OCR is currently available and requires [a tutorial](https://cloud.baidu.com/doc/OCR/s/dk3iqnq51) to obtain the _API KEY_ and _Secret KEY_, which is still available for [free](https://cloud.baidu.com/doc/OCR/s/dk3iqnq51) as of January 2022. Fill in the _API KEY_ and _Secret KEY_ and the corresponding [_URL_](https://cloud.baidu.com/doc/OCR/s/zk3h7xz52#%E8%AF%B7%E6%B1%82%E8%AF%B4%E6%98%8E) of your chosen text recognition service into the software settings and uncheck the offline OCR box to use the online OCR.

## Run & compile the source code

```shell
git clone https://github.com/xushengfeng/eSearch.git
cd eSearch
npm install
# make
npm run dist
# The installation package and unzipped directory will be generated in the build directory
```

```shell
# Run
npm run start
# debug
npm run dev
```

## Launch

Open eSearch in your launcher and it will appear in the tray. Gnome users need to install the [appindicator](https://extensions.gnome.org/extension/615/appindicator-support/) plugin to use tray.

The default shortcut is <kbd>Alt</kbd>+<kbd>C</kbd> (you can also set the shortcut in the settings)

### cli

**eSearch** supports cli, and you can simply take screenshots from the command line.

```shell
esearch (if you can not find it, try e-search)
	-a # auto-search
	-c # screen search
	-s # select search
	-b # clipboard search
	-q # Quick screenshot
```

It is not recommended to do an automatic or selected search in the terminal, otherwise **eSearch** will perform <kbd>Ctrl</kbd>+<kbd>C</kbd>, which will cause the terminal program to terminate

## Functions

Features that have been ticked are the latest in the development process but may not have been released in the latest version

-   [x] Screenshot
    -   [x] Frame crop
    -   [x] Resizable frame position (arrow keys or WASD supported)
    -   [x] Frame size field can be adjusted by entering a quadratic formula
    -   [x] Colour picker
    -   [x] Magnifying glass
    -   [x] Brush (freehand brush)
    -   [x] Geometric shapes (border fill support adjustment)
    -   [x] Advanced palette settings (using the Fabric.js api)
    -   [x] Image filters (local mosaic blur and colour adjustment supported)
    -   [x] Customize what happens when the frame is released
    -   [x] Quick full screen capture to clipboard or custom directory
    -   [x] Screenshot history
    -   [x] Window and control selection (using OpenCV edge recognition)
    -   [x] long screenshot (rolling screenshot)
    -   [x] Multi-screen (separate screenshots. Currently, cross-screen screenshots of one image are not supported)
-   [x] Record screen
    -   [x] Recording full screen
    -   [x] Customize size
    -   [x] Key prompt
    -   [x] Cursor Location Tips
    -   [x] Recorder bar
    -   [x] Segmented write
    -   [x] Recording audio
    -   [x] Recording camera
    -   [x] Custom Bitrate
-   [x] Save (optionally as SVG editable file)
-   [x] Open in other applications
-   [x] Copy to clipboard
-   [x] Pin to screen
    -   [x] Scroll wheel zoom
    -   [x] Restore default size position
    -   [x] Transparency
    -   [x] Mouse through
-   [x] QR code recognition
-   [x] OCR recognition
    -   [x] Offline OCR ([eSearch-OCR](https://github.com/xushengfeng/eSearch-OCR)）
    -   [x] Custom offline OCR models and dictionaries
    -   [x] Other online OCR
    -   [x] Online formula recognition
    -   [x] Support for applying your own secret key
    -   [ ] Form identification
-   [x] Map search by map
-   [x] Pallets
-   [x] Search by word and phrase
-   [x] Recognition display
    -   [x] Automatic search for translations
    -   [x] Search
    -   [x] Translation
    -   [x] Custom search translation engine
    -   [x] Custom search translation engine (POST mode, Api available)
    -   [x] Open in the software's own browser
    -   [x] Follow off, Out of focus off
    -   [x] Open in system browser
    -   [x] Link recognition
    -   [x] History
    -   [x] Automatic line feed removal (for automatic typesetting)
    -   [x] Find and Replace (supports regular matching)
    -   [x] Other editor editing (for automatic reloading)
    -   [x] Line numbering
    -   [x] Spell check
-   [x] Wayland Desktop

https://user-images.githubusercontent.com/28475549/155870834-34ffa59f-9eac-4eea-9d82-135681d7dfa9.mp4

> Screenshot, free resizing of frames (video approx. 2.6MB)

https://user-images.githubusercontent.com/28475549/155870857-99c7d6d0-a90b-4558-872a-85f2603225d6.mp4

> colour picker (video approx. 1MB)

https://user-images.githubusercontent.com/28475549/155870867-fb0d31f0-2e06-431c-9ae9-ee3af5a5c08e.mp4

> Ding on screen, transparency adjustment, homing and mouse operation (video approx. 1.8MB)

![3](https://esearch.vercel.app/readme/3.webp)

> Drawing screen

https://user-images.githubusercontent.com/28475549/155870881-9b2fc1b3-77de-4a99-8076-ed49b7b5c4c0.mp4

> Main screen search and other application editing (video approx. 1.6MB)

![3](https://esearch.vercel.app/readme/4.webp)

> main interface find and replace (regular support)

## Internationalization

Most buttons use icons, reducing unnecessary translations

-   [x] English
-   [x] Arabic
-   [x] Chinese (Simplified)
-   [x] Chinese (Traditional)
-   [x] Esperanto
-   [x] French
-   [x] Russian
-   [x] Spanish

## Testing

Tested under ArchLinux, KDE plasma, Xorg

Tested on Windows 10 and Windows 11

Tested on macOS Catalina

## Qantia.

### Why choose electron.

-   Cross-platform needs. Originally, I wanted to experience the excellent screenshot tools under Windows on Linux, and Linux monopoly is not good, so I chose cross-platform.
-   qt relies on caterpillar, so the cost of learning is too high. The flutter desktop version is not very mature. I am better at js development.
-   Screenshot depends on the local system, which cannot be done by browsers at present.
-   in the end, there are only js cross-platform solutions. I chose electron, which is more mature and most widely used.

### [tauri](https://github.com/tauri-apps/tauri) also supports cross-platform development and uses js development. Will it be converted to tauri development?

-   I have such a plan, but I am still very excited. However, the migration of 2000 lines of code from the main process to rust is a bit laborious, so it will not be migrated any time soon.

### A JavaScript error occurred in the main process

This is an error in the main process, which can be caused by a variety of reasons, and the really useful error message is the following specific error, which is a code error. Therefore, it is difficult to solve the problem by directly searching for "A JavaScript error occurred in the main process".

Generally speaking, reinstalling the software and restoring the settings will solve 99% of the problems. The best way is to record the detailed error message and submit an [issue](https://github.com/xushengfeng/eSearch/issues/new?assignees=&labels=bug&template=bug_report.md&title=%) E2%80%A6%E2%80%A6%E5%AD%98%E5%9C%A8%E2%80%A6%E2%80%A6%E9%94%99%E8%AF%AF) for feedback.

Accumulated errors and their discussion, solutions: [#123](https://github.com/xushengfeng/eSearch/issues/123) [#133](https://github.com/xushengfeng/eSearch/issues/133)

### After updating the version, there is an error that was not there before

You can try to restore the default settings in Settings - Advanced - Advanced Settings.

If this does not solve the problem, please submit an issue

## Contribution

Please see [contribution Guide](CONTRIBUTING.md)

## Development reasons

I've been using this great screenshot software for Windows: [Snipaste - Snip & Paste](https://www.snipaste.com/), but I've switched to Linux and Snipaste is not supported, so I've chosen [Flameshot](https://flameshot.org/), which unfortunately doesn't have an intuitive colour picker.

Another incentive for me to develop eSearch was that I enjoyed using [Smartisan bigbang](https://www.smartisan.com/pr/videos/bigbang-introduction) or [Xiaomi Portal](https://www.miui.com/zt/miui9/index.html) on my phone, but I couldn't find a similar replacement on my computer.

So I simply developed my own "screenshot + OCR + search + mapping" software. At first I developed [Information-portal](https://github.com/xushengfeng/Information-portal.git) using python+pyqt, but since I'm not familiar with pyqt, I switched to :electron: and developed this software. 😄

## License

[GPL-3.0](LICENSE) © xushengfeng

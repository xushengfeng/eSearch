module.exports = {
    t,
    lan,
};

var language = "";
var l2l = {
    en_GB: "en",
    en_UK: "en",
};

/**
 * 切换语言
 * @param {string} lan 语言
 */
function lan(lan) {
    language = lan;
}

/**
 * 翻译
 * @param {string} text 原文字
 * @returns 翻译后的文字
 */
function t(text) {
    return obj?.[text]?.[language] || obj?.[text]?.[l2l[language]] || text;
}

var obj = {
    // main
    "服务正在下载中……": { en: "Service download is in progress ......" },
    服务下载已取消: { en: "Service download has been cancelled" },
    服务已下载: { en: "Service has been downloaded" },
    "，正准备安装相关的依赖，请允许安装": {
        en: ", is preparing to install the relevant dependencies, please allow installation",
    },
    自动搜索: { en: "Automatic search" },
    截屏搜索: { en: "Screenshot search" },
    选中搜索: { en: "Selected search" },
    剪贴板搜索: { en: "Clipboard search" },
    失焦关闭: { en: "Out of focus off" },
    主界面: { en: "Main screen" },
    搜索界面: { en: "Search screen" },
    浏览器打开: { en: "Browser open" },
    主页面: { en: "Main Page" },
    设置: { en: "Settings" },
    教程帮助: { en: "Tutorial Help" },
    重启: { en: "Restart" },
    退出: { en: "Exit" },
    已经在后台启动: { en: "Already started in background" },
    服务未下载: { en: "Service not downloaded" },
    "离线OCR 服务未安装": { en: "Offline OCR service is not installed" },
    需要下载才能使用: { en: "Need to download to use" },
    不再提示: { en: "No more prompts" },
    "下载(约": { en: "Download (approx." },
    "前往 设置": { en: "Go to Settings" },
    取消: { en: "Cancel" },
    服务需要升级: { en: "Service needs to be upgraded" },
    "离线OCR 服务版本较旧": { en: "Older version of offline OCR service" },
    服务下载失败: { en: "Service download failed" },
    "离线OCR 服务版本下载失败": { en: "Offline OCR service version download failed" },
    请前往网站手动下载: { en: "Please go to the website to download manually" },
    警告: { en: "Warning" },
    无法识别二维码: { en: "QR code not recognised" },
    请尝试重新识别: { en: "Please try to re-identify" },
    选择要打开应用的位置: { en: "Select where you want to open the app" },
    选择要保存的位置: { en: "Select a location to save" },
    图像: { en: "Image" },
    保存图像失败: { en: "Failed to save image" },
    用户已取消保存: { en: "User has cancelled the save" },
    视频: { en: "Video" },
    保存视频失败: { en: "Failed to save video" },
    错误: { en: "Error" },
    重启: { en: "Reboot" },
    "已恢复默认设置，部分设置需要重启": {
        en: "Default settings have been restored, some settings need to be rebooted",
    },
    生效: { en: "Effective" },
    稍后: { en: "Later" },
    关于: { en: "About" },
    设置: { en: "Settings" },
    服务: { en: "Services" },
    隐藏: { en: "Hide" },
    隐藏其他: { en: "Hide other" },
    全部显示: { en: "Show all" },
    文件: { en: "File" },
    保存到历史记录: { en: "Save to history" },
    其他编辑器打开: { en: "Open with other editor" },
    "打开方式...": { en: "Open as..." },
    关闭: { en: "Close" },
    编辑: { en: "Edit" },
    打开链接: { en: "Open link" },
    搜索: { en: "Search" },
    翻译: { en: "Translate" },
    撤销: { en: "Undo" },
    重做: { en: "Redo" },
    剪切: { en: "Cut" },
    复制: { en: "Copy" },
    粘贴: { en: "Paste" },
    删除: { en: "Delete" },
    全选: { en: "Select All" },
    自动删除换行: { en: "Auto Delete Line Feed" },
    查找: { en: "Find" },
    替换: { en: "Replace" },
    自动换行: { en: "Auto Line Feed" },
    拼写检查: { en: "Spell check" },
    朗读: { en: "Read aloud" },
    开始朗读: { en: "Start reading aloud" },
    停止朗读: { en: "Stop reading aloud" },
    浏览器: { en: "Browser" },
    后退: { en: "Back" },
    前进: { en: "Forward" },
    刷新: { en: "Refresh" },
    停止加载: { en: "Stop loading" },
    浏览器打开: { en: "Browser open" },
    保存到历史记录: { en: "Save to history" },
    视图: { en: "View" },
    重新加载: { en: "Reload" },
    强制重载: { en: "Force Reload" },
    开发者工具: { en: "Developer Tools" },
    历史记录: { en: "History" },
    实际大小: { en: "Actual size" },
    放大: { en: "Zoom In" },
    缩小: { en: "Zoom out" },
    全屏: { en: "Full screen" },
    窗口: { en: "Window" },
    最小化: { en: "Minimise" },
    关闭: { en: "Close" },
    置于最前面: { en: "Place at top" },
    帮助: { en: "Help" },
    教程帮助: { en: "Tutorial help" },
    保存图像成功: { en: "Saved image successfully" },
    已保存图像到: { en: "Saved image to" },
    选择要保存的位置: { en: "Select a location to save to" },
};

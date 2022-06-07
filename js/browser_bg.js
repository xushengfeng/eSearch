var h1 = document.querySelector("h1");

if (navigator.onLine) {
    switch (location.search.replace("?type=", "")) {
        case "did-fail-load":
            h1.innerText = "加载失败";
            break;
        case "render-process-gone":
            h1.innerText = "进程崩溃";
            break;
        case "unresponsive":
            h1.innerText = "页面未响应";
            break;
        case "certificate-error":
            h1.innerText = "证书错误";
            break;
        default:
            break;
    }
} else {
    h1.innerText = "无网络连接";
}

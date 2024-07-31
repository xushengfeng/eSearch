const h1 = document.querySelector("h1");

const search = new URLSearchParams(location.search);

if (navigator.onLine) {
    switch (search.get("type")) {
        case "did-fail-load":
            h1.innerText = "加载失败";
            document.getElementById("details").innerHTML = `<p>${"错误代码："}${search.get("err_code")}</p>
            <p>${"错误描述："}${search.get("err_des")}</p>`;
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

import { ele, initDKH, p, view } from "dkh-ui";

initDKH({ pureStyle: true });

const pEl = view("y")
    .style({
        width: "100vw",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
    })
    .addInto();
const h1 = ele("h1")
    .addInto(pEl)
    .bindSet((v: string, el) => {
        el.innerText = v;
    });
const details = view().addInto(pEl);

const search = new URLSearchParams(location.search);

if (navigator.onLine) {
    switch (search.get("type")) {
        case "did-fail-load":
            h1.sv("加载失败");
            details
                .clear()
                .add([
                    p(`${"错误代码："}${search.get("err_code")}`),
                    p(`${"错误描述："}${search.get("err_des")}`),
                ]);
            break;
        case "render-process-gone":
            h1.sv("进程崩溃");
            break;
        case "unresponsive":
            h1.sv("页面未响应");
            break;
        case "certificate-error":
            h1.sv("证书错误");
            break;
        default:
            break;
    }
} else {
    h1.sv("无网络连接");
}

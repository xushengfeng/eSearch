import { addStyle } from "dkh-ui";
import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import { initStyle, setTitle } from "../root/root";
import { init as initOverlay } from "./overlay";
import { init as initSingle } from "./single";

initStyle(store);

setTitle(t("贴图"));

addStyle({
    body: {
        width: "100vw",
        height: "100vh",
        "--hover-color": "var(--bar-hover-color) !important;",
    },
});

// single: 每个贴图独立的系统窗口；默认：一个全屏窗口模拟多个小窗口
if (new URLSearchParams(location.search).get("mode") === "single") {
    initSingle();
} else {
    initOverlay();
}

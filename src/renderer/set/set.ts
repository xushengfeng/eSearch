/// <reference types="vite/client" />
import type { setting, 功能, 功能列表 } from "../../ShareTypes";
const path = require("node:path") as typeof import("path");
import "../../../lib/template.js";
import "../../../lib/template2.js";
const { shell, ipcRenderer, webUtils } =
    require("electron") as typeof import("electron");
const os = require("node:os") as typeof import("os");
const fs = require("node:fs") as typeof import("fs");
import {
    a,
    button,
    ele,
    image,
    input,
    p,
    radioGroup,
    select,
    txt,
    view,
    pack,
    setTranslate,
    elFromId,
    textarea,
} from "dkh-ui";

const configPath = ipcRenderer.sendSync("store", { type: "path" });

import delete_svg from "../assets/icons/delete.svg";
import handle_svg from "../assets/icons/handle.svg";
import add_svg from "../assets/icons/add.svg";
import down_svg from "../assets/icons/down.svg";

import close_svg from "../assets/icons/close.svg";
import screen_svg from "../assets/icons/screen.svg";
import ocr_svg from "../assets/icons/ocr.svg";
import search_svg from "../assets/icons/search.svg";
import scan_svg from "../assets/icons/scan.svg";
import open_svg from "../assets/icons/open.svg";
import ding_svg from "../assets/icons/ding.svg";
import record_svg from "../assets/icons/record.svg";
import long_clip_svg from "../assets/icons/long_clip.svg";
import translate_svg from "../assets/icons/translate.svg";
import copy_svg from "../assets/icons/copy.svg";
import save_svg from "../assets/icons/save.svg";
import super_edit_svg from "../assets/icons/super_edit.svg";

function iconEl(img: string) {
    return image(img, "icon").class("icon");
}

function _runTask<t>(i: number, l: t[], cb: (t: t, i?: number) => void) {
    requestIdleCallback((id) => {
        if (id.timeRemaining() > 0) {
            cb(l[i], i);
            const ii = i + 1;
            if (ii < l.length) {
                _runTask(ii, l, cb);
            }
        } else {
            if (i < l.length) {
                _runTask(i, l, cb);
            }
        }
    });
}

type RangeEl = HTMLElement & { value: number };

const old_store = JSON.parse(
    fs.readFileSync(path.join(configPath, "config.json"), "utf-8"),
) as setting;
import {
    t,
    tLan,
    lan,
    getLans,
    getLanName,
} from "../../../lib/translate/translate";
lan(old_store.语言.语言);
for (const el of document
    .querySelectorAll("[title],[placeholder]")
    .values() as Iterable<HTMLElement>) {
    if (el.title?.includes("{")) el.title = t(el.title.slice(1, -1));
    const iel = el as HTMLInputElement;
    if (iel.placeholder?.includes("{"))
        iel.placeholder = t(iel.placeholder.slice(1, -1));
}

const toTranslateEl = Array.from(
    document.querySelectorAll("li, h1, h2, h3, button, comment, t"),
) as HTMLElement[];
function translate(el: HTMLElement, i: number) {
    if (i === toTranslateEl.length - 1) initFind();
    const elT = el.innerText;
    if (elT) el.innerText = t(elT);
}

for (const el of toTranslateEl.slice(0, 30)) translate(el, 0);
document.body.style.display = "";

_runTask(30, toTranslateEl, translate);

setTranslate(t);

document.title = t(document.title);

for (const el of document
    .querySelectorAll("[data-platform]")
    .values() as Iterable<HTMLElement>) {
    const platforms = el
        .getAttribute("data-platform")
        .split(",")
        .map((i) => i.trim());
    if (!platforms.includes(process.platform)) {
        el.style.display = "none";
    }
}

const xstore = old_store;
function storeSet(path: string, value) {
    const pathx = path.split(".");
    const lastp = pathx.pop();
    const lastobj = pathx.reduce((p, c) => p[c] || {}, xstore);
    lastobj[lastp] = value;
}
function storeGet(path: string) {
    const pathx = path.split(".");
    const lastp = pathx.pop();
    const lastobj = pathx.reduce((p, c) => p[c] || {}, xstore);
    return lastobj[lastp];
}

const store = { path: path.join(configPath, "config.json") };
const historyStore = { path: path.join(configPath, "history.json") };

document.getElementById("set_default_setting").onclick = () => {
    if (confirm("将会把所有设置恢复成默认，无法撤销")) {
        ipcRenderer.send("setting", "set_default_setting");
        giveUp = true;
        location.reload();
    }
};

document.getElementById("menu").onclick = (e) => {
    const el = <HTMLElement>e.target;
    if (el.tagName === "LI") {
        let i = 0;
        document
            .getElementById("menu")
            .querySelectorAll("li")
            .forEach((lel, n) => {
                if (lel === el) {
                    i = n;
                    return;
                }
            });
        document.getElementsByTagName("html")[0].scrollTop =
            document.querySelectorAll("h1")[i].offsetTop;
    }
};

document.getElementById("menu").querySelector("li").classList.add("active");
document.onscroll = () => {
    const h1s = document.querySelectorAll("h1");
    let i = 0;
    h1s.forEach((h1, n) => {
        if (h1.offsetTop <= document.documentElement.scrollTop + 100) {
            i = n;
        }
    });
    document
        .getElementById("menu")
        .querySelectorAll("li")
        .forEach((li, n) => {
            if (i === n) {
                li.classList.add("active");
            } else {
                li.classList.remove("active");
            }
        });
};

const renderTasks: (() => void)[] = [];

function pushRender(v: () => void) {
    renderTasks.push(v);
}

const tools: Record<功能, { icon: string; title: string }> = {
    close: { icon: close_svg, title: t("关闭") },
    screens: { icon: screen_svg, title: t("屏幕管理") },
    ocr: { icon: ocr_svg, title: t("文字识别") },
    search: { icon: search_svg, title: t("以图搜图") },
    QR: { icon: scan_svg, title: t("二维码") },
    open: { icon: open_svg, title: t("其他应用打开") },
    ding: { icon: ding_svg, title: t("屏幕贴图") },
    record: { icon: record_svg, title: t("录屏") },
    long: { icon: long_clip_svg, title: t("广截屏") },
    translate: { icon: translate_svg, title: t("屏幕翻译") },
    editor: { icon: super_edit_svg, title: t("高级图片编辑") },
    copy: { icon: copy_svg, title: t("复制") },
    save: { icon: save_svg, title: t("保存") },
};

const kxActionEl = elFromId("框选后默认操作");
const kxAction = radioGroup("框选后默认操作");

for (const i in tools) {
    if (i === "close" || i === "screens") continue;

    kxActionEl.add(
        kxAction.new(
            i,
            iconEl(tools[i].icon).style({
                height: "24px",
                display: "block",
            }),
        ),
    );
}

const hotkeys_screen_shotEl = elFromId("hotkeys_screen_shot");
for (const i in tools) {
    if (i === "screens") continue;
    const xel = document.createElement("div");
    hotkeys_screen_shotEl.add([
        ele("span").add(iconEl(tools[i].icon)).attr({ title: tools[i].title }),
        xel,
    ]);
    xel.outerHTML = `<hot-keys data-path="工具快捷键.${i}"></hot-keys>`;
}

const hotkeysKxActionEl = elFromId("hotkeys_content2");
for (const i in tools) {
    if (i === "close" || i === "screens") continue;
    const xel = document.createElement("div");
    hotkeysKxActionEl.add([
        ele("span").add(iconEl(tools[i].icon)).attr({ title: tools[i].title }),
        xel,
    ]);
    xel.outerHTML = `<hot-keys name="${i}"  data-path="全局工具快捷键.${i}"></hot-keys>`;
}

for (const el of document.querySelectorAll(
    "[data-path]",
) as Iterable<HTMLElement>) {
    renderTasks.push(() => setSetting(el));
}

const setSetting = (el: HTMLElement) => {
    const path = el.getAttribute("data-path");
    const value = storeGet(path);
    if (el.tagName === "RANGE-B") {
        // range-b
        (el as HTMLInputElement).value = value;
        (el as HTMLInputElement).addEventListener("input", () => {
            storeSet(path, (el as HTMLInputElement).value);
        });
    } else if (el.tagName === "INPUT") {
        const iel = el as HTMLInputElement;
        if (iel.type === "checkbox") {
            iel.checked = value;
            iel.addEventListener("input", () => {
                storeSet(path, iel.checked);
            });
        } else {
            iel.value = value;
            iel.addEventListener("input", () => {
                storeSet(path, iel.value);
            });
        }
    } else if (el.tagName === "HOT-KEYS") {
        const iel = el as HTMLInputElement;
        iel.value = value;
        iel.addEventListener("inputend", () => {
            storeSet(path, iel.value);
        });
    } else {
        if (el.querySelector("input[type=radio]")) {
            setRadio(el, value);
            el.addEventListener("click", () => {
                storeSet(path, getRadio(el));
            });
        }
    }
};

ipcRenderer.send("setting", "get_autostart");
pushRender(() => {
    (<HTMLInputElement>document.getElementById("autostart")).checked =
        ipcRenderer.sendSync("setting", "get_autostart");
});
document.getElementById("autostart").oninput = () => {
    ipcRenderer.send(
        "setting",
        "set_autostart",
        (<HTMLInputElement>document.getElementById("autostart")).checked,
    );
};

(<HTMLInputElement>document.getElementById("启动提示")).checked =
    old_store.启动提示;

function getRadio(el: HTMLElement) {
    return (<HTMLInputElement>el.querySelector("input[type=radio]:checked"))
        .value;
}
function setRadio(el: HTMLElement, value: string) {
    (
        <HTMLInputElement>(
            el.querySelector(`input[type=radio][value="${value}"]`)
        ) || el.querySelector("input[type=radio]")
    ).checked = true;
}

let lans: string[] = getLans();

const systemLan = ipcRenderer.sendSync("app", "systemLan");

lans = [systemLan].concat(lans.filter((v) => v !== systemLan));

const lanEl = document.getElementById("语言");
const lanRadio = radioGroup("语言");
for (const i of lans) {
    lanEl.append(lanRadio.new(i, txt(getLanName(i), true)).el);
}

lanRadio.set(old_store.语言.语言);
const systemLanEl = document.getElementById("系统语言");
systemLanEl.innerText = tLan("使用系统语言", systemLan);
systemLanEl.onclick = () => {
    lanRadio.set(systemLan);
    lan(lanRadio.get());
    document.getElementById("语言重启").innerText = t("重启软件以生效");
};
lanEl.onclick = () => {
    lan(lanRadio.get());
    document.getElementById("语言重启").innerText = t("重启软件以生效");
};

document.getElementById("语言重启").onclick = () => {
    xstore.语言.语言 = lanRadio.get();
    saveSetting();
    ipcRenderer.send("setting", "reload");
};

(<HTMLInputElement>document.getElementById("自动搜索排除")).value =
    old_store.主搜索功能.自动搜索排除.join("\n");

const 全局 = old_store.全局;

const themesEl = document.getElementById("themes");
const themeInput = Array.from(
    document.querySelectorAll(".theme input"),
) as HTMLInputElement[];

const themes: setting["全局"]["主题"][] = [
    {
        light: {
            barbg: "#FFFFFF",
            bg: "#FFFFFF",
            emphasis: "#DFDFDF",
            fontColor: "#000",
            iconColor: "none",
        },
        dark: {
            barbg: "#333333",
            bg: "#000000",
            emphasis: "#333333",
            fontColor: "#fff",
            iconColor: "invert(1)",
        },
    },
    {
        light: {
            barbg: "#D7E3F8",
            bg: "#FAFAFF",
            emphasis: "#D7E3F8",
            fontColor: "#1A1C1E",
            iconColor: getIconColor("#1A1C1E"),
        },
        dark: {
            barbg: "#3B4858",
            bg: "#1A1C1E",
            emphasis: "#3B4858",
            fontColor: "#FAFAFF",
            iconColor: getIconColor("#FAFAFF"),
        },
    },
    {
        light: {
            barbg: "#D5E8CF",
            bg: "#FCFDF6",
            emphasis: "#D5E8CF",
            fontColor: "#1A1C19",
            iconColor: getIconColor("#1A1C19"),
        },
        dark: {
            barbg: "#3B4B38",
            bg: "#1A1C19",
            emphasis: "#3B4B38",
            fontColor: "#FCFDF6",
            iconColor: getIconColor("#FCFDF6"),
        },
    },
];
function setCSSVar(name: string, value: string) {
    if (value) document.documentElement.style.setProperty(name, value);
}

function setThemePreview() {
    setCSSVar("--bar-bg0", themeInput[2].value);
    setCSSVar("--bg", themeInput[4].value);
    setCSSVar("--hover-color", themeInput[0].value);
    setCSSVar("--d-bar-bg0", themeInput[3].value);
    setCSSVar("--d-bg", themeInput[5].value);
    setCSSVar("--d-hover-color", themeInput[1].value);
    setCSSVar("--font-color", themeInput[6].value);
    setCSSVar("--d-font-color", themeInput[7].value);
    setCSSVar("--icon-color", getIconColor(themeInput[6].value));
    setCSSVar("--d-icon-color", getIconColor(themeInput[7].value));
}

const theme = old_store.全局.主题;
setCSSVar("--bar-bg0", theme.light.barbg);
setCSSVar("--bg", theme.light.bg);
setCSSVar("--hover-color", theme.light.emphasis);
setCSSVar("--d-bar-bg0", theme.dark.barbg);
setCSSVar("--d-bg", theme.dark.bg);
setCSSVar("--d-hover-color", theme.dark.emphasis);
setCSSVar("--font-color", theme.light.fontColor);
setCSSVar("--d-font-color", theme.dark.fontColor);
setCSSVar("--icon-color", theme.light.iconColor);
setCSSVar("--d-icon-color", theme.dark.iconColor);

for (const i of themeInput) {
    i.onchange = setThemePreview;
}

for (const i of themes) {
    themesEl.append(
        button()
            .style({ background: i.light.emphasis })
            .on("click", () => {
                themeInput[0].value = i.light.emphasis;
                themeInput[1].value = i.dark.emphasis;
                themeInput[2].value = i.light.barbg;
                themeInput[3].value = i.dark.barbg;
                themeInput[4].value = i.light.bg;
                themeInput[5].value = i.dark.bg;
                themeInput[6].value = i.light.fontColor;
                themeInput[7].value = i.dark.fontColor;
                setThemePreview();
                for (const i of themeInput) {
                    i.dispatchEvent(new Event("input"));
                }
            }).el,
    );
}

document.getElementById("深色模式").onclick = () => {
    ipcRenderer.send(
        "setting",
        "theme",
        getRadio(document.getElementById("深色模式")),
    );
};

const 模糊 = old_store.全局.模糊;
if (模糊 !== 0) {
    document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
} else {
    document.documentElement.style.setProperty("--blur", "none");
}
document.getElementById("模糊").oninput = () => {
    const 模糊 = (<HTMLInputElement>document.getElementById("模糊")).value;
    if (Number(模糊) !== 0) {
        document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
    } else {
        document.documentElement.style.setProperty("--blur", "none");
    }
};

document.documentElement.style.setProperty(
    "--alpha",
    `${全局.不透明度 * 100}%`,
);
(<HTMLInputElement>document.getElementById("不透明度")).value = String(
    全局.不透明度 * 100,
);
document.getElementById("不透明度").oninput = () => {
    const 不透明度 = (<HTMLInputElement>document.getElementById("不透明度"))
        .value;
    document.documentElement.style.setProperty(
        "--alpha",
        `${Number(不透明度)}%`,
    );
};

const 快捷键 = old_store.快捷键;
type hotkeyElType = HTMLInputElement & { t: boolean };
for (const el of document.querySelectorAll(
    "#快捷键 hot-keys",
) as Iterable<hotkeyElType>) {
    el.value = 快捷键[el.name].key;
    el.addEventListener("inputend", () => {
        const arg = ipcRenderer.sendSync("setting", "快捷键", [
            el.name,
            el.value,
        ]);
        el.t = arg;
        storeSet(`快捷键.${el.name}.key`, arg ? el.value : "");
    });
}
for (const el of document.querySelectorAll(
    "#hotkeys_content2 hot-keys",
) as Iterable<hotkeyElType>) {
    el.addEventListener("inputend", () => {
        const arg = ipcRenderer.sendSync("setting", "快捷键2", [
            el.name,
            el.value,
        ]);
        el.t = arg;
        storeSet(`全局工具快捷键.${el.name}`, arg ? el.value : "");
    });
}

document.documentElement.style.setProperty(
    "--bar-size",
    `${xstore.工具栏.按钮大小}px`,
);
document.documentElement.style.setProperty(
    "--bar-icon",
    String(xstore.工具栏.按钮图标比例),
);
document.getElementById("按钮大小").oninput = () => {
    document.documentElement.style.setProperty(
        "--bar-size",
        `${(<RangeEl>document.getElementById("按钮大小")).value}px`,
    );
};
document.getElementById("按钮图标比例").oninput = () => {
    document.documentElement.style.setProperty(
        "--bar-icon",
        String((<RangeEl>document.getElementById("按钮图标比例")).value),
    );
};

document
    .getElementById("tool_bar_posi_b")
    .querySelectorAll("button")
    .forEach((el, i) => {
        el.onclick = () => {
            const size = `${(<HTMLInputElement>document.getElementById("按钮大小")).value}px`;
            const l: { left: string; top: string }[] = [
                { left: "10px", top: "100px" },
                {
                    left: `calc(100vw - 10px - ${size} * 2 - 8px)`,
                    top: "100px",
                },
            ];
            (<HTMLInputElement>document.getElementById("tool_bar_left")).value =
                l[i].left;
            (<HTMLInputElement>document.getElementById("tool_bar_top")).value =
                l[i].top;
        };
    });

const toolList: 功能列表 = [
    "close",
    "screens",
    "ocr",
    "search",
    "QR",
    "open",
    "ding",
    "record",
    "long",
    "translate",
    "editor",
    "copy",
    "save",
];
let toolShow = old_store.工具栏.功能;
const toolShowEl = document.getElementById("tool_show");
const toolHideEl = document.getElementById("tool_hide");
function addToolItem(e: DragEvent) {
    const id = e.dataTransfer.getData("text");
    if ((e.target as HTMLElement).dataset.id === id) return null;
    if (id) {
        toolShowEl.querySelector(`[data-id=${id}]`)?.remove();
        toolHideEl.querySelector(`[data-id=${id}]`)?.remove();
    }
    return id;
}
function createToolItem(id: string) {
    const el = document.createElement("div");
    el.draggable = true;
    el.append(iconEl(tools[id].icon).el);
    el.setAttribute("data-id", id);
    el.ondragstart = (e) => {
        e.dataTransfer.setData("text", id);
    };
    el.ondragover = (e) => {
        e.preventDefault();
    };
    el.ondrop = (e) => {
        e.stopPropagation();
        const id = addToolItem(e);
        if (id) {
            if (e.offsetY < el.offsetHeight / 2) {
                el.before(createToolItem(id));
            } else {
                el.after(createToolItem(id));
            }
            setToolL();
        }
    };
    return el;
}

toolShowEl.ondragover = (e) => {
    e.preventDefault();
};
toolHideEl.ondragover = (e) => {
    e.preventDefault();
};
toolShowEl.ondrop = (e) => {
    const id = addToolItem(e);
    if (id) {
        toolShowEl.append(createToolItem(id));
        setToolL();
    }
};
toolHideEl.ondrop = (e) => {
    const id = addToolItem(e);
    if (id) {
        toolHideEl.append(createToolItem(id));
        setToolL();
    }
};
for (const i of toolList) {
    if (toolShow.includes(i as (typeof toolShow)[0])) {
        toolShowEl.append(createToolItem(i));
    } else {
        toolHideEl.append(createToolItem(i));
    }
}
function setToolL() {
    toolShow = [];
    for (const el of toolShowEl
        .querySelectorAll(":scope > [data-id]")
        .values()) {
        toolShow.push(el.getAttribute("data-id") as (typeof toolShow)[0]);
    }
    xstore.工具栏.功能 = toolShow;
}

(<HTMLInputElement>document.getElementById("显示四角坐标")).checked =
    old_store.显示四角坐标;

// 取色器设置
document.getElementById("取色器大小").oninput = () => {
    if (
        Number(
            (<HTMLInputElement>document.getElementById("取色器大小")).value,
        ) %
            2 ===
        0
    ) {
        (<HTMLInputElement>document.getElementById("取色器大小")).value =
            String(
                Number(
                    (<HTMLInputElement>document.getElementById("取色器大小"))
                        .value,
                ) + 1,
            );
    }
    show_color_picker();
};
document.getElementById("像素大小").oninput = () => {
    show_color_picker();
};

show_color_picker();
function show_color_picker() {
    const color_size = Number(
        (<HTMLInputElement>document.getElementById("取色器大小")).value,
    );
    let inner_html = "";
    for (let i = 0; i < color_size ** 2; i++) {
        const l = Math.random() * 40 + 60;
        inner_html += `<span id="point_color_t"style="background:hsl(0,0%,${l}%);width:${
            (<HTMLInputElement>document.getElementById("像素大小")).value
        }px;height:${(<HTMLInputElement>document.getElementById("像素大小")).value}px"></span>`;
    }
    document.getElementById("point_color").style.width = `${
        Number((<HTMLInputElement>document.getElementById("像素大小")).value) *
        color_size
    }px`;
    document.getElementById("point_color").style.height = `${
        Number((<HTMLInputElement>document.getElementById("像素大小")).value) *
        color_size
    }px`;
    document.getElementById("point_color").innerHTML = inner_html;
}

// 选区&遮罩颜色设置
function msk(t: string) {
    return `linear-gradient(${t},${t}),
    conic-gradient(
            rgb(204, 204, 204) 25%,
            rgb(255, 255, 255) 0deg,
            rgb(255, 255, 255) 50%,
            rgb(204, 204, 204) 0deg,
            rgb(204, 204, 204) 75%,
            rgb(255, 255, 255) 0deg
        )
        0% 0% / 8px 8px`;
}
(<HTMLSpanElement>document.querySelector("#遮罩颜色 > span")).style.background =
    msk(old_store.框选.颜色.遮罩);
(<HTMLInputElement>document.querySelector("#遮罩颜色 > input")).oninput =
    () => {
        (<HTMLSpanElement>(
            document.querySelector("#遮罩颜色 > span")
        )).style.background = msk(
            (<HTMLInputElement>document.querySelector("#遮罩颜色 > input"))
                .value,
        );
    };

const xqckxElx = elFromId<HTMLInputElement>("选区参考线x")
    .bindSet((v: number[], el) => {
        el.value = v.join(", ");
    })
    .bindGet((el) =>
        el.value
            .split(/[,，]/)
            .filter(Boolean)
            .map((i) => Number(i)),
    )
    .sv(old_store.框选.参考线.选区.x);
const xqckxEly = elFromId<HTMLInputElement>("选区参考线y")
    .bindSet((v: number[], el) => {
        el.value = v.join(", ");
    })
    .bindGet((el) =>
        el.value
            .split(/[,，]/)
            .filter(Boolean)
            .map((i) => Number(i)),
    )
    .sv(old_store.框选.参考线.选区.y);

const xqckxEl = elFromId("选区参考线");
xqckxEl.add([
    button(txt("无")).on("click", () => {
        xqckxElx.sv([]);
        xqckxEly.sv([]);
    }),
    button(txt("九宫格")).on("click", () => {
        const v = 0.333;
        xqckxElx.sv([v, 1 - v]);
        xqckxEly.sv([v, 1 - v]);
    }),
    button(txt("黄金比例")).on("click", () => {
        const v = 0.618;
        xqckxElx.sv([v, 1 - v]);
        xqckxEly.sv([v, 1 - v]);
    }),
]);

document.getElementById("框选最小阈值").oninput = () => {
    if (
        (<HTMLInputElement>document.getElementById("框选最小阈值")).value >
        (<HTMLInputElement>document.getElementById("框选最大阈值")).value
    ) {
        (<HTMLInputElement>document.getElementById("框选最大阈值")).value = (<
            HTMLInputElement
        >document.getElementById("框选最小阈值")).value;
    }
};
document.getElementById("框选最大阈值").oninput = () => {
    if (
        (<HTMLInputElement>document.getElementById("框选最大阈值")).value <
        (<HTMLInputElement>document.getElementById("框选最小阈值")).value
    ) {
        (<HTMLInputElement>document.getElementById("框选最小阈值")).value = (<
            HTMLInputElement
        >document.getElementById("框选最大阈值")).value;
    }
};

document.getElementById("获取保存路径").onclick = () => {
    const path = ipcRenderer.sendSync(
        "get_save_path",
        (<HTMLInputElement>document.getElementById("快速截屏路径")).value || "",
    );
    if (!path) return;
    (<HTMLInputElement>document.getElementById("快速截屏路径")).value = path;
    (<HTMLInputElement>document.getElementById("快速截屏路径")).dispatchEvent(
        new Event("input"),
    );
};

(<HTMLInputElement>document.getElementById("开启自动录制")).checked =
    old_store.录屏.自动录制 !== false;
(<RangeEl>document.getElementById("自动录制延时")).value =
    old_store.录屏.自动录制 || 0;

document.getElementById("保存文件名称前缀").oninput = document.getElementById(
    "保存文件名称后缀",
).oninput = () => {
    showFTime();
};
document.getElementById("保存文件名称时间").oninput = showFTime;
import time_format from "../../../lib/time_format";
function showFTime() {
    const saveTime = new Date();
    document.getElementById("保存文件名称_p").innerText = `${
        (<HTMLInputElement>document.getElementById("保存文件名称前缀")).value
    }${time_format((<HTMLInputElement>document.getElementById("保存文件名称时间")).value, saveTime)}${
        (<HTMLInputElement>document.getElementById("保存文件名称后缀")).value
    }`;
}
pushRender(() => {
    showFTime();
});

const 字体 = old_store.字体;
document.documentElement.style.setProperty("--main-font", 字体.主要字体);
document.documentElement.style.setProperty("--monospace", 字体.等宽字体);

(<HTMLInputElement>document.querySelector("#主要字体 > input")).oninput =
    () => {
        字体.主要字体 = (<HTMLInputElement>(
            document.querySelector("#主要字体 > input")
        )).value;
        document.documentElement.style.setProperty(
            "--main-font",
            字体.主要字体,
        );
    };
(<HTMLInputElement>document.querySelector("#等宽字体 > input")).oninput =
    () => {
        字体.等宽字体 = (<HTMLInputElement>(
            document.querySelector("#等宽字体 > input")
        )).value;
        document.documentElement.style.setProperty(
            "--monospace",
            字体.等宽字体,
        );
    };

import { hexToCSSFilter } from "hex-to-css-filter";

function getIconColor(hex: string) {
    try {
        return hexToCSSFilter(hex).filter.replace(";", "");
    } catch (error) {
        return null;
    }
}

const translateES = document.getElementById("translate_es");
const translatorFrom = document.getElementById("translator_from");
const translatorTo = document.getElementById("translator_to");

const transList: { [key: string]: (typeof xstore.翻译.翻译器)[0] } = {};

const translatorList = view();
const addTranslatorM = ele("dialog").class("add_translator");
const addTranslator = button(txt("+")).on("click", async () => {
    const v = await translatorD({
        id: crypto.randomUUID().slice(0, 7),
        name: "",
        keys: {},
        type: null,
    });
    const iel = addTranslatorI(v);
    translatorList.add(iel);
    setTranLan();
});
translateES.append(translatorList.el, addTranslator.el, addTranslatorM.el);

new Sortable(translatorList.el, {
    handle: ".sort_handle",
    onEnd: () => {
        setTranLan();
    },
});

function addTranslatorI(v: setting["翻译"]["翻译器"][0]) {
    transList[v.id] = v;
    const handle = button().add(iconEl(handle_svg)).class("sort_handle");
    const text = txt(v.name, true).on("click", async () => {
        const nv = await translatorD(v);
        text.el.innerText = nv.name;
        transList[nv.id] = nv;
    });
    const rm = button()
        .add(iconEl(delete_svg))
        .on("click", () => {
            iel.el.remove();
            setTranLan();
        });
    const iel = view().add([handle, text, rm]).data({ id: v.id });
    return iel;
}

import translator from "xtranslator";
type Engines = keyof typeof translator.e;
const engineConfig: Partial<
    Record<
        Engines,
        {
            t: string;
            key: {
                name: string;
                text?: string;
                type?: "json";
                area?: boolean;
                optional?: boolean;
            }[];
            help?: { src: string };
        }
    >
> = {
    tencentTransmart: {
        t: "腾讯交互式翻译",
        key: [],
    },
    google: {
        t: "谷歌翻译",
        key: [],
    },
    yandex: {
        t: "Yandex",
        key: [],
    },
    youdao: {
        t: "有道",
        key: [{ name: "appid" }, { name: "key" }],
        help: { src: "https://ai.youdao.com/product-fanyi-text.s" },
    },
    baidu: {
        t: "百度",
        key: [{ name: "appid" }, { name: "key" }],
        help: { src: "https://fanyi-api.baidu.com/product/11" },
    },
    deepl: {
        t: "Deepl",
        key: [{ name: "key" }],
        help: { src: "https://www.deepl.com/pro-api?cta=header-pro-api" },
    },
    deeplx: {
        t: "DeeplX",
        key: [{ name: "url" }],
    },
    caiyun: {
        t: "彩云",
        key: [{ name: "token" }],
        help: {
            src: "https://docs.caiyunapp.com/blog/2018/09/03/lingocloud-api/",
        },
    },
    bing: {
        t: "必应",
        key: [{ name: "key" }],
        help: {
            src: "https://learn.microsoft.com/zh-cn/azure/cognitive-services/translator/how-to-create-translator-resource#authentication-keys-and-endpoint-url",
        },
    },
    chatgpt: {
        t: "ChatGPT",
        key: [
            { name: "key", optional: true },
            { name: "url", optional: true },
            {
                name: "config",
                text: "请求体自定义",
                type: "json",
                area: true,
                optional: true,
            },
            {
                name: "sysPrompt",
                text: "系统提示词，${t}为文字，${to}，${from}",
                optional: true,
            },
            {
                name: "userPrompt",
                text: "用户提示词，${t}为文字，${to}，${from}",
                optional: true,
            },
        ],
        help: { src: "https://platform.openai.com/account/api-keys" },
    },
    gemini: {
        t: "Gemini",
        key: [
            { name: "key" },
            { name: "url", optional: true },
            { name: "config", text: "请求体自定义", area: true },
            {
                name: "userPrompt",
                text: "用户提示词，${t}为文字，${to}，${from}",
                optional: true,
            },
        ],
        help: { src: "https://ai.google.dev/" },
    },
    niu: {
        t: "小牛翻译",
        key: [{ name: "key" }],
        help: {
            src: "https://niutrans.com/documents/contents/beginning_guide/6",
        },
    },
};

for (const v of xstore.翻译.翻译器) {
    translatorList.add(addTranslatorI(v));
}

function translatorD(v: setting["翻译"]["翻译器"][0]) {
    const idEl = input()
        .sv(v.name)
        .attr({ placeholder: t("请为翻译器命名") });
    const selectEl = select<Engines | "">(
        [{ value: "", name: t("选择引擎类型") }].concat(
            Object.entries(engineConfig).map((v) => ({
                name: v[1].t,
                value: v[0],
            })),
        ) as { value: Engines }[],
    )
        .sv(v.type || "")
        .on("input", () => {
            set(selectEl.gv);
        });
    const keys = view("y").style({ gap: "8px" });
    const help = p("");

    set(v.type);

    function set(type: Engines | "") {
        keys.clear();
        help.clear();
        if (!type) return;
        const fig = engineConfig[type];
        for (const x of fig.key) {
            const value = v.keys[x.name] as string;

            keys.add(
                view().add([
                    txt(`${x.name}`, true),
                    ele("br"),
                    (x.area ? textarea() : input())
                        .attr({ placeholder: x.text || "", spellcheck: false })
                        .data({ key: x.name })
                        .sv(
                            (x.type === "json"
                                ? JSON.stringify(value, null, 2)
                                : value) || "",
                        )
                        .style({ width: "100%" }),
                ]),
            );
        }
        if (fig.help) help.add(a(fig.help.src).add(txt("API申请")));
    }

    const testEl = view();
    const testR = p("");
    const testB = button(txt("测试"));
    testEl.add([testB, testR]);
    testB.on("click", async () => {
        const v = getV();
        if (!v) return;
        // @ts-ignore
        translator.e[v.type].setKeys(v.keys);
        try {
            const r = await translator.e[v.type].test();
            console.log(r);
            if (r) testR.el.innerText = t("测试成功");
        } catch (error) {
            testR.el.innerText = error;
            throw error;
        }
    });

    addTranslatorM.clear();
    addTranslatorM.add([
        idEl,
        selectEl,
        keys,
        help,
        testEl,
        button(txt("关闭")).on("click", () => {
            addTranslatorM.el.close();
        }),
    ]);

    function getV() {
        if (!selectEl.gv) return null;
        const key = {};
        const e = engineConfig[selectEl.gv].key;
        for (const el of keys.queryAll("input, textarea")) {
            const type = e.find((i) => i.name === el.el.dataset.key).type;
            key[el.el.dataset.key] =
                type === "json" ? JSON.parse(el.el.value) : el.el.value;
        }
        const nv: typeof v = {
            id: v.id,
            name: idEl.gv,
            keys: key,
            type: selectEl.gv,
        };
        return nv;
    }

    addTranslatorM.el.showModal();

    return new Promise((re: (nv: typeof v) => void) => {
        addTranslatorM.add(
            button(txt("完成")).on("click", () => {
                const nv = getV();
                if (
                    nv.type &&
                    Object.entries(nv.keys).every(
                        (i) =>
                            engineConfig[nv.type].key.find(
                                (j) => j.name === i[0],
                            ).optional || i[1],
                    )
                ) {
                    re(nv);
                    addTranslatorM.el.close();
                }
            }),
        );
    });
}

function setTranLan() {
    const id = (translatorList.el.firstChild as HTMLElement)?.getAttribute(
        "data-id",
    );
    translatorFrom.innerText = "";
    translatorTo.innerHTML = "";
    if (!id) return;
    const type = transList[id].type;
    const e = translator.e[type];
    const mainLan = xstore.语言.语言;
    if (!e) return;
    for (const v of e.getLanT({
        auto: t("自动"),
        text: mainLan,
        sort: "text",
    })) {
        translatorFrom.append(
            ele("option").add(txt(v.text, true)).attr({ value: v.lan }).el,
        );
    }
    for (const v of e.getTargetLanT({
        auto: t("自动"),
        text: mainLan,
        sort: "text",
    })) {
        translatorTo.append(
            ele("option").add(txt(v.text, true)).attr({ value: v.lan }).el,
        );
    }
}

setTranLan();

import Sortable from "sortablejs";

const y搜索 = document.getElementById("搜索引擎");
const y翻译 = document.getElementById("翻译引擎");

new Sortable(y搜索, {
    handle: ".sort_handle",
});
new Sortable(y翻译, {
    handle: ".sort_handle",
});

function eSort(el: HTMLElement, list: string[][]) {
    el.classList.add("sort_list");
    const sEl = view();
    new Sortable(sEl.el, {
        handle: ".sort_handle",
    });

    function add(i: (typeof list)[0]) {
        const e = ele("li");
        e.add(button(iconEl(handle_svg)).class("sort_handle"));
        for (const x of i) {
            e.add(input().sv(x));
        }
        e.add(button(iconEl(delete_svg)).on("click", () => e.el.remove()));
        return e;
    }

    for (const i of list) {
        sEl.add(add(i));
    }

    const addEl = view();
    for (const _x of list[0]) {
        addEl.add(input());
    }
    addEl.add(
        button()
            .add(iconEl(add_svg))
            .on("click", () => {
                sEl.add(
                    add(
                        Array.from(addEl.el.querySelectorAll("input")).map(
                            (i) => i.value,
                        ),
                    ),
                );
                for (const el of Array.from(
                    addEl.el.querySelectorAll("input"),
                )) {
                    el.value = "";
                }
            }),
    );

    el.append(sEl.el, addEl.el);

    return () => {
        return Array.from(sEl.el.children).map((d) =>
            Array.from(d.querySelectorAll("input")).map((i) => i.value),
        );
    };
}

function engine2list(l: { name: string; url: string }[]) {
    return l.map((i) => [i.name, i.url]);
}

function list2engine(list: string[][]) {
    return list.map((i) => ({ name: i[0], url: i[1] }));
}

const y搜索引擎 = eSort(y搜索, engine2list(old_store.引擎.搜索));
const y翻译引擎 = eSort(y翻译, engine2list(old_store.引擎.翻译));

(<HTMLInputElement>document.getElementById("记住识图引擎")).checked = Boolean(
    old_store.以图搜图.记住,
);

document.getElementById("clear_storage").onclick = () => {
    ipcRenderer.send("setting", "clear", "storage");
};
document.getElementById("clear_cache").onclick = () => {
    ipcRenderer.send("setting", "clear", "cache");
};

const ocrUrl =
    "https://github.com/xushengfeng/eSearch-OCR/releases/download/4.0.0/";
const ocrUrls: { name: string; url: string }[] = [
    { name: "ghproxy", url: `https://mirror.ghproxy.com/${ocrUrl}` },
    { name: "GitHub", url: ocrUrl },
];

const ocrModels: Record<
    string,
    { url: string; name: string; supportLang: string[] }
> = {
    ch: { url: "ch.zip", name: "中英混合", supportLang: ["zh-HANS", "en"] },
    en: { url: "en.zip", name: "英文", supportLang: ["en"] },
    chinese_cht: {
        url: "chinese_cht.zip",
        name: "中文繁体",
        supportLang: ["zh-HANT"],
    },
    korean: { url: "korean.zip", name: "韩文", supportLang: ["ko"] },
    japan: { url: "japan.zip", name: "日文", supportLang: ["ja"] },
    te: { url: "te.zip", name: "泰卢固文", supportLang: ["te"] },
    ka: { url: "ka.zip", name: "卡纳达文", supportLang: ["ka"] },
    ta: { url: "ta.zip", name: "泰米尔文", supportLang: ["ta"] },
    latin: {
        url: "latin.zip",
        name: "拉丁文",
        supportLang: [
            "af",
            "az",
            "bs",
            "cs",
            "cy",
            "da",
            "de",
            "es",
            "et",
            "fr",
            "ga",
            "hr",
            "hu",
            "id",
            "is",
            "it",
            "ku",
            "la",
            "lt",
            "lv",
            "mi",
            "ms",
            "mt",
            "nl",
            "no",
            "oc",
            "pi",
            "pl",
            "pt",
            "ro",
            "sr-Latn",
            "sk",
            "sl",
            "sq",
            "sv",
            "sw",
            "tl",
            "tr",
            "uz",
            "vi",
            "fr",
            "de",
        ],
    },
    arabic: {
        url: "arabic.zip",
        name: "阿拉伯字母",
        supportLang: ["ar", "fa", "ug", "ur"],
    },
    cyrillic: {
        url: "cyrillic.zip",
        name: "斯拉夫字母",
        supportLang: [
            "ru",
            "sr-Cyrl",
            "be",
            "bg",
            "uk",
            "mn",
            "abq",
            "ady",
            "kbd",
            "ava",
            "dar",
            "inh",
            "che",
            "lbe",
            "lez",
            "tab",
        ],
    },
    devanagari: {
        url: "devanagari.zip",
        name: "梵文字母",
        supportLang: [
            "hi",
            "mr",
            "ne",
            "bh",
            "mai",
            "ang",
            "bho",
            "mah",
            "sck",
            "new",
            "gom",
            "sa",
            "bgc",
        ],
    },
};

const langMap = {
    pi: "巴利语",
    abq: "阿布哈兹语",
    ady: "阿迪格语",
    kbd: "卡巴尔达语",
    ava: "阿瓦尔语",
    dar: "达尔格瓦语",
    inh: "印古什语",
    che: "车臣语",
    lbe: "列兹金语",
    lez: "雷兹语",
    tab: "塔巴萨兰语",
    bh: "比哈里语",
    ang: "古英语",
    mah: "马拉提语",
    sck: "西卡语",
    new: "尼瓦尔语",
    gom: "孔卡尼语",
    bgc: "哈尔穆克语",
};

function setOcr() {
    let ocrIn = "";
    for (const i of old_store.离线OCR) {
        ocrIn += `<label><input type="radio" name="OCR类型" value="${i[0]}">${i[0]}</label>`;
    }
    ocrIn += `
    <label><input type="radio" name="OCR类型" value="youdao">
        <t>有道</t>
    </label>
    <label><input type="radio" name="OCR类型" value="baidu">
        <t>百度</t>
    </label>`;
    document.getElementById("OCR类型").outerHTML =
        `<div id="OCR类型">${ocrIn}</div>`;
    setRadio(document.getElementById("OCR类型"), old_store.OCR.类型);
}

setOcr();

function getOcrType() {
    return getRadio(<HTMLInputElement>document.getElementById("OCR类型"));
}
ocrDOpen();
function ocrDOpen() {
    (<HTMLDetailsElement>document.getElementById("baidu_details")).open = false;
    (<HTMLDetailsElement>(
        document.getElementById("youdao_details")
    )).open = false;
    if (getOcrType() === "baidu") {
        (<HTMLDetailsElement>(
            document.getElementById("baidu_details")
        )).open = true;
    } else if (getOcrType() === "youdao") {
        (<HTMLDetailsElement>(
            document.getElementById("youdao_details")
        )).open = true;
    }
}
document.getElementById("OCR类型").onclick = ocrDOpen;

function OCR模型展示() {
    document.getElementById("OCR模型列表").innerHTML = "";
    const all = old_store.离线OCR;
    for (const i in all) {
        const d = document.createElement("div");
        const t = document.createElement("input");
        t.type = "text";
        t.value = all[i][0];
        t.oninput = () => {
            all[i][0] = t.value;
            xstore.离线OCR = all;
            setOcr();
        };
        d.append(t);
        const c = document.createElement("button");
        c.innerHTML = `<img src="${close_svg}" class="icon">`;
        c.onclick = () => {
            if (all.length === 1) return;
            all.splice(Number(i), 1);
            d.remove();
            xstore.离线OCR = all;
            setOcr();
        };
        d.append(c);
        document.getElementById("OCR模型列表").append(d);
    }
}
OCR模型展示();

document.getElementById("OCR拖拽放置区").ondragover = (e) => {
    e.preventDefault();
    document.getElementById("OCR拖拽放置区").classList.add("拖拽突出");
};
document.getElementById("OCR拖拽放置区").ondragleave = () => {
    document.getElementById("OCR拖拽放置区").classList.remove("拖拽突出");
};
document.getElementById("OCR拖拽放置区").ondrop = (e) => {
    e.preventDefault();
    console.log(e);
    const fs = e.dataTransfer.files;
    addOCRFromPaths(Array.from(fs).map((i) => webUtils.getPathForFile(i)));
    document.getElementById("OCR拖拽放置区").classList.remove("拖拽突出");
};

const ocrModelListEl = button(iconEl(down_svg));
const addOCRModel = ele("dialog").class("add_ocr_model");
const ocrLanMap: Record<string, string> = {};
for (const i in ocrModels) {
    for (const j of ocrModels[i].supportLang) {
        ocrLanMap[j] = i;
    }
}
const langName = new Intl.DisplayNames(xstore.语言.语言, { type: "language" });

const OCRListEl = view("y").style({ overflow: "auto", gap: "8px" });
for (const i in ocrModels) {
    const pro = ele("progress").attr({ value: 0 }).style({ display: "none" });
    const lans = view("x").style({ "column-gap": "16px", "flex-wrap": "wrap" });
    const p = path.join(configPath, "models", i);
    const exists = fs.existsSync(p);
    const downloadButton = button(exists ? "重新下载" : "下载").on(
        "click",
        () => {
            pro.el.style.display = "block";
            const url = mirrorSelect.gv + ocrModels[i].url;
            download(url, p, {
                extract: true,
                rejectUnauthorized: false,
            })
                .on("response", (res) => {
                    const total = Number(res.headers["content-length"]);
                    let now = 0;
                    res.on("data", (data) => {
                        now += Number(data.length);
                        const percent = now / total;
                        console.log(percent);
                        pro.attr({ value: percent });
                    });
                    res.on("end", () => {});
                })
                .then(() => {
                    console.log("end");
                    addOCR(p);
                });
        },
    );
    OCRListEl.add(
        view("y").add([
            view("x")
                .add([
                    button(ocrModels[i].name).on("click", () => {
                        lans.clear().add(
                            ocrModels[i].supportLang.map((i) =>
                                langMap[i]
                                    ? txt(langMap[i])
                                    : txt(langName.of(i), true),
                            ),
                        );
                    }),
                    downloadButton,
                    pro,
                ])
                .style({ "align-items": "center" }),
            lans,
        ]),
    );
}

const mirrorSelect = select(
    ocrUrls.map((i) => ({ name: i.name, value: i.url })),
);
const ocrDownloadEl = view().add([mirrorSelect]);
addOCRModel.add([
    OCRListEl,
    ocrDownloadEl,
    view().add(["将保存到：", " ", pathEl(path.join(configPath, "models"))]),
    button(txt("关闭")).on("click", () => addOCRModel.el.close()),
]);
document
    .getElementById("OCR拖拽放置区")
    .after(ocrModelListEl.el, addOCRModel.el);

ocrModelListEl.on("click", () => {
    addOCRModel.el.showModal();
});

function addOCR(p: string) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
        const files = fs.readdirSync(p);
        const downPath = path.join(p, files[0]);
        if (fs.statSync(downPath).isDirectory()) {
            addOCRFromPaths(
                fs.readdirSync(downPath).map((i) => path.join(downPath, i)),
            );
        } else {
            addOCRFromPaths(files.map((i) => path.join(p, i)));
        }
    } else {
        const files = fs.readdirSync(path.join(p, "../"));
        addOCRFromPaths(files.map((i) => path.join(p, "../", i)));
    }
}

function addOCRFromPaths(paths: string[]) {
    const l: [string, string, string, string] = [
        `新模型${crypto.randomUUID().slice(0, 7)}`,
        "默认/ppocr_det.onnx",
        "默认/ppocr_rec.onnx",
        "默认/ppocr_keys_v1.txt",
    ];
    for (const path of paths) {
        if (path.split("/").at(-1).includes("det")) {
            l[1] = path;
        } else if (path.split("/").at(-1).includes("rec")) {
            l[2] = path;
        } else {
            l[3] = path;
        }
    }
    const all = old_store.离线OCR;
    all.push(l);
    xstore.离线OCR = all;
    OCR模型展示();
    setOcr();
}

const screenKeyTipEl = document.getElementById("screen_key_tip");
const screenKeyTipKBD = screenKeyTipEl.querySelector("div");
const screenKeyTipOXEl = document.getElementById(
    "screen_key_tip_ox",
) as RangeEl;
const screenKeyTipOYEl = document.getElementById(
    "screen_key_tip_oy",
) as RangeEl;
const screenKeyTipSizeEl = document.getElementById(
    "screen_key_tip_size",
) as RangeEl;

function setKeyTip() {
    const posi = xstore.录屏.提示.键盘.位置;
    const px = posi.x === "+" ? "right" : "left";
    const py = posi.y === "+" ? "bottom" : "top";
    for (const x of ["left", "right", "top", "bottom"]) {
        screenKeyTipKBD.style[x] = "";
    }
    screenKeyTipKBD.style[px] = `${posi.offsetX}px`;
    screenKeyTipKBD.style[py] = `${posi.offsetY}px`;

    screenKeyTipKBD.style.fontSize = `${xstore.录屏.提示.键盘.大小 * 16}px`;
}
setKeyTip();

screenKeyTipOXEl.addEventListener("input", () => {
    xstore.录屏.提示.键盘.位置.offsetX = screenKeyTipOXEl.value;
    setKeyTip();
});
screenKeyTipOYEl.addEventListener("input", () => {
    xstore.录屏.提示.键盘.位置.offsetY = screenKeyTipOYEl.value;
    setKeyTip();
});
screenKeyTipSizeEl.addEventListener("input", () => {
    xstore.录屏.提示.键盘.大小 = screenKeyTipSizeEl.value;
    setKeyTip();
});

for (const x of ["+", "-"] as const) {
    for (const y of ["+", "-"] as const) {
        const px = x === "+" ? "right" : "left";
        const py = y === "+" ? "bottom" : "top";
        const handle = view().el;
        handle.style[px] = "-4px";
        handle.style[py] = "-4px";
        if (
            x === xstore.录屏.提示.键盘.位置.x &&
            y === xstore.录屏.提示.键盘.位置.y
        ) {
            handle.classList.add("tip_select");
        }
        handle.onclick = () => {
            screenKeyTipEl
                .querySelector(".tip_select")
                .classList.remove("tip_select");
            handle.classList.add("tip_select");
            xstore.录屏.提示.键盘.位置.x = x;
            xstore.录屏.提示.键盘.位置.y = y;
            setKeyTip();
        };
        screenKeyTipEl.append(handle);
    }
}

const 历史记录设置 = old_store.历史记录设置;

(<HTMLButtonElement>document.getElementById("清除历史记录")).disabled =
    !历史记录设置.保留历史记录;
(<HTMLButtonElement>document.getElementById("his_d")).disabled =
    !历史记录设置.自动清除历史记录;
(<HTMLButtonElement>document.getElementById("his_h")).disabled =
    !历史记录设置.自动清除历史记录;

document.getElementById("历史记录_b").oninput = () => {
    历史记录设置.保留历史记录 = (<HTMLInputElement>(
        document.getElementById("历史记录_b")
    )).checked;
    (<HTMLButtonElement>document.getElementById("清除历史记录")).disabled = !(<
        HTMLInputElement
    >document.getElementById("历史记录_b")).checked;
};
document.getElementById("清除历史记录").oninput = () => {
    历史记录设置.自动清除历史记录 = (<HTMLInputElement>(
        document.getElementById("清除历史记录")
    )).checked;
    (<HTMLButtonElement>document.getElementById("his_d")).disabled = !(<
        HTMLInputElement
    >document.getElementById("清除历史记录")).checked;
    (<HTMLButtonElement>document.getElementById("his_h")).disabled = !(<
        HTMLInputElement
    >document.getElementById("清除历史记录")).checked;
};
document.getElementById("clear_his").onclick = () => {
    const c = confirm("这将清除所有的历史记录\n且不能复原\n确定清除？");
    if (c)
        fs.writeFileSync(
            path.join(configPath, "history.json"),
            JSON.stringify({ 历史记录: {} }, null, 2),
        );
};

(<HTMLInputElement>document.getElementById("时间格式")).value =
    old_store.时间格式;

const hotkeysSelectEl = document.getElementById("hotkeys");
const hotkeysContentEl = document.getElementById("hotkeys_content");
const hotkeysEl = hotkeysContentEl.children as unknown as HTMLElement[];
for (let i = 0; i < hotkeysSelectEl.childElementCount; i++) {
    (hotkeysSelectEl.children[i] as HTMLElement).onclick = () => {
        selectHotkey(i);
    };
}

selectHotkey(0);

function selectHotkey(i: number) {
    for (let j = 0; j < hotkeysEl.length; j++) {
        if (j === i) hotkeysEl[j].style.display = "";
        else hotkeysEl[j].style.display = "none";
    }
}

const proxyL = ["http", "https", "ftp", "socks"];

const 代理 = old_store.代理;
getProxy();

renderTasks.push(setProxyEl);
document.getElementById("代理").onclick = setProxyEl;
function setProxyEl() {
    const m = getRadio(document.getElementById("代理"));
    const pacScriptEl = document.getElementById("pacScript_p");
    const proxyRulesEl = document.getElementById("proxyRules_p");
    const proxyBypassRulesEl = document.getElementById("proxyBypassRules_p");
    switch (m) {
        case "direct":
            pacScriptEl.style.display =
                proxyRulesEl.style.display =
                proxyBypassRulesEl.style.display =
                    "none";
            break;
        case "auto_detect":
            pacScriptEl.style.display = proxyRulesEl.style.display = "none";
            proxyBypassRulesEl.style.display = "block";
            break;
        case "pac_script":
            pacScriptEl.style.display = "block";
            proxyRulesEl.style.display = "none";
            proxyBypassRulesEl.style.display = "block";
            break;
        case "fixed_servers":
            proxyRulesEl.style.display = "block";
            pacScriptEl.style.display = "none";
            proxyBypassRulesEl.style.display = "block";
            break;
        case "system":
            pacScriptEl.style.display = proxyRulesEl.style.display = "none";
            proxyBypassRulesEl.style.display = "block";
            break;
    }
}

function getProxy() {
    const l = 代理.proxyRules.split(";") as string[];
    for (const rule of l) {
        for (const x of proxyL) {
            if (rule.includes(`${x}=`)) {
                (<HTMLInputElement>(
                    document.getElementById(`proxy_${x}`)
                )).value = rule.replace(`${x}=`, "");
            }
        }
    }
}
function setProxy() {
    const l = [];
    for (const x of proxyL) {
        const v = (<HTMLInputElement>document.getElementById(`proxy_${x}`))
            .value;
        if (v) {
            l.push(`${x}=${v}`);
        }
    }
    return l.join(";");
}

document.getElementById("打开config").title = store.path;
document.getElementById("打开config").onclick = () => {
    shell.openPath(store.path);
};

let giveUp = false;
document.getElementById("give_up_setting_b").oninput = () => {
    giveUp = (<HTMLInputElement>document.getElementById("give_up_setting_b"))
        .checked;
    if (giveUp)
        fs.writeFileSync(store.path, JSON.stringify(old_store, null, 2));
};

window.onbeforeunload = () => {
    try {
        saveSetting();
    } catch {
        ipcRenderer.send("setting", "save_err");
    }
    ipcRenderer.send("setting", "reload_main");
};

function saveSetting() {
    if (giveUp) return;
    xstore.主搜索功能.自动搜索排除 = (<HTMLInputElement>(
        document.getElementById("自动搜索排除")
    )).value
        .split(/\n/)
        .filter((i) => i !== "");
    xstore.全局.不透明度 =
        (<RangeEl>document.getElementById("不透明度")).value / 100;
    try {
        xstore.全局.主题.light.iconColor =
            getIconColor(themeInput[6].value) || themes[0].light.iconColor;
        xstore.全局.主题.dark.iconColor =
            getIconColor(themeInput[7].value) || themes[0].dark.iconColor;
    } catch (e) {}

    xstore.框选.参考线.选区.x = xqckxElx.gv;
    xstore.框选.参考线.选区.y = xqckxEly.gv;

    xstore.录屏.自动录制 =
        (<HTMLInputElement>document.getElementById("开启自动录制")).checked &&
        (<RangeEl>document.getElementById("自动录制延时")).value;

    字体.大小 = (<RangeEl>document.getElementById("字体大小")).value;
    字体.记住 = (<HTMLInputElement>document.getElementById("记住字体大小"))
        .checked
        ? typeof 字体.记住 === "number"
            ? 字体.记住
            : 字体.大小
        : false;
    xstore.字体 = 字体;
    xstore.翻译.翻译器 = Array.from(translatorList.el.children).map(
        (i: HTMLElement) => transList[i.getAttribute("data-id")],
    );
    const yS = list2engine(y搜索引擎());
    const yF = list2engine(y翻译引擎());
    if (!yF.find((i) => i.url.startsWith("translate")))
        yF.push({ name: "翻译", url: "translate/?text=%s" });
    xstore.引擎 = {
        搜索: yS,
        翻译: yF,
        记忆: { 搜索: yS[0].name, 翻译: yF[0].name },
    };
    xstore.以图搜图.记住 = (<HTMLInputElement>(
        document.getElementById("记住识图引擎")
    )).checked
        ? old_store.以图搜图.记住 ||
          getRadio(<HTMLInputElement>document.getElementById("图像搜索引擎"))
        : false;
    xstore.历史记录设置 = 历史记录设置;
    xstore.OCR.类型 = getOcrType();
    xstore.OCR.记住 = (<HTMLInputElement>document.getElementById("记住OCR引擎"))
        .checked
        ? old_store.OCR.记住 || getOcrType()
        : false;
    xstore.代理.proxyRules = setProxy();
    if (userDataPathInputed)
        fs.writeFile(
            "preload_config",
            (<HTMLInputElement>document.getElementById("user_data_path")).value,
            (e) => {
                if (e)
                    throw new Error(
                        t(
                            "保存失败，请确保软件拥有运行目录的修改权限，或重新使用管理员模式打开软件",
                        ),
                    );
            },
        );
    fs.writeFileSync(
        path.join(configPath, "config.json"),
        JSON.stringify(xstore, null, 2),
    );
}

_runTask(0, renderTasks, (v) => v());

// 查找
document.getElementById("find_b_close").onclick = () => {
    find((<HTMLInputElement>document.getElementById("find_input")).value);
};
document.getElementById("find_input").oninput = () => {
    find((<HTMLInputElement>document.getElementById("find_input")).value);
};
document.getElementById("find_b_last").onclick = () => {
    findFocusI = (findFocusI - 1) % findRanges.length;
    if (findFocusI < 0) {
        findFocusI = findRanges.length - 1;
    }
    jumpToRange(findFocusI);
};
document.getElementById("find_b_next").onclick = () => {
    findFocusI = (findFocusI + 1) % findRanges.length;
    jumpToRange(findFocusI);
};

const findCont = elFromId("find_t").bindSet((v: [number, number], el) => {
    el.innerText = `${v[0]} / ${v[1]}`;
});

function jumpToRange(i: number) {
    if (findRanges.length === 0) {
        findCont.sv([0, 0]);
        return;
    }
    const rect = findRanges[i].getBoundingClientRect();
    findCont.sv([i + 1, findRanges.length]);
    document.documentElement.scrollTo(
        0,
        rect.top - document.body.getBoundingClientRect().top,
    );
}
let allTextNodes = [];

function initFind() {
    const treeWalker = document.createTreeWalker(
        document.getElementById("main"),
        NodeFilter.SHOW_TEXT,
    );
    let currentNode = treeWalker.nextNode();
    allTextNodes = [];
    while (currentNode) {
        allTextNodes.push(currentNode);
        currentNode = treeWalker.nextNode();
    }
    console.log(allTextNodes);
}
let findRanges: Range[] = [];
let findFocusI = 0;
function find(t: string) {
    CSS.highlights.clear();

    const str = t.trim().toLowerCase();
    if (!str) {
        document.getElementById("find_t").innerText = "";
        return;
    }

    const ranges = allTextNodes
        .map((el) => {
            return { el, text: el.textContent.toLowerCase() };
        })
        .map(({ text, el }) => {
            const indices = [];
            let startPos = 0;
            while (startPos < text.length) {
                const index = text.indexOf(str, startPos);
                if (index === -1) break;
                indices.push(index);
                startPos = index + str.length;
            }

            return indices.map((index) => {
                const range = new Range();
                range.setStart(el, index);
                range.setEnd(el, index + str.length);
                return range;
            });
        });

    findRanges = ranges.flat();
    findFocusI = 0;
    jumpToRange(findFocusI);

    const searchResultsHighlight = new Highlight(...ranges.flat());
    CSS.highlights.set("search-results", searchResultsHighlight);
}

function pathEl(path: string) {
    return txt(path, true)
        .style({ "font-family": "var(--monospace)", cursor: "pointer" })
        .on("click", () => shell.openPath(path));
}
const pathInfo = view().add([
    view().add(["文字记录：", " ", pathEl(historyStore.path)]),
    view().add(["临时目录：", " ", pathEl(path.join(os.tmpdir(), "eSearch"))]),
    view().add(["运行目录：", " ", pathEl(ipcRenderer.sendSync("run_path"))]),
]);
document.getElementById("user_data_divs").after(pathInfo.el);
try {
    (<HTMLInputElement>document.getElementById("user_data_path")).value =
        fs.readFileSync("preload_config").toString().trim() ||
        store.path.replace(/[/\\]config\.json/, "");
} catch (error) {
    (<HTMLInputElement>document.getElementById("user_data_path")).value =
        store.path.replace(/[/\\]config\.json/, "");
}
let userDataPathInputed = false;
document.getElementById("user_data_path").oninput = () => {
    document.getElementById("user_data_divs").classList.add("user_data_divs");
    userDataPathInputed = true;
};
document.getElementById("move_user_data").onclick = () => {
    ipcRenderer.send(
        "setting",
        "move_user_data",
        (<HTMLInputElement>document.getElementById("user_data_path")).value,
    );
};

document.getElementById("reload").onclick = () => {
    saveSetting();
    ipcRenderer.send("setting", "reload");
};

const versionL = ["electron", "node", "chrome", "v8"];
const moreVersion = view()
    .style({ "font-family": "var(--monospace)" })
    .add(
        view()
            .add(
                txt(`${t("本机系统内核:")} ${os.type()} ${os.release()}`, true),
            )
            .add(
                versionL.map((i) =>
                    view().add(txt(`${i}: ${process.versions[i]}`, true)),
                ),
            ),
    );
document.getElementById("versions_info").after(moreVersion.el);

import _package from "../../../package.json?raw";
const packageJson = JSON.parse(_package);
const download = require("download");
document.getElementById("name").innerHTML = packageJson.name;
document.getElementById("version").innerHTML = packageJson.version;
document.getElementById("description").innerHTML = t(packageJson.description);
document.getElementById("version").onclick = () => {
    fetch("https://api.github.com/repos/xushengfeng/eSearch/releases", {
        method: "GET",
        redirect: "follow",
    })
        .then((response) => response.json())
        .then((re) => {
            console.log(re);
            if (document.getElementById("update_info").innerHTML) return;
            const l = [];
            for (const r of re) {
                if (
                    !packageJson.version.includes("beta") &&
                    !packageJson.version.includes("alpha") &&
                    old_store.更新.模式 !== "dev"
                ) {
                    if (!r.draft && !r.prerelease) l.push(r);
                } else {
                    l.push(r);
                }
            }
            function tag(text: string) {
                const tag = document.createElement("span");
                tag.innerText = t(text);
                return tag;
            }
            for (const i in l) {
                const r = l[i];
                const div = document.createElement("div");
                const tags = document.createElement("div");
                const h = document.createElement("h1");
                h.innerText = r.name;
                const p = document.createElement("p");
                p.innerHTML = r.body.replace(/\r\n/g, "<br>");
                fetch("https://api.github.com/markdown", {
                    body: JSON.stringify({ text: r.body, mode: "gfm" }),
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                })
                    .then((r) => r.text())
                    .then((data) => {
                        p.innerHTML = data;
                    });
                div.append(tags, h, p);
                document.getElementById("update_info").append(div);
                if (i === "0") {
                    const tagEl = tag("最新版本");
                    tagEl.title = t("点击下载");
                    tagEl.classList.add("download_tag");
                    tags.append(tagEl);
                    tagEl.onclick = () => {
                        shell.openExternal(r.html_url);
                    };
                    for (const a of r.assets) {
                        if (
                            a.name === `app-${process.platform}-${process.arch}`
                        ) {
                            const xel = txt("增量更新").on(
                                "click",
                                async () => {
                                    xel.clear();
                                    const pro = ele("progress");
                                    const text = txt("");
                                    xel.add([pro, text]);
                                    download(
                                        a.browser_download_url,
                                        path.join(__dirname, "../../../"),
                                        {
                                            extract: true,
                                            rejectUnauthorized: false,
                                        },
                                    )
                                        .on("response", (res) => {
                                            const total = Number(
                                                res.headers["content-length"],
                                            );
                                            let now = 0;
                                            res.on("data", (data) => {
                                                now += Number(data.length);
                                                const percent = now / total;
                                                text.el.innerText = `${(percent * 100).toFixed(2)}%`;
                                                pro.el.value = percent;
                                            });
                                            res.on("end", () => {
                                                xel.el.innerText =
                                                    t("正在更新中");
                                            });
                                        })
                                        .then(() => {
                                            xel.el.innerText = t(
                                                "更新完毕，你可以重启软件",
                                            );
                                        });
                                },
                            );
                            tagEl.after(xel.el);
                        }
                    }
                }
                if (r.name === packageJson.version) {
                    tags.append(tag("当前版本"));
                    if (i !== "0") {
                        (<HTMLElement>(
                            document.getElementById("menu").lastElementChild
                        )).style.color = "#335EFE";
                    }
                    break;
                }
            }
        })
        .catch((error) => console.log("error", error));
};

const infoEl = pack(document.getElementById("info"));

infoEl.add([
    view().add([
        "项目主页:",
        " ",
        a(packageJson.homepage).add(packageJson.homepage),
    ]),
    view().add([
        "支持该项目:",
        " ",
        a(packageJson.homepage).add("为项目点亮星标🌟"),
        " ",
        a("https://github.com/xushengfeng").add("赞赏"),
    ]),
    view().add(
        a(
            `https://github.com/xushengfeng/eSearch/releases/tag/${packageJson.version}`,
        ).add("更新日志"),
    ),
    view().add([
        a(ipcRenderer.sendSync("setting", "feedback")).add("反馈问题"),
        " ",
        a(
            `https://github.com/xushengfeng/eSearch/issues/new?assignees=&labels=新需求&template=feature_request.yaml&title=建议在……添加……功能/改进&v=${packageJson.version}&os=${process.platform} ${os.release()} (${process.arch})`,
        ).add("提供建议"),
    ]),
    view().add(
        a(
            "https://github.com/xushengfeng/eSearch/tree/master/lib/translate",
        ).add("改进翻译"),
    ),
    view().add([
        "本软件遵循",
        " ",
        a("https://www.gnu.org/licenses/gpl-3.0.html").add(packageJson.license),
    ]),
    view().add([
        "本软件基于",
        " ",
        a(
            "https://github.com/xushengfeng/eSearch-website/blob/master/public/readme/all_license.json",
        ).add("这些软件"),
    ]),
    view().add(
        `Copyright (C) 2021 ${packageJson.author.name} ${packageJson.author.email}`,
    ),
]);

document.body.onclick = (e) => {
    if ((<HTMLElement>e.target).tagName === "A") {
        const el = <HTMLAnchorElement>e.target;
        if (el.href.startsWith("http") || el.href.startsWith("https")) {
            e.preventDefault();
            shell.openExternal(el.href);
        }
    }
};

ipcRenderer.on("about", (_event, arg) => {
    if (arg !== undefined) {
        location.hash = "#about";
    }
});

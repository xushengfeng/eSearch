/// <reference types="vite/client" />
let configPath = new URLSearchParams(location.search).get("config_path");
import { setting, 功能 } from "../../ShareTypes";
const path = require("path") as typeof import("path");
import "../../../lib/template.js";
import "../../../lib/template2.js";
const { shell, ipcRenderer } = require("electron") as typeof import("electron");
const os = require("os") as typeof import("os");
const fs = require("fs") as typeof import("fs");
import { el } from "redom";

import close_svg from "../assets/icons/close.svg";
import delete_svg from "../assets/icons/delete.svg";
import handle_svg from "../assets/icons/handle.svg";
import add_svg from "../assets/icons/add.svg";

function iconEl(img: string) {
    return el("img", { src: img, class: "icon" });
}

type RangeEl = HTMLElement & { value: number };

let old_store = JSON.parse(fs.readFileSync(path.join(configPath, "config.json"), "utf-8")) as setting;
import { t, lan, getLans, getLanName } from "../../../lib/translate/translate";
lan(old_store.语言.语言);
document.querySelectorAll("[title],[placeholder]").forEach((el: HTMLElement) => {
    if (el.title?.includes("{")) el.title = t(el.title.slice(1, -1));
    const iel = el as HTMLInputElement;
    if (iel.placeholder?.includes("{")) iel.placeholder = t(iel.placeholder.slice(1, -1));
});
document.querySelectorAll("li, h1, h2, h3, button, comment, t").forEach((el: HTMLElement) => {
    if (el.innerText) el.innerText = t(el.innerText);
});
document.title = t(document.title);

document.querySelectorAll("[data-platform]").forEach((el: HTMLElement) => {
    const platforms = el
        .getAttribute("data-platform")
        .split(",")
        .map((i) => i.trim());
    if (!platforms.includes(process.platform)) {
        el.style.display = "none";
    }
});

const xstore = old_store;
function storeSet(path: string, value: any) {
    let pathx = path.split(".");
    const lastp = pathx.pop();
    const lastobj = pathx.reduce((p, c) => (p[c] = p[c] || {}), xstore);
    lastobj[lastp] = value;
}
function storeGet(path: string) {
    let pathx = path.split(".");
    const lastp = pathx.pop();
    const lastobj = pathx.reduce((p, c) => (p[c] = p[c] || {}), xstore);
    return lastobj[lastp];
}

let store = { path: path.join(configPath, "config.json") };
let historyStore = { path: path.join(configPath, "history.json") };

document.getElementById("set_default_setting").onclick = () => {
    if (confirm("将会把所有设置恢复成默认，无法撤销")) {
        ipcRenderer.send("setting", "set_default_setting");
        giveUp = true;
        location.reload();
    }
};

document.getElementById("menu").onclick = (e) => {
    let el = <HTMLElement>e.target;
    if (el.tagName == "LI") {
        let i = 0;
        document
            .getElementById("menu")
            .querySelectorAll("li")
            .forEach((lel, n) => {
                if (lel == el) {
                    i = n;
                    return;
                }
            });
        document.getElementsByTagName("html")[0].scrollTop = document.querySelectorAll("h1")[i].offsetTop;
    }
};

document.getElementById("menu").querySelector("li").classList.add("active");
document.onscroll = () => {
    let h1s = document.querySelectorAll("h1");
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

document.querySelectorAll("[data-path]").forEach((el: HTMLElement) => {
    const path = el.getAttribute("data-path");
    let value = storeGet(path);
    if (el.tagName == "RANGE-B") {
        // range-b
        (el as HTMLInputElement).value = value;
        (el as HTMLInputElement).addEventListener("input", () => {
            storeSet(path, (el as HTMLInputElement).value);
        });
    } else if (el.tagName == "INPUT") {
        let iel = el as HTMLInputElement;
        if (iel.type == "checkbox") {
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
    } else if (el.tagName == "HOT-KEYS") {
        let iel = el as HTMLInputElement;
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
});

ipcRenderer.send("autostart", "get");
ipcRenderer.on("开机启动状态", (_event, v) => {
    (<HTMLInputElement>document.getElementById("autostart")).checked = v;
});
document.getElementById("autostart").oninput = () => {
    ipcRenderer.send("autostart", "set", (<HTMLInputElement>document.getElementById("autostart")).checked);
};

(<HTMLInputElement>document.getElementById("启动提示")).checked = old_store.启动提示;

function getRadio(el: HTMLElement) {
    return (<HTMLInputElement>el.querySelector("input[type=radio]:checked")).value;
}
function setRadio(el: HTMLElement, value: string) {
    (
        <HTMLInputElement>el.querySelector(`input[type=radio][value="${value}"]`) ||
        el.querySelector(`input[type=radio]`)
    ).checked = true;
}

let lans: string[] = getLans();
function getSystemLan() {
    const sysL = navigator.language;
    if (sysL.split("-")[0] === "zh") {
        return (
            {
                "zh-CN": "zh-HANS",
                "zh-SG": "zh-HANS",
                "zh-TW": "zh-HANT",
            }[sysL] || "zh-HANS"
        );
    } else {
        if (lans.includes(sysL)) return sysL;
        else if (lans.includes(sysL.split("-")[0])) return sysL.split("-")[0];
        else return "zh-HANS";
    }
}
const systemLan = getSystemLan();

lans = [systemLan].concat(lans.filter((v) => v != systemLan));

const lanEl = document.getElementById("语言");
for (let i of lans) {
    lanEl.append(el("label", el("input", { type: "radio", name: "语言", value: i }), getLanName(i)));
}

setRadio(lanEl, old_store.语言.语言);
const systemLanEl = document.getElementById("系统语言");
systemLanEl.innerText = t("使用系统语言", systemLan);
systemLanEl.onclick = () => {
    setRadio(lanEl, systemLan);
    lan(getRadio(lanEl));
    document.getElementById("语言重启").innerText = t("重启软件以生效");
};
lanEl.onclick = () => {
    lan(getRadio(lanEl));
    document.getElementById("语言重启").innerText = t("重启软件以生效");
};

document.getElementById("语言重启").onclick = () => {
    xstore.语言["语言"] = getRadio(lanEl);
    saveSetting();
    ipcRenderer.send("setting", "reload");
};

(<HTMLInputElement>document.getElementById("自动搜索排除")).value = old_store.主搜索功能.自动搜索排除.join("\n");

var 全局 = old_store.全局;

document.getElementById("深色模式").onclick = () => {
    ipcRenderer.send("theme", getRadio(document.getElementById("深色模式")));
};

var 模糊 = old_store.全局.模糊;
if (模糊 != 0) {
    document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
} else {
    document.documentElement.style.setProperty("--blur", `none`);
}
document.getElementById("模糊").oninput = () => {
    var 模糊 = (<HTMLInputElement>document.getElementById("模糊")).value;
    if (Number(模糊) != 0) {
        document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
    } else {
        document.documentElement.style.setProperty("--blur", `none`);
    }
};

document.documentElement.style.setProperty("--alpha", String(全局.不透明度));
(<HTMLInputElement>document.getElementById("不透明度")).value = String(全局.不透明度 * 100);
document.getElementById("不透明度").oninput = () => {
    var 不透明度 = (<HTMLInputElement>document.getElementById("不透明度")).value;
    document.documentElement.style.setProperty("--alpha", String(Number(不透明度) / 100));
};

var 快捷键 = old_store.快捷键;
document.querySelectorAll("#快捷键 hot-keys").forEach((el: any) => {
    el.value = 快捷键[el.name].key;
    el.addEventListener("inputend", () => {
        ipcRenderer.send("快捷键", [el.name, el.value]);
    });
});
ipcRenderer.on("状态", (_event, name, arg) => {
    (<any>document.querySelector(`hot-keys[name=${name}]`)).t = arg;
    if (t) storeSet(`快捷键.${name}.key`, (<any>document.querySelector(`hot-keys[name=${name}]`)).value);
});

document.documentElement.style.setProperty("--bar-size", xstore.工具栏.按钮大小 + "px");
document.documentElement.style.setProperty("--bar-icon", String(xstore.工具栏.按钮图标比例));
document.getElementById("按钮大小").oninput = () => {
    document.documentElement.style.setProperty(
        "--bar-size",
        (<RangeEl>document.getElementById("按钮大小")).value + "px"
    );
};
document.getElementById("按钮图标比例").oninput = () => {
    document.documentElement.style.setProperty(
        "--bar-icon",
        String((<RangeEl>document.getElementById("按钮图标比例")).value)
    );
};

document
    .getElementById("tool_bar_posi_b")
    .querySelectorAll("button")
    .forEach((el, i) => {
        el.onclick = () => {
            let size = (<HTMLInputElement>document.getElementById("按钮大小")).value + "px";
            let l: { left: string; top: string }[] = [
                { left: "10px", top: "100px" },
                { left: `calc(100vw - 10px - ${size} * 2 - 8px)`, top: "100px" },
            ];
            (<HTMLInputElement>document.getElementById("tool_bar_left")).value = l[i].left;
            (<HTMLInputElement>document.getElementById("tool_bar_top")).value = l[i].top;
        };
    });

let toolList: 功能[] = [
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
    "copy",
    "save",
];
let toolShow = old_store.工具栏.功能;
const toolShowEl = document.getElementById("tool_show");
const toolHideEl = document.getElementById("tool_hide");
function addToolItem(e: DragEvent) {
    let id = e.dataTransfer.getData("text");
    if ((e.target as HTMLElement).dataset.id === id) return null;
    if (id) {
        toolShowEl.querySelector(`[data-id=${id}]`)?.remove();
        toolHideEl.querySelector(`[data-id=${id}]`)?.remove();
    }
    return id;
}
function createToolItem(id: string) {
    let el = document.createElement("div");
    el.draggable = true;
    let icon = document.querySelector(`#tool_icons > [data-id=${id}]`).innerHTML;
    el.innerHTML = icon;
    el.setAttribute("data-id", id);
    el.ondragstart = (e) => {
        e.dataTransfer.setData("text", id);
    };
    el.ondragover = (e) => {
        e.preventDefault();
    };
    el.ondrop = (e) => {
        e.stopPropagation();
        let id = addToolItem(e);
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
    let id = addToolItem(e);
    if (id) {
        toolShowEl.append(createToolItem(id));
        setToolL();
    }
};
toolHideEl.ondrop = (e) => {
    let id = addToolItem(e);
    if (id) {
        toolHideEl.append(createToolItem(id));
        setToolL();
    }
};
for (let i of toolList) {
    if (toolShow.includes(i as (typeof toolShow)[0])) {
        toolShowEl.append(createToolItem(i));
    } else {
        toolHideEl.append(createToolItem(i));
    }
}
function setToolL() {
    toolShow = [];
    toolShowEl.querySelectorAll(":scope > [data-id]").forEach((el) => {
        toolShow.push(el.getAttribute("data-id") as (typeof toolShow)[0]);
    });
    xstore.工具栏.功能 = toolShow;
}

(<HTMLInputElement>document.getElementById("显示四角坐标")).checked = old_store.显示四角坐标;

// 取色器设置
document.getElementById("取色器大小").oninput = () => {
    if (Number((<HTMLInputElement>document.getElementById("取色器大小")).value) % 2 == 0) {
        (<HTMLInputElement>document.getElementById("取色器大小")).value = String(
            Number((<HTMLInputElement>document.getElementById("取色器大小")).value) + 1
        );
    }
    show_color_picker();
};
document.getElementById("像素大小").oninput = () => {
    show_color_picker();
};

show_color_picker();
function show_color_picker() {
    let color_size = Number((<HTMLInputElement>document.getElementById("取色器大小")).value);
    let inner_html = "";
    for (let i = 0; i < color_size ** 2; i++) {
        var l = Math.random() * 40 + 60;
        inner_html += `<span id="point_color_t"style="background:hsl(0,0%,${l}%);width:${
            (<HTMLInputElement>document.getElementById("像素大小")).value
        }px;height:${(<HTMLInputElement>document.getElementById("像素大小")).value}px"></span>`;
    }
    document.getElementById("point_color").style.width =
        Number((<HTMLInputElement>document.getElementById("像素大小")).value) * color_size + "px";
    document.getElementById("point_color").style.height =
        Number((<HTMLInputElement>document.getElementById("像素大小")).value) * color_size + "px";
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
(<HTMLSpanElement>document.querySelector("#遮罩颜色 > span")).style.background = msk(old_store.遮罩颜色);
(<HTMLSpanElement>document.querySelector("#选区颜色 > span")).style.background = msk(old_store.选区颜色);
(<HTMLInputElement>document.querySelector("#遮罩颜色 > input")).oninput = () => {
    (<HTMLSpanElement>document.querySelector("#遮罩颜色 > span")).style.background = msk(
        (<HTMLInputElement>document.querySelector("#遮罩颜色 > input")).value
    );
};
(<HTMLInputElement>document.querySelector("#选区颜色 > input")).oninput = () => {
    (<HTMLSpanElement>document.querySelector("#选区颜色 > span")).style.background = msk(
        (<HTMLInputElement>document.querySelector("#选区颜色 > input")).value
    );
};

document.getElementById("框选最小阈值").oninput = () => {
    if (
        (<HTMLInputElement>document.getElementById("框选最小阈值")).value >
        (<HTMLInputElement>document.getElementById("框选最大阈值")).value
    ) {
        (<HTMLInputElement>document.getElementById("框选最大阈值")).value = (<HTMLInputElement>(
            document.getElementById("框选最小阈值")
        )).value;
    }
};
document.getElementById("框选最大阈值").oninput = () => {
    if (
        (<HTMLInputElement>document.getElementById("框选最大阈值")).value <
        (<HTMLInputElement>document.getElementById("框选最小阈值")).value
    ) {
        (<HTMLInputElement>document.getElementById("框选最小阈值")).value = (<HTMLInputElement>(
            document.getElementById("框选最大阈值")
        )).value;
    }
};

document.getElementById("获取保存路径").onclick = () => {
    ipcRenderer.send("get_save_path", (<HTMLInputElement>document.getElementById("快速截屏路径")).value || "");
    ipcRenderer.on("get_save_path", (_e, a) => {
        (<HTMLInputElement>document.getElementById("快速截屏路径")).value = a;
    });
};

(<HTMLInputElement>document.getElementById("开启自动录制")).checked = old_store.录屏.自动录制 !== false;
(<RangeEl>document.getElementById("自动录制延时")).value = old_store.录屏.自动录制 || 0;

document.getElementById("保存文件名称前缀").oninput = document.getElementById("保存文件名称后缀").oninput = (e) => {
    let el = <HTMLInputElement>e.target;
    el.style.width = `${el.value.length || 1}em`;
    showFTime();
};
document.getElementById("保存文件名称时间").oninput = showFTime;
import time_format from "../../../lib/time_format";
function showFTime() {
    var saveTime = new Date();
    document.getElementById("保存文件名称_p").innerText = `${
        (<HTMLInputElement>document.getElementById("保存文件名称前缀")).value
    }${time_format((<HTMLInputElement>document.getElementById("保存文件名称时间")).value, saveTime)}${
        (<HTMLInputElement>document.getElementById("保存文件名称后缀")).value
    }`;
}
showFTime();
document.getElementById("保存文件名称前缀").style.width = `${
    (<HTMLInputElement>document.getElementById("保存文件名称前缀")).value.length || 1
}em`;
document.getElementById("保存文件名称后缀").style.width = `${
    (<HTMLInputElement>document.getElementById("保存文件名称后缀")).value.length || 1
}em`;

var 字体 = old_store.字体;
document.documentElement.style.setProperty("--main-font", 字体.主要字体);
document.documentElement.style.setProperty("--monospace", 字体.等宽字体);

(<HTMLInputElement>document.querySelector("#主要字体 > input")).oninput = () => {
    字体.主要字体 = (<HTMLInputElement>document.querySelector("#主要字体 > input")).value;
    document.documentElement.style.setProperty("--main-font", 字体.主要字体);
};
(<HTMLInputElement>document.querySelector("#等宽字体 > input")).oninput = () => {
    字体.等宽字体 = (<HTMLInputElement>document.querySelector("#等宽字体 > input")).value;
    document.documentElement.style.setProperty("--monospace", 字体.等宽字体);
};

const { hexToCSSFilter } = require("hex-to-css-filter") as typeof import("hex-to-css-filter");
function getFilter(hex: string) {
    try {
        return hexToCSSFilter(hex).filter.replace(";", "");
    } catch (error) {
        return null;
    }
}
document.documentElement.style.setProperty("--icon-color", old_store.全局.图标颜色[1]);
if (old_store.全局.图标颜色[3]) document.documentElement.style.setProperty("--icon-color1", old_store.全局.图标颜色[3]);
(<HTMLInputElement>document.querySelector("#图标颜色 > input")).oninput = () => {
    document.documentElement.style.setProperty(
        "--icon-color",
        getFilter((<HTMLInputElement>document.querySelector("#图标颜色 > input")).value) || ""
    );
};
(<HTMLInputElement>document.querySelector("#图标颜色1 > input")).oninput = () => {
    if ((<HTMLInputElement>document.querySelector("#图标颜色1 > input")).value)
        document.documentElement.style.setProperty(
            "--icon-color1",
            getFilter((<HTMLInputElement>document.querySelector("#图标颜色1 > input")).value) || ""
        );
};

const translateES = document.getElementById("translate_es");
const translatorFrom = document.getElementById("translator_from");
const translatorTo = document.getElementById("translator_to");

const transList: { [key: string]: (typeof xstore.翻译.翻译器)[0] } = {};

const translatorList = el("div");
const addTranslatorM = el("dialog") as HTMLDialogElement;
const addTranslator = el("button", "+", {
    onclick: async () => {
        const v = await translatorD({ id: crypto.randomUUID().slice(0, 7), name: "", keys: [], type: null });
        const iel = addTranslatorI(v);
        translatorList.append(iel);
        setTranLan();
    },
});
translateES.append(translatorList, addTranslator, addTranslatorM);

new Sortable(translatorList, {
    handle: ".sort_handle",
    onEnd: () => {
        const id = (translatorList.firstChild as HTMLElement)?.getAttribute("data-id");
        if (!id) return;
        setTranLan();
    },
});

function addTranslatorI(v: setting["翻译"]["翻译器"][0]) {
    transList[v.id] = v;
    const handle = el("button", iconEl(handle_svg), { class: "sort_handle" });
    const text = el("span", v.name, {
        onclick: async () => {
            const nv = await translatorD(v);
            text.innerText = nv.name;
            transList[nv.id] = nv;
        },
    });
    const rm = el("button", iconEl(delete_svg), {
        onclick: () => {
            iel.remove();
        },
    });
    const iel = el("div", handle, text, rm, {
        "data-id": v.id,
    });
    return iel;
}

import translator from "xtranslator";
type Engines = keyof typeof translator.e;
let engineConfig: Partial<
    Record<
        Engines,
        {
            t: string;
            key: { name: string; text?: string }[];
            help?: { text: string; src: string };
        }
    >
> = {
    youdao: {
        t: "有道",
        key: [{ name: "appid" }, { name: "key" }],
        help: { text: "有道api申请", src: "https://ai.youdao.com/product-fanyi-text.s" },
    },
    baidu: {
        t: "百度",
        key: [{ name: "appid" }, { name: "key" }],
        help: { text: "百度api申请", src: "https://fanyi-api.baidu.com/product/11" },
    },
    deepl: {
        t: "Deepl",
        key: [{ name: "key" }],
        help: { text: "Deepl api申请", src: "https://www.deepl.com/pro-api?cta=header-pro-api" },
    },
    deeplx: {
        t: "DeeplX",
        key: [{ name: "url" }],
    },
    caiyun: {
        t: "彩云",
        key: [{ name: "token" }],
        help: { text: "彩云api申请", src: "https://docs.caiyunapp.com/blog/2018/09/03/lingocloud-api/" },
    },
    bing: {
        t: "必应",
        key: [{ name: "key" }],
        help: {
            text: "必应api申请",
            src: "https://learn.microsoft.com/zh-cn/azure/cognitive-services/translator/how-to-create-translator-resource#authentication-keys-and-endpoint-url",
        },
    },
    chatgpt: {
        t: "ChatGPT",
        key: [{ name: "key" }, { name: "url" }, { name: "config", text: "请求体自定义" }],
        help: { text: "ChatGPT api申请", src: "https://platform.openai.com/account/api-keys" },
    },
    gemini: {
        t: "Gemini",
        key: [{ name: "key" }, { name: "url" }, { name: "config", text: "请求体自定义" }],
        help: { text: "Gemini api申请", src: "https://ai.google.dev/" },
    },
    niu: {
        t: "小牛翻译",
        key: [{ name: "key" }],
        help: { text: "小牛api申请", src: "https://niutrans.com/documents/contents/beginning_guide/6" },
    },
};

xstore.翻译.翻译器.forEach((v) => {
    translatorList.append(addTranslatorI(v));
});

function translatorD(v: setting["翻译"]["翻译器"][0]) {
    const idEl = el("input", { value: v.name, type: "text" });
    const selectEl = el("select");
    const keys = el("div");
    const help = el("p");

    selectEl.append(el("option", t("选择引擎类型"), { value: "" }));
    Object.entries(engineConfig).forEach((v) => {
        const op = el("option", v[1].t, { value: v[0] });
        selectEl.append(op);
    });

    selectEl.value = v.type || "";
    selectEl.oninput = () => {
        set(selectEl.value as Engines);
    };

    set(v.type as Engines);

    function set(type: Engines) {
        keys.innerHTML = "";
        help.innerHTML = "";
        if (!type) return;
        const fig = engineConfig[type];
        fig.key.forEach((x, i) => {
            keys.append(
                el(
                    "div",
                    el("span", `${x.name}: `),
                    el("input", { placehoder: x.text || "", value: v.keys[i] || "", type: "text" })
                )
            );
        });
        if (fig.help) help.append(el("a", fig.help.text, { href: fig.help.src }));
    }

    const testEl = el("div");
    const testR = el("p");
    const testB = el("button", t("测试"));
    testEl.append(testB, testR);
    testB.onclick = async () => {
        const v = getV();
        translator.e[v.type].setKeys(v.keys);
        try {
            const r = await translator.e[v.type].test();
            console.log(r);
            if (r) testR.innerText = t("测试成功");
        } catch (error) {
            testR.innerText = error;
            throw error;
        }
    };

    addTranslatorM.innerHTML = "";
    addTranslatorM.append(
        idEl,
        selectEl,
        keys,
        help,
        testEl,
        el("button", t("关闭"), {
            onclick: () => {
                addTranslatorM.close();
            },
        })
    );

    function getV() {
        const key = Array.from(keys.querySelectorAll("input")).map((el) => el.value);
        const nv: typeof v = {
            id: v.id,
            name: idEl.value,
            keys: key,
            type: selectEl.value as Engines,
        };
        return nv;
    }

    addTranslatorM.showModal();

    return new Promise((re: (nv: typeof v) => void) => {
        addTranslatorM.append(
            el("button", t("完成"), {
                onclick: () => {
                    const nv = getV();
                    re(nv);
                    addTranslatorM.close();
                },
            })
        );
    });
}

function setTranLan() {
    const id = (translatorList.firstChild as HTMLElement)?.getAttribute("data-id");
    if (!id) return;
    const type = transList[id].type;
    const e = translator.e[type];
    const mainLan = xstore.语言.语言;
    translatorFrom.innerHTML = "";
    translatorTo.innerHTML = "";
    if (!e) return;
    e.getLanT({ auto: t("自动"), text: mainLan, sort: "text" }).forEach((v) => {
        translatorFrom.append(el("option", v.text, { value: v.lan }));
    });
    e.getTargetLanT({ auto: t("自动"), text: mainLan, sort: "text" }).forEach((v) => {
        translatorTo.append(el("option", v.text, { value: v.lan }));
    });
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

function eSort(ele: HTMLElement, list: string[][]) {
    ele.classList.add("sort_list");
    const sEl = el("div");
    new Sortable(sEl, {
        handle: ".sort_handle",
    });

    function add(i: (typeof list)[0]) {
        const e = el("li");
        e.append(el("button", { class: "sort_handle" }, iconEl(handle_svg)));
        for (let x of i) {
            const input = el("input", { type: "text" });
            input.value = x;
            e.append(input);
        }
        e.append(
            el("button", iconEl(delete_svg), {
                onclick: () => {
                    e.remove();
                },
            })
        );
        return e;
    }

    for (let i of list) {
        sEl.append(add(i));
    }

    const addEl = el("div");
    for (let _x of list[0]) {
        const input = el("input", { type: "text" });
        addEl.append(input);
    }
    addEl.append(
        el("button", iconEl(add_svg), {
            onclick: () => {
                sEl.append(add(Array.from(addEl.querySelectorAll("input")).map((i) => i.value)));
                Array.from(addEl.querySelectorAll("input")).forEach((i) => (i.value = ""));
            },
        })
    );

    ele.append(sEl, addEl);

    return () => {
        return Array.from(sEl.children).map((d) => Array.from(d.querySelectorAll("input")).map((i) => i.value));
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

(<HTMLInputElement>document.getElementById("记住识图引擎")).checked = Boolean(old_store.以图搜图.记住);

document.getElementById("clear_storage").onclick = () => {
    ipcRenderer.send("setting", "clear", "storage");
};
document.getElementById("clear_cache").onclick = () => {
    ipcRenderer.send("setting", "clear", "cache");
};

function setOcr() {
    let ocrIn = "";
    for (let i of old_store.离线OCR) {
        ocrIn += `<label><input type="radio" name="OCR类型" value="${i[0]}">${i[0]}</label>`;
    }
    ocrIn += `
    <label><input type="radio" name="OCR类型" value="youdao">
        <t>有道</t>
    </label>
    <label><input type="radio" name="OCR类型" value="baidu">
        <t>百度</t>
    </label>`;
    document.getElementById("OCR类型").outerHTML = `<div id="OCR类型">${ocrIn}</div>`;
    setRadio(document.getElementById("OCR类型"), old_store.OCR.类型);
}

setOcr();

function getOcrType() {
    return getRadio(<HTMLInputElement>document.getElementById("OCR类型"));
}
ocrDOpen();
function ocrDOpen() {
    (<HTMLDetailsElement>document.getElementById("baidu_details")).open = false;
    (<HTMLDetailsElement>document.getElementById("youdao_details")).open = false;
    if (getOcrType() == "baidu") {
        (<HTMLDetailsElement>document.getElementById("baidu_details")).open = true;
    } else if (getOcrType() == "youdao") {
        (<HTMLDetailsElement>document.getElementById("youdao_details")).open = true;
    }
}
document.getElementById("OCR类型").onclick = ocrDOpen;

function OCR模型展示() {
    document.getElementById("OCR模型列表").innerHTML = "";
    let all = old_store.离线OCR;
    for (let i in all) {
        let d = document.createElement("div");
        let t = document.createElement("input");
        t.type = "text";
        t.value = all[i][0];
        t.oninput = () => {
            all[i][0] = t.value;
            xstore.离线OCR = all;
            setOcr();
        };
        d.append(t);
        let c = document.createElement("button");
        c.innerHTML = `<img src="${close_svg}" class="icon">`;
        c.onclick = () => {
            if (all.length == 1) return;
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
    let fs = e.dataTransfer.files;
    let l = [`新模型${crypto.randomUUID().slice(0, 7)}`];
    l[1] = "默认/ppocr_det.onnx";
    l[2] = "默认/ppocr_rec.onnx";
    l[3] = "默认/ppocr_keys_v1.txt";
    for (let f of fs) {
        // @ts-ignore
        let path = f.path as string;
        if (path.split("/").at(-1).includes("det")) {
            l[1] = path;
        } else if (path.split("/").at(-1).includes("rec")) {
            l[2] = path;
        } else {
            l[3] = path;
        }
    }
    let all = old_store.离线OCR;
    all.push(l);
    xstore.离线OCR = all;
    OCR模型展示();
    setOcr();
    document.getElementById("OCR拖拽放置区").classList.remove("拖拽突出");
};

const screenKeyTipEl = document.getElementById("screen_key_tip");
const screenKeyTipKBD = screenKeyTipEl.querySelector("div");
const screenKeyTipOXEl = document.getElementById("screen_key_tip_ox") as RangeEl;
const screenKeyTipOYEl = document.getElementById("screen_key_tip_oy") as RangeEl;
const screenKeyTipSizeEl = document.getElementById("screen_key_tip_size") as RangeEl;

function setKeyTip() {
    const posi = xstore.录屏.提示.键盘.位置;
    const px = posi.x === "+" ? "right" : "left";
    const py = posi.y === "+" ? "bottom" : "top";
    for (const x of ["left", "right", "top", "bottom"]) {
        screenKeyTipKBD.style[x] = "";
    }
    screenKeyTipKBD.style[px] = posi.offsetX + "px";
    screenKeyTipKBD.style[py] = posi.offsetY + "px";

    screenKeyTipKBD.style.fontSize = xstore.录屏.提示.键盘.大小 * 16 + "px";
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
        const handle = el("div");
        handle.style[px] = "-4px";
        handle.style[py] = "-4px";
        if (x === xstore.录屏.提示.键盘.位置.x && y === xstore.录屏.提示.键盘.位置.y) {
            handle.classList.add("tip_select");
        }
        handle.onclick = () => {
            screenKeyTipEl.querySelector(".tip_select").classList.remove("tip_select");
            handle.classList.add("tip_select");
            xstore.录屏.提示.键盘.位置.x = x;
            xstore.录屏.提示.键盘.位置.y = y;
            setKeyTip();
        };
        screenKeyTipEl.append(handle);
    }
}

var 历史记录设置 = old_store.历史记录设置;

(<HTMLButtonElement>document.getElementById("清除历史记录")).disabled = !历史记录设置.保留历史记录;
(<HTMLButtonElement>document.getElementById("his_d")).disabled = !历史记录设置.自动清除历史记录;
(<HTMLButtonElement>document.getElementById("his_h")).disabled = !历史记录设置.自动清除历史记录;

document.getElementById("历史记录_b").oninput = () => {
    历史记录设置.保留历史记录 = (<HTMLInputElement>document.getElementById("历史记录_b")).checked;
    (<HTMLButtonElement>document.getElementById("清除历史记录")).disabled = !(<HTMLInputElement>(
        document.getElementById("历史记录_b")
    )).checked;
};
document.getElementById("清除历史记录").oninput = () => {
    历史记录设置.自动清除历史记录 = (<HTMLInputElement>document.getElementById("清除历史记录")).checked;
    (<HTMLButtonElement>document.getElementById("his_d")).disabled = !(<HTMLInputElement>(
        document.getElementById("清除历史记录")
    )).checked;
    (<HTMLButtonElement>document.getElementById("his_h")).disabled = !(<HTMLInputElement>(
        document.getElementById("清除历史记录")
    )).checked;
};
document.getElementById("clear_his").onclick = () => {
    var c = confirm("这将清除所有的历史记录\n且不能复原\n确定清除？");
    if (c) fs.writeFileSync(path.join(configPath, "history.json"), JSON.stringify({ 历史记录: {} }, null, 2));
};

(<HTMLInputElement>document.getElementById("时间格式")).value = old_store.时间格式;

const hotkeysSelectEl = document.getElementById("hotkeys");
const hotkeysContentEl = document.getElementById("hotkeys_content");
let hotkeysEl = hotkeysContentEl.children as unknown as HTMLElement[];
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

var proxyL = ["http", "https", "ftp", "socks"];

var 代理 = old_store.代理;
getProxy();

setProxyEl();
document.getElementById("代理").onclick = setProxyEl;
function setProxyEl() {
    const m = getRadio(document.getElementById("代理"));
    const pacScriptEl = document.getElementById("pacScript_p");
    const proxyRulesEl = document.getElementById("proxyRules_p");
    const proxyBypassRulesEl = document.getElementById("proxyBypassRules_p");
    switch (m) {
        case "direct":
            pacScriptEl.style.display = proxyRulesEl.style.display = proxyBypassRulesEl.style.display = "none";
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
    let l = 代理.proxyRules.split(";") as string[];
    for (let rule of l) {
        for (let x of proxyL) {
            if (rule.includes(x + "=")) {
                (<HTMLInputElement>document.getElementById(`proxy_${x}`)).value = rule.replace(x + "=", "");
            }
        }
    }
}
function setProxy() {
    let l = [];
    for (let x of proxyL) {
        let v = (<HTMLInputElement>document.getElementById(`proxy_${x}`)).value;
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

var giveUp = false;
document.getElementById("give_up_setting_b").oninput = () => {
    giveUp = (<HTMLInputElement>document.getElementById("give_up_setting_b")).checked;
    if (giveUp) fs.writeFileSync(store.path, JSON.stringify(old_store, null, 2));
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
    xstore.主搜索功能.自动搜索排除 = (<HTMLInputElement>document.getElementById("自动搜索排除")).value
        .split(/\n/)
        .filter((i) => i != "");
    xstore.全局.不透明度 = (<RangeEl>document.getElementById("不透明度")).value / 100;
    try {
        xstore.全局.图标颜色[1] =
            getFilter((<HTMLInputElement>document.querySelector("#图标颜色 > input")).value) || "";

        xstore.全局.图标颜色[3] =
            getFilter((<HTMLInputElement>document.querySelector("#图标颜色1 > input")).value) || "";
    } catch (e) {}
    xstore.快速截屏.路径 = (<HTMLInputElement>document.getElementById("快速截屏路径")).value
        ? ((<HTMLInputElement>document.getElementById("快速截屏路径")).value + "/").replace("//", "/")
        : "";

    xstore.录屏.自动录制 =
        (<HTMLInputElement>document.getElementById("开启自动录制")).checked &&
        (<RangeEl>document.getElementById("自动录制延时")).value;

    字体.大小 = (<RangeEl>document.getElementById("字体大小")).value;
    字体.记住 = (<HTMLInputElement>document.getElementById("记住字体大小")).checked
        ? typeof 字体.记住 === "number"
            ? 字体.记住
            : 字体.大小
        : false;
    xstore.字体 = 字体;
    xstore.翻译.翻译器 = Array.from(translatorList.children).map(
        (i: HTMLElement) => transList[i.getAttribute("data-id")]
    );
    const yS = list2engine(y搜索引擎());
    const yF = list2engine(y翻译引擎());
    if (!yF.find((i) => i.url.startsWith("translate"))) yF.push({ name: "翻译", url: "translate/?text=%s" });
    xstore.引擎 = {
        搜索: yS,
        翻译: yF,
        记忆: { 搜索: yS[0].name, 翻译: yF[0].name },
    };
    xstore.以图搜图.记住 = (<HTMLInputElement>document.getElementById("记住识图引擎")).checked
        ? old_store.以图搜图.记住 || getRadio(<HTMLInputElement>document.getElementById("图像搜索引擎"))
        : false;
    xstore.历史记录设置 = 历史记录设置;
    xstore.OCR.类型 = getOcrType();
    xstore.OCR.记住 = (<HTMLInputElement>document.getElementById("记住OCR引擎")).checked
        ? old_store.OCR.记住 || getOcrType()
        : false;
    xstore.代理.proxyRules = setProxy();
    if (userDataPathInputed)
        fs.writeFile("preload_config", (<HTMLInputElement>document.getElementById("user_data_path")).value, (e) => {
            if (e) throw new Error(t("保存失败，请确保软件拥有运行目录的修改权限，或重新使用管理员模式打开软件"));
        });
    fs.writeFileSync(path.join(configPath, "config.json"), JSON.stringify(xstore, null, 2));
}

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
function jumpToRange(i: number) {
    let rect = findRanges[i].getBoundingClientRect();
    document.getElementById("find_t").innerText = `${i + 1} / ${findRanges.length}`;
    document.documentElement.scrollTo(0, rect.top - document.body.getBoundingClientRect().top);
}
let allTextNodes = [];
window.onload = () => {
    const treeWalker = document.createTreeWalker(document.getElementById("main"), NodeFilter.SHOW_TEXT);
    let currentNode = treeWalker.nextNode();
    allTextNodes = [];
    while (currentNode) {
        allTextNodes.push(currentNode);
        currentNode = treeWalker.nextNode();
    }
    console.log(allTextNodes);
};
let findRanges: Range[] = [];
let findFocusI = 0;
function find(t: string) {
    // @ts-ignore
    CSS.highlights.clear();

    const str = t.trim().toLowerCase();
    if (!str) {
        document.getElementById("find_t").innerText = ``;
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

    // @ts-ignore
    const searchResultsHighlight = new Highlight(...ranges.flat());
    // @ts-ignore
    CSS.highlights.set("search-results", searchResultsHighlight);
}

var pathInfo = `<br>
                ${t("文字记录：")}${historyStore.path}<br>
                ${t("临时目录：")}${os.tmpdir()}${os.platform() == "win32" ? "\\" : "/"}eSearch<br>
                ${t("运行目录：")}${__dirname}`;
document.createTextNode(pathInfo);
document.getElementById("user_data_divs").insertAdjacentHTML("afterend", pathInfo);
try {
    (<HTMLInputElement>document.getElementById("user_data_path")).value =
        fs.readFileSync("preload_config").toString().trim() || store.path.replace(/[/\\]config\.json/, "");
} catch (error) {
    (<HTMLInputElement>document.getElementById("user_data_path")).value = store.path.replace(/[/\\]config\.json/, "");
}
var userDataPathInputed = false;
document.getElementById("user_data_path").oninput = () => {
    document.getElementById("user_data_divs").classList.add("user_data_divs");
    userDataPathInputed = true;
};
document.getElementById("move_user_data").onclick = () => {
    ipcRenderer.send("setting", "move_user_data", (<HTMLInputElement>document.getElementById("user_data_path")).value);
};

document.getElementById("reload").onclick = () => {
    saveSetting();
    ipcRenderer.send("setting", "reload");
};

ipcRenderer.on("setting", (_err, t, id, r) => {
    if (t == "open_dialog") {
        switch (id) {
            case "ocr_det":
                if (!r.canceled) {
                    (<HTMLInputElement>document.getElementById("ocr_det")).value = r.filePaths[0];
                }
                break;
            case "ocr_rec":
                if (!r.canceled) {
                    (<HTMLInputElement>document.getElementById("ocr_rec")).value = r.filePaths[0];
                }
                break;
            case "ocr_字典":
                if (!r.canceled) {
                    (<HTMLInputElement>document.getElementById("ocr_字典")).value = r.filePaths[0];
                }
                break;
            case "plugin":
                if (!r.canceled) {
                    let l = (<HTMLTextAreaElement>document.getElementById("plugin")).value.trim();
                    l += (l && "\n") + r.filePaths[0];
                    (<HTMLTextAreaElement>document.getElementById("plugin")).value = l;
                }
        }
    }
});

var version = `<div>${t("本机系统内核:")} ${os.type()} ${os.release()}</div>`;
var versionL = ["electron", "node", "chrome", "v8"];
for (let i in versionL) {
    version += `<div>${versionL[i]}: ${process.versions[versionL[i]]}</div>`;
}
document.getElementById("versions_info").insertAdjacentHTML("afterend", version);

import pack from "../../../package.json?raw";
var packageJson = JSON.parse(pack);
const download = require("download");
document.getElementById("name").innerHTML = packageJson.name;
document.getElementById("version").innerHTML = packageJson.version;
document.getElementById("description").innerHTML = t(packageJson.description);
document.getElementById("version").onclick = () => {
    fetch("https://api.github.com/repos/xushengfeng/eSearch/releases", { method: "GET", redirect: "follow" })
        .then((response) => response.json())
        .then((re) => {
            console.log(re);
            if (document.getElementById("update_info").innerHTML) return;
            let l = [];
            for (let r of re) {
                if (
                    !packageJson.version.includes("beta") &&
                    !packageJson.version.includes("alpha") &&
                    old_store.更新.模式 != "dev"
                ) {
                    if (!r.draft && !r.prerelease) l.push(r);
                } else {
                    l.push(r);
                }
            }
            function tag(text: string) {
                let tag = document.createElement("span");
                tag.innerText = t(text);
                return tag;
            }
            for (let i in l) {
                const r = l[i];
                let div = document.createElement("div");
                let tags = document.createElement("div");
                let h = document.createElement("h1");
                h.innerText = r.name;
                let p = document.createElement("p");
                p.innerHTML = r.body.replace(/\r\n/g, "<br>");
                div.append(tags, h, p);
                document.getElementById("update_info").append(div);
                if (i == "0") {
                    let tagEl = tag("最新版本");
                    tagEl.title = t("点击下载");
                    tagEl.classList.add("download_tag");
                    tags.append(tagEl);
                    tagEl.onclick = () => {
                        shell.openExternal(r.html_url);
                    };
                    for (let a of r.assets) {
                        if (a.name === `app-${process.platform}-${process.arch}`) {
                            let xel = el("span");
                            xel.innerText = t("增量更新");
                            tagEl.after(xel);
                            xel.onclick = async () => {
                                xel.innerHTML = "";
                                let pro = el("progress");
                                let text = el("span");
                                xel.append(pro, text);
                                download(a.browser_download_url, path.join(__dirname, "../../../"), {
                                    extract: true,
                                    rejectUnauthorized: false,
                                })
                                    .on("response", (res) => {
                                        let total = Number(res.headers["content-length"]);
                                        let now = 0;
                                        res.on("data", (data) => {
                                            now += Number(data.length);
                                            const percent = now / total;
                                            text.innerText = `${(percent * 100).toFixed(2)}%`;
                                            pro.value = percent;
                                        });
                                        res.on("end", () => {
                                            xel.innerText = t("正在更新中");
                                        });
                                    })
                                    .then(() => {
                                        xel.innerText = t("更新完毕，你可以重启软件");
                                    });
                            };
                        }
                    }
                }
                if (r.name == packageJson.version) {
                    tags.append(tag("当前版本"));
                    if (i != "0") {
                        (<HTMLElement>document.getElementById("menu").lastElementChild).style.color = "#335EFE";
                    }
                    break;
                }
            }
        })
        .catch((error) => console.log("error", error));
};

document.getElementById("info").innerHTML = `<div>${t("项目主页:")} <a href="${packageJson.homepage}">${
    packageJson.homepage
}</a></div>
    <div><a href="https://github.com/xushengfeng/eSearch/releases/tag/${packageJson.version}">${t("更新日志")}</a></div>
    <div><a href="https://github.com/xushengfeng/eSearch/issues">${t("错误报告与建议")}</a></div>
    <div><a href="https://github.com/xushengfeng/eSearch/tree/master/lib/translate">${t("改进翻译")}</a></div>
    <div>${t("本软件遵循")} <a href="https://www.gnu.org/licenses/gpl-3.0.html">${packageJson.license}</a></div>
    <div>${t("本软件基于")} <a href="https://esearch.vercel.app/readme/all_license.json">${t("这些软件")}</a></div>
    <div>Copyright (C) 2021 ${packageJson.author.name} ${packageJson.author.email}</div>`;

document.body.onclick = (e) => {
    if ((<HTMLElement>e.target).tagName === "A") {
        e.preventDefault();
        shell.openExternal((<HTMLAnchorElement>e.target).href);
    }
};

ipcRenderer.on("about", (_event, arg) => {
    if (arg != undefined) {
        location.hash = "#about";
    }
});

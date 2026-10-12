import { button, image, input, pack, txt, view } from "dkh-ui";
import { renderOn, renderSend, renderSendSync } from "../../../lib/ipc";
import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import type { ClipItem } from "../../ShareTypes";
import type { IconType } from "../../iconTypes";
import { Class, cssVar, getImgUrl, initStyle, setTitle } from "../root/root";

initStyle(store);
setTitle(t("剪贴板历史"));

const padding = cssVar("o-padding");

function iconEl(src: IconType) {
    return image(getImgUrl(`${src}.svg`), "icon").class("icon");
}

function iconB(src: IconType, title: string, onClick: () => void) {
    return button(iconEl(src))
        .attr({ title })
        .on("click", () => onClick());
}

function fmtTime(ts: number) {
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

let trash = false;
let keyword = "";
let paused = false;
/**
 * 类型筛选。空集合表示「全部」——这也是每次打开面板的初始状态：
 * 筛选是临时的查看动作，不是配置，所以不持久化。
 */
const typeFilter = new Set<ClipItem["type"]>();

// ── 工具条 ──────────────────────────────────────────────────────

const searchEl = input("search")
    .attr({ placeholder: t("搜索"), type: "search" })
    .style({ flex: "1", minWidth: 0 });
searchEl.on("input", () => {
    keyword = (searchEl.el as HTMLInputElement).value.trim().toLowerCase();
    render();
});

const pauseIcon = iconEl("pause");
const pauseEl = button(pauseIcon)
    .attr({ title: t("暂停记录") })
    .on("click", () => renderSend("clipHistorySetPaused", [!paused]));

const trashEl = iconB("delete", t("回收站"), () => {
    trash = !trash;
    render();
});

const clearEl = iconB("clear", t("清空"), () => {
    if (trash) renderSend("clipHistoryEmptyTrash", []);
    else renderSend("clipHistoryClear", []);
});

/** 三个类型筛选按钮，可多选，都不选 = 全部 */
const typeFilters = (
    [
        { type: "text", icon: "text", title: "只看文本" },
        { type: "image", icon: "img", title: "只看图片" },
        { type: "file", icon: "file", title: "只看文件" },
    ] as const
).map((i) => ({
    type: i.type as ClipItem["type"],
    el: iconB(i.icon, t(i.title), () => {
        if (typeFilter.has(i.type)) typeFilter.delete(i.type);
        else typeFilter.add(i.type);
        render();
    }),
}));

const bar = view()
    .class(Class.group)
    .style({
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding,
        flexShrink: "0",
    })
    .add([
        searchEl,
        pauseEl,
        trashEl,
        clearEl,
        ...typeFilters.map((i) => i.el),
    ]);

const warnEl = view().style({ display: "none", padding, opacity: "0.7" });

const listEl = view().style({
    display: "flex",
    flexDirection: "column",
    gap: padding,
    padding,
    overflowY: "auto",
    flex: "1",
    minHeight: "0",
});

pack(document.body).style({
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
});
bar.addInto();
warnEl.addInto();
listEl.addInto();

// ── 缩略图懒加载 ────────────────────────────────────────────────

const thumbObserver = new IntersectionObserver((entries) => {
    for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLImageElement;
        const id = el.dataset.clipid;
        if (!id) continue;
        thumbObserver.unobserve(el);
        const url = renderSendSync("clipHistoryThumb", [id]);
        if (url) el.src = url;
    }
});

// ── 渲染 ────────────────────────────────────────────────────────

function textBlock(s: string) {
    return view()
        .style({
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: "10lh",
            overflow: "hidden",
            fontSize: "0.9em",
        })
        .add(txt(s));
}

function itemEl(item: ClipItem) {
    const card = view().class(Class.deco).style({
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding,
    });

    const typeName =
        item.type === "text"
            ? t("文本")
            : item.type === "image"
              ? t("图片")
              : t("文件");

    const head = view()
        .style({
            display: "flex",
            alignItems: "center",
            gap: "6px",
            opacity: "0.7",
            fontSize: "0.85em",
        })
        .add([txt(typeName), txt(fmtTime(item.time))]);

    const actions = view().class(Class.group).style({ marginLeft: "auto" });
    if (trash) {
        actions.add([
            iconB("back", t("恢复"), () =>
                renderSend("clipHistoryRestore", [item.id]),
            ),
            iconB("delete", t("永久删除"), () =>
                renderSend("clipHistoryPurge", [item.id]),
            ),
        ]);
    } else {
        actions.add([
            iconB("copy", t("复制"), () =>
                renderSend("clipHistoryCopy", [item.id]),
            ),
            iconB("star", item.pinned ? t("取消固定") : t("固定"), () =>
                renderSend("clipHistoryPin", [item.id, !item.pinned]),
            ),
            iconB("close", t("删除"), () =>
                renderSend("clipHistoryRemove", [item.id]),
            ),
        ]);
    }
    head.add(actions);
    card.add(head);

    if (item.type === "text") {
        card.add(textBlock(item.text ?? ""));
    } else if (item.type === "file") {
        card.add(textBlock((item.files ?? []).join("\n")));
    } else {
        const img = image("", "thumb").style({
            maxWidth: "100%",
            maxHeight: "160px",
            objectFit: "contain",
            alignSelf: "flex-start",
        });
        // 占位透明像素：避免 src="" 触发一次多余的页面请求
        img.el.src =
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        img.el.dataset.clipid = item.id;
        card.add(img);
        thumbObserver.observe(img.el);
    }

    if (item.pinned) card.style({ outlineColor: "var(--emphasis-color)" });
    return card;
}

function match(item: ClipItem) {
    if (typeFilter.size > 0 && !typeFilter.has(item.type)) return false;
    if (!keyword) return true;
    if (item.type === "text")
        return (item.text ?? "").toLowerCase().includes(keyword);
    if (item.type === "file")
        return (item.files ?? []).join("\n").toLowerCase().includes(keyword);
    // 图片没有文字可搜，只能靠类型筛选命中
    return false;
}

function render() {
    const r = renderSendSync("clipHistoryGet", [trash]);
    paused = r.paused;
    pauseIcon.el.src = getImgUrl(paused ? "recume.svg" : "pause.svg");
    pauseEl.style({
        outlineColor: paused ? "var(--emphasis-color)" : "",
    });
    trashEl.style({ outlineColor: trash ? "var(--emphasis-color)" : "" });
    for (const { type, el } of typeFilters)
        el.style({
            outlineColor: typeFilter.has(type) ? "var(--emphasis-color)" : "",
        });

    if (r.warning) {
        warnEl.el.innerText = r.warning;
        warnEl.style({ display: "" });
    } else {
        warnEl.style({ display: "none" });
    }

    listEl.clear();
    const list = r.items.filter(match);
    if (list.length === 0) {
        listEl.add(
            view()
                .style({ opacity: "0.5", padding })
                .add(txt(t("暂无记录"))),
        );
        return;
    }
    listEl.add(list.map(itemEl));
}

render();
renderOn("clipHistoryChange", () => render());

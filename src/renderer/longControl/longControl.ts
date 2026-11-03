import { button, image, txt, view } from "dkh-ui";
import { renderOn, renderSend } from "../../../lib/ipc";
import store from "../../../lib/store/renderStore";
import { t } from "../../../lib/translate/translate";
import type { LongControlHint } from "../../ShareTypes";
import { getImgUrl, initStyle, setTitle } from "../root/root";

initStyle(store);
setTitle(t("长截屏"));

const root = view().attr({ id: "lc_root" }).addInto();

const head = view().attr({ id: "lc_head" }).addInto(root);
const grip = txt("⠿").class("lc_grip").addInto(head);
const title = txt(t("长截屏")).attr({ id: "lc_title" }).addInto(head);
const status = txt("").attr({ id: "lc_status" }).addInto(head);
const space = view().attr({ id: "lc_space" }).addInto(head);
function iconEl(name: "recume.svg" | "stop_record.svg" | "close.svg") {
    return image(getImgUrl(name), "icon").class("icon");
}

const closeBtn = button(iconEl("close.svg"))
    .attr({ id: "lc_close", title: "取消" })
    .addInto(head);
const primaryIcon = iconEl("recume.svg");
const primary = button(primaryIcon).attr({ id: "lc_btn" }).addInto(head);

const sub = txt("").attr({ id: "lc_sub" }).addInto(root);

const previewEl = view().attr({ id: "lc_preview" }).addInto(root);
const imgEl = image("", "")
    .attr({ id: "lc_img", draggable: false })
    .style({ display: "none" })
    .addInto(previewEl);

const card = view().attr({ id: "lc_card" }).addInto(previewEl);
const cardGrip = txt("⠿").class("lc_grip").addInto(card);
const cardText = view().class("lc_card_text").addInto(card);
const cardTitle = txt(t("按住窗口拖动"))
    .class("lc_card_title")
    .addInto(cardText);
const cardSub = txt("").class("lc_card_sub").addInto(cardText);
const cardArrow = txt("→").class("lc_card_arrow").addInto(card);

let wayland = false;
let started = true;
let starting = false;
let previewEnabled = false;
let hint: LongControlHint | undefined;

function arrowText(arrow: LongControlHint["arrow"]) {
    if (arrow === "left") return "←";
    if (arrow === "right") return "→";
    if (arrow === "up") return "↑";
    if (arrow === "down") return "↓";
    return "↗";
}

function setPreview(data: string) {
    if (!data) return;
    imgEl.attr({ src: data }).style({ display: "block" });
}

function setPrimaryIcon(
    icon: "recume.svg" | "stop_record.svg",
    title: "开始" | "结束",
    red = false,
) {
    primaryIcon.attr({ src: getImgUrl(icon), alt: t(title) });
    primaryIcon.style({ filter: red ? "none" : "var(--icon-color)" });
    primary.attr({ title });
}

function update() {
    const positioning = wayland && !started;
    const showPreview = previewEnabled;
    const showCard = positioning && showPreview;
    const showSub = positioning && !showPreview;

    previewEl.style({ display: showPreview ? "flex" : "none" });
    sub.style({ display: showSub ? "block" : "none" });
    card.style({ display: showCard ? "flex" : "none" });
    closeBtn.style({ display: positioning ? "grid" : "none" });

    if (positioning) {
        const arrow = arrowText(hint?.arrow);
        status.el.textContent = hint
            ? `${arrow} ${hint.text}`
            : t("拖到选区外");
        sub.el.textContent = hint?.subtext ?? t("拖到选区外");
        cardSub.el.textContent = hint?.subtext ?? t("拖到选区外");
        cardArrow.el.textContent = arrow;
        setPrimaryIcon("recume.svg", "开始");
    } else {
        status.el.textContent = t("抓帧中");
        sub.el.textContent = t("抓帧中");
        setPrimaryIcon("stop_record.svg", "结束", true);
    }
}

function stop() {
    primary.el.disabled = true;
    closeBtn.el.disabled = true;
    renderSend("long_control_stop", []);
}

primary.on("click", () => {
    if (wayland && !started) {
        if (starting) return;
        starting = true;
        started = true;
        update();
        primary.el.disabled = true;
        renderSend("long_control_start", []);
        setTimeout(() => {
            starting = false;
            primary.el.disabled = false;
        }, 400);
        return;
    }
    stop();
});

closeBtn.on("click", stop);

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") stop();
});

renderOn("long_control_init", ([data]) => {
    wayland = data.wayland;
    started = data.started;
    previewEnabled = data.preview;
    hint = data.hint;
    if (data.firstPreview) {
        setPreview(data.firstPreview.data);
    }
    update();
});

renderOn("long_control_preview", ([data]) => {
    if (!previewEnabled) return;
    setPreview(data.data);
});

update();

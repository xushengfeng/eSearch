import {
    button,
    frame,
    image,
    input,
    pureStyle,
    textarea,
    view,
    addStyle,
    label,
} from "dkh-ui";
import store from "../../../lib/store/renderStore";
import initStyle from "../root/root";

import close_svg from "../assets/icons/close.svg";
import edit_svg from "../assets/icons/super_edit.svg";

type aiData = {
    role: "system" | "user" | "assistant";
    content: {
        text: string;
        img?: string;
    };
};

type chatgptm = {
    role: "system" | "user" | "assistant";
    content:
        | string
        | [
              { type: "text"; text: string },
              { type: "image_url"; image_url: { url: string } },
          ];
};

const content: Map<string, aiData> = new Map();

function iconEl(src: string) {
    return button().add(image(src, "icon").class("icon"));
}

const paddingVar = "var(--o-padding)";
const inputEl = textarea().style({
    width: "100%",
    "max-height": "3lh",
    // @ts-ignore
    "field-sizing": "content",
    padding: paddingVar,
});
const fileInputEl = input("file");

let currentId = uuid();

const showList = view("y").style({
    "flex-grow": 1,
    "overflow-y": "auto",
    "padding-inline": paddingVar,
    gap: paddingVar,
});

function uuid() {
    return crypto.randomUUID().slice(0, 8);
}

function newChatItem(id: string) {
    let chatItem = showList.query(`[data-id="${id}"]`);
    if (!chatItem) {
        chatItem = view().data({ id }).class("chat-item");
        showList.add(chatItem);
    }
    const toolBar = frame("tool", {
        _: view("x").style({
            transition: "var(--transition)",
        }),
        edit: iconEl(edit_svg),
        delete: iconEl(close_svg),
    });

    const contentEl = view();

    chatItem.clear().add([toolBar.el, contentEl]);

    const c = content.get(id);
    if (!c) return;
    chatItem.class(c.role);
    if (c.content.img) {
        contentEl.add(
            image(c.content.img, "").style({
                "max-width": "300px",
                "max-height": "300px",
            }),
        );
    }
    contentEl.add(c.content.text);
}

function toChatgptm(data: aiData): chatgptm {
    const { role, content } = data;
    if (content.img) {
        return {
            role,
            content: [
                { type: "text", text: content.text },
                { type: "image_url", image_url: { url: content.img } },
            ],
        };
    }
    return {
        role,
        content: content.text,
    };
}

async function runAI() {
    const x = store.get("AI.在线模型")[0];
    const m = {
        messages: Array.from(content.values()).map(toChatgptm),
        stream: false,
    };
    for (const i in x.config) {
        m[i] = x.config[i];
    }
    const data = await (
        await fetch(x.url, {
            method: "POST",
            headers: {
                authorization: `Bearer ${x.key}`,
                "content-type": "application/json",
            },
            body: JSON.stringify(m),
        })
    ).json();
    console.log(data);

    const res = data.message?.content || data.choices[0].message.content;

    const id = uuid();
    currentId = id;
    content.set(id, {
        role: "assistant",
        content: { text: res },
    });
    newChatItem(id);
}

function setItem(data: string, type: "text" | "image_url") {
    const id = currentId;
    let oldData: aiData;
    if (content.has(id)) {
        oldData = content.get(id);
    } else {
        oldData = {
            role: "user",
            content: {
                text: "",
            },
        };
        content.set(id, oldData);
    }
    if (type === "image_url") {
        oldData.content.img = data;
    } else {
        oldData.content.text = data;
    }
}

// @ts-ignore
window.setImg = (url: string) => {
    const id = uuid();
    currentId = id;
    setItem(url, "image_url");
    newChatItem(id);
};

inputEl
    .on("input", () => {
        const text = inputEl.gv;
        const id = currentId;
        setItem(text, "text");
        newChatItem(id);
    })
    .on("keyup", (e) => {
        if (e.key === "Enter") {
            runAI();
        }
    });

fileInputEl.on("change", async (e) => {
    // @ts-ignore
    const file = e.target.files[0];
    const id = currentId;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (e) => {
        const url = e.target.result as string;
        setItem(url, "image_url");
        newChatItem(id);
    };
});

pureStyle();

initStyle(store);

addStyle({
    body: {
        background: "var(--bg)",
    },
    button: {
        width: "20px !important",
        height: "20px !important",
    },
    ".chat-item": {
        "max-width": "80%",
    },
    ".system": {
        width: "100%",
    },
    ".user": {
        "margin-left": "auto",
    },
    ".assistant": {
        "margin-right": "auto",
    },
    ".chat-item:not(:hover) #tool_tool": {
        opacity: 0,
        "pointer-events": "none",
    },
    ".user :not(button)>img": {
        "margin-left": "auto",
    },
});

document.body.append(
    view("y")
        .style({ height: "100vh" })
        .add([
            showList,
            view("y").add([
                label([fileInputEl.style({ display: "none" }), "上传图片"]),
                inputEl,
            ]),
        ]).el,
);

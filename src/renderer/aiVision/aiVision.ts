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
    select,
    pack,
    ele,
} from "dkh-ui";
import store from "../../../lib/store/renderStore";
import { getImgUrl, initStyle } from "../root/root";
import { Remarkable } from "remarkable";

const md = new Remarkable({ breaks: true });

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

// @auto-path:../assets/icons/$.svg
function iconEl(src: string) {
    return button().add(image(getImgUrl(`${src}.svg`), "icon").class("icon"));
}

const model = store.get("AI.在线模型");

const paddingVar = "var(--o-padding)";
const inputEl = textarea()
    .style({
        width: "100%",
        "max-height": "3lh",
        // @ts-ignore
        "field-sizing": "content",
        padding: paddingVar,
    })
    .attr({ autofocus: true });
const fileInputEl = input("file");
const selectModelEl = select(
    model.map((x) => ({ value: x.name, label: x.name })),
);
const promptsEl = view("x")
    .style({ gap: paddingVar })
    .add(
        [{ name: "文字识别", p: "识别图片上的文字" }].map((x) =>
            button(x.name).on("click", (e) => {
                if (e.ctrlKey) {
                    inputEl.el.setRangeText(x.p);
                } else {
                    setItem(x.p, "text");
                    newChatItem(currentId);
                    runAI();
                }
            }),
        ),
    );
// todo 自定义

const stopEl = iconEl("close")
    .bindSet((show: boolean, el) => {
        const El = pack(el);
        if (show) {
            El.style({ display: "" });
        } else {
            El.style({ display: "none" });
        }
    })
    .sv(false);

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
    const c = content.get(id);

    let chatItem = showList.query(`[data-id="${id}"]`);
    if (!chatItem) {
        chatItem = view().data({ id }).class("chat-item");
        showList.add(chatItem);
    }
    const toolBar = frame("tool", {
        _: view("x")
            .style({
                transition: "var(--transition)",
            })
            .class("small-size"),
        reflash: iconEl("reload"),
        edit: iconEl("super_edit"),
        delete: iconEl("close"),
    });

    toolBar.els.delete.on("click", () => {
        content.delete(id);
        chatItem.remove();
        setModelList(content.values().some((x) => x.content.img));
    });
    toolBar.els.edit.on("click", () => {
        const c = content.get(id);
        if (!c) return;
        inputEl.sv(c.content.text);
        currentId = id;
    });
    toolBar.els.reflash.on("click", () => {
        const keys = Array.from(content.keys());
        const nowIndex = keys.indexOf(id);
        // 在ai回答上重载，从上一个信息开始生成，覆盖当前信息
        if (content.get(id)?.role === "assistant") {
            const endIndex = nowIndex - 1;
            if (endIndex < 0) return;
            currentId = keys[endIndex];
            runAI(id, true); // 由于删除，currentId可能为assistant
        }
        // 在用户信息上重载，从用户信息开始，覆盖下一条信息
        if (content.get(id)?.role === "user") {
            currentId = id;
            const nextId = keys[nowIndex + 1] || uuid();
            runAI(nextId);
        }
    });

    const contentEl = view();

    chatItem.clear().add([toolBar.el, contentEl]);

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
    const div = view().el;
    div.innerHTML = md.render(c.content.text);
    contentEl.add(div);
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

function setModelList(isVision: boolean) {
    const oldData = selectModelEl.gv ?? model[0].name;
    const list = isVision ? model.filter((x) => x.supportVision) : model;
    const elList = list.map((x) =>
        ele("option").attr({
            value: x.name,
            innerText: x.name,
            selected: x.name === oldData,
        }),
    );
    selectModelEl.clear().add(elList);
}

async function runAI(targetId?: string, force = false) {
    const x = model.find((x) => x.name === selectModelEl.gv) || model[0];
    const clipContent: typeof content = new Map();
    for (const [id, c] of content) {
        clipContent.set(id, c);
        if (id === currentId) break;
    }
    const message = Array.from(clipContent.values());
    if (message.length === 0 || (!force && message.at(-1)?.role !== "user")) {
        pickLastItem();
        return;
    }
    const m = {
        messages: message.map(toChatgptm),
        stream: true,
    };
    for (const i in x.config) {
        m[i] = x.config[i];
    }
    const id = targetId ?? uuid();
    let resultText = "";

    const abortController = new AbortController();
    stopEl.sv(true);
    stopEl.el.onclick = () => {
        abortController.abort();
        stopEl.sv(false);
    };

    fetch(x.url, {
        method: "POST",
        headers: {
            authorization: `Bearer ${x.key}`,
            "content-type": "application/json",
        },
        signal: abortController.signal,
        body: JSON.stringify(m),
    }).then((res) => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const textDecoder = new TextDecoder();
        reader.read().then(function readBody(result) {
            const text = textDecoder
                .decode(result.value)
                .split("\n")
                .map((i) =>
                    i
                        .trim()
                        .replace(/^data:/, "")
                        .trim(),
                )
                .filter((i) => i !== "");
            for (const i of text) {
                if (i === "[DONE]") {
                    stopEl.sv(false);
                    return;
                }
                parse(i);
            }

            reader.read().then(readBody);
        });
    });
    function parse(text: string) {
        const data = JSON.parse(text);
        const res =
            data.message?.content ||
            data.choices[0].message?.content ||
            data.choices[0].delta.content;
        resultText += res;
        content.set(id, {
            role: "assistant",
            content: { text: resultText },
        });
        newChatItem(id);
        pickLastItem();
    }
}

function pickLastItem() {
    const lastId = Array.from(content.keys()).at(-1);
    if (lastId && content.get(lastId)?.role === "user") {
        currentId = lastId;
    } else {
        const userId = uuid();
        currentId = userId;
        setItem("", "text");
    }
}

function setItem(data: string, type: "text" | "image_url") {
    const id = currentId;
    let oldData: aiData;
    if (content.has(id)) {
        // @ts-ignore
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

    if (type === "image_url") setModelList(true);
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
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            runAI();
            inputEl.sv("");
        }
    });

fileInputEl.on("change", async (e) => {
    // @ts-ignore
    const file = e.target.files[0];
    const id = currentId;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (e) => {
        if (!e.target) return;
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
    ".chat-item>:nth-child(2) ul": {
        "list-style-type": "circle",
        "padding-inline-start": "20px",
    },
    ".chat-item>:nth-child(2) p": {
        "margin-block": "0.5em",
    },
});

view("y")
    .style({ height: "100vh" })
    .add([
        showList,
        view("y").add([
            view("x")
                .style({ gap: paddingVar })
                .class("small-size")
                .add([
                    label([fileInputEl.style({ display: "none" }), "上传图片"]),
                    selectModelEl,
                    promptsEl,
                    stopEl,
                ]),
            inputEl,
        ]),
    ])
    .addInto();

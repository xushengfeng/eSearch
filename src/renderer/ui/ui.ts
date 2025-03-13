import { button, ele, image, initDKH, input, pack, select, view } from "dkh-ui";
import { Class, getImgUrl } from "../root/root";
import type { IconType } from "../../iconTypes";

console.log("hi");

function iconBEl(src: IconType) {
    return button().add(image(getImgUrl(`${src}.svg`), "icon").class("icon"));
}

initDKH({ pureStyle: true });

pack(document.body).style({ background: "var(--bg)" });

const p = view("x").style({ gap: "8px", padding: "8px" }).addInto();
p.add([
    button("文字按钮"),
    iconBEl("translate"),
    select([{ value: "1" }]),
    input().sv("hi"),
    input("number"),
    input("checkbox"),
    view()
        .class(Class.group)
        .add([button("hi"), select([])]),
]);

ele("textarea").addInto();

const p2 = view("x")
    .style({ background: "linear-gradient(blue, pink)" })
    .addInto();
const bar = view().class(Class.glassBar).addInto(p2);
bar.add([iconBEl("translate")]);

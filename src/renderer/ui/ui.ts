import { button, image, input, pack, pureStyle, select, view } from "dkh-ui";
import { getImgUrl } from "../root/root";

console.log("hi");

// @auto-path:../assets/icons/$.svg
function iconBEl(src: string) {
    return button().add(image(getImgUrl(`${src}.svg`), "icon").class("icon"));
}

pureStyle();

pack(document.body).style({ background: "var(--bg)" });

const p = view("x").style({ gap: "8px", padding: "8px" }).addInto();
p.add([
    button("文字按钮"),
    iconBEl("translate"),
    select([{ value: "1" }]),
    input().sv("hi"),
    input("number"),
    input("checkbox"),
]);

const p2 = view("x")
    .style({ background: "linear-gradient(blue, pink)" })
    .addInto();
const bar = view().class("bar").addInto(p2);
bar.add([iconBEl("translate")]);

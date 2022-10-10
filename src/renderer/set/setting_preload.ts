const Store = require("electron-store");
var store = new Store();
import { t, lan } from "../../../lib/translate/translate";
lan(store.get("语言.语言"));
document.body.innerHTML = document.body.innerHTML
    .replace(/\{(.*?)\}/g, (m, v) => t(v))
    .replace(/<t>(.*?)<\/t>/g, (m, v) => t(v));
document.title = t(document.title);

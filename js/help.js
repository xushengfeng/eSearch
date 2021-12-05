store = new Store();
模糊 = store.get("模糊") || 10;
if (模糊 != 0) {
    document.documentElement.style.setProperty("--blur", `blur(${模糊}px)`);
} else {
    document.documentElement.style.setProperty("--blur", `none`);
}
// 进度条
scroll = setTimeout(() => {
    document.querySelector("body").className = "hidescrollbar";
}, 1000);
document.querySelector("body").onscroll = () => {
    clearTimeout(scroll - 1);
    document.querySelector("body").className = "";
    scroll = setTimeout(() => {
        document.querySelector("body").className = "hidescrollbar";
    }, 1000);
};

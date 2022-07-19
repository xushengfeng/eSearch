for (let p of store.get("插件.加载后")) {
    if (p.match(/\.css$/i)) {
        let i = document.createElement("link");
        i.rel = "stylesheet";
        i.type = "text/css";
        i.href = p;
        document.body.before(i);
    } else {
        let s = document.createElement("script");
        s.src = p;
        document.body.before(s);
    }
}

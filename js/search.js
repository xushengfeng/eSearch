var search = new URLSearchParams(decodeURIComponent(location.search));
let text = search.get("w");
let result = [];
fetch(`https://www.baidu.com/s?ie=UTF-8&wd=${encodeURIComponent(text)}`)
    .then((v) => v.text())
    .then(async (v) => {
    let tmp_div = document.createElement("div");
    tmp_div.innerHTML = v;
    console.log(tmp_div);
    let sl = tmp_div.querySelectorAll("h3");
    let n = 0;
    for await (let i of sl) {
        let p = i.parentElement;
        let title = i.innerText;
        let body = p.innerText.replace(title, "").trim();
        let href = i.querySelector("a").href;
        try {
            href = (await fetch(href)).url;
        }
        catch (error) { }
        let t = true;
        for (let i of result) {
            if (i?.href == href) {
                t = false;
                break;
            }
        }
        if (t) {
            result[n * 3] = { title, body, href };
            n++;
        }
    }
    r();
});
fetch(`https://cn.bing.com/search?q=${encodeURIComponent(text)}`)
    .then((v) => v.text())
    .then(async (v) => {
    let tmp_div = document.createElement("div");
    tmp_div.innerHTML = v;
    console.log(tmp_div);
    let sl = tmp_div.querySelectorAll("li.b_algo");
    let n = 0;
    for await (let i of sl) {
        let title = i.querySelector(".b_title")?.innerText;
        let body = i.querySelector(".b_attribution").nextElementSibling?.innerText;
        let href = i.querySelector(".b_title > a")?.href;
        let t = true;
        for (let i of result) {
            if (i?.href == href) {
                t = false;
                break;
            }
        }
        if (t) {
            result[n * 3 + 2] = { title, body, href };
            n++;
        }
    }
    r();
});
fetch(`https://www.google.com/search?q=${encodeURIComponent(text)}`)
    .then((v) => v.text())
    .then(async (v) => {
    let tmp_div = document.createElement("div");
    tmp_div.innerHTML = v;
    console.log(tmp_div);
    let sl = tmp_div.querySelectorAll("h3");
    let n = 0;
    for await (let i of sl) {
        let title = i.innerText;
        let body = i.parentElement.parentElement.parentElement.nextElementSibling.innerText;
        let href = i.parentElement.href;
        let t = true;
        for (let i of result) {
            if (i?.href == href) {
                t = false;
                break;
            }
        }
        if (t) {
            result[n * 3 + 2] = { title, body, href };
            n++;
        }
    }
});
function r() {
    console.log(result);
    for (const i of result) {
        if (!i)
            continue;
        let div = `<div>
            <h2><a href="${i.href}">${i.title}</a></h2><p>${i.body}</p></div>`;
        document.getElementById("google").insertAdjacentHTML("beforeend", div);
    }
}

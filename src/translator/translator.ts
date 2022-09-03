const s = decodeURIComponent(location.search);
const sl = s
    .slice(1)
    .split("&")
    .map((v) => v.split("="));

for (let i of sl) {
    switch (i[0]) {
        case "text":
            var text = i[1];
            break;
        case "from":
            var fl = i[1];
            break;
        case "to":
            var tl = i[1];
            break;
        default:
            break;
    }
}

document.querySelector("textarea").value = text;

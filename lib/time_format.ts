function format(_fmt: string, date: Date) {
    let fmt = _fmt;
    const opt = {
        YYYY: date.getFullYear(),
        YY: date.getFullYear() % 1000,
        MM: String(date.getMonth() + 1).padStart(2, "0"),
        M: date.getMonth() + 1,
        DD: String(date.getDate()).padStart(2, "0"),
        D: date.getDate(),
        d: date.getDay(),
        HH: String(date.getHours()).padStart(2, "0"),
        H: date.getHours(),
        hh: String(date.getHours() % 12).padStart(2, "0"),
        h: date.getHours() % 12,
        mm: String(date.getMinutes()).padStart(2, "0"),
        m: date.getMinutes(),
        ss: String(date.getSeconds()).padStart(2, "0"),
        s: date.getSeconds(),
        S: date.getMilliseconds(),
    };
    for (const k in opt) {
        const ret = new RegExp(`${k}`, "g");
        fmt = fmt.replace(ret, `${String(opt[k])}`);
    }
    return fmt;
}
export default format;

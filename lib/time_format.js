/**
 * 时间格式化
 * @param {String} fmt 模板
 * @param {Date} date 传入时间对象
 * @returns String
 */
function format(fmt, date) {
    let ret;
    const opt = {
        YYYY: date.getFullYear() + "",
        YY: (date.getFullYear() % 1000) + "",
        MM: (date.getMonth() + 1 + "").padStart(2, "0"),
        M: date.getMonth() + 1 + "",
        DD: (date.getDate() + "").padStart(2, "0"),
        D: date.getDate() + "",
        d: date.getDay() + "",
        HH: (date.getHours() + "").padStart(2, "0"),
        H: date.getHours() + "",
        hh: ((date.getHours() % 12) + "").padStart(2, "0"),
        h: (date.getHours() % 12) + "",
        mm: (date.getMinutes() + "").padStart(2, "0"),
        m: date.getMinutes() + "",
        ss: (date.getSeconds() + "").padStart(2, "0"),
        s: date.getSeconds() + "",
        S: date.getMilliseconds() + "",
    };
    for (let k in opt) {
        ret = new RegExp(`${k}`, "g");
        fmt = fmt.replace(ret, `${opt[k]}`);
    }
    return fmt;
}
export default format;

export { isDeepStrictEqual };

function isDeepStrictEqual(a: unknown, b: unknown) {
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (
        (typeof a !== "object" && typeof b !== "object") ||
        a === null ||
        b === null
    ) {
        return a === b;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!isDeepStrictEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (a instanceof Object && b instanceof Object) {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) return false;
        for (const key of aKeys) {
            if (!bKeys.includes(key) || !isDeepStrictEqual(a[key], b[key])) {
                return false;
            }
        }
        return true;
    }
    return false;
}

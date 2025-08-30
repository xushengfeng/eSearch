export { tryx, tryD };

function tryx<T>(fn: () => T): [T, null] | [null, Error] {
    try {
        return [fn(), null];
    } catch (e) {
        return [null, e as Error];
    }
}

function tryD<T>(fn: () => T, defaultV: T): T {
    try {
        return fn();
    } catch {
        return defaultV;
    }
}

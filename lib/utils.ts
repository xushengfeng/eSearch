export { typedEntries, typedKeys, tryx, tryD };

// biome-ignore lint/suspicious/noExplicitAny: 相信ai
type Entry<T> = T extends any ? { [K in keyof T]: [K, T[K]] }[keyof T] : never;
function typedEntries<T extends object>(obj: T) {
    return Object.entries(obj) as Exclude<Entry<T>, undefined>[];
}

function typedKeys<T extends object>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof T)[];
}

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

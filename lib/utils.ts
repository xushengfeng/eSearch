export { typedEntries, typedKeys };

// biome-ignore lint/suspicious/noExplicitAny: 相信ai
type Entry<T> = T extends any ? { [K in keyof T]: [K, T[K]] }[keyof T] : never;
function typedEntries<T extends object>(obj: T): Entry<T>[] {
    return Object.entries(obj) as Entry<T>[];
}

function typedKeys<T extends object>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof T)[];
}

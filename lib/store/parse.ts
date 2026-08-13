import type { setting } from "../../src/ShareTypes";
import type { GetValue, SettingPath } from "./renderStore";

export { xset, xget };

function xset<P extends SettingPath>(
    store: Record<string, unknown>,
    keyPath: P,
    value: GetValue<setting, P> | (unknown & {}),
): void {
    const pathx = keyPath.split(".");
    let obj = store;
    for (let i = 0; i < pathx.length; i++) {
        const p = pathx[i];
        if (i === pathx.length - 1) obj[p] = value;
        else {
            if (obj[p]?.constructor !== Object) {
                if (!Number.isNaN(Number(pathx[i + 1]))) {
                    obj[p] = [];
                } else {
                    obj[p] = {};
                }
            }
            // @ts-ignore
            obj = obj[p];
        }
    }
}
function xget<P extends SettingPath>(
    store: Record<string, unknown>,
    keyPath: P,
): GetValue<setting, P> {
    const pathx = keyPath.split(".");
    const lastp = pathx.pop() ?? "";
    // @ts-ignore
    const lastobj = pathx.reduce((p, c) => {
        return p[c] || {};
    }, store);
    return (lastobj as unknown as Record<string, unknown>)[lastp] as GetValue<
        setting,
        P
    >;
}

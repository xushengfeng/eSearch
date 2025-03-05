const { ipcRenderer } = require("electron");
import type { setting } from "../../src/ShareTypes"; // 使用类型映射和条件类型来解析路径

type Join<K, P> = K extends string | number
    ? P extends string | number
        ? `${K}.${P}`
        : never
    : never;

type Paths<T> = T extends object
    ? {
          [K in keyof T]-?: K extends string | number
              ? `${K}` | Join<K, Paths<T[K]>>
              : never;
      }[keyof T]
    : never;

type SettingPath = Paths<setting>;

type GetValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
        ? GetValue<T[K], Rest>
        : never
    : P extends keyof T
      ? T[P]
      : never;

const store = {
    get: <P extends SettingPath>(
        path: P | (unknown & {}),
    ): GetValue<setting, P> => {
        return ipcRenderer.sendSync("store", { type: "get", path });
    },
    set: <P extends SettingPath>(
        path: P | (unknown & {}),
        value: GetValue<setting, P> | (unknown & {}),
    ): void => {
        ipcRenderer.send("store", { type: "set", path, value });
    },
    getAll: () => {
        return ipcRenderer.sendSync("store", { type: "getAll" }) as setting;
    },
    setAll: (value: setting) => {
        ipcRenderer.send("store", { type: "setAll", value });
    },
};

export default store;

export type { SettingPath, GetValue };

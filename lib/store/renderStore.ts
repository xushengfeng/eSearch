const { ipcRenderer } = require("electron");
const store = {
    get: (path: string) => {
        return ipcRenderer.sendSync("store", { type: "get", path });
    },
    set: (path: string, value: any) => {
        ipcRenderer.send("store", { type: "set", path, value });
    },
};

export default store;

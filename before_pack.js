const fs = require("fs");
const path = require("path");
exports.default = async function () {
    // 重写存储器
    const storeindex = path.join(__dirname, "/node_modules/electron-store/index.js");
    fs.writeFileSync(
        storeindex,
        fs
            .readFileSync(storeindex)
            .toString()
            .replace(/ipcMain\.on\(.*\n.*\n.*?;/, "")
    );
};

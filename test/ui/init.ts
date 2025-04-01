import { exec, execSync } from "node:child_process";
import { renameSync, rmSync } from "node:fs";

const appPath =
    process.platform === "linux"
        ? `${process.env.HOME}/.config/eSearch`
        : process.platform === "win32"
          ? `${process.env.APPDATA}/eSearch`
          : process.platform === "darwin"
            ? `${process.env.HOME}/Library/Application Support/eSearch`
            : "";
const configPath = `${appPath}/config.json`;
const backupPath = `${appPath}/config.json.bak`;

function runApp() {
    return exec("pnpm run start");
}

function initConfig() {
    renameSync(configPath, backupPath);
}

function restoreConfig() {
    try {
        rmSync(configPath);
    } catch (error) {}
    renameSync(backupPath, configPath);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export { runApp, initConfig, restoreConfig, sleep };

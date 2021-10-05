// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain } = require("electron");
var screen = require("electron").screen;
const path = require("path");
if (app.getAppPath().slice(-8) == "app.asar") {
    run_path = path.resolve(__dirname, "..");
} else {
    run_path = path.resolve(__dirname, "");
}
require("@electron/remote/main").enable(screen);

app.whenReady().then(() => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        fullscreen: true,
        transparent: true,
        frame: false,
        skipTaskbar: true,
        autoHideMenuBar: true,
        movable: false,
        resizable: false,
        enableLargerThanScreen: true, // mac
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    // and load the index.html of the app.
    mainWindow.loadFile("capture.html");

    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    ipcMain.on("window-close", function () {
        mainWindow.close();
    });

    app.on("activate", function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
    // if (process.platform !== "darwin") app.quit();
});

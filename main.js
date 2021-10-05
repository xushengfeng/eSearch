// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const os = require("os");

var screen = require("electron").screen;
const path = require("path");
if (app.getAppPath().slice(-8) == "app.asar") {
    run_path = path.resolve(__dirname, "..");
} else {
    run_path = path.resolve(__dirname, "");
}

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

    ipcMain.on("window-close", () => {
        mainWindow.close();
    });

    ipcMain.on("save", (event) => {
        save_time = new Date();
        save_name_time = `${save_time.getFullYear()}-${
            save_time.getMonth() + 1
        }-${save_time.getDate()}-${save_time.getHours()}-${save_time.getMinutes()}-${save_time.getSeconds()}-${save_time.getMilliseconds()}`;
        dialog
            .showSaveDialog({
                title: "选择要保存的位置",
                defaultPath: `Screenshot-${save_name_time}.png`,
                filters: [{ name: "Images", extensions: ["png"] }],
            })
            .then((x) => {
                event.sender.send("save_path", x.filePath);
            });
    });

    ipcMain.on("ding", (event, arg) => {
        create_ding_window(arg[0], arg[1], arg[2], arg[3], arg[4]);
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
    // if (process.platform !== "darwin") app.quit();
});

function create_ding_window(x, y, w, h, img) {
    const ding_window = new BrowserWindow({
        x: x,
        y: y,
        width: w,
        height: h,
        icon: path.join(run_path, "assets/icons/1024x1024.png"),
        backgroundColor: "#fff",
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        autoHideMenuBar: true,
        enableLargerThanScreen: true, // mac
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    // and load the index.html of the app.
    ding_window.loadFile("ding.html");
    ding_window.webContents.openDevTools();
    ding_window.webContents.on('did-finish-load', () => {
        ding_window.webContents.send('img', img)
      })
    
}

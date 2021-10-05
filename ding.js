const {
    desktopCapturer,
    ipcRenderer,
    clipboard,
    nativeImage,
} = require("electron");
ipcRenderer.on("img", (event, url) => {
    // console.log(message)
    // document.getElementById('ding_photo').getContext("2d").drawImage(message, 0, 0)
    ding_canvas = document.getElementById("ding_photo");
    var ding_ctx = ding_canvas.getContext("2d");
    let img = new Image();
    img.src = url;
    img.onload = function () {
        // 统一大小
        ding_canvas.width = img.width;
        ding_canvas.height = img.height;
        ding_ctx.drawImage(img, 0, 0);
    };
});

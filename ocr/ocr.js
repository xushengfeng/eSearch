const { net,dialog } = require("electron");
module.exports = function (event, arg) {
    // 定义了POST请求
    const request = net.request({
        method: "POST",
        url: "http://127.0.0.1:8080",
        headers: { "Content-type": "application/x-www-form-urlencoded" },
    });
    request.on("response", (response) => {
        if (response.statusCode == "200") {
            response.on("data", (chunk) => {
                var t = chunk.toString();
                var t = JSON.parse(t);
                // 把返回的数据解析为JSON
            });
            response.on("end", () => {
                // 成功
            });
        } else {
            // 识别失败，警告弹窗
            dialog.showMessageBox({
                title: "警告",
                message: "识别失败\n请尝试重新识别",
                icon: `${run_path}/assets/icons/warning.png`,
            });
        }
    });
    request.on("error", () => {
        // 无法请求到数据，失败
        dialog.showMessageBox({
            title: "警告",
            message: "识别失败\n找不到服务器",
            icon: `${run_path}/assets/icons/warning.png`,
        });
    });
    // 要发送给OCR Api的数据
    data = JSON.stringify({
        access_token: access_token,
        image: arg,
        detect_direction: true,
        paragraph: true,
    });
    request.write(data);
    request.end();
};

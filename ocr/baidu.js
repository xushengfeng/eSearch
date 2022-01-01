const { net, dialog } = require("electron");
module.exports = function (event, arg, f) {
    // 定义了POST请求
    request_url = "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic";
    access_token = "[调用鉴权接口获取的token]";
    request_url = `${request_url}?access_token=${access_token}`;
    const request = net.request({
        method: "POST",
        url: request_url,
        headers: { "Content-type": "application/x-www-form-urlencoded" },
    });
    request.on("response", (response) => {
        if (response.statusCode == "200") {
            response.on("data", (chunk) => {
                var 返回的数据 = chunk.toString();
                var 返回的数据 = JSON.parse(返回的数据);
                // 把返回的数据解析为JSON
                var 输出的内容 = "";
                var text = 返回的数据["words_result"];
                for (i in text) {
                    输出的内容 += text[i]["words"] + "\n";
                }
                if (text["language"]) {
                    language = "本地语言";
                } else {
                    language = "外语";
                }
                // 在主界面输出 第二个为语言
                f([输出的内容, text["language"]]);
            });
            response.on("end", () => {
                // 成功
                event.sender.send("ocr_back", "ok");
            });
        } else {
            // 识别失败，警告弹窗
            event.sender.send("ocr_back", "else");
            dialog.showMessageBox({
                title: "警告",
                message: "识别失败\n请尝试重新识别",
                icon: `${run_path}/assets/icons/warning.png`,
            });
        }
    });
    request.on("error", () => {
        event.sender.send("ocr_back", "else");
        dialog.showMessageBox({
            title: "警告",
            message: "识别失败\n找不到服务器",
            icon: `${run_path}/assets/icons/warning.png`,
        });
    });
    // 要发送给OCR Api的数据
    data = JSON.stringify({
        access_token: "",
        image: arg,
        detect_direction: true, // 识别方向
        paragraph: true, // 识别段落
    });
    request.write(data);
    request.end();
};

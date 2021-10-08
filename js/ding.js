const { ipcRenderer } = require("electron");
ipcRenderer.on("img", (event, url) => {
    document.getElementById("ding_photo").src = url;
});
窗口透明度=document.getElementById('透明度')
窗口透明度.addEventListener('input',()=>{
    document.getElementById('ding_photo').style.opacity=`${窗口透明度.value/100}`
})
document.getElementById('close').addEventListener('click',()=>{
ipcRenderer.send('ding_close')
ipcRenderer.send('ding_resize')
})
const { ipcRenderer } = require("electron");

t=''
type=''
ipcRenderer.on("text", (event, list) => {
    t=list[0]
    type=list[1]
    if(type=='ocr'){
        document.getElementById('text').innerText=t
    }
    if(type=='QR'){
        document.getElementById('text').innerText=t
    }
});
document.getElementById('search_b').addEventListener('click',()=>{
    s=document.getSelection().toString()
    url=`https://www.baidu.com/?=wd=${s}`
    // ipcRenderer.send('web_show',url)
})
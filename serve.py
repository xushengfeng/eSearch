import web
from paddleocr import PaddleOCR
import json
import base64
import cv2
import numpy as np

def ocr(data,lang):
    ocr = PaddleOCR(use_gpu=False,lang=lang) # 首次执行会自动下载模型文件
    image_string = data
    img_data = base64.b64decode(image_string)
    nparr = np.fromstring(img_data, np.uint8)
    img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    result = ocr.ocr(img_np)
    dic={}
    dic["boxes"] = [line[0] for line in result]
    dic["txts"] = [line[1][0] for line in result]
    # dic["scores"] = [line[1][1] for line in result]
    dic["lang"] = lang
    return dic


urls = (
    '/', 'index'
)

def c_or_e(x):
    letters = 0
    space = 0
    digit = 0
    others = 0
    for c in x:
        if ord(c) in range(65,91) or ord(c) in range(97,123):
            letters+=1
        elif c.isspace():
            space+=1
        elif c.isdigit():
            digit+=1
        else:
            others+=1
    if letters/(len(x)-space)>0.5:
        return 'e'
    else:
        return 'c'

class index:
    def POST(self):
        data = web.data()
        x=''
        ocr_r=ocr(data,'ch')
        for i in ocr_r["txts"]:
            x+=i
        if c_or_e(x)=='e' and len(ocr_r)<=15:
            ocr_r['lang']=='en'
        if c_or_e(x)=='c':
            print('c')
            return json.dumps((ocr_r))
        else:
            print('e')
            return json.dumps((ocr(data,'en')))
        

if __name__ == "__main__":
    app = web.application(urls, globals())
    app.run()
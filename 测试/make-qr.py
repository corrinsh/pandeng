"""生成"扫码打开"二维码（带版本参数，用于强制刷新缓存）

用法: python 测试/make-qr.py <URL基础地址> <版本标记> [输出文件]
例:   python 测试/make-qr.py https://xxx.app.workbuddy.host v4 扫码打开.png
"""
import os
import sys
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from PIL import Image, ImageDraw, ImageFont

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://77f25e49ef724748b84c3810fefb5cc1.app.workbuddy.host"
VER = sys.argv[2] if len(sys.argv) > 2 else "v4"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, "扫码打开.png")

SEP = "&" if "?" in BASE else "?"
URL = f"{BASE}{SEP}b={VER}"

qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_M, box_size=22, border=4)
qr.add_data(URL)
qr.make(fit=True)
img = qr.make_image(fill_color="#12100E", back_color="#FAF6EF").convert("RGB")

PAD = 56
CAP = 64
canvas = Image.new("RGB", (img.width + PAD * 2, img.height + PAD * 2 + CAP), (250, 246, 239))
canvas.paste(img, (PAD, PAD))

d = ImageDraw.Draw(canvas)
font = None
for name in ("msyh.ttc", "msyhbd.ttc", "simhei.ttf", "Deng.ttf"):
    p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", name)
    if os.path.exists(p):
        font = ImageFont.truetype(p, 26)
        break
text = f"扫码打开 · 版本 {VER}"
try:
    d.text((canvas.width // 2, canvas.height - CAP + 12), text,
           font=font, fill=(140, 136, 116), anchor="ma")
except Exception:
    pass

canvas.save(OUT)
print("二维码地址:", URL)
print("尺寸:", canvas.size)
print("已写入:", OUT)

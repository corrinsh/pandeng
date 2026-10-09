"""生成"扫码打开"二维码

用法:
  python 测试/make-qr.py <URL> [版本标记] [输出文件]
  # 版本标记省略或传 "-" 时不加 ?b= 参数（GitHub Pages 这类新域名不需要破缓存）
例:
  python 测试/make-qr.py https://corrinsh.github.io/pandeng/
  python 测试/make-qr.py https://xxx.app.workbuddy.host v9
"""
import os
import sys
import qrcode
from qrcode.constants import ERROR_CORRECT_M
from PIL import Image, ImageDraw, ImageFont

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://corrinsh.github.io/pandeng/"
VER = (sys.argv[2] if len(sys.argv) > 2 else "").strip()
if VER in ("-", "none"):
    VER = ""
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, "扫码打开.png")

if VER:
    SEP = "&" if "?" in BASE else "?"
    URL = f"{BASE}{SEP}b={VER}"
else:
    URL = BASE

qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_M, box_size=22, border=4)
qr.add_data(URL)
qr.make(fit=True)
# 仪器风配色：深炭模块 + 纸白底（二维码需要高对比，不能反过来）
img = qr.make_image(fill_color="#0E0F10", back_color="#F2EFE9").convert("RGB")

PAD = 56
CAP = 64
canvas = Image.new("RGB", (img.width + PAD * 2, img.height + PAD * 2 + CAP), (242, 239, 233))
canvas.paste(img, (PAD, PAD))

d = ImageDraw.Draw(canvas)
font = None
for name in ("msyh.ttc", "msyhbd.ttc", "simhei.ttf", "Deng.ttf"):
    p = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts", name)
    if os.path.exists(p):
        font = ImageFont.truetype(p, 26)
        break
text = "扫码打开 · 攀登" + (f" · {VER}" if VER else "")
try:
    d.text((canvas.width // 2, canvas.height - CAP + 12), text,
           font=font, fill=(120, 116, 108), anchor="ma")
except Exception:
    pass

canvas.save(OUT)
print("二维码地址:", URL)
print("尺寸:", canvas.size)
print("已写入:", OUT)

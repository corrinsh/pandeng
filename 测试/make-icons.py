# -*- coding: utf-8 -*-
"""攀登 · 图标生成（仪器风）
深炭底 + 琥珀折线 + 方形峰值标记。方角、无渐变、无阴影 —— 和 UI 同一套语言。

用法：
  python 测试/make-icons.py
输出到项目 assets/ 下：
  icon.svg / icon-180.png / icon-192.png / icon-512.png / icon-maskable-512.png
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")

BG = (14, 15, 16)          # #0E0F10
ACCENT = (224, 163, 58)    # #E0A33A

# 山形折线（120x120 坐标系内）
PATH = [(20, 90), (46, 42), (64, 68), (78, 50), (100, 90)]
PEAK = (46, 42)


def render(size, maskable=False):
    ss = 4
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 底：普通图标留圆角（约 22%），maskable 满幅铺底
    if maskable:
        d.rectangle([0, 0, S, S], fill=BG)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)

    # maskable 时把图形缩到安全区（中心 72%），避免被系统裁切
    k = 0.72 if maskable else 1.0
    off = (1 - k) / 2.0

    def pt(p):
        x = (p[0] / 120.0 * k + off) * S
        y = (p[1] / 120.0 * k + off) * S
        return (x, y)

    w = max(2, int(S * 0.055 * k))
    d.line([pt(p) for p in PATH], fill=ACCENT, width=w, joint="curve")

    # 峰值标记：方形，不是圆点 —— 仪器不做圆
    cx, cy = pt(PEAK)
    r = w * 0.78
    d.rectangle([cx - r, cy - r, cx + r, cy + r], fill=ACCENT)

    return img.resize((size, size), Image.LANCZOS)


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <rect width="120" height="120" rx="26" fill="#0E0F10"/>
  <path d="M20 90 L46 42 L64 68 L78 50 L100 90"
        fill="none" stroke="#E0A33A" stroke-width="6.6"
        stroke-linejoin="round" stroke-linecap="butt"/>
  <rect x="41.2" y="37.2" width="9.6" height="9.6" fill="#E0A33A"/>
</svg>
"""

os.makedirs(OUT, exist_ok=True)

with open(os.path.join(OUT, "icon.svg"), "w", encoding="utf-8") as f:
    f.write(SVG)

for size, name, msk in [
    (180, "icon-180.png", False),
    (192, "icon-192.png", False),
    (512, "icon-512.png", False),
    (512, "icon-maskable-512.png", True),
]:
    path = os.path.join(OUT, name)
    render(size, msk).save(path, "PNG", optimize=True)
    print("已写入", path, os.path.getsize(path), "bytes")

# 抽色校验：确认底色就是 #0E0F10、图形就是 #E0A33A
im = render(192).convert("RGB")
print("底色采样 (2,2) =", im.getpixel((2, 2)))
print("图形采样 (峰值附近) =", im.getpixel((int(46 / 120 * 192), int(44 / 120 * 192))))

"""把截图目录拼成一张联络表，便于一眼看完整个流程。

用法:
  python 测试/make-sheet.py                 # 拼 测试/shots（本地验收）
  python 测试/make-sheet.py shots-live      # 拼 测试/shots-live（线上验收）
"""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRNAME = sys.argv[1] if len(sys.argv) > 1 else "shots"
SHOTS = os.path.join(ROOT, "测试", DIRNAME)

NAMES = [
    "01-select",
    "02-map-foothill", "03-brief", "04-quiz-q1", "05-quiz-judged", "06-result", "07-map-after",
    "08-map-midway", "09-midway-brief", "09-midway-quiz",
    "08-map-summit", "09-summit-brief", "09-summit-quiz",
]

CW, CH = 200, 432
COLS, ROWS = 7, 2
LABEL = 20
PAD = 8

sheet = Image.new(
    "RGB",
    (COLS * (CW + PAD) + PAD, ROWS * (CH + LABEL + PAD) + PAD),
    (24, 24, 24),
)
d = ImageDraw.Draw(sheet)

for i, n in enumerate(NAMES):
    p = os.path.join(SHOTS, n + ".png")
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("RGB")
    im.thumbnail((CW, CH), Image.LANCZOS)
    c, r = i % COLS, i // COLS
    x = PAD + c * (CW + PAD) + (CW - im.width) // 2
    y = PAD + r * (CH + LABEL + PAD)
    sheet.paste(im, (x, y))
    d.text((PAD + c * (CW + PAD) + 2, y + im.height + 4), n, fill=(190, 190, 190))

out = os.path.join(SHOTS, "_contact-sheet.png")
sheet.save(out)
print("已写入", out, sheet.size)

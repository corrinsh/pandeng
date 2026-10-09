"""纹理回归检查：检测截图里是否存在"整屏横线"这类高频条纹。

为什么需要：手机 3.5 倍屏上 1 CSS px 的线会被放大成 3.5 个物理像素，
本来是"雅致质感"的纹理在真机上会变成"满屏横线"被当成 bug。
这个脚本用「高通滤波 + 自相关」把条纹强度量化出来，换皮肤后可以直接回归。

用法:
  python 测试/check-stripes.py <截图.png> [x0] [x1] [y0比例] [y1比例]
退出码: 0 = 干净, 1 = 发现明显条纹
"""
import sys
from PIL import Image

path = sys.argv[1]
x0 = int(sys.argv[2]) if len(sys.argv) > 2 else 6
x1 = int(sys.argv[3]) if len(sys.argv) > 3 else 52
ya = float(sys.argv[4]) if len(sys.argv) > 4 else 0.20
yb = float(sys.argv[5]) if len(sys.argv) > 5 else 0.75

# 判定阈值：高通后标准差超过这个值就认为有可视频闪条纹
THRESHOLD = 0.35

im = Image.open(path).convert("L")
W, H = im.size
px = im.load()
y0, y1 = int(H * ya), int(H * yb)

rows = [sum(px[x, y] for x in range(x0, x1)) / (x1 - x0) for y in range(y0, y1)]
n = len(rows)

# 高通：减去 25 行滑动平均，压掉低频明暗渐变，只留下高频条纹
K = 25
hp = []
for i in range(n):
    a, b = max(0, i - K), min(n, i + K + 1)
    hp.append(rows[i] - sum(rows[a:b]) / (b - a))
mean = sum(hp) / n
hp = [v - mean for v in hp]
sd = (sum(v * v for v in hp) / n) ** 0.5

print(f"图片 {W}x{H}   采样带 x={x0}..{x1}  y={y0}..{y1}")
print(f"背景亮度均值 = {sum(rows)/n:.1f}")
print(f"条纹强度（高通标准差） = {sd:.3f}   阈值 {THRESHOLD}")

if sd < THRESHOLD:
    print("→ 干净：这条带没有可视频闪条纹")
    sys.exit(0)

print("\n⚠️ 检出条纹。自相关峰值对应的周期：")
scores = []
for p in range(2, 61):
    num = sum(hp[i] * hp[i + p] for i in range(n - p))
    den = sum(hp[i] * hp[i] for i in range(n - p)) or 1
    scores.append((num / den, p))
peaks = []
for i in range(1, len(scores) - 1):
    r, p = scores[i]
    if r > scores[i - 1][0] and r > scores[i + 1][0] and r > 0.10:
        peaks.append((r, p))
peaks.sort(reverse=True)
for r, p in peaks[:5]:
    print(f"   周期 {p:>2} 物理像素 = {p/3.5:.2f} CSS像素   相关 {r:+.3f}")
sys.exit(1)

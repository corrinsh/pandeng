# -*- coding: utf-8 -*-
"""通过 GitHub Git Data API 把整个仓库推上去。
为什么不用 git push：github.com:443 直连被重置（Recv failure: Connection was reset），
而 api.github.com 可以直连。走 API 建 blob → tree → commit → ref 四步。

用法：GH_TOKEN=xxx python gh-upload.py
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

OWNER = "corrinsh"
REPO = "pandeng"
BRANCH = "main"
ROOT = r"E:\WB工作区\益智手机游戏"
MESSAGE = os.environ.get("GH_MSG") or """攀登 · AI 认知训练（三档 45 关）

- 三档：山脚（认识论）/ 山腰（工程方法）/ 山巅（动手造 Agent），每档 3 章 15 关
- 全离线：内置出题器（6 台出题机 + 每关素材池），不联网、不接 API
- 视觉：仪器风一套语言，三档只换强调色与底色色温
- 零框架：纯 HTML + CSS + 原生 ES Module，PWA 可添加到主屏幕
- 验收：56 项断言全绿（测试/ui-test.mjs）"""

TOKEN = os.environ.get("GH_TOKEN")
if not TOKEN:
    print("缺少 GH_TOKEN")
    sys.exit(1)

API = "https://api.github.com"


def call(method, path, payload=None, tries=5):
    url = API + path
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    last = ""
    for i in range(tries):
        req = urllib.request.Request(url, data=body, method=method)
        req.add_header("Authorization", "Bearer " + TOKEN)
        req.add_header("Accept", "application/vnd.github+json")
        req.add_header("Content-Type", "application/json; charset=utf-8")
        req.add_header("User-Agent", "pandeng-uploader")
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")
            last = "%s %s -> %s %s" % (method, path, e.code, detail[:300])
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(2 + i * 2)
                continue
            raise RuntimeError(last)
        except Exception as e:
            last = "%s %s -> %s" % (method, path, e)
            time.sleep(2 + i * 2)
    raise RuntimeError("重试耗尽: " + last)


# 用 git ls-files 拿到已跟踪文件列表（.gitignore 已经过滤好了）
out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True)
files = [f.decode("utf-8") for f in out.stdout.split(b"\x00") if f]
files.sort()
print("待上传文件数:", len(files))
if not files:
    sys.exit("没有文件可上传")

# 0) 空仓库不允许建 blob（409 Git Repository is empty），先用 Contents API 塞一个种子文件
try:
    with open(os.path.join(ROOT, ".gitignore"), "rb") as fh:
        seed = base64.b64encode(fh.read()).decode("ascii")
    res = call("PUT", "/repos/%s/%s/contents/.gitignore" % (OWNER, REPO),
               {"message": "初始化仓库", "content": seed, "branch": BRANCH})
    print("已用 .gitignore 初始化仓库，首个提交:", res["commit"]["sha"][:10])
except RuntimeError as e:
    print("种子文件已存在或初始化跳过：", str(e)[:160])

# 1) 逐个建 blob
entries = []
total = 0
for i, rel in enumerate(files, 1):
    abs_path = os.path.join(ROOT, rel.replace("/", os.sep))
    with open(abs_path, "rb") as fh:
        raw = fh.read()
    total += len(raw)
    b64 = base64.b64encode(raw).decode("ascii")
    res = call("POST", "/repos/%s/%s/git/blobs" % (OWNER, REPO),
               {"content": b64, "encoding": "base64"})
    entries.append({"path": rel, "mode": "100644", "type": "blob", "sha": res["sha"]})
    print("  [%2d/%d] %-42s %7d B" % (i, len(files), rel, len(raw)))

print("总字节:", total)

# 2) 建 tree（完整树，不带 base_tree）
tree = call("POST", "/repos/%s/%s/git/trees" % (OWNER, REPO), {"tree": entries})
print("tree:", tree["sha"])

# 3) 建 commit：父提交 = 种子提交
ref = call("GET", "/repos/%s/%s/git/ref/heads/%s" % (OWNER, REPO, BRANCH))
parent = ref["object"]["sha"]
commit = call("POST", "/repos/%s/%s/git/commits" % (OWNER, REPO),
              {"message": MESSAGE, "tree": tree["sha"], "parents": [parent]})
print("commit:", commit["sha"])

# 4) 更新分支引用
call("PATCH", "/repos/%s/%s/git/refs/heads/%s" % (OWNER, REPO, BRANCH),
     {"sha": commit["sha"], "force": True})
print("已更新分支:", BRANCH)

print("✅ 上传完成")
print("   https://github.com/%s/%s" % (OWNER, REPO))

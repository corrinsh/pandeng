"""攀登 · 本地开发服务器

为什么不用 `python -m http.server`：
  它用的是 ThreadingHTTPServer 的默认设置，request_queue_size 只有 5。
  浏览器打开一个页面会并发拉 20+ 个资源（HTTP/1.0 每个请求一条新连接），
  连接队列一溢出就是 ERR_CONNECTION_REFUSED —— 表现成"随机加载失败"。
  这里把队列放到 256，并开启 HTTP/1.1 keep-alive 复用连接。

用法： python 测试/serve.py [端口]   （默认 8099）
"""
import os
import sys
import contextlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"      # 开 keep-alive，连接数骤降

    def end_headers(self):
        # 开发期绝不缓存自己的 js/css，改完刷新即生效
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 静默；要排查时把下面这行取消注释
        # sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))
        pass


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 256           # 关键：默认只有 5


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8099
    handler = lambda *a, **kw: Handler(*a, directory=ROOT, **kw)  # noqa: E731
    with Server(("127.0.0.1", port), handler) as httpd:
        print(f"攀登 · 本地服务 http://127.0.0.1:{port}/  (root={ROOT})", flush=True)
        with contextlib.suppress(KeyboardInterrupt):
            httpd.serve_forever()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ローカル開発用の簡易静的サーバー（標準ライブラリのみ）。

特徴:
  - クリーンURL対応: 拡張子なしのパス（例 /select, /results）は
    自動的に <path>.html を探して返す。
  - クエリ文字列を捨てない: /index.html?team=BR などを
    リダイレクトせずそのまま配信するため、?team=XX が失われない。
    （npx serve のクリーンURLリダイレクトは team パラメータを落とす不具合があった）

使い方:
  python serve.py            # http://localhost:8080/
  python serve.py 3000       # ポート指定
  uv run python serve.py 8080
"""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))


class CleanUrlHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        fs = super().translate_path(path)
        if not os.path.exists(fs):
            # クエリ/フラグメントを除いたパス部分
            root = path.split("?", 1)[0].split("#", 1)[0]
            base = os.path.basename(root)
            # 末尾スラッシュなし & 拡張子なしのとき <path>.html を試す
            if base and not root.endswith("/") and "." not in base:
                alt = super().translate_path(root + ".html")
                if os.path.isfile(alt):
                    return alt
        return fs

    def end_headers(self):
        # 開発時の確認をしやすくするためキャッシュを無効化
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"無効なポート: {sys.argv[1]}")
            sys.exit(1)

    os.chdir(HERE)
    httpd = HTTPServer(("127.0.0.1", port), CleanUrlHandler)
    print(f"Serving {HERE}")
    print(f"  http://localhost:{port}/")
    print("Ctrl+C で停止します。")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n停止しました。")
        httpd.server_close()


if __name__ == "__main__":
    main()

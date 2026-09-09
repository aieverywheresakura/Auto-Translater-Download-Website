#!/usr/bin/env python3
"""確認站上寫著的每一個數字都對得上實際的 APK。

version.json、index.html 的後備值、_redirects 的 latest.apk 目標，三份東西講的
必須是同一件事。任何一處對不上，使用者照著頁面校驗就會失敗——而那正是最沒有
辦法自己判斷「是我抄錯還是檔案被換了」的時刻。

    ./tools/check.py

發版後、提交前跑一次。回傳碼非 0 代表有問題，可以直接掛在 CI 上。
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import apkinfo  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
problems = []


def check(label, actual, expected):
    if actual != expected:
        problems.append("%s：頁面寫 %r，實際是 %r" % (label, actual, expected))


def grab(text, pattern):
    found = re.search(pattern, text, re.S)
    return found.group(1) if found else None


def main():
    os.chdir(ROOT)
    with open("version.json", encoding="utf-8") as handle:
        manifest = json.load(handle)
    release = manifest["latest"]

    if not os.path.isfile(release["file"]):
        print("錯誤：version.json 指向的 %s 不存在。" % release["file"], file=sys.stderr)
        return 1

    info = apkinfo.inspect(release["file"])
    for key in ("version", "versionCode", "size", "sha256", "minSdk", "minAndroid",
                "targetSdk", "abis"):
        check("version.json latest.%s" % key, release[key], info[key])
    check("version.json signing.certSha256", manifest["signing"]["certSha256"], info["certSha256"])
    check("version.json package", manifest["package"], info["package"])

    with open("index.html", encoding="utf-8") as handle:
        html = handle.read()
    fallbacks = [
        ("版本徽章", r'id="version-badge">([^<]*)<', "v" + release["version"]),
        ("發佈日期", r'id="release-date">([^<]*)<', release["released"]),
        ("下載連結", r'id="download-btn" href="([^"]*)"', release["file"]),
        ("檔案大小", r'id="download-meta">([^<]*)<', "%.1f MB" % (release["size"] / 1048576.0)),
        ("支援架構", r'id="spec-abi">([^<]*)<', " · ".join(release["abis"])),
        ("檔案雜湊", r'id="sha-file">([^<]*)<', release["sha256"]),
        ("憑證指紋", r'id="sha-cert">([^<]*)<', manifest["signing"]["certSha256"]),
        ("結構化資料版本", r'"softwareVersion": "([^"]*)"', release["version"]),
    ]
    for label, pattern, expected in fallbacks:
        check("index.html " + label, grab(html, pattern), expected)

    with open("_redirects", encoding="utf-8") as handle:
        redirects = handle.read()
    for alias in ("/latest.apk", "/download/android/latest.apk"):
        line = next((l for l in redirects.splitlines() if l.startswith(alias + " ")), None)
        if not line:
            problems.append("_redirects 少了 %s 的規則" % alias)
        elif "/" + release["file"] not in line:
            problems.append("_redirects 的 %s 沒有指向 %s" % (alias, release["file"]))

    for old in manifest.get("history", []):
        if not os.path.isfile(old["file"]):
            problems.append("歷史版本 v%s 的檔案不見了：%s" % (old["version"], old["file"]))

    for lang in ("zh-Hant", "zh-Hans", "en"):
        if not release.get("notes", {}).get(lang):
            problems.append("v%s 的 %s 更新說明是空的" % (release["version"], lang))

    if problems:
        print("對不上的地方：")
        for line in problems:
            print("  - " + line)
        return 1

    print("v%s（%d）：version.json、index.html、_redirects 三邊一致，雜湊與 APK 相符。"
          % (release["version"], release["versionCode"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

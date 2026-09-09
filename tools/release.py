#!/usr/bin/env python3
"""把一個新編好的 APK 放上下載頁。

    ./tools/release.py ~/Downloads/app-release.apk
    ./tools/release.py app-release.apk --notes notes.json --prune

做的事：檢查這個檔案能不能發（套件名、簽名金鑰、版本號），複製成帶版本號的
檔名，把舊版推進歷史，然後把 version.json、_redirects、index.html 裡所有
寫死的版本資訊一次改齊。

version.json 是給 JS 讀的，index.html 裡那份是沒有 JS 時的後備——兩邊不一致
的話，關掉 JS 的訪客會看到上一版的雜湊值卻下載到新檔案，於是校驗必然失敗。
所以這件事不適合用手做。
"""

import argparse
import datetime
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import apkinfo  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "version.json")
INDEX = os.path.join(ROOT, "index.html")
REDIRECTS = os.path.join(ROOT, "_redirects")
APK_DIR = os.path.join("download", "android")
NAME_TEMPLATE = "LiveTranslator-%s.apk"
LANGS = ("zh-Hant", "zh-Hans", "en")


def fail(message):
    print("錯誤：" + message, file=sys.stderr)
    sys.exit(1)


def load_notes(path):
    if not path:
        return {lang: [] for lang in LANGS}
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    missing = [lang for lang in LANGS if not data.get(lang)]
    if missing:
        print("提醒：更新說明缺少 %s，那幾種語言的清單會是空的。" % "、".join(missing))
    return {lang: list(data.get(lang, [])) for lang in LANGS}


def read_index():
    with open(INDEX, encoding="utf-8") as handle:
        return handle.read()


def substitute(text, pattern, value, what):
    """換掉唯一一處，換不到或換到多處就停——寧可不改也不要改錯。"""
    new_text, count = re.subn(pattern, lambda m: m.group(1) + value + m.group(2), text, flags=re.S)
    if count != 1:
        fail("index.html 裡的「%s」找到 %d 處，預期剛好 1 處。" % (what, count))
    return new_text


def update_index(old_file, release, signing):
    text = read_index()
    text = text.replace(os.path.basename(old_file), os.path.basename(release["file"]))

    fields = [
        (r'(id="version-badge">)[^<]*(<)', "v" + release["version"], "版本徽章"),
        (r'(id="release-date">)[^<]*(<)', release["released"], "發佈日期"),
        (r'(id="download-btn" href=")[^"]*(")', release["file"], "下載連結"),
        (r'(id="download-meta">)[^<]*(<)', "%.1f MB" % (release["size"] / 1048576.0), "檔案大小"),
        (r'(id="spec-os">)[^<]*(<)', "Android %s 以上" % release["minAndroid"], "系統需求"),
        (r'(id="spec-abi">)[^<]*(<)', " · ".join(release["abis"]), "支援架構"),
        (r'(id="sha-file">)[^<]*(<)', release["sha256"], "檔案雜湊"),
        (r'(id="sha-cert">)[^<]*(<)', signing["certSha256"], "憑證指紋"),
        (r'(id="cert-subject">)[^<]*(<)', signing["subject"], "憑證主體"),
        (r'("softwareVersion": ")[^"]*(")', release["version"], "結構化資料版本"),
    ]
    for pattern, value, what in fields:
        text = substitute(text, pattern, value, what)

    with open(INDEX, "w", encoding="utf-8") as handle:
        handle.write(text)


def update_redirects(old_file, new_file):
    with open(REDIRECTS, encoding="utf-8") as handle:
        text = handle.read()
    if old_file not in text:
        print("提醒：_redirects 沒有指向舊檔案，latest.apk 的目標請自行確認。")
    with open(REDIRECTS, "w", encoding="utf-8") as handle:
        handle.write(text.replace("/" + old_file, "/" + new_file))


def main():
    parser = argparse.ArgumentParser(description="發佈一個新版 APK 到下載頁。")
    parser.add_argument("apk", help="剛編好的 APK（例如 CI artifact 裡的 app-release.apk）")
    parser.add_argument("--date", help="發佈日期 YYYY-MM-DD，預設今天")
    parser.add_argument("--notes", help="更新說明 JSON，鍵是 zh-Hant / zh-Hans / en，值是字串陣列")
    parser.add_argument("--keep", type=int, default=2, help="保留幾個舊版本，預設 2")
    parser.add_argument("--prune", action="store_true", help="順手刪掉超出保留數的舊 APK 檔案")
    parser.add_argument("--allow-key-change", action="store_true",
                        help="接受簽名金鑰與線上版本不同（會讓所有使用者無法覆蓋更新）")
    parser.add_argument("--force", action="store_true", help="跳過版本號遞增與覆蓋檢查")
    args = parser.parse_args()

    if not os.path.isfile(args.apk):
        fail("找不到 %s" % args.apk)

    info = apkinfo.inspect(args.apk)
    with open(MANIFEST, encoding="utf-8") as handle:
        manifest = json.load(handle)
    current = manifest["latest"]

    if info["package"] != manifest["package"]:
        fail("套件名是 %s，這個站發的是 %s。" % (info["package"], manifest["package"]))

    if not info["certSha256"]:
        fail("這個 APK 沒有 v2/v3 簽名，裝不上 Android 11 以後的機器。")

    if info["certSha256"] != manifest["signing"]["certSha256"] and not args.allow_key_change:
        fail("簽名憑證與線上版本不同。\n"
             "  線上：%s\n  這個：%s\n"
             "金鑰換掉的話，所有使用者都必須先解除安裝才能更新，資料會一起沒有。\n"
             "確定要換就加 --allow-key-change。"
             % (manifest["signing"]["certSha256"], info["certSha256"]))

    if info["versionCode"] <= current["versionCode"] and not args.force:
        fail("versionCode %d 沒有比線上的 %d 大，Android 會把它當成降級而拒絕安裝。"
             % (info["versionCode"], current["versionCode"]))

    dest_rel = os.path.join(APK_DIR, NAME_TEMPLATE % info["version"])
    dest_abs = os.path.join(ROOT, dest_rel)
    if os.path.exists(dest_abs) and not args.force:
        fail("%s 已經存在。同一個版本號要重發就先改版本號，真的要覆蓋才用 --force。" % dest_rel)

    notes = load_notes(args.notes)
    released = args.date or datetime.date.today().isoformat()

    os.makedirs(os.path.dirname(dest_abs), exist_ok=True)
    shutil.copy2(args.apk, dest_abs)

    release = {
        "version": info["version"],
        "versionCode": info["versionCode"],
        "released": released,
        "file": dest_rel,
        "size": info["size"],
        "sha256": info["sha256"],
        "minSdk": info["minSdk"],
        "minAndroid": info["minAndroid"],
        "targetSdk": info["targetSdk"],
        "abis": info["abis"],
        "notes": notes,
    }

    history = [current] + manifest.get("history", [])
    dropped = history[args.keep:]
    history = history[:args.keep]

    manifest["latest"] = release
    manifest["history"] = history
    manifest["updated"] = released
    manifest["signing"]["certSha256"] = info["certSha256"]
    manifest["signing"]["schemes"] = info["signingSchemes"]

    with open(MANIFEST, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    update_index(current["file"], release, manifest["signing"])
    update_redirects(current["file"], dest_rel)

    print("已發佈 v%s (%d)" % (release["version"], release["versionCode"]))
    print("  檔案  %s  %.1f MB" % (dest_rel, release["size"] / 1048576.0))
    print("  雜湊  %s" % release["sha256"])

    for old in dropped:
        path = os.path.join(ROOT, old["file"])
        if args.prune and os.path.exists(path):
            os.remove(path)
            print("  已刪除 %s（超出保留數）" % old["file"])
        elif os.path.exists(path):
            print("  已離開清單但檔案還在：%s（--prune 可順手刪掉）" % old["file"])

    if not args.notes:
        print("\n下一步：把更新說明填進 version.json 的 latest.notes，三種語言都要。")
    print("確認頁面沒問題後提交：git add -A && git commit -m 'Release v%s'" % release["version"])


if __name__ == "__main__":
    main()

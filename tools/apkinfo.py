#!/usr/bin/env python3
"""從 APK 讀出發佈頁需要的所有事實，不依賴 Android SDK。

發版時這些值必須跟實際檔案一致，用手抄遲早會抄錯一位，所以直接讀檔案：
版本號讀二進位 AndroidManifest.xml，簽名指紋讀 APK Signing Block，
架構列表看 lib/ 底下有哪些目錄。

    python3 tools/apkinfo.py app-release.apk
"""

import hashlib
import json
import os
import struct
import sys
import zipfile

# --- 二進位 AndroidManifest.xml -------------------------------------------
#
# 格式是 AOSP 的 ResChunk 串接：字串池 + 資源對照表 + 元素節點。
# 這裡只要 <manifest> 和 <uses-sdk> 上的幾個屬性，所以走一遍節點就停。

CHUNK_STRING_POOL = 0x0001
CHUNK_START_ELEMENT = 0x0102
FLAG_UTF8 = 1 << 8
TYPE_STRING = 0x03
TYPE_INT_DEC = 0x10


def _read_string_pool(data, offset, header_size, size):
    count, _style_count, flags, strings_start, _styles_start = struct.unpack(
        "<IIIII", data[offset + 8:offset + 28]
    )
    utf8 = bool(flags & FLAG_UTF8)
    offsets = struct.unpack("<%dI" % count, data[offset + header_size:offset + header_size + 4 * count])
    base = offset + strings_start
    out = []
    for rel in offsets:
        p = base + rel
        if utf8:
            for _ in range(2):  # 兩個變長長度：字元數、位元組數
                length = data[p]
                p += 1
                if length & 0x80:
                    length = ((length & 0x7F) << 8) | data[p]
                    p += 1
            out.append(data[p:p + length].decode("utf-8", "replace"))
        else:
            length = struct.unpack("<H", data[p:p + 2])[0]
            out.append(data[p + 2:p + 2 + 2 * length].decode("utf-16-le", "replace"))
    return out


def parse_manifest(raw):
    strings = []
    attrs = {}
    offset = 8  # 跳過最外層 XML chunk 的表頭
    while offset + 8 <= len(raw):
        chunk_type, header_size, size = struct.unpack("<HHI", raw[offset:offset + 8])
        if size == 0:
            break
        if chunk_type == CHUNK_STRING_POOL:
            strings = _read_string_pool(raw, offset, header_size, size)
        elif chunk_type == CHUNK_START_ELEMENT:
            p = offset + header_size
            _ns, name_idx = struct.unpack("<ii", raw[p:p + 8])
            attr_start, attr_size, attr_count = struct.unpack("<HHH", raw[p + 8:p + 14])
            element = strings[name_idx]
            if element in ("manifest", "uses-sdk"):
                base = p + attr_start
                for i in range(attr_count):
                    a = base + i * attr_size
                    _ans, key_idx, raw_value = struct.unpack("<iii", raw[a:a + 12])
                    value_type = raw[a + 15]
                    value_data = struct.unpack("<i", raw[a + 16:a + 20])[0]
                    if raw_value >= 0 and value_type == TYPE_STRING:
                        value = strings[raw_value]
                    elif value_type == TYPE_INT_DEC:
                        value = value_data
                    else:
                        value = strings[raw_value] if raw_value >= 0 else value_data
                    if key_idx >= 0:
                        attrs.setdefault(strings[key_idx], value)
        offset += size
    return attrs


# --- APK Signing Block ------------------------------------------------------
#
# 版面：uint64 長度 / 一串 (uint64 長度, uint32 id, 值) / uint64 長度 / 16 byte magic。
# v2 (0x7109871a) 與 v3 (0xf05368c0) 區塊的前兩個欄位都是 digests、certificates，
# 所以同一套拆法就夠拿到憑證。

MAGIC = b"APK Sig Block 42"
SCHEME_BLOCKS = [(0x7109871A, "v2"), (0xF05368C0, "v3"), (0x1B93AD61, "v3.1")]


def _length_prefixed(buf, offset):
    length = struct.unpack("<I", buf[offset:offset + 4])[0]
    return buf[offset + 4:offset + 4 + length], offset + 4 + length


def signing_certificate(data):
    magic_at = data.rfind(MAGIC)
    if magic_at < 24:
        return None, []

    block_size = struct.unpack("<Q", data[magic_at - 8:magic_at])[0]
    block_start = magic_at + 16 - 8 - block_size
    end = magic_at - 8

    found = {}
    offset = block_start + 8
    while offset + 12 <= end:
        pair_len = struct.unpack("<Q", data[offset:offset + 8])[0]
        if pair_len < 4 or offset + 8 + pair_len > end + 8:
            break
        pair_id = struct.unpack("<I", data[offset + 8:offset + 12])[0]
        found[pair_id] = data[offset + 12:offset + 8 + pair_len]
        offset += 8 + pair_len

    schemes = [name for block_id, name in SCHEME_BLOCKS if block_id in found]
    cert = None
    for block_id, _name in SCHEME_BLOCKS:
        if block_id not in found:
            continue
        try:
            signers, _ = _length_prefixed(found[block_id], 0)
            signer, _ = _length_prefixed(signers, 0)
            signed_data, _ = _length_prefixed(signer, 0)
            _digests, pos = _length_prefixed(signed_data, 0)
            certificates, _ = _length_prefixed(signed_data, pos)
            cert, _ = _length_prefixed(certificates, 0)
            break
        except (struct.error, IndexError):
            continue
    return cert, schemes


# --- 對外 -------------------------------------------------------------------

def inspect(path):
    data = open(path, "rb").read()

    with zipfile.ZipFile(path) as zf:
        manifest = parse_manifest(zf.read("AndroidManifest.xml"))
        abis = sorted({
            name.split("/")[1]
            for name in zf.namelist()
            if name.startswith("lib/") and name.count("/") >= 2
        })
        has_v1 = any(n.startswith("META-INF/") and n.endswith((".RSA", ".DSA", ".EC"))
                     for n in zf.namelist())

    cert, schemes = signing_certificate(data)
    if has_v1:
        schemes = ["v1"] + schemes

    min_sdk = int(manifest.get("minSdkVersion", 0) or 0)
    info = {
        "package": manifest.get("package"),
        "version": manifest.get("versionName"),
        "versionCode": int(manifest.get("versionCode", 0) or 0),
        "minSdk": min_sdk,
        "minAndroid": ANDROID_RELEASE.get(min_sdk, str(min_sdk)),
        "targetSdk": int(manifest.get("targetSdkVersion", 0) or 0),
        "abis": abis,
        "size": os.path.getsize(path),
        "sha256": hashlib.sha256(data).hexdigest(),
        "certSha256": hashlib.sha256(cert).hexdigest() if cert else None,
        "signingSchemes": schemes,
    }
    return info


# 只列 minSdk 可能落在的區間，不必是完整表。
ANDROID_RELEASE = {
    21: "5.0", 22: "5.1", 23: "6.0", 24: "7.0", 25: "7.1", 26: "8.0", 27: "8.1",
    28: "9", 29: "10", 30: "11", 31: "12", 32: "12L", 33: "13", 34: "14", 35: "15",
}


def main():
    if len(sys.argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    print(json.dumps(inspect(sys.argv[1]), indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())

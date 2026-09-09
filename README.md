# Live Translator — Android 下載站

[Auto-Translater-Frontend-Android](https://github.com/aieverywheresakura/Auto-Translater-Frontend-Android)
（私有倉庫）編出來的 APK 發給使用者的地方。純靜態，沒有建置步驟，部署在
Cloudflare Pages：

| 網址 | 用途 |
| --- | --- |
| `https://download.aieverywhere.top/` | 正式網址，對外都用這個 |
| `https://aieverywhere.pages.dev/` | Pages 自帶網址，自訂網域出事時的備援 |

iOS 版不走這裡，Apple 只允許 App Store：
[apps.apple.com/us/app/livetranslator/id6757924636](https://apps.apple.com/us/app/livetranslator/id6757924636)。
`/download/ios/` 與 `/ios` 都會跳過去，免得有人以為那個路徑底下藏了個 `.ipa`。

App 沒有上架 Google Play，所以這一頁就是唯一的官方來源。頁面本身要能回答
「這個檔案能不能信」，所以校驗值、簽名指紋、系統警告的說明都在上面。

這個倉庫是公開的，而 App 的原始碼倉庫不是。這裡沒有秘密可洩漏：APK、雜湊、
簽名憑證指紋本來就是要讓每個人都看得到才有意義——校驗值只有一個人知道的話，
它就不能證明任何事。簽名金鑰不在這裡，在 Android 倉庫的 Actions secrets 裡。

## 目錄結構

```text
.
├── index.html            下載頁（沒有 JS 時顯示的值寫死在裡面，是後備）
├── 404.html
├── version.json          版本資訊的唯一來源，JS 從這裡讀
├── _headers              Cloudflare Pages 回應標頭：APK 型別、快取、CSP
├── _redirects            /latest.apk 之類的固定網址
├── robots.txt            擋爬蟲抓 APK
├── sitemap.xml
├── site.webmanifest
├── assets/               圖示
├── css/style.css
├── js/main.js            讀 version.json、三語切換、複製雜湊
├── download/
│   ├── android/          APK，檔名帶版本號
│   └── ios/index.html    路標：跳去 App Store（iOS 不可能有自行發佈的安裝檔）
└── tools/
    ├── apkinfo.py        從 APK 讀版本、雜湊、簽名指紋（不需要 Android SDK）
    ├── release.py        發版：把上面全部改齊
    └── check.py          驗證三邊一致，提交前跑
```

### 為什麼 APK 的檔名帶版本號

`app.apk` 這種固定檔名配上 CDN 快取，最容易出的事是使用者下載到上一版而毫無徵兆。
檔名帶版本號之後，同一個 URL 的內容永遠不變，`_headers` 才敢對它下
`immutable` 一年的快取；要一個不隨版本改的網址就走 `_redirects` 的 `/latest.apk`，
那是 302，不會被快取住。

## 發一個新版

先從 Android 倉庫的 [GitHub Actions Artifacts](https://github.com/aieverywheresakura/Auto-Translater-Frontend-Android/actions)（需要該私有倉庫的權限）下載 `livetranslator-release-apk`，
解開得到 `app-release.apk`（**不是** `app-release-unsigned.apk`，那個裝不了），然後：

```bash
./tools/release.py ~/Downloads/app-release.apk --notes notes.json
```

`notes.json` 是更新說明，三種語言都要：

```json
{
  "zh-Hant": ["這一版做了什麼"],
  "zh-Hans": ["这一版做了什么"],
  "en": ["What changed in this release"]
}
```

沒給 `--notes` 也可以，之後自己補進 `version.json` 的 `latest.notes`。

腳本會做這些事：

1. 從 APK 直接讀出版本號、versionCode、minSdk、支援架構、SHA-256 與簽名憑證指紋——
   不接受手動輸入，抄錯一位的下場是使用者照著頁面校驗一定失敗。
2. 擋掉三種發不得的情況：套件名不對、簽名憑證跟線上不同（換金鑰會讓所有人
   無法覆蓋更新）、versionCode 沒有變大（Android 會當成降級而拒絕安裝）。
3. 複製成 `download/android/LiveTranslator-<版本>.apk`。
4. 把舊版推進 `version.json` 的 `history`，預設留兩個。
5. 把 `version.json`、`_redirects`、`index.html` 裡所有寫死的版本資訊改齊。

改完先驗一次再看頁面，然後提交：

```bash
./tools/check.py              # version.json / index.html / _redirects 三邊對得上嗎
python3 -m http.server 8000   # 開 http://localhost:8000 看實際畫面
git add -A && git commit -m "Release v2.4.0" && git push
```

`check.py` 會重算 APK 的雜湊，再跟三份檔案比對，回傳碼非 0 就是有地方沒改齊，
可以直接掛在 CI 上。

push 之後 Cloudflare Pages 會自動部署。

### 只想看 APK 的資訊

```bash
./tools/apkinfo.py some.apk
```

會印出版本、雜湊、簽名指紋、支援架構。`apkinfo.py` 自己解二進位
`AndroidManifest.xml` 與 APK Signing Block，不需要裝 Android SDK。

### 倉庫大小

每發一版就多一個十幾 MB 的檔案，而且 git 歷史裡刪不掉。`--prune` 只是把超出
保留數的檔案從工作區移除，倉庫還是會一直長。發了十幾版之後如果覺得 clone 太慢，
就改成 [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)：
APK 不進版控，改用 `wrangler pages deploy` 上傳。

Cloudflare Pages 單檔上限 25 MiB，目前的 APK 12.6 MB，還有餘裕；哪天 APK 逼近
這條線就得改用外部儲存（R2）而不是繼續塞進 Pages。

## 日常維護

大部分時候要做的事只有一件（發版），其他都是偶爾。按情況對照：

| 情況 | 做什麼 |
| --- | --- |
| App 出了新版 | `./tools/release.py <APK> --notes notes.json`，見上一節 |
| 只改文案、樣式、FAQ | 直接改 `index.html` / `css` / `js`，跑 `./tools/check.py`，push |
| 加一種語言 | `js/main.js` 的 `I18N` 加一份字典、`LANGS` 加代碼、頁首加一顆按鈕 |
| 改了版本號或雜湊 | 別手改。真的手改了，`./tools/check.py` 一定要是綠的才能 push |
| 換簽名金鑰 | 先在頁面上公告舊指紋要換成什麼，再 `--allow-key-change`（見最後一節） |
| 倉庫太大 | 見〈倉庫大小〉，改用 Direct Upload |

改任何東西之前記得 `git pull`——Cloudflare Pages 不會改倉庫，但你可能在別台機器上改過。

### 文字改在哪裡

一段話只存一份，看語言決定在哪：

- **繁體中文**改 `index.html`。頁面上帶 `data-i18n` 的元素，它的內文就是繁體版本，
  也是沒有 JS 時顯示的東西；`js/main.js` 開場會把這些字收進字典，所以改 HTML 就夠了。
- **簡體與英文**改 `js/main.js` 裡 `I18N` 的 `zh-Hans` / `en`，鍵就是 `data-i18n` 的值。
- 只有 JS 會用到、頁面上沒有的句子（複製成功的提示、非 Android 裝置的提醒），
  三種語言都寫在 `I18N` 裡，`zh-Hant` 那份只剩這幾句。

新增一個鍵就在 HTML 標 `data-i18n="新的鍵"`，再去 `zh-Hans` 和 `en` 各補一行；
漏補的話會退回繁體，不會變成空白。

版本、大小、雜湊那幾個欄位不在此列——那些 HTML 與 `version.json` 兩邊都有，
由 `release.py` 一起改，`check.py` 會盯。

### 每次 push 之後

GitHub Actions 會跑 `tools/check.py`（見 `.github/workflows/check.yml`），
Cloudflare Pages 會自動部署。兩邊都綠了再去看實際網站：

```bash
# 線上的版本資訊是不是新的
curl -s https://download.aieverywhere.top/version.json | python3 -m json.tool

# /latest.apk 有沒有指到新檔案，型別對不對
curl -sI https://download.aieverywhere.top/latest.apk

# 最實在的一項：真的下載下來算一次，要跟頁面上印的一致
curl -sL https://download.aieverywhere.top/latest.apk | shasum -a 256
```

最後那一條算的是**使用者真正拿到的位元組**，中間經過 CDN、快取、重寫規則。
本機 `check.py` 綠燈只代表倉庫是對的，這一條才代表線上是對的。

## Cloudflare Pages 設定

專案是純靜態，不需要建置：

| 項目 | 值 |
| --- | --- |
| Framework preset | None |
| Build command | 留空 |
| Build output directory | `/` |

`_headers` 與 `_redirects` 必須在輸出目錄的根，也就是跟 `index.html` 同一層。

### 第一次綁定網域

Pages 專案建好之後預設只有 `<專案名>.pages.dev`。正式網址在專案的
**Custom domains** 加 `download.aieverywhere.top`，Cloudflare 會自己在
`aieverywhere.top` 的 DNS 補一筆 CNAME（網域本來就託管在 Cloudflare 的話）。
憑證幾分鐘內簽好，在那之前開會看到 TLS 錯誤，是正常的。

`pages.dev` 那個網址不要停用——自訂網域的 DNS 或憑證出問題時，它是唯一還能
發 APK 出去的路，頁面上也印著它當備援。

### `_headers` 在管什麼

- APK 明寫 `Content-Type: application/vnd.android.package-archive` 與
  `Content-Disposition: attachment`。Pages 對 `.apk` 的預設型別不保證，
  猜錯的話瀏覽器會試著預覽而不是下載。
- 帶版本號的 APK 給 `immutable`，一年；`version.json` 只給五分鐘，
  發版後要能馬上看到新的。
- `version.json` 開 `Access-Control-Allow-Origin: *`，讓 App 或其他站點也能
  拿它做更新檢查。
- CSP 只允許同源，頁面本來就沒有任何外部資源。

## 版本資訊格式

`version.json` 是頁面唯一的事實來源，`index.html` 裡那份寫死的值只在 JS 沒跑起來
時頂著。兩邊必須一致——不一致的話，關掉 JS 的訪客會看到舊的雜湊卻下載到新檔案，
於是校驗必然失敗。`release.py` 存在的理由就是這個，別用手改。

`history` 陣列空的時候，頁面上的「歷史版本」整段會自動隱藏。

## 簽名金鑰

所有版本用同一把金鑰簽名，憑證指紋是

```text
5f115aedaff29add0e2f5d175ee01b9e6699b324d19908178bda72722e078aac
```

這個值印在下載頁上，使用者可以用 `apksigner verify --print-certs` 比對。
它跨版本不變，變了就代表金鑰換過——那必須事先公告，否則使用者沒有理由相信新的那把。
金鑰本身在 Android 倉庫的 GitHub Actions secrets 裡，不在這裡。

弄丟金鑰的後果是所有現有使用者都得先解除安裝才能更新，資料一起沒有。自行發佈的
APK 沒有 Play App Signing 那層保險。

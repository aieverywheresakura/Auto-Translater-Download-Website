/*
 * 下載頁的全部行為。三件事：
 *   1. 從 version.json 把版本／大小／雜湊填進頁面，HTML 裡的值只是沒有 JS 時的後備。
 *   2. 三種語言切換，記在 localStorage。
 *   3. 複製雜湊、提醒非 Android 訪客。
 *
 * 沒有建置步驟，所以刻意只用瀏覽器原生 API。
 */
(function () {
  'use strict';

  var LANGS = ['zh-Hant', 'zh-Hans', 'en'];
  var STORAGE_KEY = 'lt-download-lang';

  var I18N = {
    'zh-Hant': {
      'html.title': 'Live Translator for Android — 官方 APK 下載',
      'skip': '跳到下載',
      'brand.sub': 'Android 版',
      'hero.eyebrow': '官方安裝檔',
      'hero.title': '即時語音翻譯，裝進你的 Android',
      'hero.lede': '會議、課堂、直播與跨境協作的即時語音與文字翻譯。這裡是唯一的官方下載點，其他來源的安裝檔我們無法擔保。',
      'download.cta': '下載 APK',
      'spec.os': '系統需求',
      'spec.abi': '支援架構',
      'spec.pkg': '套件名稱',
      'spec.osValue': 'Android {v} 以上',
      'changelog.title': '這一版有什麼',
      'mirror.label': '主站無法連線時的備援：',
      'verify.title': '安裝前先驗一下',
      'verify.intro': '側載的風險在於你不知道手上的檔案有沒有被換過。下面兩個值可以各自回答一半：第一個確認檔案本身沒被動過，第二個確認它確實是我們簽的。',
      'verify.file': 'APK 檔案 SHA-256',
      'verify.cert': '簽名憑證 SHA-256',
      'verify.how': '怎麼比對',
      'verify.howFile': '檔案雜湊在自己的電腦上算：',
      'verify.howCert': '憑證指紋要用 Android SDK 的 apksigner，它讀的是簽名區塊而不是檔案內容：',
      'verify.note': '憑證指紋跨版本不變。哪天它變了，代表簽名金鑰換了——那必須是我們公開說明過的事，否則就別裝。',
      'copy': '複製',
      'copied': '已複製',
      'copyFailed': '複製失敗，請手動選取',
      'install.title': '安裝步驟',
      'install.s1.t': '下載 APK',
      'install.s1.d': '用手機的瀏覽器直接開這一頁最省事。在電腦上下載的話，記得把檔案傳進手機再開啟。',
      'install.s2.t': '允許這個來源安裝',
      'install.s2.d': '點開下載好的檔案，系統會擋一次。照著提示進「設定 → 安裝未知應用程式」，把當下這個瀏覽器或檔案管理器打開權限，再回來繼續。這個開關是給那一個 App 的，不是全域的。',
      'install.s3.t': '安裝並登入',
      'install.s3.d': '安裝完第一次啟動會要求麥克風權限，那是語音輸入用的。沒有帳號的話可以直接在 App 內註冊。',
      'perm.title': 'App 要哪些權限',
      'perm.h1': '權限',
      'perm.h2': '用途',
      'perm.mic': '錄下你說的話拿去辨識與翻譯。不開就只能用文字翻譯。',
      'perm.net': '翻譯在伺服器上做，必須連網。',
      'perm.state': '判斷斷線，好決定要不要重連。',
      'faq.title': '常見問題',
      'faq.q1': '為什麼不上 Google Play？',
      'faq.a1': '主要使用者在中國大陸，那裡的手機大多沒有 Play 商店，上架也到不了他們手上。自行發佈的 APK 反而是所有地區都能裝的那一個。',
      'faq.q2': '系統說「這個檔案可能有害」，正常嗎？',
      'faq.a2': '正常。Android 對所有不是從商店來的安裝檔都這樣提示，它警告的是來源不明，不是檔案本身有問題。你可以先比對上面的 SHA-256 再決定要不要繼續。',
      'faq.q3': '中國大陸的手機能用嗎？',
      'faq.a3': '能。App 完全不依賴 Google Play 服務，預設的語音辨識走我們自己的伺服器。個人資料頁裡另一個「裝置端辨識」選項要靠手機自己的語音辨識服務，沒有的機器會自動變成灰色，那是預期行為。',
      'faq.q4': '更新要先解除安裝嗎？',
      'faq.a4': '不用。每一版都用同一把金鑰簽名，直接覆蓋安裝就好，資料和登入狀態都會留著。反過來說，如果系統拒絕覆蓋並說簽章不符，那個檔案就不是我們發的。',
      'faq.q5': '有 iOS 版嗎？',
      'faq.a5': '有，功能與這一版對齊。網頁版不用安裝，開瀏覽器就能用。',
      'history.title': '歷史版本',
      'history.note': '舊版只在需要退回時使用，一般情況請裝最新版。',
      'history.download': '下載',
      'footer.web': '網頁版',
      'footer.ios': 'iOS 版',
      'footer.manifest': '版本資訊 JSON',
      'note.desktop': '你正在用電腦瀏覽。APK 要裝在 Android 手機上，先下載再傳進手機開啟。',
      'note.ios': '這是 Android 安裝檔，iPhone 與 iPad 裝不了。請改用 iOS 版或網頁版。'
    },

    'zh-Hans': {
      'html.title': 'Live Translator for Android — 官方 APK 下载',
      'skip': '跳到下载',
      'brand.sub': 'Android 版',
      'hero.eyebrow': '官方安装包',
      'hero.title': '实时语音翻译，装进你的 Android',
      'hero.lede': '会议、课堂、直播与跨境协作的实时语音与文字翻译。这里是唯一的官方下载点，其他来源的安装包我们无法担保。',
      'download.cta': '下载 APK',
      'spec.os': '系统要求',
      'spec.abi': '支持架构',
      'spec.pkg': '包名',
      'spec.osValue': 'Android {v} 及以上',
      'changelog.title': '这一版有什么',
      'mirror.label': '主站打不开时的备用地址：',
      'verify.title': '安装前先验一下',
      'verify.intro': '旁加载的风险在于你不知道手上的文件有没有被换过。下面两个值各回答一半：第一个确认文件本身没被动过，第二个确认它确实是我们签的。',
      'verify.file': 'APK 文件 SHA-256',
      'verify.cert': '签名证书 SHA-256',
      'verify.how': '怎么比对',
      'verify.howFile': '文件哈希在自己的电脑上算：',
      'verify.howCert': '证书指纹要用 Android SDK 的 apksigner，它读的是签名块而不是文件内容：',
      'verify.note': '证书指纹跨版本不变。哪天它变了，说明签名密钥换了——那必须是我们公开说明过的事，否则就别装。',
      'copy': '复制',
      'copied': '已复制',
      'copyFailed': '复制失败，请手动选取',
      'install.title': '安装步骤',
      'install.s1.t': '下载 APK',
      'install.s1.d': '用手机浏览器直接打开这一页最省事。在电脑上下载的话，记得把文件传进手机再打开。',
      'install.s2.t': '允许这个来源安装',
      'install.s2.d': '点开下载好的文件，系统会拦一次。按提示进「设置 → 安装未知应用」，给当前这个浏览器或文件管理器开权限，再回来继续。这个开关是给那一个 App 的，不是全局的。',
      'install.s3.t': '安装并登录',
      'install.s3.d': '装完第一次启动会要麦克风权限，那是语音输入用的。没有账号可以直接在 App 内注册。',
      'perm.title': 'App 要哪些权限',
      'perm.h1': '权限',
      'perm.h2': '用途',
      'perm.mic': '录下你说的话拿去识别与翻译。不开就只能用文字翻译。',
      'perm.net': '翻译在服务器上做，必须联网。',
      'perm.state': '判断断线，好决定要不要重连。',
      'faq.title': '常见问题',
      'faq.q1': '为什么不上 Google Play？',
      'faq.a1': '主要用户在中国大陆，那里的手机大多没有 Play 商店，上架也到不了他们手上。自行发布的 APK 反而是所有地区都能装的那一个。',
      'faq.q2': '系统提示「这个文件可能有害」，正常吗？',
      'faq.a2': '正常。Android 对所有不是从商店来的安装包都这样提示，它警告的是来源不明，不是文件本身有问题。你可以先比对上面的 SHA-256 再决定要不要继续。',
      'faq.q3': '国内的手机能用吗？',
      'faq.a3': '能。App 完全不依赖 Google Play 服务，默认的语音识别走我们自己的服务器。个人资料页里另一个「设备端识别」选项要靠手机自带的语音识别服务，没有的机器会自动变灰，那是预期行为。',
      'faq.q4': '更新要先卸载吗？',
      'faq.a4': '不用。每一版都用同一把密钥签名，直接覆盖安装就行，数据和登录状态都留着。反过来说，如果系统拒绝覆盖并提示签名不一致，那个文件就不是我们发的。',
      'faq.q5': '有 iOS 版吗？',
      'faq.a5': '有，功能与这一版对齐。网页版不用安装，打开浏览器就能用。',
      'history.title': '历史版本',
      'history.note': '旧版只在需要回退时使用，一般情况请装最新版。',
      'history.download': '下载',
      'footer.web': '网页版',
      'footer.ios': 'iOS 版',
      'footer.manifest': '版本信息 JSON',
      'note.desktop': '你正在用电脑浏览。APK 要装在 Android 手机上，先下载再传进手机打开。',
      'note.ios': '这是 Android 安装包，iPhone 和 iPad 装不了。请改用 iOS 版或网页版。'
    },

    'en': {
      'html.title': 'Live Translator for Android — Official APK',
      'skip': 'Skip to download',
      'brand.sub': 'for Android',
      'hero.eyebrow': 'Official build',
      'hero.title': 'Real-time translation, on your Android phone',
      'hero.lede': 'Live speech and text translation for meetings, classes, livestreams and cross-border work. This is the only official download; we cannot vouch for builds from anywhere else.',
      'download.cta': 'Download APK',
      'spec.os': 'Requires',
      'spec.abi': 'Architectures',
      'spec.pkg': 'Package',
      'spec.osValue': 'Android {v} or later',
      'changelog.title': "What's in this release",
      'mirror.label': 'Mirror, if this domain is unreachable:',
      'verify.title': 'Verify before you install',
      'verify.intro': 'The risk in sideloading is not knowing whether the file you hold is the file we built. These two values each answer half of that: the first says the file is untouched, the second says we signed it.',
      'verify.file': 'APK SHA-256',
      'verify.cert': 'Signing certificate SHA-256',
      'verify.how': 'How to compare',
      'verify.howFile': 'Hash the file on your own machine:',
      'verify.howCert': "The certificate fingerprint needs apksigner from the Android SDK — it reads the signing block, not the file's bytes:",
      'verify.note': 'The certificate fingerprint does not change between releases. If it ever does, the signing key was rotated — something we would announce first. Otherwise, do not install.',
      'copy': 'Copy',
      'copied': 'Copied',
      'copyFailed': 'Copy failed — select it manually',
      'install.title': 'How to install',
      'install.s1.t': 'Download the APK',
      'install.s1.d': "Opening this page in the phone's own browser is the shortest path. If you download on a computer, move the file to the phone before opening it.",
      'install.s2.t': 'Allow this source to install apps',
      'install.s2.d': 'Android blocks the first attempt. Follow the prompt into Settings → Install unknown apps and grant it to the browser or file manager you are using, then come back. The switch applies to that one app, not to the system.',
      'install.s3.t': 'Install and sign in',
      'install.s3.d': 'On first launch the app asks for the microphone, which is what speech input needs. You can register an account inside the app.',
      'perm.title': 'Permissions the app requests',
      'perm.h1': 'Permission',
      'perm.h2': 'Why',
      'perm.mic': 'Captures what you say for recognition and translation. Without it, only text translation works.',
      'perm.net': 'Translation runs on our servers, so the app needs a connection.',
      'perm.state': 'Detects dropped connections so the app knows when to reconnect.',
      'faq.title': 'Questions',
      'faq.q1': 'Why not Google Play?',
      'faq.a1': 'Most of our users are in mainland China, where phones generally ship without the Play Store — listing there would not reach them. A self-hosted APK is the one build that installs everywhere.',
      'faq.q2': 'Android warns that the file may be harmful. Is that expected?',
      'faq.a2': 'Yes. Android shows that for every install that did not come from a store; it is warning about the source, not about this file. Compare the SHA-256 above if you want certainty before continuing.',
      'faq.q3': 'Does it work on phones in mainland China?',
      'faq.a3': 'Yes. The app has no dependency on Google Play services, and the default speech recognition runs on our own servers. The alternative on-device engine in Profile needs a recognition service on the phone; where none exists the option is greyed out, which is expected.',
      'faq.q4': 'Do I have to uninstall before updating?',
      'faq.a4': 'No. Every release is signed with the same key, so installing over the top keeps your data and session. Conversely, if Android refuses the update over a signature mismatch, that file did not come from us.',
      'faq.q5': 'Is there an iOS version?',
      'faq.a5': 'Yes, with the same feature set. The web version needs no install at all.',
      'history.title': 'Earlier versions',
      'history.note': 'Only for rolling back. Install the latest release unless you have a reason not to.',
      'history.download': 'Download',
      'footer.web': 'Web app',
      'footer.ios': 'iOS app',
      'footer.manifest': 'Release manifest',
      'note.desktop': 'You are on a desktop browser. An APK installs on an Android phone — download it here, then move it to the phone.',
      'note.ios': 'This is an Android package; it will not install on iPhone or iPad. Use the iOS app or the web version instead.'
    }
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var manifest = null;

  /* ---------- language ---------- */

  function stored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function detect() {
    var saved = stored();
    if (LANGS.indexOf(saved) !== -1) return saved;
    var tags = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en'];
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i].toLowerCase();
      if (tag.indexOf('zh') !== 0) continue;
      // 只有明確的繁體地區才給繁體；zh-CN、zh-SG 與光禿禿的 zh 都走簡體。
      return /hant|\b(tw|hk|mo)\b/.test(tag) ? 'zh-Hant' : 'zh-Hans';
    }
    return 'en';
  }

  function t(key) {
    var lang = document.documentElement.getAttribute('data-lang') || 'zh-Hant';
    var dict = I18N[lang] || I18N['zh-Hant'];
    return dict[key] != null ? dict[key] : (I18N['zh-Hant'][key] || key);
  }

  function applyLang(lang) {
    if (LANGS.indexOf(lang) === -1) lang = 'zh-Hant';
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.lang = lang === 'en' ? 'en' : (lang === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant');
    document.title = t('html.title');

    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }

    var buttons = document.querySelectorAll('.lang button');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].setAttribute('aria-pressed', String(buttons[j].getAttribute('data-lang') === lang));
    }

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* 無痕模式，算了 */ }

    // 這幾塊的文字是拼出來的，語言換了得重畫。
    renderRelease();
    renderHistory();
    renderPlatformNote();
  }

  /* ---------- release data ---------- */

  function formatSize(bytes) {
    if (!bytes) return '';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function setText(sel, text) {
    var el = $(sel);
    if (el && text) el.textContent = text;
  }

  function renderRelease() {
    if (!manifest || !manifest.latest) return;
    var r = manifest.latest;

    setText('#version-badge', 'v' + r.version);
    setText('#release-date', r.released);
    setText('#spec-os', t('spec.osValue').replace('{v}', r.minAndroid));
    if (r.abis) setText('#spec-abi', r.abis.join(' · '));
    setText('#sha-file', r.sha256);

    if (manifest.signing) {
      setText('#sha-cert', manifest.signing.certSha256);
      setText('#cert-subject', manifest.signing.subject);
    }

    var btn = $('#download-btn');
    if (btn && r.file) btn.setAttribute('href', r.file);
    setText('#download-meta', formatSize(r.size));

    var lang = document.documentElement.getAttribute('data-lang') || 'zh-Hant';
    var notes = r.notes && (r.notes[lang] || r.notes['en']);
    var list = $('#changelog-list');
    if (list && notes) {
      list.textContent = '';
      notes.forEach(function (line) {
        var li = document.createElement('li');
        li.textContent = line;
        list.appendChild(li);
      });
    }
  }

  function renderHistory() {
    var section = $('#history');
    var list = $('#history-list');
    if (!section || !list) return;

    var items = (manifest && manifest.history) || [];
    if (!items.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    list.textContent = '';

    items.forEach(function (item) {
      var li = document.createElement('li');

      var a = document.createElement('a');
      a.href = item.file;
      a.setAttribute('download', '');
      a.textContent = 'v' + item.version;
      li.appendChild(a);

      var meta = document.createElement('span');
      meta.className = 'muted';
      meta.textContent = [item.released, formatSize(item.size)].filter(Boolean).join(' · ');
      li.appendChild(meta);

      list.appendChild(li);
    });
  }

  function renderPlatformNote() {
    var note = $('#platform-note');
    if (!note) return;
    var ua = navigator.userAgent || '';
    var key = null;

    if (/Android/i.test(ua)) {
      key = null;
    } else if (/iPhone|iPad|iPod/i.test(ua) ||
               (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      key = 'note.ios';
    } else {
      key = 'note.desktop';
    }

    if (key) {
      note.textContent = t(key);
      note.hidden = false;
    } else {
      note.hidden = true;
    }
  }

  /* ---------- copy ---------- */

  function toast(message) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.hidden = true; }, 1800);
  }

  // 舊瀏覽器、http 來源、以及使用者沒給剪貼簿權限的情況，clipboard API
  // 會不存在或直接被拒絕。所以是先試新的、失敗再退回 execCommand，而不是
  // 只看 API 在不在——被拒絕的那條路比不存在常見得多。
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('execCommand copy failed'));
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  /* ---------- wiring ---------- */

  document.addEventListener('click', function (event) {
    var langBtn = event.target.closest('.lang button');
    if (langBtn) {
      applyLang(langBtn.getAttribute('data-lang'));
      return;
    }

    var copyBtn = event.target.closest('.copy');
    if (copyBtn) {
      var target = $(copyBtn.getAttribute('data-copy'));
      if (!target) return;
      copyText(target.textContent.trim()).then(
        function () { toast(t('copied')); },
        function () { toast(t('copyFailed')); }
      );
    }
  });

  applyLang(detect());
  renderPlatformNote();

  // version.json 是版本資訊的唯一來源；HTML 裡那份只是它抓不到時的後備，
  // 所以抓失敗就安靜地留著頁面原本的值，不要清空或報錯。
  fetch('version.json', { cache: 'no-cache' })
    .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error(res.status)); })
    .then(function (data) {
      manifest = data;
      renderRelease();
      renderHistory();
    })
    .catch(function () { /* 後備值已經在頁面上了 */ });
})();

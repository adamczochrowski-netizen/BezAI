/* Bez AI – skrypt treści. Szuka sygnałów AI na stronie i ukrywa/rozmywa posty, w których je znalazł.
   Sygnały: etykieta platformy ("Treści utworzone przez SI"), hashtag z listy, fraza z listy,
   link do konta z listy, a na Instagramie/Threads także dane posta (ai_label_info + pełny opis). */
(function () {
  'use strict';

  const AIB = globalThis.AIB;
  if (!AIB || globalThis.__aibContentLoaded) return;
  globalThis.__aibContentLoaded = true;

  // __AIB_SITE__ pozwala testom udawać daną stronę na localhost.
  const siteKey =
    (typeof window.__AIB_SITE__ === 'string' && AIB.SITES[window.__AIB_SITE__] && window.__AIB_SITE__) ||
    AIB.siteKeyForHost(location.hostname);
  if (!siteKey) return;
  const site = AIB.SITES[siteKey];

  const HASHTAG_RE = /#([\p{L}\p{N}_]+)/gu;
  // Etykiety AI rozpoznawane wzorcem, np. "Treści utworzone przez SI", "Prawdopodobnie utworzone przy użyciu SI".
  const LABEL_PATTERNS = [
    /^(?:(?:treści|treść|profil|konto|obraz|zdjęcie|wideo|film)\s+)?(?:prawdopodobnie\s+)?(?:utworzon|wygenerowan|stworzon|zmodyfikowan|edytowan|zmienion)\S*\s+(?:przez|przy\s+użyciu|z\s+użyciem|za\s+pomocą)\s+(?:si|ai|sztuczn\S*(?:\s+inteligencj\S*)?)$/u,
    /^(?:(?:content|profile|image|photo|video)\s+)?(?:probably\s+|likely\s+)?(?:made|created|generated|edited|modified|imagined)\s+(?:with|by|using)\s+(?:meta\s+)?ai$/u,
    /^ai[- ]generated(?:\s+(?:content|profile|image|photo|video))?$/u,
    /^informacje o (?:si|ai)$/u
  ];
  const CODE_PATH_RE = /\/(?:p|reel|reels|tv|post)\/([A-Za-z0-9_-]{5,})/;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'TEMPLATE', 'OPTION']);
  const EDITABLE_SEL = '[contenteditable]:not([contenteditable="false"]), textarea, input, [role="textbox"]';
  const PERMALINK_SEL = [
    'a[href*="/p/"]', 'a[href*="/reel/"]', 'a[href*="/posts/"]', 'a[href*="/status/"]',
    'a[href*="/watch?"]', 'a[href*="/shorts/"]', 'a[href*="/comments/"]', 'a[href*="/permalink/"]',
    'a[href*="story_fbid"]', 'a[href*="/videos/"]', 'a[href*="/post/"]'
  ].join(',');
  const BIG_MEDIA = 200; // px – minimalny rozmiar "dużego" zdjęcia/wideo
  // Post oznaczony mocnym sygnałem – w środku nie trzeba już szukać. Słabo oznaczony (tylko rozmyty)
  // skanujemy dalej, bo mocniejszy sygnał może pojawić się później (np. hashtag w doczytanym opisie).
  const STRONG_FLAG = '[data-aib-flagged]:not([data-aib-weak])';

  let settings = null;
  let active = false;
  let observer = null;
  let labelSet = new Set();
  let hashtagSet = new Set();
  let accountSet = new Set();
  let ownAccountSet = new Set();
  let trustedSet = new Set();
  let keywordRe = null;
  let sharedListData = {}; // pobrane wspólne listy (chrome.storage.local)

  let pending = new Set();
  let flushTimer = 0;

  // Dane postów z page-hook.js: kod → {ai, caption, user}; kod → powód ukrycia (albo null).
  const mediaItems = new Map();
  const mediaReasons = new Map();
  let urlTimer = 0;

  // Liczniki: pageCount = ile postów jest teraz oflagowanych; totalKeys = co już doliczyliśmy do "łącznie".
  let pageKeys = new Set();
  const totalKeys = new Set();
  let pageCount = 0;
  let unsentAdded = 0;
  let reportTimer = 0;
  let elementIds = new WeakMap();
  let nextElementId = 1;
  const revealedAt = new WeakMap();

  // Komentarze botów
  const BOTS = globalThis.AIBBots;
  const PROFILE_PATH_RE = /^\/([\w.]+)\/?$/;
  const RESERVED_PATHS = new Set(['explore', 'reels', 'reel', 'p', 'direct', 'accounts', 'stories', 'about',
    'legal', 'privacy', 'terms', 'developer', 'web', 'emails', 'challenge', 'tv', 'home', 'search', 'notifications']);
  let botOpts = {};
  let botCount = 0;
  let botKeys = new Set();
  let evaluated = new WeakMap(); // wiersz → długość tekstu przy ostatniej ocenie
  let textUsers = new Map(); // tekst → konta, które go napisały (wykrywanie kopiuj-wklej)
  let textRows = new Map(); // tekst → wiersze z tym tekstem
  let userTextRows = new Map(); // konto|tekst → wiersze (zalew od jednego konta)
  const commentData = new Map(); // konto → dane komentarzy z page-hook (Instagram)
  const rowLists = new WeakSet(); // elementy rozpoznane jako lista komentarzy

  // ---------- ustawienia ----------

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function compile() {
    labelSet = new Set(settings.labels.map(AIB.normLabel).filter(Boolean));
    hashtagSet = new Set(settings.hashtags.map(AIB.normHashtag).filter(Boolean));
    // Konta: własna lista + wspólne listy, bez "Zaufanych kont".
    trustedSet = new Set(settings.botWhitelist.map(AIB.normAccount).filter(Boolean));
    ownAccountSet = new Set(settings.accounts.map(AIB.normAccount).filter(Boolean));
    const shared = globalThis.AIBLists
      ? AIBLists.collect(settings.sharedLists, sharedListData, siteKey)
      : { ai: new Set(), bot: new Set() };
    accountSet = new Set([...ownAccountSet, ...shared.ai].filter((a) => !trustedSet.has(a)));
    const kws = Array.from(new Set(settings.keywords.map(AIB.normText).filter(Boolean)))
      .sort((a, b) => b.length - a.length);
    keywordRe = kws.length
      ? new RegExp('(?<![\\p{L}\\p{N}])(?:' + kws.map(escapeRe).join('|') + ')(?![\\p{L}\\p{N}])', 'gu')
      : null;
    botOpts = {
      phrases: settings.botPhrases,
      botAccounts: settings.botAccounts.map(AIB.normAccount).filter(Boolean),
      sharedBotAccounts: shared.bot,
      whitelist: [...trustedSet],
      sensitivity: settings.botSensitivity
    };
  }

  // ---------- wykrywanie ----------

  function isLabel(norm) {
    if (!norm) return false;
    if (labelSet.has(norm)) return true;
    for (const re of LABEL_PATTERNS) if (re.test(norm)) return true;
    return false;
  }

  function matchText(raw, allowLabel, el) {
    if (allowLabel && settings.detectLabels && raw.length <= 80) {
      if (isLabel(AIB.normLabel(raw))) return { type: 'label', text: raw.trim() };
    }
    if (!settings.detectHashtags && !settings.detectKeywords) return null;
    const t = AIB.normText(raw);
    if (settings.detectHashtags && t.includes('#')) {
      for (const m of t.matchAll(HASHTAG_RE)) {
        if (hashtagSet.has(m[1])) return { type: 'hashtag', text: '#' + m[1] };
      }
    }
    if (settings.detectKeywords && keywordRe) {
      // Fraza w pytaniu, recenzji albo newsie to raczej treść *o* AI – patrz AIB.keywordStrength.
      // Fraza w nazwie konta ("Miku AI Art") to deklaracja konta – liczy się w pełni.
      const soft = !!site.topicSoft && !(site.authorSel && el && el.closest && el.closest(site.authorSel));
      let weak = null;
      for (const m of t.matchAll(keywordRe)) {
        const s = AIB.keywordStrength(t, m.index, m[0], soft);
        if (s === 'strong') return { type: 'keyword', text: m[0] };
        if (s === 'weak' && !weak && settings.blurTopics) weak = { type: 'keyword', text: m[0], weak: true };
      }
      return weak;
    }
    return null;
  }

  function isEditable(el) {
    return !!(el && el.closest && el.closest(EDITABLE_SEL));
  }

  // Wyróżnienie fragmentu w środku zdania (YouTube pogrubia szukaną frazę: "… is <b>AI generated</b> …").
  const HIGHLIGHT_TAGS = new Set(['B', 'STRONG', 'MARK', 'EM']);

  function isIgnored(el) {
    return !!(site.ignore && el.closest(site.ignore));
  }

  function checkTextNode(node) {
    let raw = node.nodeValue;
    if (!raw || raw.length < 2) return;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName) || isIgnored(parent)) return;
    let allowLabel = true;
    if ((HIGHLIGHT_TAGS.has(parent.tagName) || parent.classList.contains('bold')) && parent.parentElement) {
      // Sprawdzone na żywo (13.11.2026): wyszukiwanie "ai generated" pogrubiało tę frazę w opisach
      // i pogrubiony kawałek wyglądał jak etykieta platformy. Oceniamy więc całe zdanie.
      const full = parent.parentElement.textContent || '';
      if (full.trim().length > raw.trim().length + 3) {
        raw = full;
        allowLabel = false;
      }
    }
    const reason = matchText(raw, allowLabel, parent);
    if (reason && !isEditable(parent)) flag(parent, reason);
  }

  function codeFromPath(path) {
    const m = CODE_PATH_RE.exec(path || '');
    return m ? m[1] : null;
  }

  function checkLink(a) {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || isIgnored(a)) return;
    let url;
    try {
      url = new URL(href, location.href);
    } catch (e) {
      return;
    }
    if (site.dataHook && mediaReasons.size) {
      const code = codeFromPath(url.pathname);
      const r = code && mediaReasons.get(code);
      if (r) {
        flag(a, r, code);
        return;
      }
    }
    if (settings.detectHashtags) {
      const m = url.pathname.match(/^\/(?:explore\/tags|hashtag)\/([^/?#]+)/i);
      if (m) {
        let tag = m[1];
        try { tag = decodeURIComponent(tag); } catch (e) { /* zostaw jak jest */ }
        tag = AIB.normHashtag(tag);
        if (hashtagSet.has(tag)) {
          if (!isEditable(a)) flag(a, { type: 'hashtag', text: '#' + tag });
          return;
        }
      }
    }
    if (settings.detectAccounts && accountSet.size) {
      const samePlatform = url.hostname === location.hostname || AIB.siteKeyForHost(url.hostname) === siteKey;
      if (!samePlatform) return;
      for (const cand of AIB.accountCandidatesFromUrl(url)) {
        if (accountSet.has(cand)) {
          if (!isEditable(a)) flag(a, { type: 'account', text: cand });
          return;
        }
      }
    }
  }

  function scanElement(root) {
    if (SKIP_TAGS.has(root.tagName)) return;

    if (settings.detectHashtags || (settings.detectAccounts && accountSet.size) || mediaReasons.size) {
      if (root.matches('a[href]')) checkLink(root);
      for (const a of root.querySelectorAll('a[href]')) checkLink(a);
    }

    if (settings.detectLabels) {
      const els = root.matches('[aria-label]') ? [root] : [];
      for (const el of root.querySelectorAll('[aria-label]')) els.push(el);
      for (const el of els) {
        const v = el.getAttribute('aria-label');
        if (v && v.length <= 80 && isLabel(AIB.normLabel(v)) && !isEditable(el) && !isIgnored(el)) {
          flag(el, { type: 'label', text: v.trim() });
        }
      }
    }

    if (settings.detectHashtags || settings.detectKeywords) {
      const imgs = root.matches('img[alt]') ? [root] : [];
      for (const img of root.querySelectorAll('img[alt]')) imgs.push(img);
      for (const img of imgs) {
        const alt = img.getAttribute('alt');
        if (alt && alt.length > 3 && !isIgnored(img)) {
          const reason = matchText(alt, false, img);
          if (reason) flag(img, reason);
        }
      }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) checkTextNode(n);

    if (settings.detectBots && BOTS) scanComments(root);
  }

  // ---------- komentarze botów ----------

  function profileUser(a) {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return null;
    let url;
    try { url = new URL(href, location.href); } catch (e) { return null; }
    if (url.hostname !== location.hostname && AIB.siteKeyForHost(url.hostname) !== siteKey) return null;
    if (siteKey === 'instagram') {
      const m = PROFILE_PATH_RE.exec(url.pathname);
      if (!m || RESERVED_PATHS.has(m[1].toLowerCase())) return null;
      return m[1].toLowerCase();
    }
    const c = AIB.accountCandidatesFromUrl(url)[0];
    return c && !RESERVED_PATHS.has(c) ? c : null;
  }

  function hasProfileLink(el) {
    for (const a of el.querySelectorAll('a[href]')) if (profileUser(a)) return true;
    return false;
  }

  function looksLikeRow(el) {
    return !!el.querySelector('img') && hasProfileLink(el);
  }

  // Instagram: wiersz komentarza = element listy, w której większość elementów ma awatar i link do profilu.
  function igCommentRow(start) {
    const stop = document.querySelector('main') || document.body;
    for (let a = start, depth = 0; a && a.parentElement && a !== stop && depth < 22; a = a.parentElement, depth++) {
      const p = a.parentElement;
      if (p.children.length < 2 || !looksLikeRow(a)) continue;
      let isList = rowLists.has(p);
      if (!isList) {
        let rows = 0;
        for (const k of p.children) if (looksLikeRow(k)) rows++;
        isList = rows >= 2 && rows / p.children.length >= 0.5;
        if (isList) rowLists.add(p);
      }
      if (isList) {
        const h = a.getBoundingClientRect().height;
        return h > 0 && h < 400 && !containsBigMedia(a) ? a : null;
      }
    }
    return null;
  }

  function commentRowOf(node) {
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return null;
    if (site.commentSelector) {
      const c = el.closest(site.commentSelector);
      return c && (!site.commentScope || c.closest(site.commentScope)) ? c : null;
    }
    if (site.commentHeuristic) return igCommentRow(el);
    return null;
  }

  // Sam tekst komentarza – bez nazwy autora, czasu i przycisków ("Odpowiedz", "Lubię to").
  function commentText(row) {
    const parts = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const p = n.parentElement;
      if (!p || SKIP_TAGS.has(p.tagName)) continue;
      if (site.commentSelector && p.closest(site.commentSelector) !== row) continue; // odpowiedzi pod spodem
      const ctl = p.closest('a, button, [role="button"], time');
      if (ctl && row.contains(ctl)) {
        const t = ctl.tagName === 'A' ? ctl.textContent.trim() : '';
        if (t.startsWith('@') || t.startsWith('#')) parts.push(n.nodeValue);
        continue;
      }
      parts.push(n.nodeValue);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  function currentTakenAt() {
    const code = codeFromPath(location.pathname);
    const it = code && mediaItems.get(code);
    return it && it.takenAt ? it.takenAt : null;
  }

  function postOwnerFor(row) {
    const art = row.closest('article, [aria-posinset]');
    if (art) {
      for (const a of art.querySelectorAll('a[href]')) {
        if (row.contains(a)) continue;
        const u = profileUser(a);
        if (u) return u;
      }
    }
    const code = codeFromPath(location.pathname);
    const it = code && mediaItems.get(code);
    return it && it.user ? String(it.user).toLowerCase() : null;
  }

  function findCommentData(user, nt) {
    const list = user && commentData.get(user);
    if (!list) return null;
    for (const d of list) {
      const dn = AIB.normText(d.text).slice(0, 24);
      if (dn && nt.includes(dn)) return d;
    }
    return null;
  }

  function evaluateRow(row, cascade) {
    if (!row.isConnected || row.hasAttribute('data-aib-flagged')) return;
    const text = commentText(row);
    if (evaluated.get(row) === text.length) return;
    evaluated.set(row, text.length);

    let user = null;
    const others = new Set();
    for (const a of row.querySelectorAll('a[href]')) {
      if (site.commentSelector && a.closest(site.commentSelector) !== row) continue;
      const u = profileUser(a);
      if (!u) continue;
      if (!user) user = u;
      else if (u !== user) others.add(u);
    }
    // Opis autora posta (na Instagramie to pierwszy "komentarz" na liście) – nie oceniamy.
    if (user && user === postOwnerFor(row)) {
      if (row.hasAttribute('data-aib-bot')) unmarkBot(row);
      return;
    }
    const mentions = Math.max(others.size, (text.match(/@[\w.]+/g) || []).length);
    const nt = AIB.normText(text);
    // Klucz podobieństwa: "Come to Fenerbahçe 💛💙" = "come to fenerbahce!!"
    const key = BOTS.dupKey(text);
    const keyLetters = (key.match(/\p{L}/gu) || []).length;

    let dupCount = 0;
    if (key.length >= 10) {
      if (!textUsers.has(key)) textUsers.set(key, new Set());
      if (!textRows.has(key)) textRows.set(key, new Set());
      textUsers.get(key).add(user || 'anon:' + (textRows.get(key).size + 1));
      textRows.get(key).add(row);
      dupCount = textUsers.get(key).size;
    }

    // Zalew: to samo konto, podobny tekst (liczymy wiersze na stronie i osobne komentarze w danych).
    let selfRepeat = 0;
    let sameUserRows = null;
    if (user && key.length >= 2) {
      const k = user + '|' + key;
      if (!userTextRows.has(k)) userTextRows.set(k, new Set());
      sameUserRows = userTextRows.get(k);
      sameUserRows.add(row);
      for (const other of sameUserRows) if (!other.isConnected) sameUserRows.delete(other);
      selfRepeat = sameUserRows.size;
      const list = commentData.get(user);
      if (list) {
        const pks = new Set(list.filter((x) => BOTS.dupKey(x.text) === key).map((x) => x.pk));
        selfRepeat = Math.max(selfRepeat, pks.size);
      }
    }

    // Pamięć między postami (7 dni, tylko skróty): ten sam tekst pod innymi postami / od innych kont.
    let crossPosts = 0;
    let knownBot = false;
    const postHash = memHash(postIdFor(row));
    const userHash = user ? memHash(user) : null;
    if (settings.botMemory && userHash) {
      const b = mem.b[userHash];
      knownBot = !!(b && b.p.some((p) => p !== postHash)); // oznaczony gdzie indziej, nie tutaj
      if (keyLetters >= 8) {
        const kh = memHash(key);
        memRecord(kh, userHash, postHash);
        const e = mem.t[kh];
        crossPosts = Object.keys(e[userHash] || {}).length;
        dupCount = Math.max(dupCount, Object.keys(e).length);
      }
    }

    // Puste zdjęcie profilowe widać też bezpośrednio w adresie awatara na stronie.
    const avatar = row.querySelector('img');
    const domDefaultPic = !!(avatar && BOTS.DEFAULT_PIC_RE && BOTS.DEFAULT_PIC_RE.test(avatar.getAttribute('src') || ''));

    const d = findCommentData(user, nt);
    const takenAt = currentTakenAt();
    const r = BOTS.score({
      text,
      user,
      mentions,
      dupCount,
      selfRepeat,
      crossPosts,
      knownBot,
      verified: d ? d.verified : false,
      defaultPic: (d && d.defaultPic) || domDefaultPic,
      likes: d && typeof d.likes === 'number' ? d.likes : undefined,
      delaySec: d && takenAt ? d.createdAt - takenAt : undefined
    }, botOpts);

    if (r.isBot) {
      markBot(row, r, user, nt);
      if (settings.botMemory && userHash) memBot(userHash, postHash);
    } else if (row.hasAttribute('data-aib-bot')) unmarkBot(row);

    // Drugi raz podobny tekst (od innego konta albo od tego samego) – oceń ponownie wcześniejsze wiersze.
    if (cascade && (dupCount >= 2 || selfRepeat >= 2)) {
      const others = new Set([...(textRows.get(key) || []), ...(sameUserRows || [])]);
      for (const other of others) {
        if (other !== row) {
          evaluated.delete(other);
          evaluateRow(other, false);
        }
      }
    }
  }

  function markBot(row, r, user, nt) {
    row.setAttribute('data-aib-bot', settings.botMode === 'hide' ? 'hide' : 'collapse');
    row.setAttribute('data-aib-botlabel',
      'Prawdopodobnie bot (' + r.reasons.slice(0, 3).join(', ') + ') · kliknij, aby pokazać');
    const key = 'bot:' + (user || '') + '|' + nt.slice(0, 60);
    if (!botKeys.has(key)) {
      botKeys.add(key);
      botCount++;
      if (!totalKeys.has(key)) {
        totalKeys.add(key);
        unsentAdded++;
      }
      scheduleReport();
    }
  }

  function unmarkBot(row) {
    row.removeAttribute('data-aib-bot');
    row.removeAttribute('data-aib-botlabel');
  }

  // ---------- pamięć botów między postami ----------
  // Zapisujemy tylko skróty (hasze): bez nazw kont, bez treści komentarzy, bez adresów postów.
  // Struktura: t[hasz tekstu][hasz konta][hasz posta] = czas; b[hasz konta] = {t: czas, p: [hasze postów]}

  const MEM_DAYS = 7;
  const MEM_MAX_TEXTS = 4000;
  let mem = { t: {}, b: {} };
  let memTimer = 0;

  function memHash(s) {
    let x = 0x811c9dc5;
    const str = String(s);
    for (let i = 0; i < str.length; i++) {
      x ^= str.charCodeAt(i);
      x = Math.imul(x, 0x01000193);
    }
    return (x >>> 0).toString(36);
  }

  function postIdFor(row) {
    const code = codeFromPath(location.pathname);
    if (code) return 'c:' + code;
    const post = row.closest('article, [aria-posinset], shreddit-post');
    const a = post && post.querySelector(PERMALINK_SEL);
    if (a) {
      try { return 'u:' + new URL(a.getAttribute('href'), location.href).pathname; } catch (e) { /* niżej */ }
    }
    return 'u:' + location.pathname;
  }

  function memPrune(m) {
    const cutoff = Date.now() - MEM_DAYS * 864e5;
    const newest = [];
    for (const [kh, users] of Object.entries(m.t)) {
      let max = 0;
      for (const [uh, posts] of Object.entries(users)) {
        for (const [ph, ts] of Object.entries(posts)) {
          if (ts < cutoff) delete posts[ph];
          else if (ts > max) max = ts;
        }
        if (!Object.keys(posts).length) delete users[uh];
      }
      if (!Object.keys(users).length) delete m.t[kh];
      else newest.push([kh, max]);
    }
    if (newest.length > MEM_MAX_TEXTS) {
      newest.sort((a, b) => a[1] - b[1]);
      for (const [kh] of newest.slice(0, newest.length - MEM_MAX_TEXTS)) delete m.t[kh];
    }
    for (const [uh, b] of Object.entries(m.b)) if (!b || b.t < cutoff) delete m.b[uh];
    return m;
  }

  // Scalanie z tym, co zapisały inne karty w międzyczasie.
  function memMerge(into, from) {
    for (const [kh, users] of Object.entries(from.t || {})) {
      const tu = into.t[kh] || (into.t[kh] = {});
      for (const [uh, posts] of Object.entries(users)) {
        const tp = tu[uh] || (tu[uh] = {});
        for (const [ph, ts] of Object.entries(posts)) tp[ph] = Math.max(tp[ph] || 0, ts);
      }
    }
    for (const [uh, b] of Object.entries(from.b || {})) {
      const tb = into.b[uh] || (into.b[uh] = { t: 0, p: [] });
      tb.t = Math.max(tb.t, b.t || 0);
      for (const p of b.p || []) if (!tb.p.includes(p)) tb.p.push(p);
      if (tb.p.length > 5) tb.p = tb.p.slice(-5);
    }
    return into;
  }

  function memSave() {
    memTimer = 0;
    try {
      chrome.storage.local.get('botMemory', (r) => {
        const stored = (r && r.botMemory) || { t: {}, b: {} };
        mem = memPrune(memMerge(memMerge({ t: {}, b: {} }, stored), mem));
        chrome.storage.local.set({ botMemory: mem });
      });
    } catch (e) { /* wtyczka przeładowana */ }
  }

  function memSchedule() {
    if (!memTimer) memTimer = setTimeout(memSave, 3000);
  }

  function memRecord(kh, uh, ph) {
    const users = mem.t[kh] || (mem.t[kh] = {});
    const posts = users[uh] || (users[uh] = {});
    if (!posts[ph]) {
      posts[ph] = Date.now();
      memSchedule();
    }
  }

  function memBot(uh, ph) {
    const b = mem.b[uh] || (mem.b[uh] = { t: 0, p: [] });
    b.t = Date.now();
    if (!b.p.includes(ph)) {
      b.p.push(ph);
      if (b.p.length > 5) b.p.shift();
    }
    memSchedule();
  }

  function memLoad() {
    return new Promise((resolve) => {
      chrome.storage.local.get('botMemory', (r) => {
        const m = (r && r.botMemory) || {};
        resolve(memPrune({ t: m.t || {}, b: m.b || {} }));
      });
    });
  }

  function scanComments(root) {
    const rows = new Set();
    const inside = commentRowOf(root);
    if (inside) rows.add(inside);
    if (site.commentSelector) {
      for (const r of root.querySelectorAll(site.commentSelector)) {
        if (!site.commentScope || r.closest(site.commentScope)) rows.add(r);
      }
    } else if (site.commentHeuristic) {
      for (const a of root.querySelectorAll('a[href]')) {
        if (!profileUser(a)) continue;
        const r = igCommentRow(a);
        if (r) rows.add(r);
      }
    }
    for (const r of rows) evaluateRow(r, true);
  }

  function handleCommentData(it) {
    const user = String(it.user || '').toLowerCase();
    if (!user) return;
    const list = commentData.get(user) || [];
    if (!list.some((d) => d.pk === it.pk)) list.push(it);
    if (list.length > 30) list.shift();
    commentData.set(user, list);
    if (!active || !settings.detectBots) return;
    // Dane mogły przyjść po wyrenderowaniu komentarza – oceń ponownie wiersze tego konta.
    for (const a of document.querySelectorAll('a[href*="/' + CSS.escape(user) + '"]')) {
      if (profileUser(a) !== user) continue;
      const r = commentRowOf(a);
      if (r) {
        evaluated.delete(r);
        evaluateRow(r, true);
      }
    }
  }

  // ---------- dane postów (Instagram / Threads) ----------

  function reasonForItem(it) {
    if (settings.detectLabels && it.ai) return { type: 'label', text: it.ai };
    if (it.caption) {
      const r = matchText(it.caption, false);
      if (r) return r;
    }
    if (settings.detectAccounts && it.user && accountSet.has(String(it.user).toLowerCase())) {
      return { type: 'account', text: String(it.user).toLowerCase() };
    }
    return null;
  }

  function flagCode(code, reason) {
    for (const a of document.querySelectorAll('a[href*="' + code + '"]')) {
      let path = '';
      try { path = new URL(a.getAttribute('href'), location.href).pathname; } catch (e) { continue; }
      if (codeFromPath(path) === code) flag(a, reason, code);
    }
    if (codeFromPath(location.pathname) === code) flagCurrentMedia(reason, code);
  }

  function handleMedia(it) {
    if (it && it.kind === 'comment') {
      handleCommentData(it);
      return;
    }
    if (!it || !it.code) return;
    mediaItems.set(it.code, it);
    if (!active) return;
    const r = reasonForItem(it);
    mediaReasons.set(it.code, r);
    if (r) flagCode(it.code, r);
    // Poznaliśmy autora bieżącego posta – jego opis nie może zostać uznany za bota.
    if (settings.detectBots && it.code === codeFromPath(location.pathname)) {
      for (const row of document.querySelectorAll('[data-aib-bot]')) {
        evaluated.delete(row);
        evaluateRow(row, false);
      }
    }
  }

  function onMediaEvent(e) {
    let items;
    try { items = JSON.parse(e.detail); } catch (err) { return; }
    if (Array.isArray(items)) items.forEach(handleMedia);
  }

  // Strona posta / Reels: kod jest tylko w adresie – ukrywamy najbardziej widoczne duże zdjęcie/wideo.
  function bigVisibleMedia() {
    const root = document.querySelector('main') || document.body;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let best = null;
    let bestArea = 0;
    for (const m of root.querySelectorAll('video, img')) {
      const r = m.getBoundingClientRect();
      if (r.width < BIG_MEDIA || r.height < BIG_MEDIA) continue;
      const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (w * h > bestArea) {
        bestArea = w * h;
        best = m;
      }
    }
    return best;
  }

  function flagCurrentMedia(reason, code) {
    const m = bigVisibleMedia();
    if (!m) return;
    const c = mediaContainer(m);
    if (c) flagContainer(c, reason, code, true);
  }

  function checkUrl() {
    if (!active) return;
    const code = codeFromPath(location.pathname);
    if (!code) return;
    const r = mediaReasons.get(code);
    const m = bigVisibleMedia();
    if (!m) return;
    const flagged = m.closest('[data-aib-flagged]');
    if (r) {
      if (!flagged || (flagged.hasAttribute('data-aib-weak') && !r.weak)) flagCurrentMedia(r, code);
    } else if (flagged && flagged.hasAttribute('data-aib-code') && flagged.getAttribute('data-aib-code') !== code) {
      // Reels potrafią użyć tego samego bloku dla następnego filmu – zdejmujemy stare oznaczenie.
      unflag(flagged);
    }
  }

  // ---------- ukrywanie ----------

  function isBigMedia(m) {
    const r = m.getBoundingClientRect();
    return r.width >= BIG_MEDIA && r.height >= BIG_MEDIA;
  }

  function containsBigMedia(el) {
    if ((el.tagName === 'IMG' || el.tagName === 'VIDEO') && isBigMedia(el)) return 1;
    let n = 0;
    for (const m of el.querySelectorAll('img, video')) if (isBigMedia(m)) n++;
    return n;
  }

  // Najbliższy blok z dużym zdjęciem/wideo, rozszerzony w górę, dopóki ma tę samą wysokość
  // i nie obejmuje kolejnych dużych zdjęć (np. zdjęcie + kolumna z opisem na stronie posta,
  // ale nie cały rząd siatki Eksploruj).
  function mediaContainer(el) {
    const stop = document.querySelector('main') || document.body;
    let cand = null;
    for (let e = el; e && e !== stop && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      if (containsBigMedia(e)) { cand = e; break; }
    }
    if (!cand) return null;
    const h = cand.getBoundingClientRect().height;
    const count = containsBigMedia(cand);
    for (let p = cand.parentElement; p && p !== stop && p !== document.body; p = p.parentElement) {
      if (p.getBoundingClientRect().height > h * 1.15 || containsBigMedia(p) > count) break;
      cand = p;
    }
    // Zabezpieczenie: nie zasłaniamy całej siatki ani strony.
    if (containsBigMedia(cand) > 6) return null;
    return cand;
  }

  function fallbackAllowed() {
    if (!site.mediaFallback) return false;
    return !(site.noFallbackPaths || []).some((re) => re.test(location.pathname));
  }

  function findContainer(el) {
    // Sygnał w komentarzu ukrywa tylko ten komentarz, a nie cały post.
    const row = commentRowOf(el);
    if (row) return [row, false];
    for (const sel of site.containers) {
      const c = el.closest(sel);
      if (c && c !== document.body && c !== document.documentElement && c.tagName !== 'MAIN') return [c, false];
    }
    if (fallbackAllowed()) {
      const c = mediaContainer(el);
      if (c) return [c, true];
    }
    return [null, false];
  }

  function describe(reason) {
    switch (reason.type) {
      case 'label': return 'etykieta „' + reason.text + '”';
      case 'hashtag': return reason.text;
      case 'keyword': return '„' + reason.text + '”';
      case 'account':
        return 'konto ' + (reason.text.includes('/') ? reason.text : '@' + reason.text) +
          (ownAccountSet.has(reason.text) ? '' : ' ze wspólnej listy');
      default: return '';
    }
  }

  function postKey(c, code) {
    if (code) return 'code:' + code;
    const a = c.querySelector(PERMALINK_SEL);
    if (a) {
      try {
        const url = new URL(a.getAttribute('href'), location.href);
        const pc = codeFromPath(url.pathname);
        if (pc) return 'code:' + pc;
        for (const k of Array.from(url.searchParams.keys())) {
          if (k.startsWith('__') || k === 'igsh' || k === 'utm_source') url.searchParams.delete(k);
        }
        return url.pathname + url.search;
      } catch (e) { /* fallback niżej */ }
    }
    let id = elementIds.get(c);
    if (!id) {
      id = 'el' + nextElementId++;
      elementIds.set(c, id);
    }
    return id;
  }

  function flag(el, reason, code) {
    const [c, soft] = findContainer(el);
    if (c) flagContainer(c, reason, code, soft);
    else if (orphans.length < 500) {
      // Sprawdzone na żywo na Threads (12.11.2026): tekst posta jest na stronie ~4 s wcześniej niż
      // atrybut, po którym rozpoznajemy post. Sygnał czeka więc w poczekalni i próbujemy ponownie.
      orphans.push({ el, reason, code, t: Date.now() });
      scheduleOrphans(400);
    }
  }

  // ---------- poczekalnia: sygnały, które jeszcze nie mają swojego posta ----------

  const ORPHAN_TTL = 30000;
  const CONTAINER_ATTRS = ['data-pressable-container', 'aria-posinset', 'aria-label', 'role', 'data-testid'];
  let orphans = [];
  let orphanTimer = 0;

  function scheduleOrphans(delay) {
    if (!orphanTimer) orphanTimer = setTimeout(retryOrphans, delay);
  }

  function retryOrphans() {
    orphanTimer = 0;
    if (!active || !orphans.length) return;
    const now = Date.now();
    const keep = [];
    for (const o of orphans) {
      if (!o.el.isConnected || now - o.t > ORPHAN_TTL || o.el.closest(STRONG_FLAG)) continue;
      const [c, soft] = findContainer(o.el);
      if (c) flagContainer(c, o.reason, o.code, soft);
      else keep.push(o);
    }
    orphans = keep;
    if (orphans.length) scheduleOrphans(1000);
  }

  function labelFor(reason) {
    return (reason.weak ? 'Możliwa treść AI (' : 'Treść AI ukryta (') + describe(reason) + ') · kliknij, aby pokazać';
  }

  function flagContainer(c, reason, code, soft) {
    if (c.hasAttribute('data-aib-flagged')) {
      // Słaby sygnał (tylko rozmycie) ustępuje mocnemu, np. tytuł "AI art…" + #aiart niżej w opisie.
      if (c.hasAttribute('data-aib-weak') && !reason.weak) {
        c.removeAttribute('data-aib-weak');
        c.setAttribute('data-aib-flagged', reason.type);
        c.setAttribute('data-aib-label', labelFor(reason));
        if (!soft) c.removeAttribute('data-aib-soft');
        if (code) c.setAttribute('data-aib-code', code);
      }
      return;
    }
    c.setAttribute('data-aib-flagged', reason.type);
    c.setAttribute('data-aib-label', labelFor(reason));
    if (soft || reason.weak) c.setAttribute('data-aib-soft', '');
    if (reason.weak) c.setAttribute('data-aib-weak', '');
    if (code) c.setAttribute('data-aib-code', code);
    try {
      if (getComputedStyle(c).position === 'static') c.setAttribute('data-aib-static', '');
    } catch (e) { /* ignore */ }
    for (const v of c.querySelectorAll('video')) {
      try { v.pause(); } catch (e) { /* ignore */ }
    }
    const key = postKey(c, code);
    if (!pageKeys.has(key)) {
      pageKeys.add(key);
      pageCount++;
      if (!totalKeys.has(key)) {
        totalKeys.add(key);
        unsentAdded++;
      }
      scheduleReport();
    }
  }

  const FLAG_ATTRS = ['data-aib-flagged', 'data-aib-label', 'data-aib-static', 'data-aib-revealed', 'data-aib-soft',
    'data-aib-code', 'data-aib-weak'];

  function unflag(c) {
    for (const a of FLAG_ATTRS) c.removeAttribute(a);
  }

  function unflagAll() {
    for (const c of document.querySelectorAll('[data-aib-flagged]')) unflag(c);
    for (const r of document.querySelectorAll('[data-aib-bot]')) {
      unmarkBot(r);
      r.removeAttribute('data-aib-revealed');
    }
  }

  // ---------- obserwacja zmian na stronie ----------

  function schedule(node) {
    pending.add(node);
    if (!flushTimer) flushTimer = setTimeout(flush, 120);
  }

  function flush() {
    flushTimer = 0;
    const nodes = pending;
    pending = new Set();
    if (!active) return;
    for (const n of nodes) {
      if (!n.isConnected) continue;
      if (n.nodeType === Node.TEXT_NODE) {
        const p = n.parentElement;
        if (p && !nodes.has(p) && !p.closest(STRONG_FLAG)) {
          checkTextNode(n);
          if (settings.detectBots && BOTS) {
            const row = commentRowOf(p);
            if (row) evaluateRow(row, true);
          }
        }
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      let anc = n.parentNode;
      let covered = false;
      while (anc) {
        if (nodes.has(anc)) { covered = true; break; }
        anc = anc.parentNode;
      }
      if (covered || n.closest(STRONG_FLAG)) continue;
      scanElement(n);
    }
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const n of m.addedNodes) {
            if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) schedule(n);
          }
        } else if (m.type === 'characterData') {
          schedule(m.target);
        } else if (m.type === 'attributes' && orphans.length) {
          // Strona dokleiła atrybut posta (np. data-pressable-container) – spróbuj przypisać sygnały.
          scheduleOrphans(100);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: CONTAINER_ATTRS
    });
    if (site.dataHook && !urlTimer) urlTimer = setInterval(checkUrl, 700);
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
    pending.clear();
    if (urlTimer) clearInterval(urlTimer);
    urlTimer = 0;
  }

  // ---------- licznik ----------

  function scheduleReport() {
    if (!reportTimer) reportTimer = setTimeout(report, 400);
  }

  function report() {
    reportTimer = 0;
    const added = unsentAdded;
    unsentAdded = 0;
    try {
      if (!chrome.runtime || !chrome.runtime.id) return; // wtyczka przeładowana – stary skrypt
      const p = chrome.runtime.sendMessage({ type: 'aib-count', count: active ? pageCount + botCount : 0, added });
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  // ---------- kliknięcia i wideo ----------

  function onPointer(e) {
    if (!active) return;
    const t = e.target;
    if (!t || !t.closest) return;
    // Zwinięty komentarz bota: kliknięcie w pasek rozwija go.
    const bot = t.closest('[data-aib-bot="collapse"]:not([data-aib-revealed])');
    if (bot && !bot.hasAttribute('data-aib-flagged')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.type === 'click') bot.setAttribute('data-aib-revealed', '');
      return;
    }
    const c = t.closest('[data-aib-flagged]');
    if (!c) return;
    if (settings.mode !== 'blur' && !c.hasAttribute('data-aib-soft')) return;
    if (!c.hasAttribute('data-aib-revealed')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.type === 'click') {
        c.setAttribute('data-aib-revealed', '');
        revealedAt.set(c, Date.now());
      }
      return;
    }
    // Chwilę po odsłonięciu blokujemy kliknięcia, żeby "dwuklik" nie dał np. polubienia.
    const at = revealedAt.get(c);
    if (at && Date.now() - at < 500) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }

  function onPlay(e) {
    if (!active) return;
    const v = e.target;
    if (!v || !v.closest) return;
    const c = v.closest('[data-aib-flagged]');
    if (c && !c.hasAttribute('data-aib-revealed')) {
      try { v.pause(); } catch (err) { /* ignore */ }
    }
  }

  // ---------- start ----------

  function apply() {
    stopObserver();
    unflagAll();
    pageKeys = new Set();
    pageCount = 0;
    elementIds = new WeakMap();
    botKeys = new Set();
    botCount = 0;
    evaluated = new WeakMap();
    textUsers = new Map();
    textRows = new Map();
    userTextRows = new Map();
    orphans = [];
    compile();
    active = !!settings.enabled && settings.sites[siteKey] !== false;
    mediaReasons.clear();
    if (!active) {
      document.documentElement.removeAttribute('data-aib-mode');
      report();
      return;
    }
    document.documentElement.setAttribute('data-aib-mode', settings.mode === 'blur' ? 'blur' : 'hide');
    for (const it of mediaItems.values()) mediaReasons.set(it.code, reasonForItem(it));
    startObserver();
    if (document.body) scanElement(document.body);
    checkUrl();
    report();
  }

  function loadSharedData() {
    return new Promise((resolve) => {
      chrome.storage.local.get('sharedListData', (r) => resolve((r && r.sharedListData) || {}));
    });
  }

  async function init() {
    settings = await AIB.loadSettings();
    sharedListData = await loadSharedData();
    mem = await memLoad();
    window.addEventListener('pagehide', () => { if (memTimer) { clearTimeout(memTimer); memSave(); } });

    // Najpierw odbierz dane, które page-hook już zebrał (z HTML strony), dopiero potem skanuj.
    if (site.dataHook) {
      document.addEventListener('aib:media', onMediaEvent);
      document.dispatchEvent(new CustomEvent('aib:ready'));
    }
    apply();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        AIB.loadSettings().then((s) => {
          settings = s;
          apply();
        });
      } else if (area === 'local' && changes && changes.botMemory && changes.botMemory.newValue &&
          !Object.keys(changes.botMemory.newValue.t || {}).length && !Object.keys(changes.botMemory.newValue.b || {}).length) {
        // "Wyczyść pamięć" w ustawieniach
        mem = { t: {}, b: {} };
      } else if (area === 'local' && (!changes || changes.sharedListData || !Object.keys(changes).length)) {
        // Odświeżona wspólna lista → przelicz.
        loadSharedData().then((d) => {
          sharedListData = d;
          apply();
        });
      }
    });

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg && msg.type === 'aib-get-status') {
        sendResponse({
          site: siteKey,
          siteName: site.name,
          active,
          count: active ? pageCount : 0,
          bots: active ? botCount : 0
        });
      }
    });

    for (const type of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) {
      window.addEventListener(type, onPointer, true);
    }
    document.addEventListener('play', onPlay, true);
  }

  init();
})();

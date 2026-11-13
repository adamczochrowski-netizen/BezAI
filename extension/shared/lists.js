/* Bez AI – wspólne listy kont (jak listy filtrów w uBlocku).
   Lista to zwykły plik tekstowy pod dowolnym adresem (np. GitHub, Gist):

     ! Title: Konta AI – Polska
     ! Updated: 2026-11-12
     [ai]
     instagram ai.art.daily
     facebook jakas.strona.ai
     https://www.instagram.com/inne.konto/     ← link do profilu też działa
     nazwa.bez.platformy                         ← wszystkie platformy
     [bot]
     instagram xjxjxjxjxj9

   Wymaga wcześniej załadowanego shared/defaults.js (AIB). Lista to tylko dane – nic z niej nie jest wykonywane. */
(function (root) {
  'use strict';

  const PLATFORMS = {
    instagram: 'instagram', ig: 'instagram', facebook: 'facebook', fb: 'facebook', threads: 'threads',
    x: 'x', twitter: 'x', youtube: 'youtube', yt: 'youtube', reddit: 'reddit',
    '*': '*', all: '*', wszystkie: '*'
  };
  const NAME_RE = /^[\p{L}\p{N}_.\-/]{1,100}$/u;
  const MAX_ENTRIES = 50000;
  const MAX_CHARS = 3 * 1024 * 1024;

  function parseEntry(line) {
    const AIB = root.AIB;
    const parts = line.split(/\s+/);
    let platform = '*';
    let name = parts[0];
    if (parts.length >= 2) {
      const p = PLATFORMS[parts[0].toLowerCase()];
      if (!p) return null;
      platform = p;
      name = parts[1];
    }
    if (/^https?:\/\//i.test(name)) {
      let url;
      try { url = new URL(name); } catch (e) { return null; }
      const site = AIB.siteKeyForHost(url.hostname);
      if (!site) return null;
      platform = site;
    }
    name = AIB.normAccount(name);
    if (!name || !NAME_RE.test(name)) return null;
    return platform + '/' + name;
  }

  function parseList(text) {
    const out = { title: null, updated: null, homepage: null, ai: [], bot: [], errors: 0 };
    const seen = { ai: new Set(), bot: new Set() };
    let section = 'ai';
    for (const raw of String(text || '').slice(0, MAX_CHARS).split(/\r?\n/)) {
      let line = raw.trim();
      if (!line) continue;
      if (line.startsWith('!') || line.startsWith('#')) {
        const m = /^[!#]\s*(title|tytuł|updated|aktualizacja|homepage|strona)\s*:\s*(.+)$/i.exec(line);
        if (m) {
          const k = m[1].toLowerCase();
          const v = m[2].trim().slice(0, 200);
          if (k === 'title' || k === 'tytuł') out.title = v;
          else if (k === 'updated' || k === 'aktualizacja') out.updated = v;
          else out.homepage = v;
        }
        continue;
      }
      const sec = /^\[(ai|bots?|boty)\]$/i.exec(line);
      if (sec) {
        section = sec[1].toLowerCase().startsWith('b') ? 'bot' : 'ai';
        continue;
      }
      line = line.replace(/\s+[!#].*$/, ''); // komentarz na końcu linii
      const entry = parseEntry(line);
      if (!entry) {
        out.errors++;
        continue;
      }
      if (seen[section].has(entry)) continue;
      if (out.ai.length + out.bot.length >= MAX_ENTRIES) break;
      seen[section].add(entry);
      out[section].push(entry);
    }
    return out;
  }

  // ["instagram/ai.art.daily", "*/foo", "reddit/r/aiart"] → nazwy dla danej platformy
  function namesFor(entries, siteKey) {
    const out = [];
    for (const e of entries || []) {
      const i = e.indexOf('/');
      if (i < 0) continue;
      const p = e.slice(0, i);
      if (p === siteKey || p === '*') out.push(e.slice(i + 1));
    }
    return out;
  }

  // Konta z włączonych list, z podziałem na AI i boty.
  function collect(subs, data, siteKey) {
    const ai = new Set();
    const bot = new Set();
    for (const s of subs || []) {
      if (!s || s.enabled === false) continue;
      const d = data && data[s.url];
      if (!d) continue;
      for (const n of namesFor(d.ai, siteKey)) ai.add(n);
      for (const n of namesFor(d.bot, siteKey)) bot.add(n);
    }
    return { ai, bot };
  }

  function validUrl(u) {
    let url;
    try { url = new URL(String(u || '').trim()); } catch (e) { return null; }
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    return url.href;
  }

  // GitHub: link do pliku w przeglądarce → surowy plik
  function rawUrl(href) {
    const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(href);
    return m ? 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/' + m[3] : href;
  }

  async function fetchList(url) {
    let res;
    try {
      res = await fetch(url, { cache: 'no-cache', credentials: 'omit', redirect: 'follow' });
    } catch (e) {
      throw new Error('Nie udało się pobrać (brak internetu albo serwer nie pozwala na pobieranie)');
    }
    if (!res.ok) throw new Error('Serwer odpowiedział błędem ' + res.status);
    const text = await res.text();
    if (text.length > MAX_CHARS) throw new Error('Lista jest za duża (ponad 3 MB)');
    return parseList(text);
  }

  // Pobiera wszystkie (albo jedną) subskrybowane listy i zapisuje wynik w chrome.storage.local.
  async function refreshAll(onlyUrl) {
    let sharedLists;
    if (globalThis.AIB && AIB.loadSharedLists) {
      sharedLists = await AIB.loadSharedLists();
    } else {
      sharedLists = (await chrome.storage.sync.get('sharedLists')).sharedLists || [];
    }
    const { sharedListData = {} } = await chrome.storage.local.get('sharedListData');
    for (const s of sharedLists) {
      if (onlyUrl && s.url !== onlyUrl) continue;
      const prev = sharedListData[s.url] || {};
      try {
        const p = await fetchList(s.url);
        sharedListData[s.url] = {
          title: p.title, updated: p.updated, homepage: p.homepage,
          ai: p.ai, bot: p.bot, errors: p.errors,
          fetchedAt: Date.now(), ok: true, error: null
        };
      } catch (e) {
        // Stare wpisy zostają, dopóki lista znów się nie pobierze.
        sharedListData[s.url] = Object.assign({ ai: [], bot: [] }, prev, {
          fetchedAt: Date.now(), ok: false, error: String((e && e.message) || e)
        });
      }
    }
    for (const k of Object.keys(sharedListData)) {
      if (!sharedLists.some((s) => s.url === k)) delete sharedListData[k];
    }
    await chrome.storage.local.set({ sharedListData });
    return sharedListData;
  }

  // Twoje własne listy jako plik do opublikowania.
  function buildExport(settings, title) {
    const lines = [
      '! Title: ' + (title || 'Moja lista – Bez AI'),
      '! Updated: ' + new Date().toISOString().slice(0, 10),
      '! Lista dla wtyczki Bez AI. Sekcje [ai] i [bot], jedno konto w linii,',
      '! opcjonalnie z platformą na początku, np.: instagram nazwa.konta',
      '',
      '[ai]'
    ];
    for (const a of settings.accounts || []) lines.push(root.AIB.normAccount(a));
    lines.push('', '[bot]');
    for (const a of settings.botAccounts || []) lines.push(root.AIB.normAccount(a));
    return lines.join('\n') + '\n';
  }

  const api = { parseList, parseEntry, namesFor, collect, validUrl, rawUrl, fetchList, refreshAll, buildExport };
  root.AIBLists = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

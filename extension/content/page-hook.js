/* Bez AI – skrypt w świecie strony (world: MAIN), tylko Instagram i Threads.
   Czyta dane postów, które strona i tak pobiera (/graphql, /api/v1 oraz dane osadzone w HTML),
   i wyciąga z nich: kod posta, etykietę AI (ai_label_info), pełny opis i autora.
   Nic nie wysyła na zewnątrz – przekazuje to tylko skryptowi wtyczki zdarzeniem "aib:media". */
(function () {
  'use strict';
  if (window.__aibPageHook) return;
  window.__aibPageHook = true;

  const RELEVANT = /\/graphql|\/api\/v1\/|\/api\/graphql/;
  const CODE_RE = /^[A-Za-z0-9_-]{5,}$/;
  const MAX_ITEMS = 3000;
  const known = new Map();
  let ready = false;

  function send(items) {
    document.dispatchEvent(new CustomEvent('aib:media', { detail: JSON.stringify(items) }));
  }

  // Domyślne (puste) zdjęcie profilowe Instagrama – identyfikatory plików (kopia z shared/bot-score.js,
  // bo ten skrypt działa w świecie strony). 573323465_… sprawdzone na żywo 12.11.2026.
  const DEFAULT_PIC_RE = /573323465_1219825463302212_7278921664109726296_n|44884218_345707102882519_2446069589734326272_n/;

  function emit(items) {
    if (!items.length) return;
    for (const it of items) {
      const key = it.kind === 'comment' ? 'c:' + it.pk : it.code;
      known.delete(key);
      known.set(key, it);
    }
    while (known.size > MAX_ITEMS) known.delete(known.keys().next().value);
    if (ready) send(items);
  }

  // Skrypt wtyczki startuje później niż ten – po jego sygnale oddajemy wszystko, co już mamy.
  document.addEventListener('aib:ready', () => {
    ready = true;
    if (known.size) send(Array.from(known.values()));
  });

  function pick(o) {
    const ai = o.ai_label_info;
    const user = (o.user && o.user.username) || (o.owner && o.owner.username) || null;
    return {
      code: o.code,
      ai: ai && typeof ai === 'object' ? String(ai.attribution_label_text || ai.subtitle_text || 'AI') : null,
      caption: o.caption && typeof o.caption.text === 'string' ? o.caption.text.slice(0, 5000) : null,
      user: typeof user === 'string' ? user : null,
      takenAt: typeof o.taken_at === 'number' ? o.taken_at : null
    };
  }

  // Komentarz (sprawdzone 12.11.2026): {pk, text, created_at, comment_like_count, child_comment_count,
  // user: {username, is_verified, profile_pic_url}}
  function isComment(o) {
    return typeof o.text === 'string' && typeof o.created_at === 'number' && o.user && typeof o.user === 'object' &&
      typeof o.user.username === 'string' && ('comment_like_count' in o || 'child_comment_count' in o);
  }

  function pickComment(o) {
    return {
      kind: 'comment',
      pk: String(o.pk || o.id || o.created_at + o.user.username),
      text: o.text.slice(0, 1000),
      user: o.user.username,
      verified: !!o.user.is_verified,
      defaultPic: DEFAULT_PIC_RE.test(String(o.user.profile_pic_url || '')),
      createdAt: o.created_at,
      likes: typeof o.comment_like_count === 'number' ? o.comment_like_count : null
    };
  }

  function walk(root, out) {
    const stack = [root];
    let guard = 0;
    while (stack.length && guard++ < 400000) {
      const o = stack.pop();
      if (!o || typeof o !== 'object') continue;
      if (Array.isArray(o)) {
        for (let i = 0; i < o.length; i++) if (o[i] && typeof o[i] === 'object') stack.push(o[i]);
        continue;
      }
      if (typeof o.code === 'string' && CODE_RE.test(o.code) && ('ai_label_info' in o || 'caption' in o)) {
        out.push(pick(o));
      } else if (isComment(o)) {
        out.push(pickComment(o));
      }
      for (const k in o) {
        const v = o[k];
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }

  function parseText(text) {
    if (!text || text.length < 20) return;
    if (text.indexOf('"code"') < 0 && text.indexOf('comment_like_count') < 0) return;
    let t = text.startsWith('for (;;);') ? text.slice(9) : text;
    const out = [];
    const tryParse = (s) => {
      try { walk(JSON.parse(s), out); return true; } catch (e) { return false; }
    };
    if (!tryParse(t)) {
      for (const line of t.split('\n')) if (line.trim()) tryParse(line);
    }
    emit(out);
  }

  // XHR (Instagram ładuje feed przez XHR na /graphql/query)
  try {
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const sendXhr = XHR.send;
    XHR.open = function (method, url) {
      try { this.__aibUrl = String(url); } catch (e) { /* ignore */ }
      return open.apply(this, arguments);
    };
    XHR.send = function () {
      try {
        if (RELEVANT.test(this.__aibUrl || '')) {
          this.addEventListener('load', function () {
            try {
              if (this.responseType === '' || this.responseType === 'text') parseText(this.responseText);
              else if (this.responseType === 'json' && this.response) {
                const out = [];
                walk(this.response, out);
                emit(out);
              }
            } catch (e) { /* ignore */ }
          });
        }
      } catch (e) { /* ignore */ }
      return sendXhr.apply(this, arguments);
    };
  } catch (e) { /* ignore */ }

  // fetch
  try {
    const origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function (input) {
        const p = origFetch.apply(this, arguments);
        try {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          if (RELEVANT.test(url)) {
            p.then((r) => {
              try { r.clone().text().then(parseText, () => {}); } catch (e) { /* ignore */ }
            }, () => {});
          }
        } catch (e) { /* ignore */ }
        return p;
      };
    }
  } catch (e) { /* ignore */ }

  // Dane osadzone w HTML przy pierwszym wczytaniu strony
  const done = new WeakSet();
  function scanScripts() {
    for (const s of document.querySelectorAll('script[type="application/json"]')) {
      if (done.has(s)) continue;
      done.add(s);
      const t = s.textContent;
      if (t && ((t.indexOf('"code"') >= 0 && (t.indexOf('ai_label_info') >= 0 || t.indexOf('"caption"') >= 0)) ||
          t.indexOf('comment_like_count') >= 0)) {
        parseText(t);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scanScripts);
  else scanScripts();
  window.addEventListener('load', scanScripts);
})();

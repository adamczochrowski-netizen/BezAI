/* Bez AI – ocena punktowa "czy ten komentarz pisze bot".
   Czysta funkcja bez zależności od strony (testy: node test/bot-score.test.js).
   Żaden pojedynczy słaby sygnał nie wystarcza – komentarz jest zwijany dopiero po przekroczeniu progu. */
(function (root) {
  'use strict';

  // Frazy prawie wyłącznie spamowe: +4 (edytowalne w ustawieniach jako "Frazy botów").
  const DEFAULT_BOT_PHRASES = [
    'check my bio', 'check out my bio', 'link in my bio', 'look at my bio', 'check my profile',
    'visit my profile', 'check my page', 'promote it on', 'promote this on', 'send it to @',
    'post it on @', 'feature it on @', 'collab? dm', 'free followers', 'free likes', 'buy followers',
    'gain followers', 'hot pics', 'see my photos', 'my private pics', 'onlyfans', 'fansly',
    'link w bio', 'sprawdź mój profil', 'sprawdz moj profil', 'zajrzyj na mój profil',
    'wejdź na mój profil', 'wejdz na moj profil', 'zapraszam na mój profil', 'zapraszam na priv',
    'napisz priv', 'pisz priv', 'darmowi obserwujący', 'darmowe polubienia', 'kup obserwujących'
  ];

  // Podejrzane, ale ludzie też tak piszą: +2.
  const MEDIUM_PHRASES = [
    'dm me', 'dm for', 'dm to', 'send me a dm', 'message me', 'inbox me', 'text me',
    'napisz do mnie', 'pisz do mnie', 'thanks to @', 'thanks to mrs', 'thanks to mr', 'dzięki @',
    'dzięki pani', 'dzięki panu', 'earned $', 'made $', 'profit', 'i invested', 'investment',
    'account manager', 'crypto', 'bitcoin', 'forex', 'trading', 'zarobiłem', 'zarobiłam', 'zarobić',
    'inwestycj', 'kryptowalut', 'telegram', 'whatsapp', '18+', 'randki', 'poznaj mnie',
    'moje zdjęcia', 'zobacz moje'
  ];

  // Ogólniki typowe dla botów "od zasięgów": +2.
  const GENERIC_BOT_PHRASES = [
    'nice pic', 'nice post', 'nice photo', 'great post', 'great content', 'amazing content',
    'awesome content', 'love your content', 'love your page', 'nice page', 'great page', 'keep it up',
    'keep up the good work', 'great job', 'nice feed', 'fajny profil', 'super profil', 'fajna strona'
  ];

  // Styl komentarzy generowanych przez AI: +1 (słaby sygnał).
  const LLM_PHRASES = [
    'what a stunning', 'absolutely stunning', 'truly inspiring', 'such an inspiring', 'this is truly',
    'keep shining', 'keep inspiring', 'the way you capture', 'your content is', 'incredible work',
    'what an incredible', 'pure magic', 'love the vibe', 'this made my day', 'such a vibe'
  ];

  // Słowa, z których składają się "puste" komentarze (np. "wow super 🔥").
  const GENERIC_WORDS = new Set([
    'nice', 'wow', 'amazing', 'awesome', 'great', 'cool', 'beautiful', 'gorgeous', 'stunning', 'lovely',
    'perfect', 'super', 'love', 'it', 'this', 'so', 'very', 'pic', 'photo', 'post', 'content', 'good',
    'job', 'work', 'omg', 'wonderful', 'fantastic', 'excellent', 'fajne', 'fajny', 'fajna', 'piękne',
    'pięknie', 'piękny', 'świetne', 'świetny', 'ekstra', 'extra', 'cudne', 'cudowne', 'brawo', 'sztos',
    'top', 'mega', 'hej', 'hi', 'hello', 'yes', 'yeah', 'wow!'
  ]);

  // Teksty, które ludzie naturalnie powtarzają (życzenia, gratulacje, kondolencje) – nie liczymy ich jako kopiuj-wklej.
  const DUP_EXEMPT_RE = /urodzin|najlepszego|sto lat|birthday|gratul|congrat|brawo|powodzenia|good luck|rip\b|\[\*\]|spoczywaj|kondolencj|condolence|wyrazy współczucia|happy new year|merry christmas|wesołych|szczęśliwego|smacznego|zdrówka|zdrowia/u;

  // Puste (domyślne) zdjęcie profilowe Instagrama – identyfikatory plików.
  // 573323465_… – sprawdzone na żywo 12.11.2026 (szara sylwetka, .png); 44884218_… – starszy wariant.
  const DEFAULT_PIC_RE = /573323465_1219825463302212_7278921664109726296_n|44884218_345707102882519_2446069589734326272_n/;

  const THRESHOLDS = { low: 6, medium: 4, high: 3 };
  const LINK_RE = /(https?:\/\/|www\.|t\.me\/|wa\.me\/|bit\.ly\/|linktr\.ee|\.com\/|\.ru\/)/i;
  const PHONE_RE = /\+?\d[\d \-]{8,}\d/;
  const EMOJI_RE = /\p{Extended_Pictographic}/gu;
  const LETTER_RE = /\p{L}/gu;

  function norm(s) {
    return String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const reCache = new Map();
  function phraseRe(list) {
    const key = list.join('\u0001');
    let re = reCache.get(key);
    if (!re) {
      const items = Array.from(new Set(list.map(norm).filter(Boolean))).sort((a, b) => b.length - a.length);
      // Granica słowa tylko po stronie litery/cyfry – "made $" ma łapać "made $5000", "thanks to @" – "@anna".
      const W = /[\p{L}\p{N}]/u;
      const part = (p) =>
        (W.test(p[0]) ? '(?<![\\p{L}\\p{N}])' : '') + escapeRe(p) + (W.test(p[p.length - 1]) ? '(?![\\p{L}\\p{N}])' : '');
      re = items.length ? new RegExp('(?:' + items.map(part).join('|') + ')', 'u') : null;
      reCache.set(key, re);
      if (reCache.size > 20) reCache.delete(reCache.keys().next().value);
    }
    return re;
  }

  function normUser(u) {
    return norm(u).replace(/^@/, '');
  }

  // Klucz do wykrywania PODOBNYCH (nie tylko identycznych) tekstów:
  // "Come to Fenerbahçe 💛💙" = "come to fenerbahce!!" = "COME TO FENERBAHCE 💛".
  function dupKey(text) {
    return String(text || '')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '') // ogonki i akcenty
      .toLowerCase()
      .replace(/ł/g, 'l').replace(/ø/g, 'o').replace(/ß/g, 'ss')
      .replace(/(https?:\/\/|www\.)\S+/g, ' url ')
      .replace(/@[\w.]+/g, ' @ ') // oznaczenia kont – boty podmieniają nazwy
      .replace(/\d+/g, '0') // liczby – boty podmieniają kwoty
      .replace(/[^\p{L}\p{N}@ ]+/gu, ' ') // emoji i interpunkcja
      .replace(/(\p{L})\1{2,}/gu, '$1$1') // "goooool" → "gool"
      .replace(/\s+/g, ' ')
      .trim();
  }

  function suspiciousUsername(u) {
    if (!u) return false;
    if (/\d{5,}/.test(u)) return true; // np. anna83920
    if (/\d{4}/.test(u) && !/(19|20)\d{2}/.test(u)) return true; // 4 cyfry, ale nie rok urodzenia
    if (/[a-z]\d{2,}[a-z]{2,}\d*$/.test(u)) return true; // np. kasia83xk
    if ((u.match(/[._]/g) || []).length >= 4) return true; // np. a.n.n.a_x_x
    // "walenie w klawiaturę": xjxjxjxjxj9, asdasdasd, qwrtzx – powtarzany wzór albo brak samogłosek
    const letters = u.replace(/[^a-z]/g, '');
    // (wzór musi powtórzyć się 3 razy – "barbara" ani "anna" nie są podejrzane)
    if (/(..)\1{2,}/.test(letters) || /(...)\1{2,}/.test(letters)) return true;
    if (letters.length >= 6 && !/[aeiouy]/.test(letters)) return true;
    return false;
  }

  function isGenericOnly(text) {
    const words = text.replace(EMOJI_RE, ' ').replace(/[^\p{L}\p{N}\s!]/gu, ' ').split(/\s+/).filter(Boolean);
    if (words.length > 4) return false;
    return words.every((w) => GENERIC_WORDS.has(w.replace(/!+$/, '')));
  }

  /**
   * @param {object} c komentarz: {text, user, mentions, verified, defaultPic, delaySec, likes, dupCount}
   * @param {object} opts {phrases, botAccounts, whitelist, sensitivity}
   * @returns {{score:number, reasons:string[], isBot:boolean}}
   */
  function score(c, opts) {
    opts = opts || {};
    const reasons = [];
    let s = 0;
    const text = norm(c.text);
    const user = normUser(c.user);
    const add = (pts, why) => {
      s += pts;
      if (why && pts > 0) reasons.push(why);
    };

    const whitelist = new Set((opts.whitelist || []).map(normUser));
    const bots = new Set((opts.botAccounts || []).map(normUser));
    const sharedBots = opts.sharedBotAccounts instanceof Set ? opts.sharedBotAccounts
      : new Set((opts.sharedBotAccounts || []).map(normUser));
    if (user && whitelist.has(user)) return { score: -100, reasons: [], isBot: false };
    if (user && bots.has(user)) return { score: 100, reasons: ['konto z Twojej listy botów'], isBot: true };
    if (user && sharedBots.has(user)) return { score: 100, reasons: ['konto ze wspólnej listy botów'], isBot: true };

    if (text) {
      const strong = phraseRe(opts.phrases || DEFAULT_BOT_PHRASES);
      const m1 = strong && strong.exec(text);
      if (m1) add(4, '„' + m1[0] + '”');

      const m2 = phraseRe(MEDIUM_PHRASES).exec(text);
      if (m2) {
        add(2, '„' + m2[0] + '”');
        // drugi, inny podejrzany zwrot (np. "zarobiłem" + "dzięki pani")
        const rest = text.slice(0, m2.index) + ' ' + text.slice(m2.index + m2[0].length);
        const m2b = phraseRe(MEDIUM_PHRASES).exec(rest);
        if (m2b) add(2, '„' + m2b[0] + '”');
      }

      const m3 = phraseRe(GENERIC_BOT_PHRASES).exec(text);
      if (m3) add(2, 'ogólnik „' + m3[0] + '”');
      else if (isGenericOnly(text)) add(1, 'pusty ogólnik');

      if (phraseRe(LLM_PHRASES).test(text)) add(1, 'styl komentarza AI');
      if (LINK_RE.test(text)) add(2, 'link');
      if (PHONE_RE.test(text)) add(2, 'numer telefonu');

      const emoji = (text.match(EMOJI_RE) || []).length;
      const letters = (text.match(LETTER_RE) || []).length;
      if (emoji >= 6 && letters <= 3) add(1, 'same emoji');

      if (c.dupCount >= 2 && letters >= 8 && !DUP_EXEMPT_RE.test(text)) {
        if (isGenericOnly(text) || letters < 25) add(1, 'powtarzany krótki tekst');
        else add(c.dupCount >= 3 ? 4 : 3, 'ten sam tekst u wielu kont');
      }
    }

    // To samo konto wkleja ten sam komentarz wiele razy (sprawdzone na żywo: "Come to Fenerbahçe" ×25).
    if (c.selfRepeat >= 3) add(4, 'to samo konto wkleja ten sam tekst ×' + c.selfRepeat);
    else if (c.selfRepeat === 2) add(3, 'ten sam komentarz dwa razy');

    // Pamięć między postami (7 dni): ten sam komentarz tego konta pod różnymi postami.
    // Życzenia, ogólniki i bardzo krótkie teksty ludzie też kopiują – za nie najwyżej +1.
    if (c.crossPosts >= 2) {
      const letters = (text.match(LETTER_RE) || []).length;
      const humanish = DUP_EXEMPT_RE.test(text) || isGenericOnly(text) || letters < 15;
      if (humanish) add(1, 'powtarza krótki tekst pod różnymi postami');
      else if (c.crossPosts >= 3) add(4, 'ten sam komentarz pod ' + c.crossPosts + ' postami');
      else add(2, 'ten sam komentarz pod 2 postami');
    }
    if (c.knownBot) add(2, 'wcześniej oznaczony jako bot');

    if ((c.mentions || 0) >= 3) add(2, 'masowe oznaczanie kont');
    if (suspiciousUsername(user)) add(1, 'dziwna nazwa konta');
    if (c.defaultPic) add(2, 'brak zdjęcia profilowego');
    if (typeof c.delaySec === 'number' && c.delaySec >= 0 && c.delaySec < 60) add(2, 'komentarz w <1 min od publikacji');

    if (c.verified) add(-6);
    if (typeof c.likes === 'number') {
      if (c.likes >= 100) add(-3);
      else if (c.likes >= 20) add(-1);
    }

    const threshold = THRESHOLDS[opts.sensitivity] || THRESHOLDS.medium;
    return { score: s, reasons, isBot: s >= threshold };
  }

  const api = { score, dupKey, DEFAULT_BOT_PHRASES, THRESHOLDS, DEFAULT_PIC_RE, suspiciousUsername };
  root.AIBBots = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

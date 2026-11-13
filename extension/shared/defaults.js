/* Bez AI – wspólne ustawienia domyślne, konfiguracja stron i funkcje pomocnicze.
   Ładowany przez skrypt treści, okienko (popup) i stronę ustawień. */
(function () {
  'use strict';

  // Wspólna lista kont prowadzona w repozytorium projektu (plik lista/lista.txt).
  const PROJECT_LIST_URL = 'https://raw.githubusercontent.com/adamczochrowski-netizen/BezAI/main/lista/lista.txt';

  // Selektory "kontenerów" – elementu, który ukrywamy, gdy w środku znajdziemy sygnał AI.
  // Kolejność ma znaczenie: dla każdego sygnału bierzemy pierwszy pasujący selektor (closest()).
  // dataHook: strona ładuje dane postów (z pełnym opisem i polem ai_label_info) – czytamy je.
  // mediaFallback: gdy nie ma znacznika posta (strona posta, Reels, siatka Eksploruj),
  //   ukrywamy najbliższy blok z dużym zdjęciem/wideo – zawsze jako rozmycie.
  const SITES = {
    instagram: {
      name: 'Instagram',
      hosts: ['instagram.com'],
      containers: ['article'],
      dataHook: true,
      mediaFallback: true,
      noFallbackPaths: [/^\/direct\//, /^\/accounts\//],
      // Komentarze na Instagramie nie mają znacznika – rozpoznajemy wiersze listy (awatar + link do profilu).
      commentHeuristic: true
    },
    facebook: {
      name: 'Facebook',
      hosts: ['facebook.com'],
      // Tylko w głównej części strony – role="article" poza nią to wiadomości z czatu Messengera.
      // Komentarze otwierają się też w oknie (role="dialog") – opis: "Komentarz Imię Nazwisko 9 godz. temu".
      containers: [
        '[role="main"] [role="article"][aria-label]',
        '[role="dialog"] [role="article"][aria-label]',
        '[role="main"] [aria-posinset]',
        '[role="main"] [data-pagelet^="FeedUnit"]',
        '[role="main"] [role="feed"] > div'
      ],
      commentSelector: '[role="article"][aria-label]',
      commentScope: '[role="main"], [role="dialog"]'
    },
    threads: {
      name: 'Threads',
      hosts: ['threads.com', 'threads.net'],
      containers: ['div[data-pressable-container="true"]'],
      dataHook: true,
      // Jak na X: w wyszukiwaniu "ai art" (13.11.2026) połowa wpisów to opinie o AI ("AI art isn't that
      // good, yet") – tylko rozmywamy. Temat wpisu wybrany przez autora (link "AI Art" obok nazwy konta,
      // /search?q=AI%20Art&serp_type=tags) liczy się w pełni.
      topicSoft: true,
      authorSel: 'a[href*="serp_type=tags"]'
    },
    // topicSoft: tytuły i wpisy często są *o* AI (newsy, recenzje, dyskusje), a nie *z* AI –
    //   frazy tematyczne ("ai art", "midjourney") tylko rozmywają, zamiast ukrywać.
    x: {
      name: 'X (Twitter)',
      hosts: ['x.com', 'twitter.com'],
      containers: ['article[data-testid="tweet"]', '[data-testid="cellInnerDiv"]'],
      topicSoft: true,
      // Nazwa konta: "Miku AI Art", "AI art gallery" – konto samo mówi, że publikuje AI (sprawdzone
      // na żywo 13.11.2026), więc fraza w nazwie liczy się w pełni, a nie tylko jako temat.
      authorSel: '[data-testid="User-Name"]',
      // Odpowiedzi pod wpisem (strona /konto/status/123) oceniamy jak komentarze; autor wpisu = z adresu.
      // Na X prawie każdy ma płatny znaczek i fani odpowiadają w kilkadziesiąt sekund – tych sygnałów nie liczymy.
      commentSelector: 'article[data-testid="tweet"]',
      commentPath: /^\/[^/]+\/status\/\d+/,
      commentTextSel: '[data-testid="tweetText"]',
      likesSel: '[data-testid="like"], [data-testid="unlike"]'
    },
    youtube: {
      name: 'YouTube',
      hosts: ['youtube.com'],
      topicSoft: true,
      // Elementy samej platformy, których nie oceniamy: "Podsumowanie filmu wygenerowane przez AI"
      // to streszczenie robione przez YouTube, a nie treść AI (sprawdzone na żywo 13.11.2026).
      ignore: 'ytd-expandable-metadata-renderer',
      authorSel: 'ytd-channel-name, #channel-name',
      containers: [
        'ytd-rich-item-renderer',
        'ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-reel-item-renderer',
        'ytd-playlist-video-renderer',
        'ytd-playlist-panel-video-renderer',
        'ytd-comment-view-model',
        'ytd-comment-renderer',
        'yt-lockup-view-model',
        'ytm-shorts-lockup-view-model-v2',
        'ytm-shorts-lockup-view-model',
        'ytm-rich-item-renderer',
        'ytm-video-with-context-renderer',
        'ytm-compact-video-renderer'
      ],
      commentSelector: 'ytd-comment-view-model, ytd-comment-renderer'
    },
    reddit: {
      name: 'Reddit',
      hosts: ['reddit.com'],
      containers: ['shreddit-comment', 'article', 'shreddit-post', 'div.thing'],
      commentSelector: 'shreddit-comment',
      topicSoft: true
    }
  };

  // Etykiety, które platformy same doklejają do treści AI. Porównanie dokładne (bez wielkości liter).
  // Instagram/Facebook po polsku piszą "SI" (sprawdzone na żywo 12.11.2026).
  // Dodatkowo skrypt treści rozpoznaje warianty wzorcem (np. "… utworzone przez SI").
  const DEFAULT_LABELS = [
    'Treści utworzone przez SI',
    'Profil wygenerowany przez SI',
    'Prawdopodobnie utworzone przy użyciu SI',
    'Informacje o SI',
    'AI info',
    'Informacje o AI',
    'Made with AI',
    'Imagined with AI',
    'AI-generated',
    'AI generated',
    'AI-generated content',
    'Generated by AI',
    'Generated with AI',
    'Wygenerowane przez AI',
    'Wygenerowano przez AI',
    'Wygenerowane przez SI',
    'Utworzone przy użyciu AI',
    'Stworzone przy użyciu AI',
    'Treści wygenerowane przez AI',
    'Creator labeled as AI-generated',
    'Twórca oznaczył jako wygenerowane przez AI',
    'Altered or synthetic content',
    'Zmienione lub syntetyczne treści',
    'Treści zmienione lub syntetyczne'
  ];

  // Hashtagi (bez #). Celowo NIE ma tu samego #ai – posty o AI to nie to samo co treści z AI.
  const DEFAULT_HASHTAGS = [
    'aiart', 'aiartwork', 'aiartworks', 'aiartist', 'aiartists', 'aiartcommunity', 'aiartgallery',
    'aiartdaily', 'aigenerated', 'aigeneratedart', 'aigeneratedimage', 'aigeneratedimages',
    'aigeneratedvideo', 'aiimage', 'aiimages', 'aiphoto', 'aiphotography', 'aiportrait', 'aivideo',
    'aianimation', 'aifilm', 'aimodel', 'aiinfluencer', 'aigirl', 'aigirls', 'aiwoman', 'aibeauty',
    'aifashion', 'aidesign', 'aicreator', 'aiillustration', 'aidigitalart', 'madewithai',
    'createdwithai', 'generatedwithai', 'midjourney', 'midjourneyart', 'midjourneyai',
    'midjourneyartwork', 'midjourneyv6', 'midjourneyv7', 'nijijourney', 'stablediffusion',
    'stablediffusionart', 'sdxl', 'dalle', 'dalle2', 'dalle3', 'chatgptart', 'chatgptimage',
    'gptimage', 'soraai', 'sora2', 'openaisora', 'runwayml', 'runwayai', 'klingai', 'veo3',
    'googleveo', 'leonardoai', 'fluxai', 'ideogram', 'adobefirefly', 'nanobanana', 'grokimagine',
    'sztukaai', 'grafikaai', 'obrazai', 'wygenerowaneprzezai',
    // Z prawdziwych tytułów na YouTube (13.11.2026):
    'aishorts', 'aivideos', 'aimusic', 'aimusicvideo', 'aisong', 'aicover', 'aigeneratedmusic',
    'sunoai', 'higgsfieldai'
  ];

  // Frazy szukane w tekście posta (całe słowa, bez wielkości liter).
  const DEFAULT_KEYWORDS = [
    'ai-generated', 'ai generated', 'generated by ai', 'generated with ai', 'made with ai',
    'created with ai', 'created by ai', 'made by ai', 'ai art', 'ai artwork', 'midjourney',
    'stable diffusion', 'dall-e', 'dall·e', 'nijijourney', 'made with sora', 'made with veo',
    'made with kling', 'wygenerowane przez ai', 'wygenerowany przez ai', 'wygenerowana przez ai',
    'wygenerowano przez ai', 'wygenerowane przez sztuczną inteligencję',
    'wygenerowany przez sztuczną inteligencję', 'wygenerowana przez sztuczną inteligencję',
    'stworzone przez sztuczną inteligencję', 'stworzone przez ai',
    'utworzone przez si', 'wygenerowane przez si', 'stworzone przez si', 'utworzone przy użyciu si',
    'wygenerowane przy użyciu si', 'utworzone przez ai', 'utworzone przy użyciu ai',
    'stworzone z ai', 'stworzone przy użyciu ai', 'zrobione przez ai', 'grafika ai', 'obraz ai',
    'ai music video', 'made with midjourney', 'made with suno', 'made with runway',
    // Zapis z kropkami ("Pink Floyd - Echoes (A.I. Generated Music Video)", YouTube 13.11.2026)
    'a.i. generated', 'a.i.-generated', 'generated by a.i.', 'made with a.i.', 'a.i. art'
  ];

  // ---------- "z AI" czy "o AI"? ----------
  // Frazy tematyczne: pasują i do treści z AI ("AI generated viking music"), i do treści o AI
  // ("Is AI-Generated Art Original?", "Midjourney V7 review"). W pytaniu, newsie czy recenzji są
  // pomijane. Pozostałe frazy to przyznanie się twórcy ("made with AI", "wygenerowane przez AI") –
  // w pytaniu tylko rozmywają.
  // Na prawdziwym YouTube (13.11.2026) tytuł z "AI generated" bez pytania/dyskusji to w 13 na 14
  // przypadków film AI – dlatego takie tytuły nadal są ukrywane. Za to "AI art" i nazwy narzędzi
  // w treści wpisów na X to często opinie ("AI art is never more perfect") – tam tylko rozmywamy.
  const SOFT_TOPIC_KEYWORDS = new Set([
    'ai art', 'ai artwork', 'a.i. art', 'grafika ai', 'obraz ai',
    'midjourney', 'stable diffusion', 'dall-e', 'dall·e', 'nijijourney'
  ]);
  const TOPIC_KEYWORDS = new Set(['ai-generated', 'ai generated', 'a.i. generated', 'a.i.-generated',
    'ai music video', ...SOFT_TOPIC_KEYWORDS]);
  const W = (words) => new RegExp('(?<![\\p{L}\\p{N}])(?:' + words.join('|') + ')(?![\\p{L}\\p{N}])', 'u');
  // Zdanie zaczyna się od słowa pytającego.
  const QUESTION_START_RE = new RegExp('^(?:is|are|was|were|can|could|should|would|will|do|does|did|why|how|what|which|who|when|where|has|have|' +
    'czy|jak|dlaczego|czemu|co|kto|kiedy|gdzie|ile|który|która|które)(?![\\p{L}\\p{N}])', 'u');
  // Słowa typowe dla newsów, recenzji, poradników i dyskusji o AI.
  const DISCUSSION_RE = W([
    'vs', 'versus', 'debate', 'explained?', 'explaining', 'explainer', 'reviews?', 'reviewed', 'tutorials?', 'guide',
    'how to', 'news', 'bans?', 'banned', 'banning', 'lawsuits?', 'laws?', 'copyright', 'detect', 'detecting',
    'detectors?', 'detection', 'spot', 'spotting', 'tell if', 'fakes?', 'scams?', 'problems?', 'dangers?',
    'dangerous', 'ethics', 'ethical', 'theft', 'steal', 'stealing', 'stolen', 'artists', 'controversy',
    'controversial', 'regulations?', 'study', 'research', 'report', 'podcast', 'interview', 'opinion',
    'reaction', 'reacts?', 'reacting', 'documentary', 'threat', 'truth', 'myths?', 'lies', 'exposed',
    'warning', 'against', 'hate', 'ruining', 'ruined', 'destroying', 'replac(?:e|es|ed|ing)', 'jobs',
    'future', 'course', 'lesson', 'learn', 'tips', 'tricks', 'comparison', 'compared', 'test', 'tested', 'testing',
    'tools', 'apps?', 'software', 'plugins?', 'generator\\p{L}*', 'narzędzi\\p{L}*', 'aplikacj\\p{L}*',
    'feels? like', 'sounds? like', 'i think', 'imo', 'judg\\p{L}*', 'is not art', 'isn.t art', 'nie jest sztuką',
    'czy', 'jak rozpoznać', 'rozpozna\\p{L}*', 'poradnik\\p{L}*', 'recenzj\\p{L}*', 'testuj\\p{L}*', 'porównanie',
    'wywiad\\p{L}*', 'afer\\p{L}*', 'zakaz\\p{L}*', 'praw[oa]', 'prawa autorskie', 'artyst\\p{L}*', 'kradzież\\p{L}*',
    'kradnie', 'oszust\\p{L}*', 'wiadomości', 'debat\\p{L}*', 'zagrożeni\\p{L}*', 'problem\\p{L}*', 'fałszyw\\p{L}*',
    'wykry\\p{L}*', 'przyszłoś\\p{L}*', 'kontrowers\\p{L}*', 'etyk\\p{L}*', 'przeciw', 'przeciwko', 'kurs\\p{L}*',
    'lekcj\\p{L}*', 'porady', 'wyjaśnia\\p{L}*', 'o co chodzi', 'prawda', 'mit', 'mity',
    // Zachęty z poradników (opisy filmów na YouTube, 13.11.2026)
    // (bez "prompt" i "workflow" – twórcy AI piszą "prompt w komentarzu", "workflow w bio")
    'create your own', 'make your own', 'step by step', 'masterclass', 'stwórz własn\\p{L}*', 'krok po kroku'
  ]);

  // Słowo przeczące bezpośrednio przed frazą (na żywo, Threads 13.11.2026: "I love tarot and non AI art").
  const NEGATION_RE = /(?:^|[^\p{L}\p{N}])(?:non|not|no|zero|anti|without|never|nie|bez|nigdy|żadn\p{L}*)[\s\-–]*$|n['’]t\s+$/u;

  // Kropka kończy zdanie tylko przed odstępem albo na końcu tekstu – nie w linkach
  // ("https://tolt.link/…"), skrótach ("A.I.") ani liczbach ("Seedance 2.5").
  function isStop(t, i, stops) {
    if (!stops.includes(t[i])) return false;
    return t[i] !== '.' || i + 1 >= t.length || /\s/.test(t[i + 1]);
  }

  // Fragment tekstu wokół trafienia, ograniczony podanymi znakami.
  function around(t, index, len, stops) {
    let s = index;
    while (s > 0 && !isStop(t, s - 1, stops)) s--;
    let e = index + len;
    while (e < t.length && !isStop(t, e, stops)) e++;
    return { text: t.slice(s, e).trim(), end: t[e] || '' };
  }

  /**
   * Jak mocny jest sygnał z frazy znalezionej w tekście (t – tekst po normText).
   * 'strong' – ukryj jak zwykle, 'weak' – tylko rozmyj, 'ignore' – to raczej treść *o* AI.
   */
  function keywordStrength(t, index, phrase, topicSoft) {
    // Zaprzeczenie tuż przed frazą: "non AI art", "not AI generated", "nie wygenerowane przez AI".
    if (NEGATION_RE.test(t.slice(Math.max(0, index - 16), index))) return 'ignore';
    // Zdanie pytające ("Is AI-Generated Art Original?") – liczy się zdanie z frazą, nie całe opisy:
    // "Wygenerowane przez AI, co myślicie?" to nadal przyznanie się twórcy.
    const clause = around(t, index, phrase.length, '.!?\n,;:');
    const question = clause.end === '?' || QUESTION_START_RE.test(clause.text);
    const sentence = around(t, index, phrase.length, '.!?\n');
    const discussion = question || DISCUSSION_RE.test(sentence.text.replace(phrase, ' '));
    if (TOPIC_KEYWORDS.has(phrase)) {
      if (discussion) return 'ignore';
      // Na YouTube/X/Reddicie "AI art" i nazwy narzędzi to często opinie, poradniki i nowości – tylko rozmywamy.
      return SOFT_TOPIC_KEYWORDS.has(phrase) && topicSoft ? 'weak' : 'strong';
    }
    return discussion ? 'weak' : 'strong';
  }

  const DEFAULTS = {
    enabled: true,
    mode: 'hide', // 'hide' | 'blur'
    detectLabels: true,
    detectHashtags: true,
    detectKeywords: true,
    detectAccounts: true,
    blurTopics: true, // treści, które tylko *mówią* o AI (tytuły, pytania): rozmyj zamiast nic nie robić
    sites: Object.fromEntries(Object.keys(SITES).map((k) => [k, true])),
    labels: DEFAULT_LABELS,
    hashtags: DEFAULT_HASHTAGS,
    keywords: DEFAULT_KEYWORDS,
    accounts: [],
    // Komentarze botów (ocena punktowa w shared/bot-score.js)
    detectBots: true,
    botSensitivity: 'medium', // 'low' | 'medium' | 'high'
    botMode: 'collapse', // 'collapse' (zwiń do paska) | 'hide'
    botMemory: true, // pamięć między postami (7 dni, lokalnie, tylko skróty)
    botPhrases: globalThis.AIBBots ? globalThis.AIBBots.DEFAULT_BOT_PHRASES.slice() : [],
    botAccounts: [],
    botWhitelist: [], // "Zaufane konta" – wyjątki od wszystkich list kont (własnych i wspólnych)
    // Wspólne listy: [{url, enabled}] – pobrane wpisy leżą w chrome.storage.local.sharedListData.
    // Domyślnie subskrybowana jest lista projektu (dopóki ktoś nie zmieni subskrypcji w ustawieniach).
    sharedLists: [{ url: PROJECT_LIST_URL, enabled: true }]
  };
  const LIST_KEYS = ['labels', 'hashtags', 'keywords', 'accounts', 'botPhrases', 'botAccounts', 'botWhitelist', 'sharedLists'];

  function normText(s) {
    return String(s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Etykieta: dodatkowo obcinamy kropki/kreski/separatory z brzegów ("• AI info").
  function normLabel(s) {
    return normText(s).replace(/^[\s·•|:\-–—]+|[\s·•|:\-–—]+$/g, '');
  }

  function normHashtag(s) {
    return normText(s).replace(/^#+/, '').replace(/\s+/g, '');
  }

  // Konto: przyjmuje "@nazwa", "nazwa", "u/nazwa", "r/sub" albo pełny link do profilu.
  function normAccount(s) {
    let v = String(s || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v) || /^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(v)) {
      try {
        const url = new URL(/^https?:/i.test(v) ? v : 'https://' + v);
        const cands = accountCandidatesFromUrl(url);
        return cands[0] || '';
      } catch (e) {
        return '';
      }
    }
    v = normText(v).replace(/^\/+|\/+$/g, '').replace(/^@/, '');
    v = v.replace(/^user\//, 'u/');
    return v;
  }

  // Z linku do profilu wyciąga możliwe identyfikatory konta, z którymi porównujemy listę.
  function accountCandidatesFromUrl(url) {
    const segs = url.pathname.split('/').filter(Boolean).map((seg) => {
      try { return decodeURIComponent(seg).toLowerCase(); } catch (e) { return seg.toLowerCase(); }
    });
    if (!segs.length) return [];
    const out = [];
    const s0 = segs[0].replace(/^@/, '');
    if (s0 === 'profile.php') {
      const id = url.searchParams.get('id');
      if (id) out.push(id);
      return out;
    }
    if ((s0 === 'r' || s0 === 'u' || s0 === 'user') && segs[1]) {
      out.push((s0 === 'user' ? 'u' : s0) + '/' + segs[1]);
      out.push(segs[1]);
      return out;
    }
    if ((s0 === 'channel' || s0 === 'c') && segs[1]) {
      out.push(segs[1]);
      return out;
    }
    out.push(s0);
    return out;
  }

  function siteKeyForHost(hostname) {
    const h = String(hostname || '').toLowerCase();
    for (const [key, site] of Object.entries(SITES)) {
      if (site.hosts.some((d) => h === d || h.endsWith('.' + d))) return key;
    }
    return null;
  }

  function withDefaults(stored) {
    const s = Object.assign({}, DEFAULTS, stored || {});
    s.sites = Object.assign({}, DEFAULTS.sites, (stored && stored.sites) || {});
    for (const k of LIST_KEYS) {
      if (!Array.isArray(s[k])) s[k] = DEFAULTS[k].slice();
    }
    s.sharedLists = s.sharedLists.map((x) => Object.assign({}, x));
    return s;
  }

  // Subskrypcje wspólnych list: zapisane albo – gdy nikt ich jeszcze nie zmieniał – domyślne.
  async function loadSharedLists() {
    const { sharedLists } = await chrome.storage.sync.get('sharedLists');
    const list = Array.isArray(sharedLists) ? sharedLists : DEFAULTS.sharedLists;
    return list.map((x) => Object.assign({}, x));
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (stored) => resolve(withDefaults(stored)));
    });
  }

  // ---------- szybkie oznaczanie kont (menu pod prawym przyciskiem, przyciski na stronie) ----------

  // Pierwsze części adresów, które nie są nazwą konta (post, wyszukiwanie, grupy…).
  const NOT_ACCOUNT = new Set([
    'p', 'reel', 'reels', 'tv', 'explore', 'stories', 'direct', 'accounts', 'about', 'legal', 'privacy', 'terms',
    'developer', 'web', 'emails', 'challenge', 'home', 'search', 'notifications', 'watch', 'shorts', 'results',
    'playlist', 'feed', 'hashtag', 'i', 'settings', 'messages', 'groups', 'photo', 'photos', 'permalink.php',
    'story.php', 'events', 'marketplace', 'gaming', 'video', 'videos', 'share', 'login', 'signup', 'compose',
    'intent', 'post', 'posts', 'help', 'policies', 'bookmarks', 'friends', 'pages', 'live', 'premium'
  ]);

  // Link do profilu → {site, name} albo null, gdy to nie jest link do konta na obsługiwanej stronie.
  function accountFromLink(href) {
    let url;
    try { url = new URL(href); } catch (e) { return null; }
    const site = siteKeyForHost(url.hostname);
    if (!site) return null;
    const name = accountCandidatesFromUrl(url)[0];
    if (!name || NOT_ACCOUNT.has(name)) return null;
    return { site, name };
  }

  function accountLabel(name) {
    const n = normAccount(name);
    return n.includes('/') ? n : '@' + n;
  }

  /**
   * Ustawia status konta na listach użytkownika (jeden zapis = jedno przeliczenie strony):
   * 'ai' – ukrywaj posty (Konta AI), 'bot' – zwijaj komentarze (Konta botów),
   * 'trust' – Zaufane konta (wygrywają ze wszystkimi listami), 'none' – usuń z tych trzech list.
   */
  async function setAccountStatus(name, status) {
    const n = normAccount(name);
    if (!n) return false;
    const keys = ['accounts', 'botAccounts', 'botWhitelist'];
    const st = await chrome.storage.sync.get(keys);
    const lists = {};
    for (const k of keys) lists[k] = Array.isArray(st[k]) ? st[k].slice() : DEFAULTS[k].slice();
    const drop = (k) => { lists[k] = lists[k].filter((x) => normAccount(x) !== n); };
    if (status === 'ai') { drop('botWhitelist'); drop('accounts'); lists.accounts.push(accountLabel(n)); }
    else if (status === 'bot') { drop('botWhitelist'); drop('botAccounts'); lists.botAccounts.push(accountLabel(n)); }
    else if (status === 'trust') { drop('accounts'); drop('botAccounts'); drop('botWhitelist'); lists.botWhitelist.push(accountLabel(n)); }
    else if (status === 'none') { for (const k of keys) drop(k); }
    else return false;
    await chrome.storage.sync.set(lists);
    return true;
  }

  globalThis.AIB = {
    SITES,
    DEFAULTS,
    normText,
    normLabel,
    normHashtag,
    normAccount,
    accountCandidatesFromUrl,
    siteKeyForHost,
    withDefaults,
    loadSettings,
    loadSharedLists,
    keywordStrength,
    TOPIC_KEYWORDS,
    PROJECT_LIST_URL,
    accountFromLink,
    accountLabel,
    setAccountStatus,
    NOT_ACCOUNT
  };
})();

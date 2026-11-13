/* Bez AI – strona edycji list. */
'use strict';

const AIB = globalThis.AIB;

const LISTS = [
  {
    key: 'accounts',
    title: 'Zablokowane konta',
    desc: 'np. @ai.art.daily, u/nazwa, r/aiArt albo link do profilu.',
    norm: AIB.normAccount
  },
  {
    key: 'hashtags',
    title: 'Hashtagi',
    desc: 'Bez znaku # (można też z #).',
    norm: AIB.normHashtag
  },
  {
    key: 'keywords',
    title: 'Frazy w opisie',
    desc: 'Szukane jako całe słowa, bez wielkości liter.',
    norm: AIB.normText
  },
  {
    key: 'labels',
    title: 'Etykiety platform',
    desc: 'Dokładny tekst etykiety AI, np. „AI info”.',
    norm: (s) => s.replace(/\s+/g, ' ').trim()
  },
  {
    key: 'botPhrases',
    title: 'Frazy botów',
    desc: 'Zwroty prawie zawsze oznaczające spam (+4 pkt), np. „check my bio”.',
    norm: AIB.normText
  },
  {
    key: 'botAccounts',
    title: 'Konta botów',
    desc: 'Komentarze tych kont są zawsze zwijane.',
    norm: AIB.normAccount
  },
  {
    key: 'botWhitelist',
    title: 'Zaufane konta',
    desc: 'Nigdy nie ukrywane z powodu list kont (własnych i wspólnych) ani zwijane jako boty – np. znajomi.',
    norm: AIB.normAccount
  }
];

let settings = null;
const areas = {};

function parse(list, text) {
  const seen = new Set();
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const v = list.norm(line);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function updateCount(list) {
  const n = parse(list, areas[list.key].value).length;
  document.getElementById('count-' + list.key).textContent = n + ' poz.';
}

function build() {
  const root = document.getElementById('lists');
  for (const list of LISTS) {
    const card = document.createElement('section');
    card.className = 'list';

    const head = document.createElement('div');
    head.className = 'head';
    const h = document.createElement('h2');
    h.textContent = list.title;
    const count = document.createElement('span');
    count.className = 'count';
    count.id = 'count-' + list.key;
    head.append(h, count);

    const p = document.createElement('p');
    p.textContent = list.desc;

    const ta = document.createElement('textarea');
    ta.spellcheck = false;
    ta.value = settings[list.key].join('\n');
    ta.setAttribute('aria-label', list.title);
    ta.addEventListener('input', () => {
      updateCount(list);
      setMsg('Masz niezapisane zmiany.', '');
    });
    areas[list.key] = ta;

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'reset';
    const isUserList = ['accounts', 'botAccounts', 'botWhitelist'].includes(list.key);
    reset.textContent = isUserList ? 'Wyczyść listę' : 'Przywróć domyślne';
    reset.addEventListener('click', () => {
      ta.value = AIB.DEFAULTS[list.key].join('\n');
      updateCount(list);
      setMsg('Masz niezapisane zmiany.', '');
    });

    card.append(head, p, ta, reset);
    root.append(card);
    updateCount(list);
  }
}

function setMsg(text, cls) {
  const el = document.getElementById('saveMsg');
  el.textContent = text;
  el.className = cls;
}

async function save() {
  const patch = {};
  for (const list of LISTS) {
    patch[list.key] = parse(list, areas[list.key].value);
    areas[list.key].value = patch[list.key].join('\n');
    updateCount(list);
  }
  try {
    await chrome.storage.sync.set(patch);
    Object.assign(settings, patch);
    setMsg('Zapisano ✓', 'ok');
  } catch (e) {
    setMsg('Nie udało się zapisać (lista może być za długa): ' + (e && e.message ? e.message : e), 'err');
  }
}

// ---------- wspólne listy ----------

const $ = (id) => document.getElementById(id);

function listMsg(text, cls) {
  const el = $('listMsg');
  el.textContent = text;
  el.className = 'msg ' + (cls || '');
}

function fmtTime(ts) {
  if (!ts) return 'jeszcze nie pobrano';
  const d = new Date(ts);
  return d.toLocaleDateString('pl-PL') + ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

async function getSubs() {
  return AIB.loadSharedLists();
}

async function setSubs(subs) {
  await chrome.storage.sync.set({ sharedLists: subs });
  settings.sharedLists = subs;
}

async function renderSubs() {
  const subs = await getSubs();
  const { sharedListData = {} } = await chrome.storage.local.get('sharedListData');
  const box = $('subs');
  box.textContent = '';
  if (!subs.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Nie subskrybujesz jeszcze żadnej listy.';
    box.append(p);
    return;
  }
  for (const s of subs) {
    const d = sharedListData[s.url] || {};
    const row = document.createElement('div');
    row.className = 'sub' + (s.enabled === false ? ' off' : '');

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = s.enabled !== false;
    toggle.setAttribute('aria-label', 'Włącz listę');
    toggle.addEventListener('change', async () => {
      const all = await getSubs();
      const it = all.find((x) => x.url === s.url);
      if (it) it.enabled = toggle.checked;
      await setSubs(all);
      renderSubs();
    });

    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('b');
    title.textContent = d.title || 'Lista bez tytułu'; // tekst z cudzego serwera – tylko jako tekst
    const url = document.createElement('small');
    url.textContent = s.url;
    const meta = document.createElement('span');
    meta.className = 'meta';
    const ai = (d.ai || []).length;
    const bot = (d.bot || []).length;
    meta.textContent = 'AI: ' + ai + ' · boty: ' + bot + ' · ' +
      (d.ok === false ? 'błąd: ' + d.error : 'pobrano ' + fmtTime(d.fetchedAt)) +
      (d.updated ? ' · lista z ' + d.updated : '');
    if (d.ok === false) meta.classList.add('err');
    info.append(title, url, meta);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'ghost small';
    del.textContent = 'Usuń';
    del.addEventListener('click', async () => {
      await setSubs((await getSubs()).filter((x) => x.url !== s.url));
      await AIBLists.refreshAll();
      listMsg('Usunięto listę.', '');
      renderSubs();
    });

    row.append(toggle, info, del);
    box.append(row);
  }
}

function bindShared() {
  $('addList').addEventListener('submit', async (e) => {
    e.preventDefault();
    const first = AIBLists.validUrl($('listUrl').value);
    const url = first && AIBLists.validUrl(AIBLists.rawUrl(first));
    if (!url) {
      listMsg('Podaj adres listy zaczynający się od https://', 'err');
      return;
    }
    // Zgoda Chrome na pobieranie z tego serwera – musi paść od razu po kliknięciu.
    if (chrome.permissions && chrome.permissions.request && url.startsWith('https:')) {
      let granted = false;
      try {
        granted = await chrome.permissions.request({ origins: [new URL(url).origin + '/*'] });
      } catch (err) {
        granted = false;
      }
      if (!granted) {
        listMsg('Bez zgody Chrome wtyczka nie może pobierać listy z tego serwera.', 'err');
        return;
      }
    }
    const subs = await getSubs();
    if (subs.some((s) => s.url === url)) {
      listMsg('Ta lista już jest subskrybowana.', '');
      return;
    }
    subs.push({ url, enabled: true });
    await setSubs(subs);
    listMsg('Pobieram listę…', '');
    const data = await AIBLists.refreshAll(url);
    const d = data[url] || {};
    $('listUrl').value = '';
    if (d.ok) {
      listMsg('Dodano „' + (d.title || 'Lista bez tytułu') + '”: ' + d.ai.length + ' kont AI, ' + d.bot.length +
        ' botów' + (d.errors ? ' (pominięto ' + d.errors + ' błędnych linii)' : '') + '.', 'ok');
    } else {
      listMsg('Dodano, ale nie udało się pobrać: ' + d.error, 'err');
    }
    renderSubs();
  });

  $('refreshLists').addEventListener('click', async () => {
    listMsg('Aktualizuję…', '');
    const data = await AIBLists.refreshAll();
    const bad = Object.values(data).filter((d) => d.ok === false).length;
    listMsg(bad ? 'Zaktualizowano, ale ' + bad + ' list nie udało się pobrać.' : 'Zaktualizowano.', bad ? 'err' : 'ok');
    renderSubs();
  });

  $('exportList').addEventListener('click', () => {
    // Eksportujemy to, co jest teraz w polach (także niezapisane zmiany).
    const accounts = parse(LISTS.find((l) => l.key === 'accounts'), areas.accounts.value);
    const botAccounts = parse(LISTS.find((l) => l.key === 'botAccounts'), areas.botAccounts.value);
    const text = AIBLists.buildExport({ accounts, botAccounts });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bez-ai-moja-lista.txt';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    listMsg('Zapisano plik bez-ai-moja-lista.txt (' + accounts.length + ' kont AI, ' + botAccounts.length + ' botów).', 'ok');
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      renderSubs();
      renderMemory();
    }
  });

  $('clearMemory').addEventListener('click', async () => {
    await chrome.storage.local.set({ botMemory: { t: {}, b: {} } });
    renderMemory();
  });
}

async function renderMemory() {
  const { botMemory = {} } = await chrome.storage.local.get('botMemory');
  const texts = Object.keys(botMemory.t || {}).length;
  const bots = Object.keys(botMemory.b || {}).length;
  $('memInfo').textContent = settings.botMemory === false
    ? 'Pamięć jest wyłączona (włączysz ją w okienku wtyczki).'
    : 'Zapamiętane teksty: ' + texts + ' · konta oznaczone jako boty: ' + bots + '.';
}

(async function main() {
  settings = await AIB.loadSettings();
  build();
  bindShared();
  renderSubs();
  renderMemory();
  document.getElementById('save').addEventListener('click', save);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  });
})();

/* Bez AI – okienko wtyczki. */
'use strict';

const $ = (id) => document.getElementById(id);
const AIB = globalThis.AIB;
let settings = null;
let sharedAi = 0; // liczba kont AI ze wspólnych (włączonych) list

async function loadSharedCount() {
  try {
    const { sharedListData = {} } = await chrome.storage.local.get('sharedListData');
    sharedAi = 0;
    for (const s of settings.sharedLists || []) {
      if (s.enabled === false) continue;
      const d = sharedListData[s.url];
      if (d && Array.isArray(d.ai)) sharedAi += d.ai.length;
    }
  } catch (e) {
    sharedAi = 0;
  }
}

const MODE_HINTS = {
  hide: 'Posty z AI znikają z feedu całkowicie.',
  blur: 'Posty z AI są rozmyte – kliknij, żeby zobaczyć.'
};

const BOT_HINTS = {
  low: 'Tylko oczywisty spam i oszustwa. Najmniej pomyłek.',
  medium: 'Spam + podejrzane konta i kopiuj-wklej. Polecane.',
  high: 'Łapie też ogólniki typu „Nice pic 🔥” od dziwnych kont. Więcej pomyłek.'
};

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function render() {
  $('enabled').checked = settings.enabled;
  document.body.classList.toggle('disabled', !settings.enabled);
  for (const r of document.querySelectorAll('input[name="mode"]')) r.checked = r.value === settings.mode;
  $('modeHint').textContent = MODE_HINTS[settings.mode] || '';
  for (const k of ['detectLabels', 'detectHashtags', 'detectKeywords', 'blurTopics', 'detectAccounts', 'detectBots', 'botMemory']) $(k).checked = settings[k];
  for (const r of document.querySelectorAll('input[name="botSensitivity"]')) r.checked = r.value === settings.botSensitivity;
  for (const r of document.querySelectorAll('input[name="botMode"]')) r.checked = r.value === settings.botMode;
  $('botOptions').classList.toggle('off', !settings.detectBots);
  $('blurTopics').closest('.row').classList.toggle('off', !settings.detectKeywords);
  $('botHint').textContent = BOT_HINTS[settings.botSensitivity] || '';
  $('nHashtags').textContent = settings.hashtags.length + ' na liście';
  $('nKeywords').textContent = settings.keywords.length + ' na liście';
  const na = settings.accounts.length;
  const own = na ? na + ' ' + plural(na, 'Twoje', 'Twoje', 'Twoich') : '';
  const shared = sharedAi ? sharedAi + ' ze wspólnych list' : '';
  $('nAccounts').textContent = [own, shared].filter(Boolean).join(' + ') || 'listy puste';

  const box = $('sites');
  box.textContent = '';
  for (const [key, site] of Object.entries(AIB.SITES)) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = settings.sites[key] !== false;
    input.addEventListener('change', () => {
      save({ sites: Object.assign({}, settings.sites, { [key]: input.checked }) });
    });
    const span = document.createElement('span');
    span.textContent = site.name;
    label.append(input, span);
    box.append(label);
  }
}

async function save(patch) {
  Object.assign(settings, patch);
  render();
  try {
    await chrome.storage.sync.set(patch);
  } catch (e) {
    $('addMsg').textContent = 'Nie udało się zapisać: ' + (e && e.message ? e.message : e);
    $('addMsg').className = 'hint err';
  }
}

async function activeTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0].id : null;
}

async function refreshStatus() {
  const status = $('status');
  let res = null;
  try {
    const tabId = await activeTabId();
    if (tabId != null) res = await chrome.tabs.sendMessage(tabId, { type: 'aib-get-status' });
  } catch (e) {
    res = null;
  }
  if (!res) {
    const names = Object.values(AIB.SITES).map((s) => s.name.replace(/ \(.*\)/, '')).join(', ');
    status.textContent =
      'Ta strona nie jest obsługiwana. Wtyczka działa na: ' + names +
      '. Jeśli to jedna z nich, odśwież kartę.';
    status.className = 'status';
    $('tabCount').textContent = '–';
    $('botCount').textContent = '–';
    return;
  }
  if (!res.active) {
    status.textContent = settings.enabled
      ? 'Wyłączone na stronie ' + res.siteName + '.'
      : 'Wtyczka jest wyłączona.';
    status.className = 'status off';
  } else {
    status.textContent = 'Działa na stronie ' + res.siteName + '.';
    status.className = 'status on';
  }
  $('tabCount').textContent = String(res.count || 0);
  $('botCount').textContent = String(res.bots || 0);
}

async function refreshTotal() {
  try {
    const { totalHidden = 0 } = await chrome.storage.local.get('totalHidden');
    $('total').textContent = String(totalHidden);
  } catch (e) { /* ignore */ }
}

function bind() {
  $('enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }).then(refreshStatus));
  for (const r of document.querySelectorAll('input[name="mode"]')) {
    r.addEventListener('change', () => r.checked && save({ mode: r.value }));
  }
  for (const k of ['detectLabels', 'detectHashtags', 'detectKeywords', 'blurTopics', 'detectAccounts', 'detectBots', 'botMemory']) {
    $(k).addEventListener('change', (e) => save({ [k]: e.target.checked }));
  }
  for (const name of ['botSensitivity', 'botMode']) {
    for (const r of document.querySelectorAll('input[name="' + name + '"]')) {
      r.addEventListener('change', () => r.checked && save({ [name]: r.value }));
    }
  }

  $('addAccount').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('addMsg');
    const raw = $('accountInput').value;
    const acc = AIB.normAccount(raw);
    if (!acc) {
      msg.textContent = 'Wpisz nazwę konta, np. @ai.art.daily, albo wklej link do profilu.';
      msg.className = 'hint err';
      return;
    }
    const shown = acc.includes('/') ? acc : '@' + acc;
    if (settings.accounts.map(AIB.normAccount).includes(acc)) {
      msg.textContent = shown + ' już jest na liście.';
      msg.className = 'hint';
      return;
    }
    await save({ accounts: settings.accounts.concat(acc) });
    $('accountInput').value = '';
    msg.textContent = 'Dodano ' + shown + '.';
    msg.className = 'hint ok';
  });

  $('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.totalHidden) refreshTotal();
    if (area === 'local' && changes.sharedListData) loadSharedCount().then(render);
  });
}

(async function main() {
  settings = await AIB.loadSettings();
  await loadSharedCount();
  render();
  bind();
  refreshStatus();
  refreshTotal();
  setInterval(refreshStatus, 1500);
})();

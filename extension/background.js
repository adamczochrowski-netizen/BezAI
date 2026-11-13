/* Bez AI – service worker: licznik na ikonie wtyczki, suma "łącznie ukryto",
   odświeżanie wspólnych list kont co 12 godzin i menu "Bez AI" pod prawym przyciskiem na linku do konta. */
'use strict';

importScripts('shared/bot-score.js', 'shared/defaults.js', 'shared/lists.js');

const LIST_ALARM = 'aib-shared-lists';

function scheduleLists() {
  chrome.alarms.get(LIST_ALARM, (a) => {
    if (!a) chrome.alarms.create(LIST_ALARM, { delayInMinutes: 1, periodInMinutes: 720 });
  });
}

// ---------- menu pod prawym przyciskiem na linku do konta ----------

const MENUS = [
  ['aib-ai', 'Ukrywaj posty tego konta (treści AI)', 'ai'],
  ['aib-bot', 'Oznacz to konto jako bota', 'bot'],
  ['aib-trust', 'Ufaj temu kontu (nigdy nie ukrywaj)', 'trust']
];
const STATUS_TEXT = {
  ai: ' – posty tego konta będą ukrywane.',
  bot: ' – komentarze tego konta będą zwijane.',
  trust: ' – zaufane konto: nie będzie ukrywane ani zwijane.'
};

function createMenus() {
  if (!chrome.contextMenus) return;
  const patterns = chrome.runtime.getManifest().content_scripts.slice(-1)[0].matches;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'aib-root', title: 'Bez AI', contexts: ['link'], documentUrlPatterns: patterns });
    for (const [id, title] of MENUS) {
      chrome.contextMenus.create({ id, parentId: 'aib-root', title, contexts: ['link'], documentUrlPatterns: patterns });
    }
  });
}

if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const m = MENUS.find((x) => x[0] === info.menuItemId);
    if (!m || !info.linkUrl) return;
    const acc = AIB.accountFromLink(info.linkUrl);
    let text;
    let undo = null;
    if (!acc) {
      text = 'To nie jest link do konta. Kliknij prawym przyciskiem nazwę konta.';
    } else {
      await AIB.setAccountStatus(acc.name, m[2]);
      text = AIB.accountLabel(acc.name) + STATUS_TEXT[m[2]];
      undo = acc.name;
    }
    if (tab && tab.id >= 0) {
      chrome.tabs.sendMessage(tab.id, { type: 'aib-toast', text, undo }).catch(() => {});
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  createMenus();
  scheduleLists();
  AIBLists.refreshAll().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  createMenus();
  scheduleLists();
  AIBLists.refreshAll().catch(() => {});
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === LIST_ALARM) AIBLists.refreshAll().catch(() => {});
});

let chain = Promise.resolve();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'aib-count' || !sender.tab) return;
  const tabId = sender.tab.id;
  const n = Number(msg.count) || 0;
  const text = n <= 0 ? '' : n > 999 ? '1k+' : String(n);

  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#6d28d9' }).catch(() => {});
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' }).catch(() => {});
  }

  const added = Number(msg.added) || 0;
  if (added > 0) {
    // Kolejkujemy zapisy, żeby kilka kart naraz nie nadpisywało sobie sumy.
    chain = chain
      .then(async () => {
        const { totalHidden = 0 } = await chrome.storage.local.get('totalHidden');
        await chrome.storage.local.set({ totalHidden: totalHidden + added });
      })
      .catch(() => {});
  }
});

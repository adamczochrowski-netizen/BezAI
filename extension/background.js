/* Bez AI – service worker: licznik na ikonie wtyczki, suma "łącznie ukryto"
   i odświeżanie wspólnych list kont co 12 godzin. */
'use strict';

importScripts('shared/bot-score.js', 'shared/defaults.js', 'shared/lists.js');

const LIST_ALARM = 'aib-shared-lists';

function scheduleLists() {
  chrome.alarms.get(LIST_ALARM, (a) => {
    if (!a) chrome.alarms.create(LIST_ALARM, { delayInMinutes: 1, periodInMinutes: 720 });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleLists();
  AIBLists.refreshAll().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
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

/* Zastępnik API chrome.* do testów na zwykłej stronie (localhost). Trzyma dane w localStorage. */
(function () {
  'use strict';
  const PREFIX = 'aib-test:';
  const changeListeners = [];
  const msgListeners = [];

  function read(area) {
    try { return JSON.parse(localStorage.getItem(PREFIX + area) || '{}'); } catch (e) { return {}; }
  }
  function write(area, obj) {
    localStorage.setItem(PREFIX + area, JSON.stringify(obj));
  }
  function fire(changes, area) {
    setTimeout(() => changeListeners.forEach((l) => l(changes, area)), 0);
  }
  function makeArea(area) {
    return {
      get(keys, cb) {
        const all = read(area);
        let res = {};
        if (keys == null) res = all;
        else if (typeof keys === 'string') { if (keys in all) res[keys] = all[keys]; }
        else if (Array.isArray(keys)) { for (const k of keys) if (k in all) res[k] = all[k]; }
        else { for (const k of Object.keys(keys)) res[k] = k in all ? all[k] : keys[k]; }
        res = JSON.parse(JSON.stringify(res));
        if (cb) setTimeout(() => cb(res), 0);
        return Promise.resolve(res);
      },
      set(obj, cb) {
        const all = read(area);
        const changes = {};
        for (const k of Object.keys(obj)) {
          changes[k] = { oldValue: all[k], newValue: obj[k] };
          all[k] = JSON.parse(JSON.stringify(obj[k]));
        }
        write(area, all);
        fire(changes, area);
        if (cb) setTimeout(cb, 0);
        return Promise.resolve();
      },
      clear() {
        write(area, {});
        fire({}, area);
        return Promise.resolve();
      }
    };
  }

  // Zmiany zrobione w innej karcie (np. w makiecie okienka) też docierają do strony testowej.
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith(PREFIX)) fire({}, e.key.slice(PREFIX.length));
  });

  window.__aibMessages = [];
  window.chrome = {
    storage: {
      sync: makeArea('sync'),
      local: makeArea('local'),
      onChanged: { addListener: (f) => changeListeners.push(f) }
    },
    runtime: {
      id: 'test',
      sendMessage(msg) {
        window.__aibMessages.push(msg);
        if (msg && msg.type === 'aib-count') {
          // udajemy service worker: suma "łącznie" + status karty dla makiety okienka
          const local = read('local');
          local.totalHidden = (local.totalHidden || 0) + (msg.added || 0);
          write('local', local);
          localStorage.setItem(PREFIX + 'tabstatus', JSON.stringify({
            site: window.__AIB_SITE__ || 'instagram',
            siteName: { instagram: 'Instagram', facebook: 'Facebook' }[window.__AIB_SITE__] || 'Instagram',
            active: true,
            count: msg.count
          }));
        }
        return Promise.resolve();
      },
      onMessage: { addListener: (f) => msgListeners.push(f) },
      openOptionsPage() { window.open('/test/popup.html?page=options', '_blank'); }
    },
    tabs: {
      query: async () => [{ id: 1 }],
      sendMessage: async () => {
        try { return JSON.parse(localStorage.getItem(PREFIX + 'tabstatus') || 'null'); } catch (e) { return null; }
      }
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {}
    }
  };

  // Pomocnik dla testów: zapytaj skrypt treści o status (jak robi to okienko).
  window.__aibAskContent = (msg) =>
    new Promise((resolve) => msgListeners.forEach((l) => l(msg, {}, resolve)));
})();

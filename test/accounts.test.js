/* Testy: konto z linku (menu pod prawym przyciskiem) i zmiana statusu konta (ai / bot / zaufane / usuń).
   Uruchom: node test/accounts.test.js */
'use strict';
let store = {};
global.chrome = {
  storage: {
    sync: {
      get: async (keys) => {
        const out = {};
        for (const k of [].concat(keys)) if (k in store) out[k] = JSON.parse(JSON.stringify(store[k]));
        return out;
      },
      set: async (obj) => { Object.assign(store, JSON.parse(JSON.stringify(obj))); }
    }
  }
};
require('../extension/shared/bot-score.js');
require('../extension/shared/defaults.js');
const AIB = globalThis.AIB;

let fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? 'OK ' : 'BŁĄD ') + ' ' + name + (ok ? '' : ' → chciano ' + JSON.stringify(want) + ', jest ' + JSON.stringify(got)));
}

const LINKS = [
  ['https://www.instagram.com/ai.art.daily/', { site: 'instagram', name: 'ai.art.daily' }],
  ['https://www.instagram.com/p/ABC123/', null],
  ['https://www.instagram.com/reels/ABC123/', null],
  ['https://www.instagram.com/explore/tags/aiart/', null],
  ['https://x.com/miku_kreacje/status/1234567890', { site: 'x', name: 'miku_kreacje' }],
  ['https://x.com/hashtag/aiart', null],
  ['https://x.com/i/communities/123', null],
  ['https://www.youtube.com/@ArtPhilosophy', { site: 'youtube', name: 'artphilosophy' }],
  ['https://www.youtube.com/watch?v=abc', null],
  ['https://www.youtube.com/channel/UCabc', { site: 'youtube', name: 'ucabc' }],
  ['https://www.facebook.com/profile.php?id=100012345', { site: 'facebook', name: '100012345' }],
  ['https://www.facebook.com/groups/123456/', null],
  ['https://www.facebook.com/jan.kowalski.77', { site: 'facebook', name: 'jan.kowalski.77' }],
  ['https://www.reddit.com/r/aiArt/', { site: 'reddit', name: 'r/aiart' }],
  ['https://www.reddit.com/user/spam_bot_123/', { site: 'reddit', name: 'u/spam_bot_123' }],
  ['https://www.threads.com/@neon.paleta.art', { site: 'threads', name: 'neon.paleta.art' }],
  ['https://example.com/someone', null],
  ['to nie jest adres', null]
];
for (const [url, want] of LINKS) check('link: ' + url, AIB.accountFromLink(url), want);

(async () => {
  store = { accounts: ['ai.art.daily', 'inne.konto'], botAccounts: [], botWhitelist: [] };
  await AIB.setAccountStatus('ai.art.daily', 'trust');
  check('ufaj: zdjęte z listy AI, dodane do zaufanych', [store.accounts, store.botWhitelist], [['inne.konto'], ['@ai.art.daily']]);

  await AIB.setAccountStatus('@AI.Art.Daily', 'ai');
  check('ukrywaj: z zaufanych z powrotem na listę AI', [store.accounts, store.botWhitelist], [['inne.konto', '@ai.art.daily'], []]);

  await AIB.setAccountStatus('https://www.instagram.com/spam.bot.x/', 'bot');
  check('bot z linku', store.botAccounts, ['@spam.bot.x']);

  await AIB.setAccountStatus('spam.bot.x', 'bot');
  check('bot drugi raz – bez duplikatu', store.botAccounts, ['@spam.bot.x']);

  await AIB.setAccountStatus('r/aiArt', 'ai');
  check('subreddit bez @', store.accounts.slice(-1), ['r/aiart']);

  await AIB.setAccountStatus('spam.bot.x', 'none');
  await AIB.setAccountStatus('ai.art.daily', 'none');
  check('cofnij: usunięte ze wszystkich list', [store.accounts, store.botAccounts, store.botWhitelist], [['inne.konto', 'r/aiart'], [], []]);

  check('pusta nazwa nic nie zmienia', await AIB.setAccountStatus('', 'ai'), false);

  console.log(fail ? '\n' + fail + ' sprawdzeń nie przeszło' : '\nWszystkie testy kont OK');
  process.exit(fail ? 1 : 0);
})();

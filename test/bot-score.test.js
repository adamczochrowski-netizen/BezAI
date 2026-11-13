// Testy oceny botów: node test/bot-score.test.js (z folderu bez-ai)
'use strict';
const path = require('path');
const { score, dupKey } = require(path.join(__dirname, '..', 'extension', 'shared', 'bot-score.js'));

const cases = [
  // [opis, komentarz, oczekiwane isBot przy czułości "medium"]
  ['spam: check my bio', { text: 'Check my bio 💋', user: 'jessica_hot8821' }, true],
  ['spam: promocja', { text: 'Promote it on @viralpages 🔥', user: 'mark.media' }, true],
  ['scam: inwestycje EN', { text: 'I made $5000 in a week thanks to @fx_mentor_anna, she is legit 🙏', user: 'daniel.w' }, true],
  ['scam: inwestycje PL', { text: 'Zarobiłem 3000 zł w tydzień dzięki pani @inwestycje_ewa, polecam!', user: 'tomek.k' }, true],
  ['spam: link do kupna', { text: 'Buy followers at www.cheapfollows.com', user: 'growth' }, true],
  ['spam: priv PL', { text: 'Hej przystojniaku, zapraszam na priv 😘', user: 'ola_9283x' }, true],
  ['bot: ogólnik + cyfry + brak zdjęcia', { text: 'Nice pic 🔥', user: 'user84736251', defaultPic: true }, true],
  ['bot: ten sam tekst u wielu kont', { text: 'Your journey is so motivating, thanks for sharing', user: 'anna.k', dupCount: 3 }, true],
  ['bot: masowe tagowanie + ogólnik', { text: '@a1 @b2 @c3 @d4 great content', user: 'promo', mentions: 4 }, true],
  // Prawdziwy przypadek z Instagrama (12.11.2026): jedno konto wkleja ten sam komentarz ~25 razy.
  ['bot: zalew od jednego konta (na żywo)', { text: 'Come to Fenerbahçe 💛💙', user: 'xjxjxjxjxj9', selfRepeat: 25, defaultPic: true }, true],
  ['bot: zalew nawet bez danych o awatarze', { text: 'Come to Fenerbahçe 💛💙', user: 'xjxjxjxjxj9', selfRepeat: 3 }, true],
  ['bot: zalew przy łagodnej czułości', { text: 'Come to Fenerbahçe 💛💙', user: 'xjxjxjxjxj9', selfRepeat: 25, defaultPic: true }, true, { sensitivity: 'low' }],
  ['bot: lista użytkownika', { text: 'Ładne', user: 'Znany.Bot' }, true, { botAccounts: ['@znany.bot'] }],

  ['człowiek: pytanie', { text: 'Świetne zdjęcie! Gdzie to było?', user: 'kasia.nowak' }, false],
  ['człowiek: oznacza znajomą', { text: '@kasia.nowak patrz 😂', user: 'marta_1990', mentions: 1 }, false],
  ['człowiek: krótki ogólnik', { text: 'Fajne', user: 'piotr' }, false],
  ['człowiek: nice pic bez innych sygnałów', { text: 'Nice pic 🔥', user: 'sara.k' }, false],
  ['człowiek: zweryfikowany z polubieniami', { text: 'Greatest ever ❤️', user: 'fan.page', verified: true, likes: 250 }, false],
  ['człowiek: rozmowa o kryptowalutach', { text: 'Bitcoin znowu spada, ciekawe co dalej', user: 'jan_k' }, false],
  ['człowiek: popularne powtórzenie ogólnika', { text: 'So beautiful 😍😍', user: 'ewa', dupCount: 3 }, false],
  ['człowiek: dziwna nazwa, normalny tekst', { text: 'Byłem tam w zeszłym roku, polecam latem', user: 'marek19870' }, false],
  ['człowiek: życzenia urodzinowe od wielu osób', { text: 'Wszystkiego najlepszego z okazji urodzin!', user: 'ciocia_basia', dupCount: 6 }, false],
  ['człowiek: gratulacje od wielu osób', { text: 'Gratulacje, zasłużony sukces!!', user: 'kolega.z.pracy', dupCount: 4 }, false],
  ['człowiek: krótkie powtórzenie', { text: 'Haha dokładnie tak', user: 'zenek', dupCount: 3 }, false],
  ['człowiek: przypadkiem wysłał dwa razy', { text: 'Super relacja z meczu, dzięki!', user: 'tomek', selfRepeat: 2 }, false],
  ['człowiek: imię z powtórzeniem liter', { text: 'Piękne zdjęcie', user: 'barbara.nowak' }, false],
  ['człowiek: na białej liście', { text: 'Check my bio', user: 'kolega' }, false, { whitelist: ['kolega'] }],
  // Pamięć między postami
  ['bot: ten sam komentarz pod 3 postami', { text: 'Follow me for daily motivation quotes and tips', user: 'quote.daily', crossPosts: 3 }, true],
  ['człowiek: ten sam komentarz pod 2 postami', { text: 'Follow me for daily motivation quotes and tips', user: 'quote.daily', crossPosts: 2 }, false],
  ['człowiek: życzenia pod 4 postami w tygodniu', { text: 'Wszystkiego najlepszego z okazji urodzin!', user: 'ciocia_basia', crossPosts: 4 }, false],
  ['człowiek: krótki tekst pod 5 postami', { text: 'Piękne 😍', user: 'ewa', crossPosts: 5 }, false],
  ['bot: wcześniej oznaczony + ogólnik od zasięgów', { text: 'Great content, keep it up', user: 'promo.page', knownBot: true }, true],
  ['człowiek: wcześniej oznaczony, ale normalny tekst', { text: 'Byłem tam w zeszłym roku', user: 'kuba', knownBot: true }, false],
  ['czułość: ostro łapie słabszy przypadek', { text: 'Nice pic 🔥', user: 'kasia83xk' }, true, { sensitivity: 'high' }],
  ['czułość: łagodnie przepuszcza średni', { text: 'Nice pic 🔥', user: 'user84736251', defaultPic: true }, false, { sensitivity: 'low' }]
];

let failed = 0;
for (const [name, c, want, opts] of cases) {
  const r = score(c, Object.assign({ sensitivity: 'medium' }, opts || {}));
  const ok = r.isBot === want;
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'XX '} ${name}: wynik ${r.score} → ${r.isBot ? 'bot' : 'człowiek'}${r.reasons.length ? ' (' + r.reasons.join(', ') + ')' : ''}`);
}
// Podobne teksty: ten sam klucz mimo emoji, ogonków, wielkości liter i interpunkcji.
const same = [
  ['Come to Fenerbahçe 💛💙', 'come to fenerbahce!!', 'COME TO FENERBAHCE 💛'],
  ['Zarobiłem 3000 zł dzięki @ewa_inwest', 'zarobilem 5000 zl dzieki @anna.trader'],
  ['Gooooool!!! Brawo', 'gool brawo'],
  ['Check www.spam.example/xyz now', 'check https://inny.example/abc now']
];
const different = [['Come to Fenerbahçe', 'Come to Galatasaray'], ['Piękne zdjęcie', 'Piękne miejsce']];
let dkFail = 0;
for (const group of same) {
  const keys = new Set(group.map(dupKey));
  const ok = keys.size === 1;
  if (!ok) dkFail++;
  console.log(`${ok ? 'OK ' : 'XX '} podobne → ten sam klucz: ${group.join(' | ')} → ${[...keys].join(' / ')}`);
}
for (const [a, b] of different) {
  const ok = dupKey(a) !== dupKey(b);
  if (!ok) dkFail++;
  console.log(`${ok ? 'OK ' : 'XX '} różne → różne klucze: ${a} | ${b}`);
}
failed += dkFail;

console.log(failed ? `\nBŁĘDY: ${failed}` : `\nWszystkie ${cases.length} przypadki + ${same.length + different.length} testy podobieństwa OK`);
process.exit(failed ? 1 : 0);

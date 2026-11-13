// Testy wspólnych list: node test/lists.test.js (z folderu bez-ai)
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'extension', 'shared', 'defaults.js'));
const L = require(path.join(__dirname, '..', 'extension', 'shared', 'lists.js'));

let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'OK ' : 'XX '} ${name}${ok ? '' : `\n    dostałem: ${JSON.stringify(got)}\n    oczekiwałem: ${JSON.stringify(want)}`}`);
}

const sample = [
  '! Title: Konta AI – test',
  '! Updated: 2026-11-12',
  '# komentarz',
  '',
  '[ai]',
  'instagram ai.art.daily',
  'IG @Dreamy.Visions          ! wielkie litery i @',
  'facebook jakas.strona.ai',
  'https://www.instagram.com/link.form/?hl=pl',
  'https://www.reddit.com/r/aiArt/',
  'wszedzie.konto',
  'instagram ai.art.daily',
  'myspace stare.konto',
  'instagram <script>alert(1)</script>',
  '[bot]',
  'instagram xjxjxjxjxj9',
  'x spam_bot_123'
].join('\n');

const p = L.parseList(sample);
check('tytuł i data', [p.title, p.updated], ['Konta AI – test', '2026-11-12']);
check('wpisy AI (bez duplikatów, z normalizacją, link → platforma)', p.ai, [
  'instagram/ai.art.daily',
  'instagram/dreamy.visions',
  'facebook/jakas.strona.ai',
  'instagram/link.form',
  'reddit/r/aiart',
  '*/wszedzie.konto'
]);
check('wpisy botów', p.bot, ['instagram/xjxjxjxjxj9', 'x/spam_bot_123']);
check('odrzucone linie (nieznana platforma, śmieci)', p.errors, 2);

check('namesFor: instagram dostaje swoje + wspólne', L.namesFor(p.ai, 'instagram'),
  ['ai.art.daily', 'dreamy.visions', 'link.form', 'wszedzie.konto']);
check('namesFor: reddit', L.namesFor(p.ai, 'reddit'), ['r/aiart', 'wszedzie.konto']);

const data = { 'https://a/1.txt': { ai: p.ai, bot: p.bot }, 'https://a/2.txt': { ai: ['instagram/z.drugiej.listy'], bot: [] } };
const all = L.collect([{ url: 'https://a/1.txt' }, { url: 'https://a/2.txt' }], data, 'instagram');
check('collect: dwie listy razem', [all.ai.size, all.bot.size, all.ai.has('z.drugiej.listy')], [5, 1, true]);
const off = L.collect([{ url: 'https://a/1.txt' }, { url: 'https://a/2.txt', enabled: false }], data, 'instagram');
check('collect: wyłączona lista się nie liczy', off.ai.has('z.drugiej.listy'), false);

check('validUrl: https OK', L.validUrl('https://example.com/lista.txt'), 'https://example.com/lista.txt');
check('validUrl: http tylko localhost', [L.validUrl('http://example.com/a.txt'), L.validUrl('http://localhost:8791/a.txt')],
  [null, 'http://localhost:8791/a.txt']);
check('validUrl: śmieci', L.validUrl('javascript:alert(1)'), null);
check('rawUrl: link GitHuba → surowy plik', L.rawUrl('https://github.com/jan/bez-ai-lista/blob/main/lista.txt'),
  'https://raw.githubusercontent.com/jan/bez-ai-lista/main/lista.txt');

const exp = L.buildExport({ accounts: ['@Ai.Art.Daily', 'https://www.instagram.com/x.y/'], botAccounts: ['spam.bot'] }, 'Test');
const back = L.parseList(exp);
check('eksport → import daje te same konta', [back.title, back.ai, back.bot],
  ['Test', ['*/ai.art.daily', '*/x.y'], ['*/spam.bot']]);

console.log(failed ? `\nBŁĘDY: ${failed}` : '\nWszystkie testy list OK');
process.exit(failed ? 1 : 0);

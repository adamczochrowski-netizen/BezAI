/* Testy: fraza o AI – przyznanie się twórcy ("z AI") czy temat/pytanie ("o AI")?
   Uruchom: node test/keywords.test.js */
'use strict';
global.chrome = { storage: { sync: { get: async () => ({}) } } };
require('../extension/shared/bot-score.js');
require('../extension/shared/defaults.js');
const AIB = globalThis.AIB;

const kws = AIB.DEFAULTS.keywords.map(AIB.normText).sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE = new RegExp('(?<![\\p{L}\\p{N}])(?:' + kws.map(esc).join('|') + ')(?![\\p{L}\\p{N}])', 'gu');

// Tak samo jak content.js: pierwsze mocne trafienie wygrywa, inaczej pierwsze słabe.
function classify(text, topicSoft) {
  const t = AIB.normText(text);
  let weak = false;
  for (const m of t.matchAll(RE)) {
    const s = AIB.keywordStrength(t, m.index, m[0], topicSoft);
    if (s === 'strong') return 'strong';
    if (s === 'weak') weak = true;
  }
  return weak ? 'weak' : 'none';
}

// [opis, tekst, topicSoft (YouTube/X/Reddit), oczekiwany wynik]
const CASES = [
  // YouTube / X / Reddit – tytuły
  ['YT: pytanie o sztukę AI (na żywo)', 'Is AI-Generated Art Original?', true, 'none'],
  ['YT: recenzja Midjourney', 'Midjourney V7 full review and tutorial', true, 'none'],
  ['YT: AI art to kradzież', 'AI art is theft. Here\'s why', true, 'none'],
  ['YT: PL pytanie', 'Czy grafika AI to sztuka?', true, 'none'],
  ['YT: jak rozpoznać', 'Jak rozpoznać obraz AI – poradnik', true, 'none'],
  ['YT: artyści przeciw', 'Artists against AI art: the lawsuit explained', true, 'none'],
  ['YT: muzyka AI (bez pytania i dyskusji)', 'AI generated lofi beats to relax 🎧', true, 'strong'],
  ['YT: narzędzie bez dyskusji', 'Midjourney v7 cinematic portraits', true, 'weak'],
  ['YT: generator to nie treść AI', 'Best free AI art generator 2026', true, 'none'],
  // Prawdziwe tytuły z wyszukiwania "ai generated" na YouTube (13.11.2026)
  ['YT na żywo: news', 'Court releases DUI suspect after AI-generated police report', true, 'none'],
  ['YT na żywo: quiz', 'Can you spot AI-generated political ads?', true, 'none'],
  ['YT na żywo: AI or real?', 'AI generated or real?', true, 'none'],
  ['YT na żywo: film AI', 'Ravnir - Eldruna | Viking Music Live Concert 🔥 AI Generated Viking Music', true, 'strong'],
  ['YT na żywo: film AI 2', 'World’s First Fully AI Generated Feature Film 😳', true, 'strong'],
  ['YT na żywo: teledysk AI', 'Daughters of the Pearlspire Palace [AI Music Video]', true, 'strong'],
  ['YT: przyznanie się', 'Made with AI: cyberpunk city 4K', true, 'strong'],
  ['YT: przyznanie PL', 'Wygenerowane przez AI – piękne widoki Polski', true, 'strong'],
  ['YT: przyznanie w pytaniu', 'How to tell if a photo was made with AI', true, 'weak'],
  ['YT: czy to zrobione przez AI?', 'Is this video made with AI?', true, 'weak'],
  ['X: zwykły wpis z frazą tematyczną', 'Spent the evening playing with ai art again', true, 'weak'],
  ['X: news o AI', 'Getty sues Stability over Stable Diffusion copyright', true, 'none'],
  // Prawdziwe wpisy z wyszukiwania "ai art" na X (13.11.2026)
  ['X na żywo: opinia', 'AI art is never "more perfect". That\'s what I\'m addressing', true, 'weak'],
  ['X na żywo: "feels like"', 'community voting on ai art feels like a genuinely fresh.', true, 'none'],
  ['X na żywo: pytanie z "tho?"', 'people judging ai art sounds harder than just training models, tho?', true, 'none'],
  ['X na żywo: fake', 'Remember, it was the same fandom that circulated a fake AI Mornye image to create “AI art” misinfo.', true, 'none'],
  ['X na żywo: nazwa konta (deklaracja)', '田中未来｜Miku AI Art', false, 'strong'],
  ['X na żywo: konto o narzędziach', 'AiofTIKTOK | AI Art & Tools', false, 'none'],
  // Instagram / Facebook / Threads – opisy postów twórców
  ['IG: AI art w opisie', 'AI art portrait ✨ inspired by baroque painters', false, 'strong'],
  ['IG: wygenerowane + pytanie do fanów', 'Ten obraz został wygenerowany przez AI, co myślicie?', false, 'strong'],
  ['IG: made with AI + pytanie', 'Made with AI. Do you like it?', false, 'strong'],
  ['IG: pytanie do fanów o AI art', 'What do you think about AI art?', false, 'none'],
  ['IG: midjourney w opisie', 'Midjourney v7, prompt w komentarzu', false, 'strong'],
  ['IG: zdanie o przyszłości osobno', 'Wygenerowane przez AI. Przyszłość jest teraz ✨', false, 'strong'],
  ['IG: news o AI', 'Nowy zakaz: obrazy AI w reklamach muszą mieć oznaczenie', false, 'none'],
  ['IG: bez frazy', 'Zachód słońca nad Bałtykiem 🌅', false, 'none'],
  ['IG: mocne wygrywa ze słabym', 'Czy to sztuka? Wygenerowane przez AI.', false, 'strong'],
  // Słowa w środku innych słów się nie liczą
  ['"testament" to nie "test"', 'AI generated: The Testament of Light', true, 'strong'],
  ['"mitologia" to nie "mit"', 'Grafika AI – mitologia słowiańska', false, 'strong']
];

let fail = 0;
for (const [name, text, topicSoft, want] of CASES) {
  const got = classify(text, topicSoft);
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? 'OK ' : 'BŁĄD ') + ' ' + name + (ok ? '' : ' → chciano ' + want + ', jest ' + got));
}
console.log(fail ? '\n' + fail + ' z ' + CASES.length + ' nie przeszło' : '\nWszystkie ' + CASES.length + ' przypadki fraz OK');
process.exit(fail ? 1 : 0);

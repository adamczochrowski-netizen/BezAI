/* Pasek testowy + automatyczne sprawdzenie oczekiwań (data-test-expect="hidden|visible"). */
(function () {
  'use strict';

  // Ustawienia startowe testu: jedno zablokowane konto.
  if (!localStorage.getItem('aib-test:sync')) {
    localStorage.setItem('aib-test:sync', JSON.stringify({ accounts: ['ai.art.daily'] }));
  }

  window.__aibCheck = function () {
    const rows = [];
    for (const el of document.querySelectorAll('[data-test-expect]')) {
      const want = el.getAttribute('data-test-expect');
      if (want === 'bot' || want === 'nobot') {
        const isBot = el.hasAttribute('data-aib-bot');
        rows.push({
          id: el.getAttribute('data-test-id'),
          want,
          got: isBot ? 'bot: ' + el.getAttribute('data-aib-botlabel') : 'nobot',
          ok: want === 'bot' ? isBot : !isBot
        });
        continue;
      }
      // hidden = mocne oznaczenie, weak = tylko rozmycie (treść być może *o* AI), visible = nic.
      const flagged = el.hasAttribute('data-aib-flagged');
      const weak = flagged && el.hasAttribute('data-aib-weak');
      const insideFlagged = !!(el.parentElement && el.parentElement.closest('[data-aib-flagged]'));
      const ok = want === 'hidden' ? flagged && !weak : want === 'weak' ? weak : !flagged && !insideFlagged;
      rows.push({
        id: el.getAttribute('data-test-id'),
        want,
        got: flagged ? (weak ? 'weak' : 'hidden') + '(' + el.getAttribute('data-aib-flagged') + ')' : insideFlagged ? 'inside-hidden' : 'visible',
        ok
      });
    }
    return { pass: rows.every((r) => r.ok), failed: rows.filter((r) => !r.ok), total: rows.length, rows };
  };

  function bar() {
    const b = document.createElement('div');
    b.id = 'test-bar';
    b.innerHTML =
      '<b>Makieta testowa</b>' +
      '<button data-mode="hide">Tryb: ukryj</button>' +
      '<button data-mode="blur">Tryb: rozmyj</button>' +
      '<button data-reset>Reset ustawień</button>' +
      '<span id="test-result"></span>';
    document.body.prepend(b);
    b.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.mode) chrome.storage.sync.set({ mode: btn.dataset.mode });
      if ('reset' in btn.dataset) {
        localStorage.removeItem('aib-test:sync');
        localStorage.removeItem('aib-test:local');
        location.reload();
      }
    });
    setInterval(() => {
      const r = window.__aibCheck();
      const el = document.getElementById('test-result');
      el.textContent = (r.pass ? 'OK ' : 'BŁĄD ') + (r.total - r.failed.length) + '/' + r.total;
      el.style.color = r.pass ? '#15803d' : '#b91c1c';
    }, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bar);
  else bar();
})();

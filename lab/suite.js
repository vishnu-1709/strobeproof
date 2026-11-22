import { CASES } from '../core/fixtures.js';
import { analyzeFrames } from '../core/analyzeFrames.js';

const rows = document.getElementById('rows'), status = document.getElementById('status'), summary = document.getElementById('summary');
const btn = document.getElementById('run');

const label = (e) => e.verdict + (e.red && e.general === false ? ' (red only)' : e.red ? ' (red)' : e.general ? ' (general)' : '');

async function run() {
  btn.disabled = true;
  rows.replaceChildren();
  summary.replaceChildren();
  status.textContent = 'Running…';
  const expected = (await (await fetch('../core/__tests__/expected.json', { cache: 'no-store' })).json()).cases;
  let pass = 0, n = 0;
  const t0 = performance.now();
  for (const [id, exp] of Object.entries(expected)) {
    const c = CASES[id];
    await new Promise((r) => setTimeout(r, 0)); // let the page paint between cases
    const r = analyzeFrames(c.make(), c.display);
    const ok = r.verdict === exp.verdict
      && (exp.general === undefined || r.general.fail === exp.general)
      && (exp.red === undefined || r.red.fail === exp.red);
    n++; if (ok) pass++;
    const tr = document.createElement('tr');
    tr.dataset.case = id; tr.dataset.ok = String(ok);
    const actual = r.verdict + (r.red.fail && !r.general.fail ? ' (red only)' : r.red.fail ? ' (general + red)' : r.general.fail ? ' (general)' : '');
    for (const text of [id, c.name, label(exp), actual, String(Math.max(r.general.maxTransitions, r.red.maxTransitions))]) {
      const td = document.createElement('td'); td.textContent = text; tr.append(td);
    }
    const m = document.createElement('td');
    m.innerHTML = ok ? '<span class="mark-ok">✓ match</span>' : '<span class="mark-bad">✗ mismatch</span>';
    tr.append(m);
    rows.append(tr);
    status.textContent = `Running… ${n} of ${Object.keys(expected).length}`;
  }
  status.textContent = `Finished in ${Math.round(performance.now() - t0)} ms.`;
  const v = document.createElement('div');
  v.className = 'verdict ' + (pass === n ? 'ok' : 'fail');
  v.id = 'suite-result';
  v.dataset.pass = String(pass); v.dataset.total = String(n);
  v.innerHTML = `<h2>${pass} of ${n} cases match the expected answer</h2><p>${pass === n ? 'Every case gives the locked answer.' : 'Some cases do not match. See the table.'}</p>`;
  summary.append(v);
  btn.disabled = false;
}
btn.addEventListener('click', run);
run();

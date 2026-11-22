// Strobeproof M0 spike: popup. Sends requests to the service worker and shows stored results.
const $ = (id) => document.getElementById(id);
const out = $('out');
const statusEl = $('status');

function say(text) {
  statusEl.textContent = text;
  console.log('[spike popup]', text);
}

async function render() {
  const { spikeResults = [] } = await chrome.storage.local.get('spikeResults');
  out.textContent = spikeResults.length ? JSON.stringify(spikeResults, null, 2) : '(no results yet)';
}

async function run(msg, label) {
  say(label + '…');
  try {
    const r = await chrome.runtime.sendMessage(msg);
    say(r && r.error ? label + ' failed: ' + r.error : label + ' done.');
  } catch (e) {
    // Expected for the calm test: the popup closes when the test tab opens.
    say(label + ' started. Results appear here when the popup is reopened. (' + e.message + ')');
  }
  await render();
}

$('probe').addEventListener('click', () => run({ type: 'probeActive' }, 'Probing this tab'));
$('calm').addEventListener('click', () => run({ type: 'calmTest' }, 'Running Calm measurement'));
$('applyCalm').addEventListener('click', () => run({ type: 'applyCalm', on: true }, 'Applying Calm'));
$('removeCalm').addEventListener('click', () => run({ type: 'applyCalm', on: false }, 'Removing Calm'));
$('clear').addEventListener('click', () => run({ type: 'clear' }, 'Clearing'));
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(out.textContent);
    say('Copied. Paste it into the chat.');
  } catch (e) {
    say('Copy failed: ' + e.message + '. Select the text above and copy it manually.');
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.spikeResults) render();
});
render();

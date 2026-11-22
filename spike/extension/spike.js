const out = document.getElementById('out');
let last = null;

function show(obj) {
  last = obj;
  out.textContent = JSON.stringify(obj, null, 2);
  console.log('[spike]', obj);
}

document.getElementById('probe').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let report;
  try { report = await chrome.tabs.sendMessage(tab.id, { type: 'spike-probe' }); }
  catch (e) { return show({ error: 'Content script not reachable. Reload the tab and retry. ' + e }); }
  const urls = [...new Set([
    ...report.videos.flatMap(v => [v.currentSrc, ...v.sources.map(s => s.src)]).filter(u => /^https?:/.test(u || '')),
    ...report.animatedImgCandidates,
  ])];
  report.extensionFetch = urls.length ? (await chrome.runtime.sendMessage({ type: 'spike-fetch', urls })).results : 'no http(s) media URLs';
  show(report);
};

document.getElementById('calm').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('calm.html') });

document.getElementById('copy').onclick = async () => {
  await navigator.clipboard.writeText(JSON.stringify(last, null, 2));
  out.textContent = 'Copied.\n' + out.textContent;
};

// Probe ②: can an extension page fetch a media URL that the page loaded? (host_permissions bypass page CORS)

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type !== 'offscreen-fetch') return false;
  (async () => {
    const results = [];
    for (const url of msg.urls.slice(0, 10)) {
      const r = { url: url.slice(0, 160) };
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 8000);
        const res = await fetch(url, { headers: { Range: 'bytes=0-1023' }, signal: ctl.signal, credentials: 'omit' });
        clearTimeout(t);
        r.status = res.status;
        r.contentType = res.headers.get('content-type');
        r.contentRange = res.headers.get('content-range');
        r.contentLength = res.headers.get('content-length');
        const buf = new Uint8Array(await res.arrayBuffer());
        r.bytes = buf.length;
        r.magic = [...buf.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join(' ');
        r.ok = res.ok;
      } catch (e) { r.ok = false; r.error = String(e); }
      results.push(r);
    }
    reply({ results });
  })();
  return true;
});

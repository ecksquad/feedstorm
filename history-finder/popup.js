'use strict';

/*
 * chrome.history.search() is only ever called after an explicit in-popup
 * "Show my top sites" click - not on popup open. Installing the extension
 * grants the browser-level permission, but that isn't the same as actually
 * reading someone's history; this adds a second, deliberate, human-readable
 * gate in front of the moment that actually happens, with the guarantee
 * spelled out in view-consent right before it.
 *
 * Everything past that gate still runs only while the popup document is
 * open. A Manifest V3 popup is torn down the instant it loses focus/closes -
 * there is no background page keeping this alive, and nothing here ever
 * calls chrome.storage or fetch(). So the moment the popup closes, the
 * scanned history list (and anything left unticked in it) simply ceases to
 * exist - that's the browser's own lifecycle doing the work, not a rule we
 * have to remember to follow. The ONLY data that leaves this popup at all is
 * the list of domains you explicitly tick and confirm, and it goes exactly
 * one place: a new browser tab's URL, opened locally on this machine.
 */

const FEEDSTORM_URL = 'https://ecksquad.github.io/feedstorm/';

function hostnameOf(url){
  try{
    const u = new URL(url);
    // http(s) only - chrome://, chrome-extension://, file:// etc all parse
    // "successfully" here (with nonsense hostnames like an extension ID or
    // "settings"), they just aren't real websites.
    if(u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '');
  }catch(e){ return null; }
}

async function scan(){
  const items = await chrome.history.search({
    text: '',
    startTime: 0,
    maxResults: 5000
  });

  const counts = new Map();
  for(const item of items){
    const host = hostnameOf(item.url);
    if(!host) continue; // covers chrome://, chrome-extension://, about:, file:// etc - not real sites
    counts.set(host, (counts.get(host) || 0) + (item.visitCount || 1));
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);
}

function render(ranked){
  const list = document.getElementById('list');
  if(!ranked.length){
    list.innerHTML = '<div class="empty">No browsing history found on this profile.</div>';
    return;
  }
  // Pre-checked by default: most people want most of their top sites, so this
  // is "untick the rare one you don't want" instead of "tick every one you
  // do" - fewer clicks for the common case. Still a real choice, not
  // auto-added: nothing happens until "Add to Feedstorm" is clicked, and
  // unticking here still means a site is never added at all.
  list.innerHTML = ranked.map(([host, count]) => `
    <label class="row">
      <input type="checkbox" data-host="${host}" checked>
      <span class="host">${host}</span>
      <span class="count">${count} visits</span>
    </label>
  `).join('');

  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', updateFooter);
  });
  updateFooter();
}

function updateFooter(){
  const checked = document.querySelectorAll('#list input:checked');
  document.getElementById('selCount').textContent = checked.length;
  document.getElementById('addBtn').disabled = checked.length === 0;
}

document.getElementById('addBtn').addEventListener('click', () => {
  const hosts = Array.from(document.querySelectorAll('#list input:checked')).map(cb => cb.getAttribute('data-host'));
  if(!hosts.length) return;
  const url = FEEDSTORM_URL + '?import=' + encodeURIComponent(hosts.join(','));
  chrome.tabs.create({ url });
  window.close();
});

// chrome.history.search() only ever runs after this explicit click - not on
// popup open. "Not now" (or just closing the popup) means your history is
// never read at all, not just "read but discarded."
document.getElementById('declineBtn').addEventListener('click', () => window.close());
document.getElementById('consentBtn').addEventListener('click', () => {
  document.getElementById('view-consent').classList.remove('active');
  document.getElementById('view-list').classList.add('active');
  scan().then(render).catch(() => {
    document.getElementById('list').innerHTML = '<div class="empty">Couldn\'t read history - check the extension has permission.</div>';
  });
});

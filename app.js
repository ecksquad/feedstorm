'use strict';

const $ = sel => document.querySelector(sel);

/* ---------------- theme ---------------- */
const THEME_KEY = 'feedstorm.theme';
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  $('#themeToggleBtn').textContent = theme === 'light' ? '☀️' : '🌙';
  try{ localStorage.setItem(THEME_KEY, theme); }catch(e){}
}
function currentTheme(){
  let stored = null;
  try{ stored = localStorage.getItem(THEME_KEY); }catch(e){}
  if(stored === 'light' || stored === 'dark') return stored;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
applyTheme(currentTheme());
$('#themeToggleBtn').addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ---------------- view switching ---------------- */
function showView(name){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + name).classList.add('active');
  $('#manageBtn').hidden = name !== 'feed';
}
$('#manageBtn').addEventListener('click', () => showView('setup'));

/* ---------------- state ---------------- */
// selected sources: Map<key, {domain, favicon, manual, originHint?}>
const selected = new Map();
let domainCandidates = []; // [{domain, visitCount}] from the last history scan

const STORAGE_KEY = 'feedstorm_sources';
const FEED_CACHE_KEY = 'feedstorm_feedCache';

/* ---------------- history scan ---------------- */
function hostnameOf(url){
  try{ return new URL(url).hostname.replace(/^www\./, ''); }
  catch(e){ return null; }
}
function isIgnorable(hostname){
  if(!hostname) return true;
  if(hostname === 'localhost') return true;
  if(hostname.endsWith('.local')) return true;
  return false;
}

async function scanHistory(){
  const btn = $('#scanBtn');
  btn.disabled = true; btn.textContent = 'Scanning…';
  try{
    const items = await chrome.history.search({
      text: '', startTime: Date.now() - 90 * 24 * 3600 * 1000, maxResults: 5000
    });
    const byHost = new Map();
    for(const item of items){
      const host = hostnameOf(item.url);
      if(isIgnorable(host)) continue;
      byHost.set(host, (byHost.get(host) || 0) + (item.visitCount || 1));
    }
    domainCandidates = Array.from(byHost.entries())
      .map(([domain, visitCount]) => ({ domain, visitCount }))
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 40);
    renderDomainList();
    if(domainCandidates.length === 0){
      toast("Couldn't find much history yet - try adding a site by hand below.");
    }
  }catch(err){
    toast("Couldn't read history: " + err.message);
  }finally{
    btn.disabled = false; btn.textContent = '🔍 Scan my history';
  }
}
$('#scanBtn').addEventListener('click', scanHistory);

function faviconUrl(domain){
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

function renderDomainList(){
  const list = $('#domainList');
  if(domainCandidates.length === 0){ list.innerHTML = ''; return; }
  list.innerHTML = domainCandidates.map(d => {
    const checked = selected.has(d.domain);
    return `<label class="domain-row" data-domain="${d.domain}">
      <input type="checkbox" ${checked ? 'checked' : ''}>
      <img src="${faviconUrl(d.domain)}" alt="">
      <span class="dn">${d.domain}</span>
      <span class="dv">${d.visitCount} visits</span>
    </label>`;
  }).join('');
  list.querySelectorAll('.domain-row input').forEach(input => {
    input.addEventListener('change', (e) => {
      const row = e.target.closest('.domain-row');
      const domain = row.getAttribute('data-domain');
      if(e.target.checked){
        selected.set(domain, { domain, favicon: faviconUrl(domain), manual: false });
      } else {
        selected.delete(domain);
      }
      updateSelCount();
      persistSelected();
    });
  });
}

function updateSelCount(){
  $('#selCount').textContent = selected.size;
  $('#buildBtn').disabled = selected.size === 0;
}

/* ---------------- manual add ---------------- */
function normalizeManualInput(raw){
  let s = raw.trim();
  if(!s) return null;
  if(!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try{
    const u = new URL(s);
    return { domain: u.hostname.replace(/^www\./, ''), origin: u.origin, path: u.pathname !== '/' ? u.pathname : '' };
  }catch(e){ return null; }
}
$('#manualAddBtn').addEventListener('click', () => {
  const input = $('#manualUrl');
  const parsed = normalizeManualInput(input.value);
  if(!parsed){ toast("That doesn't look like a valid address."); return; }
  const key = parsed.domain + parsed.path;
  if(selected.has(key)){ toast('Already added.'); input.value = ''; return; }
  selected.set(key, {
    domain: key, favicon: faviconUrl(parsed.domain), manual: true,
    originHint: parsed.origin + parsed.path
  });
  input.value = '';
  updateSelCount();
  persistSelected();
  toast('Added ' + key);
});
$('#manualUrl').addEventListener('keydown', (e) => { if(e.key === 'Enter') $('#manualAddBtn').click(); });

/* ---------------- persistence ---------------- */
async function persistSelected(){
  try{ await chrome.storage.local.set({ [STORAGE_KEY]: Array.from(selected.values()) }); }
  catch(e){}
}
async function restoreSelected(){
  try{
    const data = await chrome.storage.local.get(STORAGE_KEY);
    (data[STORAGE_KEY] || []).forEach(s => selected.set(s.domain, s));
  }catch(e){}
  updateSelCount();
}

/* ---------------- feed discovery ----------------
   Extension pages with host_permissions can fetch cross-origin without the
   CORS restrictions a plain webpage would hit - that's what makes this
   architecture (vs. a normal website) actually workable without a backend
   proxy. */
async function getFeedCache(){
  try{
    const data = await chrome.storage.local.get(FEED_CACHE_KEY);
    return data[FEED_CACHE_KEY] || {};
  }catch(e){ return {}; }
}
async function setFeedCacheEntry(key, feedUrl){
  const cache = await getFeedCache();
  cache[key] = feedUrl;
  try{ await chrome.storage.local.set({ [FEED_CACHE_KEY]: cache }); }catch(e){}
}

const FEED_LINK_RE = /<link[^>]+(?:rel=["']alternate["'][^>]+type=["']application\/(?:rss|atom)\+xml["']|type=["']application\/(?:rss|atom)\+xml["'][^>]+rel=["']alternate["'])[^>]*>/gi;
const HREF_RE = /href=["']([^"']+)["']/i;
const WELL_KNOWN_PATHS = ['/feed', '/rss', '/rss.xml', '/feed.xml', '/atom.xml', '/index.xml', '/feeds/posts/default'];

async function fetchText(url, timeoutMs){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
  try{
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
    if(!res.ok) return null;
    return await res.text();
  }catch(e){ return null; }
  finally{ clearTimeout(t); }
}

function looksLikeFeed(text){
  if(!text) return false;
  const head = text.slice(0, 400).toLowerCase();
  return head.includes('<rss') || head.includes('<feed') || head.includes('<?xml');
}

// A handful of well-known sites host their real feed on a different
// subdomain than the site itself (same-origin guessing can never find
// these), each hand-verified rather than guessed.
const KNOWN_FEED_HINTS = {
  'news.sky.com': 'https://feeds.skynews.com/feeds/rss/home.xml',
  'skynews.com': 'https://feeds.skynews.com/feeds/rss/home.xml',
  'bbc.co.uk': 'https://feeds.bbci.co.uk/news/rss.xml',
  'bbc.com': 'https://feeds.bbci.co.uk/news/rss.xml'
};

async function discoverFeed(origin, hintPath){
  const cacheKey = origin + (hintPath || '');
  const cache = await getFeedCache();
  if(cache[cacheKey] !== undefined) return cache[cacheKey];

  let hostname;
  try{ hostname = new URL(origin).hostname.replace(/^www\./, ''); }catch(e){ hostname = ''; }
  const candidates = [];
  if(KNOWN_FEED_HINTS[hostname]) candidates.push(KNOWN_FEED_HINTS[hostname]);
  if(hintPath){
    const trimmed = hintPath.replace(/\/$/, '');
    candidates.push(origin + trimmed + '/.rss');
    candidates.push(origin + trimmed + '.rss');
  }
  WELL_KNOWN_PATHS.forEach(p => candidates.push(origin + p));

  // Same-origin/known-hint candidates first - some sites block bot-like
  // homepage requests (403) while still serving their actual feed fine, so
  // gating discovery behind a successful homepage fetch would miss those.
  for(const url of candidates){
    const text = await fetchText(url, 6000);
    if(looksLikeFeed(text)){
      await setFeedCacheEntry(cacheKey, url);
      return url;
    }
  }

  // Last resort: parse the homepage for a declared <link rel="alternate">
  // feed - tried last since some sites block even this request outright.
  const pageUrl = origin + (hintPath || '');
  const html = await fetchText(pageUrl, 8000);
  if(html){
    const matches = html.match(FEED_LINK_RE);
    if(matches){
      for(const tag of matches){
        const hrefMatch = tag.match(HREF_RE);
        if(!hrefMatch) continue;
        let feedUrl;
        try{ feedUrl = new URL(hrefMatch[1], pageUrl).href; }catch(e){ continue; }
        const text = await fetchText(feedUrl, 6000);
        if(looksLikeFeed(text)){
          await setFeedCacheEntry(cacheKey, feedUrl);
          return feedUrl;
        }
      }
    }
  }

  await setFeedCacheEntry(cacheKey, null);
  return null;
}

/* ---------------- feed parsing ---------------- */
function firstImgFromHtml(html){
  if(!html) return null;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}
function textOf(node, selector){
  const el = node.querySelector(selector);
  return el ? el.textContent.trim() : '';
}

// CSS selectors don't reliably match namespaced XML tags (media:content,
// media:thumbnail) via querySelector/querySelectorAll even when the
// selector string itself is syntactically valid - confirmed directly
// against a real feed: no exception, it just silently never matches.
// getElementsByTagName matches on the literal qualified name and works
// correctly for namespaced elements in an XML document.
function firstMediaImage(node){
  const enclosure = node.getElementsByTagName('enclosure')[0];
  if(enclosure && enclosure.getAttribute('url')) return enclosure.getAttribute('url');
  const mediaContent = node.getElementsByTagName('media:content')[0];
  if(mediaContent && mediaContent.getAttribute('url')) return mediaContent.getAttribute('url');
  const mediaThumb = node.getElementsByTagName('media:thumbnail')[0];
  if(mediaThumb && mediaThumb.getAttribute('url')) return mediaThumb.getAttribute('url');
  return null;
}

function parseFeedXml(xmlText, sourceMeta){
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if(doc.querySelector('parsererror')) return [];
  const posts = [];

  const rssItems = doc.querySelectorAll('channel item, rss item');
  if(rssItems.length){
    rssItems.forEach(item => {
      const title = textOf(item, 'title');
      const linkEl = item.querySelector('link');
      const link = textOf(item, 'link') || (linkEl && linkEl.getAttribute('href')) || '';
      const pubDate = textOf(item, 'pubDate') || textOf(item, 'published') || textOf(item, 'date');
      const description = textOf(item, 'description') || textOf(item, 'summary') || '';
      let image = firstMediaImage(item);
      if(!image) image = firstImgFromHtml(description);
      posts.push({
        title, link, pubDate: pubDate ? new Date(pubDate) : null,
        snippet: description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220),
        image, source: sourceMeta
      });
    });
    return posts;
  }

  doc.querySelectorAll('feed entry').forEach(entry => {
    const title = textOf(entry, 'title');
    const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
    const link = linkEl ? (linkEl.getAttribute('href') || '') : '';
    const pubDate = textOf(entry, 'published') || textOf(entry, 'updated');
    const summary = textOf(entry, 'summary') || textOf(entry, 'content') || '';
    let image = firstImgFromHtml(summary);
    if(!image) image = firstMediaImage(entry);
    posts.push({
      title, link, pubDate: pubDate ? new Date(pubDate) : null,
      snippet: summary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220),
      image, source: sourceMeta
    });
  });
  return posts;
}

/* ---------------- build feed ---------------- */
let allPosts = [];
let activeSourceFilter = null;

async function buildFeed(){
  showView('feed');
  const body = $('#feedBody');
  body.innerHTML = `<div class="storm-loader"><div class="bolt-spin">⚡</div><div>Gathering your storm…</div></div>`;
  $('#filterRow').innerHTML = '';
  allPosts = [];
  activeSourceFilter = null;

  const sources = Array.from(selected.values());
  const results = await Promise.all(sources.map(async (s) => {
    try{
      let origin, hintPath;
      if(s.manual && s.originHint){
        const u = new URL(s.originHint);
        origin = u.origin; hintPath = u.pathname !== '/' ? u.pathname : '';
      } else {
        origin = 'https://' + s.domain; hintPath = '';
      }
      const feedUrl = await discoverFeed(origin, hintPath);
      if(!feedUrl) return { source: s, posts: [], ok: false };
      const xml = await fetchText(feedUrl, 9000);
      if(!xml) return { source: s, posts: [], ok: false };
      const posts = parseFeedXml(xml, s);
      return { source: s, posts, ok: posts.length > 0 };
    }catch(e){
      return { source: s, posts: [], ok: false };
    }
  }));

  const failed = results.filter(r => !r.ok);
  results.forEach(r => allPosts.push(...r.posts));
  allPosts.sort((a, b) => (b.pubDate ? b.pubDate.getTime() : 0) - (a.pubDate ? a.pubDate.getTime() : 0));

  renderFilterRow(sources, results);
  renderPosts();

  if(failed.length){
    toast(`Couldn't find a feed for ${failed.map(r => r.source.domain).join(', ')}`);
  }
}
$('#buildBtn').addEventListener('click', buildFeed);

function renderFilterRow(sources, results){
  const row = $('#filterRow');
  const okDomains = new Set(results.filter(r => r.ok).map(r => r.source.domain));
  const chips = ['<button class="filter-chip active" data-filter="">All</button>']
    .concat(sources.filter(s => okDomains.has(s.domain)).map(s =>
      `<button class="filter-chip" data-filter="${s.domain}"><img src="${s.favicon}" alt="">${s.domain}</button>`
    ));
  row.innerHTML = chips.join('');
  row.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      row.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeSourceFilter = chip.getAttribute('data-filter') || null;
      renderPosts();
    });
  });
}

function timeAgo(date){
  if(!date) return '';
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return mins + 'm ago';
  const hours = Math.round(mins / 60);
  if(hours < 24) return hours + 'h ago';
  return Math.round(hours / 24) + 'd ago';
}

function renderPosts(){
  const body = $('#feedBody');
  const list = activeSourceFilter ? allPosts.filter(p => p.source.domain === activeSourceFilter) : allPosts;
  if(list.length === 0){
    body.innerHTML = `<div class="empty-hint">No posts to show yet - try picking a few more sources.</div>`;
    return;
  }
  body.innerHTML = `<div class="post-grid">${list.map(postCardHtml).join('')}</div>`;
}

function escapeHtml(s){
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function postCardHtml(p){
  const thumb = p.image
    ? `<img class="thumb" src="${escapeHtml(p.image)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;thumb none&quot;>📰</div>'">`
    : `<div class="thumb none">📰</div>`;
  return `<a class="post-card" href="${escapeHtml(p.link)}" target="_blank" rel="noopener">
    ${thumb}
    <div class="body">
      <div class="post-src"><img src="${p.source.favicon}" alt="">${escapeHtml(p.source.domain)}</div>
      <div class="post-title">${escapeHtml(p.title)}</div>
      <div class="post-snip">${escapeHtml(p.snippet)}</div>
      <div class="post-time">${timeAgo(p.pubDate)}</div>
    </div>
  </a>`;
}

/* ---------------- init ---------------- */
(async function init(){
  await restoreSelected();
  renderDomainList();
})();

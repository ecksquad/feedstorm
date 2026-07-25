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

const STORAGE_KEY = 'feedstorm_sources';
const FEED_CACHE_KEY = 'feedstorm_feedCache';

/* ---------------- curated site list ----------------
   No plain website can read a user's real browsing history - that needs a
   browser extension's history permission, which comes with real install
   friction (developer mode, or a store listing + review). This curated list
   plus "add a site by hand" gets most of the same value (pick your sites,
   see them all in one feed) with zero install - just open the page. */
const CURATED_SITES = [
  { category: 'News', items: [
    { name: 'BBC News', domain: 'bbc.co.uk' },
    { name: 'The Guardian', domain: 'theguardian.com' },
    { name: 'Sky News', domain: 'news.sky.com' },
    { name: 'Reuters', domain: 'reuters.com' },
    { name: 'Al Jazeera', domain: 'aljazeera.com' }
  ]},
  { category: 'Tech', items: [
    { name: 'The Verge', domain: 'theverge.com' },
    { name: 'Ars Technica', domain: 'arstechnica.com' },
    { name: 'TechCrunch', domain: 'techcrunch.com' },
    { name: 'Wired', domain: 'wired.com' },
    { name: 'ZDNET', domain: 'zdnet.com' }
  ]},
  { category: 'Sports', items: [
    { name: 'BBC Sport', domain: 'bbc.co.uk', path: '/sport' },
    { name: 'Sky Sports', domain: 'skysports.com' },
    { name: 'ESPN', domain: 'espn.com' }
  ]},
  { category: 'Science & Space', items: [
    { name: 'NASA', domain: 'nasa.gov' },
    { name: 'National Geographic', domain: 'nationalgeographic.com' },
    { name: 'Scientific American', domain: 'scientificamerican.com' }
  ]}
];

function faviconUrl(domain){
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`;
}

function siteKey(site){ return site.domain + (site.path || ''); }

function renderCuratedList(){
  const wrap = $('#curatedList');
  wrap.innerHTML = CURATED_SITES.map(group => `
    <div class="cat-group">
      <div class="cat-label">${group.category}</div>
      <div class="site-grid">
        ${group.items.map(site => {
          const key = siteKey(site);
          const active = selected.has(key);
          return `<button type="button" class="site-chip${active ? ' active' : ''}" data-key="${key}">
            <img src="${faviconUrl(site.domain)}" alt="">
            <span>${site.name}</span>
            <span class="tick">✓</span>
          </button>`;
        }).join('')}
      </div>
    </div>
  `).join('');

  wrap.querySelectorAll('.site-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const key = chip.getAttribute('data-key');
      const site = CURATED_SITES.flatMap(g => g.items).find(s => siteKey(s) === key);
      if(selected.has(key)){
        selected.delete(key);
        chip.classList.remove('active');
      } else {
        const entry = { domain: key, favicon: faviconUrl(site.domain), manual: !!site.path };
        if(site.path) entry.originHint = 'https://' + site.domain + site.path;
        selected.set(key, entry);
        chip.classList.add('active');
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
function persistSelected(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected.values()))); }
  catch(e){}
}
function restoreSelected(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    (raw ? JSON.parse(raw) : []).forEach(s => selected.set(s.domain, s));
  }catch(e){}
  updateSelCount();
}

/* ---------------- feed discovery ----------------
   This is a plain website, not a browser extension, so its fetch() calls
   are subject to normal CORS rules - most sites don't send the headers
   that would let another origin read their response directly. Routing
   through a small dedicated proxy sidesteps that. Tried public free
   CORS-relay services first (allorigins.win etc.) - all failed in testing
   (down, 403, 522, timeout) within minutes of each other, which isn't bad
   luck, it's what free/unauthenticated proxy services are like. This one
   is a tiny Flask route on the same Pi the car/house app already runs on
   (see feedproxy_server.py), exposed publicly via Tailscale Funnel - a
   short-term call while this is small; if Feedstorm ever gets real
   traffic, this should move to its own separate hosting rather than
   riding on personal home infrastructure. */
const CORS_PROXY = 'https://magicmirroros.tail655aa9.ts.net/feedproxy?url=';
function viaProxy(url){ return CORS_PROXY + encodeURIComponent(url); }

function getFeedCache(){
  try{ return JSON.parse(localStorage.getItem(FEED_CACHE_KEY) || '{}'); }
  catch(e){ return {}; }
}
function setFeedCacheEntry(key, feedUrl){
  const cache = getFeedCache();
  cache[key] = feedUrl;
  try{ localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(cache)); }catch(e){}
}

const FEED_LINK_RE = /<link[^>]+(?:rel=["']alternate["'][^>]+type=["']application\/(?:rss|atom)\+xml["']|type=["']application\/(?:rss|atom)\+xml["'][^>]+rel=["']alternate["'])[^>]*>/gi;
const HREF_RE = /href=["']([^"']+)["']/i;
const WELL_KNOWN_PATHS = ['/feed', '/rss', '/rss.xml', '/feed.xml', '/atom.xml', '/index.xml', '/feeds/posts/default'];

async function fetchText(url, timeoutMs){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
  try{
    const res = await fetch(viaProxy(url), { signal: ctrl.signal });
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

/* ---------------- PWA install ---------------- */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('#installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; });

/* ---------------- init ---------------- */
(async function init(){
  await restoreSelected();
  renderCuratedList();
})();

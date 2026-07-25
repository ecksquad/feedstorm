# Feedstorm

Pick your favourite sites and Feedstorm blends their latest posts - photos,
headlines, everything - into one feed. Live at
**https://ecksquad.github.io/feedstorm/** - just open it, no install, no
account, no permissions to approve.

## Why it works this way

An earlier version of this was a browser extension that could read your real
browsing history to find your most-visited sites automatically. That's
genuinely the only way to get *automatic* site detection - a plain webpage
can never read browsing history, full stop - but it meant developer-mode
installs and eventually a store listing + review just to try it. Too much
friction for what this is. This version trades the automatic detection for a
curated checklist (News/Tech/Sports/Science, tap to add) plus a manual
"add any site" box - nearly as fast to set up, and it's just a link.

## Scope

Feedstorm aggregates sites with a public **RSS or Atom feed** - news sites,
blogs, YouTube channels, subreddits, Substack, podcasts. That covers a huge
share of what people actually follow, reliably and without touching anyone's
terms of service. It does **not** attempt to scrape platforms like Instagram,
TikTok or X - those block automated access and require paid, restricted
official APIs per platform.

A handful of sites (confirmed: Engadget, Reddit's `.rss` endpoint) return
403 to automated fetches outright - bot protection, not a Feedstorm bug.

## Architecture

- `index.html` / `app.js` - the whole front end: curated site picker, manual
  add, RSS/Atom discovery + parsing, the feed grid, light/dark mode.
- `feedproxy_server.py` - a small Flask route that fetches a feed URL
  server-side and returns it with a permissive CORS header. Needed because
  this is a plain website: its own fetch() calls are subject to normal CORS
  rules, and most sites don't send headers letting another origin read
  their response. Public CORS-relay services (allorigins.win etc.) were
  tried first and all failed within minutes of each other in testing - down,
  403, 522, timeout - which is typical of free/unauthenticated proxy
  services, not something worth depending on.
- Currently deployed on the same Raspberry Pi the developer's car/house
  control app runs on, exposed publicly via Tailscale Funnel
  (`https://magicmirroros.tail655aa9.ts.net/feedproxy`). **This is a
  short-term call while Feedstorm is small** - if it ever gets real
  traffic, the proxy should move to its own separate hosting (e.g. a
  Cloudflare Worker) rather than riding on personal home infrastructure.
- `manifest.json` / `sw.js` - installable as a PWA (add to home screen),
  works offline for the app shell.
- `gen_icons.ps1` - regenerates everything in `icons/` if the design changes.

## Local development

Any static file server works, e.g.:

```
node -e "require('http').createServer((req,res)=>{const fs=require('fs');const path=require('path');let p=req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0];fs.readFile(path.join(__dirname,p),(e,d)=>{if(e){res.writeHead(404);res.end();return}res.end(d)})}).listen(8420)"
```

then open `http://127.0.0.1:8420/index.html`.

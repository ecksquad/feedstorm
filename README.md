# Feedstorm

A browser extension that turns your most-visited sites into one custom feed.

Feedstorm looks at *your own browsing history* (nothing leaves your browser)
to find the sites you actually visit, lets you pick which ones to include with
a checkbox list, then pulls their latest posts - photos, headlines, snippets -
into one unified, sortable feed. Light and dark mode.

## Why an extension, not a website

A plain website can never read your browsing history or most-visited sites -
that's a hard browser privacy boundary, not a missing feature. Only a browser
extension can request that permission, with an explicit install-time consent
prompt. That's the whole reason this is a `.crx`-style unpacked extension
rather than a hosted webpage like this developer's other projects.

It also means feed-fetching needs no server/proxy: an extension page with
`host_permissions` can fetch other sites directly, bypassing the CORS
restrictions a normal website would hit.

## Scope

Feedstorm aggregates sites with a public **RSS or Atom feed** - news sites,
blogs, YouTube channels, subreddits, Substack, podcasts. That covers a huge
share of what people actually follow, reliably and without touching anyone's
terms of service. It does **not** attempt to scrape platforms like Instagram,
TikTok or X - those block automated access and require paid, restricted
official APIs per platform.

A handful of sites (confirmed: Engadget, Reddit's `.rss` endpoint) return
403 to automated fetches outright, likely bot-protection that may behave
differently for a real signed-in browser session than it did in headless
testing - not a bug in Feedstorm, just something those specific sites block.

## Installing (unpacked, for now)

1. Open `edge://extensions` (or `chrome://extensions`).
2. Enable **Developer mode** (top right).
3. **Load unpacked** → select this folder.
4. Click the Feedstorm icon in the toolbar.

## How it works

- **Scan my history**: reads the last 90 days of browsing history via the
  `history` permission, groups by domain, ranks by visit count. Nothing is
  read automatically in the background - only when you tap the button.
- **Add a site by hand**: paste any domain, or a specific page (like a
  subreddit) - Feedstorm tries to auto-discover its RSS/Atom feed.
- **Build my Feedstorm**: fetches and merges every selected source's feed,
  sorted newest-first (most feeds don't expose view counts, so recency is
  the reliable, universal signal), with filter chips to view one source at
  a time.
- Discovered feed URLs are cached (`chrome.storage.local`) so re-building
  doesn't re-run discovery every time.

## Files

- `manifest.json` - Manifest V3 extension definition
- `background.js` - opens the app as a real tab (not a cramped popup) on
  icon click
- `app.html` / `app.js` - the whole app: history scan, feed discovery,
  RSS/Atom parsing, rendering, theme toggle
- `gen_icons.ps1` - regenerates `icons/` if the design changes

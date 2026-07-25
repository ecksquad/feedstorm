# Feedstorm: Find My Sites

A small, separate companion extension. Feedstorm itself stays a plain
website - this is the only piece that touches your browsing history,
because a plain webpage has no way to read it at all; only an extension
with the `history` permission can.

## What it does

Click the extension icon and you'll see an explicit consent screen first -
not the scan itself. Only clicking **Show my top sites** actually reads
your history; **Not now** (or just closing the popup) means it's never
read at all. After that, it groups your history by site, ranks by how
often you've actually visited each one, and shows you a checklist - your
real top sites, not a guess. Tick the ones you want, click **Add to
Feedstorm**, and it opens the site with those added.

## The privacy guarantee

**Anything shown but not ticked disappears the moment you close the
popup - nothing about it is ever written to disk or sent anywhere.**

This isn't a policy we're promising to follow - it falls out of how the
popup is built:

- The history scan and the ranked list live only in the popup document's
  memory. A browser extension popup is destroyed the instant it loses
  focus; there's no background page keeping it alive.
- Nothing in `popup.js` ever calls `chrome.storage`, and the extension
  doesn't even request the `storage` permission - it physically can't
  persist anything.
- Nothing in `popup.js` ever calls `fetch()` or sends data anywhere. The
  *only* place any of your history data goes is: the domains you tick,
  bundled into the URL of a new browser tab it opens to Feedstorm, on
  your own machine. Nothing crosses the network.
- The list isn't filtered by what a site *is* - a site is shown exactly
  like any other if you visited it. Nothing about your history is quietly
  hidden or judged; you decide what to keep just by ticking or not
  ticking it.

## Installing it (unpacked - no store listing)

1. Open `edge://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**, and select this `history-finder` folder.
4. Click the Feedstorm icon in your toolbar whenever you want suggestions.

## Files

- `manifest.json` - Manifest V3, `history` permission only.
- `popup.html` / `popup.js` - the whole thing; ranks and renders history,
  hands off ticked domains to Feedstorm.
- `test_harness.html` - loads `popup.js` against fake mocked history data
  (no real extension context needed) - used to verify the ranking/filtering
  logic without needing a real browsing history to test against.

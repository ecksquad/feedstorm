# Store listing copy

Paste these into the Chrome Web Store Developer Dashboard / Edge Add-ons
Partner Center submission forms. Both stores ask for slightly different
field names but the content below covers what each one wants.

## Name
Feedstorm: Find My Sites

## Short description (Chrome: max 132 characters)
Suggests sites for Feedstorm from your top-visited history. Nothing is read until you say so, and nothing is ever saved.

(131 characters)

## Detailed description

Feedstorm (ecksquad.github.io/feedstorm) blends the latest posts from your
favourite sites into one feed. This companion extension helps you find
sites to add to it, based on where you actually spend time - your real
top sites, not a guess.

How it works: click the toolbar icon and you'll see a consent screen
first, not a scan. Only clicking "Show my top sites" reads your history;
closing the popup or clicking "Not now" means it's never read at all.
After that, it ranks your history by site and shows you a checklist with
your top sites already selected - untick anything you'd rather leave out,
then click "Add to Feedstorm" and it opens with those sites added.

Nothing is ever recorded. This extension has no server and makes no
network requests of any kind - it can't send your history anywhere even
if it wanted to. It doesn't request the storage permission either, so it
can't save anything to disk. The ranked list only exists in the popup's
own memory, which is destroyed the moment the popup closes - anything you
untick (or the whole list, if you close without clicking "Add to
Feedstorm") disappears with it, guaranteed by how a browser extension
popup works, not by a policy we're promising to follow.

Full privacy policy: https://ecksquad.github.io/feedstorm/history-finder/privacy.html
Source code (fully open): github.com/ecksquad/feedstorm/tree/main/history-finder

## Single purpose description (Chrome requires this in its own field)

This extension has one job: read the user's browsing history, only after
an explicit in-extension consent click, to rank and suggest their
most-visited sites as candidates to add to Feedstorm (a separate website).
It does nothing else - no other feature, no other data access.

## Permission justification: `history`

The extension's entire purpose is suggesting sites from browsing history,
which requires this permission - it's the only one requested. Access only
happens after an explicit "Show my top sites" click on a consent screen
shown every time the popup opens (not merely granted once at install and
then used silently). Nothing read is stored or transmitted anywhere; full
technical explanation of how that's structurally enforced (not just
promised) is in the linked privacy policy.

## Category
Chrome Web Store: "Productivity" or "News & Weather"
Edge Add-ons: "Productivity"

## Privacy policy URL
https://ecksquad.github.io/feedstorm/history-finder/privacy.html

## Screenshots
See `screenshots/` in this folder - consent screen and the ranked list,
captured at 1280x800.

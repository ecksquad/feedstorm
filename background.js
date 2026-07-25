// Opens the app as a real full tab rather than a cramped popup - clicking
// the toolbar icon focuses an already-open Feedstorm tab if one exists,
// otherwise opens a new one.
const APP_URL = chrome.runtime.getURL("app.html");

chrome.action.onClicked.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: APP_URL });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: APP_URL });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: APP_URL });
  }
});

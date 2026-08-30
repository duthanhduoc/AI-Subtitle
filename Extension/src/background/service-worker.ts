// Best-effort entry point for callers that need to inject the content bundle
// into the active tab. The content bundle has its own duplicate-load guard.
chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse) => {
    if (
      !message ||
      typeof message !== "object" ||
      !("type" in message) ||
      (message as { type: unknown }).type !== "ENSURE_CONTENT"
    )
      return;
    const tabId = sender.tab?.id ?? (message as { tabId?: number }).tabId;
    if (!tabId) {
      sendResponse({ ok: false, error: "No active tab." });
      return;
    }
    // This helper deliberately reports only that the best-effort attempt finished;
    // a follow-up tab message is responsible for surfacing restricted-page failures.
    void chrome.scripting
      .executeScript({
        target: { tabId, allFrames: false },
        files: ["content.js"],
      })
      .then(
        () => sendResponse({ ok: true }),
        () => sendResponse({ ok: true }),
      );
    // Keep Chrome's response channel alive until executeScript settles.
    return true;
  },
);

const hlsByTab = new Map<number, HlsUrl[]>();

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const tabId = details.tabId;
    if (tabId < 0 || !/\.m3u8(?:$|[?#])/i.test(details.url)) return;
    const current = hlsByTab.get(tabId) ?? [];
    const next = [
      { url: details.url, frameId: details.frameId, seenAt: Date.now() },
      ...current.filter((entry) => entry.url !== details.url),
    ].slice(0, 10);
    hlsByTab.set(tabId, next);
  },
  { urls: ["*://*/*.m3u8*"] },
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") hlsByTab.delete(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => hlsByTab.delete(tabId));

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!message || typeof message !== "object" || !("type" in message)) return;
  if ((message as { type?: unknown }).type !== "GET_HLS_URLS") return;
  const tabId = (message as { tabId?: unknown }).tabId ?? sender.tab?.id;
  if (typeof tabId !== "number") {
    sendResponse({ ok: false, error: "No tab selected." });
    return;
  }
  sendResponse({ ok: true, value: hlsByTab.get(tabId) ?? [] });
});
import type { HlsUrl } from "../shared/messages";

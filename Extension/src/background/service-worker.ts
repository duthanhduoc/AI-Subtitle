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

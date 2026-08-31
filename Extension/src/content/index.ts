import { discover, getVideo } from "./discovery";
import { isMessage, type Reply } from "../shared/messages";
import { openPlayer } from "../pip/player";
import { sessionForUrl, type SubtitleSession } from "./subtitle-session";

type ContentWindow = Window & {
  __customPipContentLoaded?: boolean;
  __customPipSubtitleSession?: SubtitleSession;
};
const contentWindow = window as ContentWindow;
contentWindow.__customPipSubtitleSession ??= {
  url: location.href,
  tracks: [],
};

// The popup injects content.js before each request. Store the guard on `window`
// so reinjection does not register duplicate message listeners.
if (!contentWindow.__customPipContentLoaded) {
  contentWindow.__customPipContentLoaded = true;
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender,
      sendResponse: (reply: Reply<unknown>) => void,
    ) => {
      if (!isMessage(message)) return;

      // SPA navigation can reuse this content-script world. Treat a new URL as
      // a new media session so subtitles from the previous title disappear.
      const currentSession = contentWindow.__customPipSubtitleSession!;
      const nextSession = sessionForUrl(currentSession, location.href);
      contentWindow.__customPipSubtitleSession = nextSession;
      if (message.type === "GET_CANDIDATES") {
        sendResponse({ ok: true, value: discover() });
        return;
      }
      // IDs are intentionally ephemeral; re-resolve after the user's selection
      // because a site may have replaced its player since the last scan.
      const video = getVideo(message.id);
      if (!video) {
        sendResponse({
          ok: false,
          error: "The selected video is no longer available. Reopen the extension.",
        });
        return;
      }

      // Extension preferences are global, while subtitle tracks belong to the
      // current page session. controlsDelay remains stored for auto-hide behavior.
      void chrome.storage.local
        .get({ fontSize: "medium", background: "medium", controlsDelay: 2200 })
        .then((settings) => openPlayer(video, settings, nextSession))
        .then(() => sendResponse({ ok: true, value: null }))
        .catch((error: unknown) =>
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not open Picture-in-Picture.",
          }),
        );
      // Chrome requires `true` when sendResponse will run asynchronously.
      return true;
    },
  );
}

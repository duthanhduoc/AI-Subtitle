import { discover, getVideo } from "./discovery";
import { isMessage, type Reply } from "../shared/messages";
import { openPlayer } from "../pip/player";
import { openVideoDialog } from "./dialog";
import { sessionForUrl, type SubtitleSession } from "./subtitle-session";

// Content-script state lives with the tab, not the short-lived popup. It is
// deliberately session-only: reloads clear it and no subtitle text is persisted.
let subtitleOffset = 0;
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
      if (nextSession !== currentSession) subtitleOffset = 0;
      contentWindow.__customPipSubtitleSession = nextSession;
      if (message.type === "GET_CANDIDATES") {
        sendResponse({ ok: true, value: discover() });
        return;
      }
      if (message.type === "SET_OFFSET") {
        // Invalid runtime payloads fall back safely despite TypeScript callers.
        subtitleOffset = Number.isFinite(message.offset) ? message.offset : 0;
        sendResponse({ ok: true, value: null });
        return;
      }

      if (message.type === "OPEN_DIALOG") {
        const video = message.id ? getVideo(message.id) : undefined;
        const url = message.url ?? video?.currentSrc;
        if (!url || url.startsWith("blob:")) {
          sendResponse({
            ok: false,
            error:
              "This video has no reusable URL. Use a detected HLS stream instead.",
          });
          return;
        }
        video?.pause();
        void chrome.runtime
          .sendMessage({ type: "ENSURE_VIDEOJS_MAIN" })
          .catch(() => undefined)
          .then(() =>
            openVideoDialog(url, message.subtitles, message.subtitleName),
          )
          .then(() => sendResponse({ ok: true, value: null }))
          .catch((error: unknown) =>
            sendResponse({
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Could not create the video dialog.",
            }),
          );
        return true;
      }

      // IDs are intentionally ephemeral; re-resolve after the user's selection
      // because a site may have replaced its player since the last scan.
      const video = getVideo(message.id);
      if (!video) {
        sendResponse({
          ok: false,
          error: "The selected video is no longer available. Scan again.",
        });
        return;
      }

      // Extension preferences are global, while tracks and offset belong to the
      // current page session. The player currently consumes the subtitle fields;
      // controlsDelay remains stored for the planned auto-hide behavior.
      void chrome.storage.local
        .get({ fontSize: "medium", background: "medium", controlsDelay: 2200 })
        .then((settings) =>
          openPlayer(
            video,
            message.subtitles
              ? {
                  name: message.subtitleName ?? "Subtitle",
                  text: message.subtitles,
                }
              : undefined,
            subtitleOffset,
            settings,
            nextSession,
          ),
        )
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

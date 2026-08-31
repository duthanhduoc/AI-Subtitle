import "@videojs/html/media/hlsjs-video";
import "@videojs/html/video/player";
import "@videojs/html/video/skin";
import "@videojs/html/video/skin.css";
import "./player.css";
import { discover, getVideo } from "../content/discovery";
import { openPlayer } from "../pip/player";
import { isPlayerMessage, type Reply } from "../shared/messages";
import type { SubtitleState } from "../subtitles/types";

const params = new URLSearchParams(location.search);
const source = params.get("src");
const root = document.getElementById("app")!;
const subtitleState: SubtitleState = { tracks: [] };
let hlsMedia: HTMLElementTagNameMap["hlsjs-video"] | undefined;

void chrome.tabs.getCurrent().then((tab) => {
  if (!tab?.id) return;
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender,
      sendResponse: (reply: Reply<unknown>) => void,
    ) => {
      if (!isPlayerMessage(message) || message.tabId !== tab.id) return;
      if (message.type === "GET_CANDIDATES") {
        sendResponse({ ok: true, value: discover() });
        return;
      }
      const nativeVideo = getVideo(message.id);
      const media = hlsMedia;
      if (!nativeVideo || !media) {
        sendResponse({
          ok: false,
          error: "The player video is not ready. Rescan and try again.",
        });
        return;
      }
      void chrome.storage.local
        .get({ fontSize: "medium", background: "medium", controlsDelay: 2200 })
        .then((settings) =>
          openPlayer(media, settings, subtitleState, nativeVideo),
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
      return true;
    },
  );
});

if (!source) {
  root.textContent = "No HLS URL was provided.";
} else {
  const player = document.createElement("video-player");
  const skin = document.createElement("video-skin");
  hlsMedia = document.createElement("hlsjs-video");

  hlsMedia.slot = "media";
  hlsMedia.src = source;
  hlsMedia.setAttribute("playsinline", "");
  hlsMedia.setAttribute("preload", "auto");
  skin.append(hlsMedia);
  player.append(skin);
  root.append(player);

  requestAnimationFrame(() => {
    skin.shadowRoot
      ?.querySelector<HTMLElement>("media-play-button")
      ?.focus({ preventScroll: true });
  });
}

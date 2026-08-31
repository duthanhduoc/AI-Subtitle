import "@videojs/html/media/hlsjs-video";
import "@videojs/html/video/player";
import "@videojs/html/video/skin";
import "@videojs/html/video/skin.css";
import "./player.css";
import { discover, getVideo } from "../content/discovery";
import { openPlayer } from "../pip/player";
import { isPlayerMessage, type Reply } from "../shared/messages";
import { srtToVtt } from "../subtitles/srt";
import type { SubtitleState } from "../subtitles/types";
import { PictureInPicture2, type IconNode } from "lucide";

const params = new URLSearchParams(location.search);
const source = params.get("src");
const root = document.getElementById("app")!;
const subtitleState: SubtitleState = { tracks: [] };
let hlsMedia: HTMLElementTagNameMap["hlsjs-video"] | undefined;
let subtitleTrack: HTMLTrackElement | undefined;
let subtitleUrl: string | undefined;
const svgNamespace = "http://www.w3.org/2000/svg";

const lucide = (
  document: Document,
  [tag, attributes, children]: IconNode,
): SVGElement => {
  const element = document.createElementNS(svgNamespace, tag);
  for (const [name, value] of Object.entries(attributes))
    element.setAttribute(name, String(value));
  element.append(
    ...(children ?? []).map((child) => lucide(document, child)),
  );
  return element;
};

const isVtt = (value: string): boolean =>
  /^\uFEFF?WEBVTT(?:[\t ]|\r?\n|$)/.test(value);

const subtitleFileToVtt = async (file: File): Promise<string> => {
  const text = await file.text();
  if (isVtt(text)) return text.replace(/^\uFEFF/, "");
  return srtToVtt(text);
};

const clearSubtitleTrack = () => {
  subtitleTrack?.remove();
  subtitleTrack = undefined;
  if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
  subtitleUrl = undefined;
};

const createTooltip = (id: string, label: string): HTMLElement => {
  const tooltip = document.createElement("media-tooltip");
  tooltip.id = id;
  tooltip.className = "media-surface media-tooltip";
  tooltip.setAttribute("side", "top");
  tooltip.textContent = label;
  return tooltip;
};

const createSubtitleTools = (
  media: HTMLElementTagNameMap["hlsjs-video"],
): HTMLElement => {
  const tools = document.createElement("div");
  tools.className = "player-subtitle-tools";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".srt,.vtt,text/vtt,application/x-subrip";
  input.hidden = true;

  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "player-subtitle-upload media-button media-button--subtle media-button--icon";
  button.id = "extension-subtitle-upload-trigger";
  button.textContent = "CC+";
  button.setAttribute("aria-label", "Upload SRT or VTT subtitle");
  button.setAttribute("commandfor", "extension-subtitle-upload-tooltip");
  button.addEventListener("click", () => input.click());

  const tooltip = createTooltip(
    "extension-subtitle-upload-tooltip",
    "Upload subtitle",
  );

  const status = document.createElement("span");
  status.className = "player-subtitle-status";
  status.hidden = true;
  status.setAttribute("role", "status");

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    void subtitleFileToVtt(file)
      .then((vtt) => {
        const nextUrl = URL.createObjectURL(
          new Blob([vtt], { type: "text/vtt" }),
        );
        const nextTrack = document.createElement("track");
        nextTrack.kind = "subtitles";
        nextTrack.src = nextUrl;
        nextTrack.srclang = "vi";
        nextTrack.label = file.name;
        nextTrack.default = true;

        clearSubtitleTrack();
        subtitleUrl = nextUrl;
        subtitleTrack = nextTrack;
        media.append(nextTrack);
        tooltip.textContent = "Replace subtitle";
        status.textContent = file.name;
        status.dataset.error = "false";
      })
      .catch((error: unknown) => {
        status.textContent =
          error instanceof Error ? error.message : "Could not load subtitle.";
        status.dataset.error = "true";
      });
  });

  tools.append(button, tooltip, input, status);
  return tools;
};

const createCustomPipControls = (): DocumentFragment => {
  const controls = document.createDocumentFragment();
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "player-custom-pip media-button media-button--subtle media-button--icon";
  button.id = "extension-custom-pip-trigger";
  button.setAttribute("aria-label", "Open extension Picture-in-Picture");
  button.setAttribute("commandfor", "extension-custom-pip-tooltip");
  const icon = lucide(document, PictureInPicture2);
  icon.classList.add("media-icon");
  icon.setAttribute("aria-hidden", "true");
  button.append(icon);

  const tooltip = createTooltip(
    "extension-custom-pip-tooltip",
    "Open Custom PiP",
  );
  button.addEventListener("click", () => {
    const media = hlsMedia;
    if (!media) return;
    void chrome.storage.local
      .get({ fontSize: "medium", background: "medium", controlsDelay: 2200 })
      .then((settings) => openPlayer(media, settings, subtitleState, media))
      .catch((error: unknown) => {
        tooltip.textContent =
          error instanceof Error
            ? error.message
            : "Could not open extension Picture-in-Picture.";
      });
  });
  controls.append(button, tooltip);
  return controls;
};

const replaceNativePip = (skin: HTMLElement): void => {
  const shadowRoot = skin.shadowRoot;
  if (!shadowRoot) return;

  const hideStyle = document.createElement("style");
  // video-skin's DOM is stable; CSS keeps the native control hidden even when
  // its availability state is recalculated after Document PiP restores media.
  hideStyle.textContent = "media-pip-button { display: none !important; }";
  shadowRoot.append(hideStyle);

  const nativePip = shadowRoot.querySelector<HTMLElement>("media-pip-button");
  const pipGroup = nativePip?.parentElement;
  if (nativePip && pipGroup)
    pipGroup.insertBefore(createCustomPipControls(), nativePip);
};

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
  skin.append(createSubtitleTools(hlsMedia));
  player.append(skin);
  root.append(player);

  window.addEventListener("pagehide", clearSubtitleTrack, { once: true });

  requestAnimationFrame(() => {
    const shadowRoot = skin.shadowRoot;
    const controls = shadowRoot?.querySelector<HTMLElement>(
      ".media-controls--primary .media-button-group:last-child",
    );
    const settings = controls?.querySelector<HTMLElement>("#settings-trigger");
    const subtitleTools = skin.querySelector<HTMLElement>(
      ":scope > .player-subtitle-tools",
    );

    if (controls && settings && subtitleTools) {
      subtitleTools.style.position = "static";
      subtitleTools.style.display = "contents";
      controls.insertBefore(subtitleTools, settings);
    }

    replaceNativePip(skin);

    shadowRoot
      ?.querySelector<HTMLElement>("media-play-button")
      ?.focus({ preventScroll: true });
  });
}

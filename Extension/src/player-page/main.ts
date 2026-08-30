import Hls from "hls.js";
import { findCue } from "../subtitles/search";
import { parseSrt } from "../subtitles/srt";
import { formatTime } from "../shared/time";
import type { SubtitleCue } from "../subtitles/types";
import playerMarkup from "../pip/player.html?raw";
import playerStyles from "../pip/player.css?raw";

const params = new URLSearchParams(location.search);
const source = params.get("src");
const root = document.getElementById("app")!;
const style = document.createElement("style");
style.textContent = playerStyles;
document.head.append(style);
root.innerHTML = playerMarkup;

const player = document.querySelector<HTMLElement>("#player")!;
const video = document.createElement("video");
video.controls = false;
video.playsInline = true;
video.preload = "auto";
video.style.cssText =
  "width:100%;height:100%;object-fit:contain;background:#000";
player.prepend(video);
document.documentElement.style.setProperty("--subtitle-font-size", "24px");
document.documentElement.style.setProperty(
  "--subtitle-background-alpha",
  "0.5",
);

const $ = <T extends Element>(selector: string) =>
  document.querySelector(selector) as T;
const subtitle = $<HTMLDivElement>(".subs");
const play = $<HTMLButtonElement>("button.play");
const progress = $<HTMLInputElement>("input.progress");
const time = $<HTMLSpanElement>(".time");
const mute = $<HTMLButtonElement>("button.mute");
const volume = $<HTMLInputElement>("input.volume");
const file = $<HTMLInputElement>("input.srt-file");
const addSrt = $<HTMLButtonElement>("button.add-srt");
const settings = $<HTMLButtonElement>("button.settings");
const menu = $<HTMLDivElement>(".settings-menu");
const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
let cues: SubtitleCue[] = [];
let dragging = false;
let playbackError = "";

type DocumentPip = {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
};

if (!source) {
  subtitle.textContent = "No HLS URL was provided.";
} else if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource(source);
  hls.attachMedia(video);
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) playbackError = `HLS error: ${data.details}`;
  });
} else if (video.canPlayType("application/vnd.apple.mpegurl")) {
  video.src = source;
} else {
  playbackError = "This browser cannot play HLS streams.";
}

play.textContent = "▶";
mute.textContent = "🔊";
settings.textContent = "⚙";
play.onclick = () => (video.paused ? void video.play() : video.pause());
mute.onclick = () => {
  video.muted = !video.muted;
  mute.textContent = video.muted ? "🔇" : "🔊";
};
volume.value = String(video.volume);
volume.oninput = () => {
  video.volume = Number(volume.value);
  video.muted = video.volume === 0;
};
progress.onpointerdown = () => (dragging = true);
progress.onpointerup = () => (dragging = false);
progress.oninput = () => (video.currentTime = Number(progress.value));
settings.onclick = () => menu.classList.toggle("open");
addSrt.onclick = () => file.click();
file.onchange = async () => {
  const selected = file.files?.[0];
  if (selected) cues = parseSrt(await selected.text()).cues;
};
for (const button of menu.querySelectorAll<HTMLButtonElement>("[data-preset]"))
  button.onclick = () => {
    player.dataset.preset = button.dataset.preset;
    menu.classList.remove("open");
  };

const pipButton = document.createElement("button");
pipButton.className = "pip icon";
pipButton.type = "button";
pipButton.textContent = "PiP";
pipButton.title = "Open Document PiP";
pipButton.setAttribute("aria-label", "Open Document PiP");
document.querySelector(".settings-wrap")!.before(pipButton);

let pipWindow: Window | undefined;
let restored = true;
const originalParent = player.parentNode;
const originalNext = player.nextSibling;

pipButton.onclick = async () => {
  const api = (window as Window & { documentPictureInPicture?: DocumentPip })
    .documentPictureInPicture;
  if (!api) {
    playbackError = "Document PiP is not supported by this browser.";
    return;
  }
  if (pipWindow && !pipWindow.closed) return;

  try {
    // This must stay in the click handler because Chrome requires user activation.
    pipWindow = await api.requestWindow({
      width: Math.max(480, player.clientWidth),
      height: Math.max(270, player.clientHeight),
    });
    restored = false;
    const pipStyle = pipWindow.document.createElement("style");
    pipStyle.textContent = playerStyles;
    pipWindow.document.head.append(pipStyle);
    pipWindow.document.documentElement.style.setProperty(
      "--subtitle-font-size",
      "24px",
    );
    pipWindow.document.documentElement.style.setProperty(
      "--subtitle-background-alpha",
      "0.5",
    );
    pipWindow.document.body.replaceChildren(player);
    pipWindow.addEventListener(
      "pagehide",
      () => {
        if (restored) return;
        restored = true;
        if (originalParent?.isConnected)
          originalParent.insertBefore(
            player,
            originalNext?.isConnected ? originalNext : null,
          );
        pipWindow = undefined;
      },
      { once: true },
    );
  } catch (error) {
    playbackError =
      error instanceof Error ? error.message : "Could not open Document PiP.";
  }
};
const speedPicker = document.querySelector<HTMLButtonElement>(
  "button.speed-picker",
)!;
speedPicker.onclick = () => {
  const rate =
    speeds[(speeds.indexOf(video.playbackRate) + 1) % speeds.length] ?? 1;
  video.playbackRate = rate;
  speedPicker.querySelector(".speed-value")!.textContent = `${rate}x`;
};

function render() {
  progress.max = String(Number.isFinite(video.duration) ? video.duration : 0);
  if (!dragging) progress.value = String(video.currentTime || 0);
  progress.style.setProperty(
    "--played",
    `${video.duration ? (video.currentTime / video.duration) * 100 : 0}%`,
  );
  play.textContent = video.paused ? "▶" : "❚❚";
  time.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  subtitle.textContent =
    playbackError || findCue(cues, video.currentTime)?.text || "";
  requestAnimationFrame(render);
}
render();

import type { HlsUrl } from "./messages";

export function preferTopFrameHls(entries: HlsUrl[]) {
  const topFrame = entries.filter(({ frameId }) => frameId === 0);
  return topFrame.length ? topFrame : entries;
}

// This function is passed directly to chrome.scripting.executeScript and must
// remain self-contained because MAIN-world execution cannot use module imports.
export function findMarkedVideoHlsUrls(
  marker: string,
  scope: Record<string, unknown> = window as unknown as Record<string, unknown>,
  root: ParentNode = document,
  pageUrl: string = location.href,
): string[] {
  const video = [...root.querySelectorAll("video")].find(
    (element) => element.getAttribute("data-custom-pip-hls-target") === marker,
  );
  if (!video) return [];
  video.removeAttribute("data-custom-pip-hls-target");

  const urls = new Set<string>();
  for (const key of Object.getOwnPropertyNames(scope)) {
    try {
      const value = scope[key];
      if (!value || (typeof value !== "object" && typeof value !== "function"))
        continue;
      const hls = value as { media?: unknown; url?: unknown };
      if (hls.media !== video || typeof hls.url !== "string") continue;
      const url = new URL(hls.url, pageUrl).href;
      if (/\.m3u8(?:$|[?#])/i.test(url)) urls.add(url);
    } catch {
      // Window properties may be cross-origin or implemented by throwing getters.
      continue;
    }
  }
  return [...urls];
}

export function isLikelyMasterHls(url: string) {
  try {
    return !/(?:^|\/)(?:audio|video|rendition(?:-[^/]+)?)\.m3u8$/i.test(
      new URL(url).pathname,
    );
  } catch {
    return false;
  }
}

export function selectPrimaryHls(
  entries: HlsUrl[],
  resolutions: Record<string, string>,
) {
  // A top-level player is more likely to be the page's content than HLS loaded
  // by advertising frames. Keep iframe streams as the fallback for embeds.
  const candidates = preferTopFrameHls(entries);
  const confirmedMasters = candidates.filter(({ url }) => {
    const resolution = resolutions[url];
    return resolution && resolution !== "Unknown";
  });
  if (confirmedMasters.length) return confirmedMasters;

  const likelyMasters = candidates.filter(({ url }) => isLikelyMasterHls(url));
  return likelyMasters.length ? likelyMasters : candidates.slice(0, 1);
}

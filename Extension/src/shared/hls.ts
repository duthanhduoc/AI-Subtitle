import type { HlsUrl } from "./messages";

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
  const confirmedMasters = entries.filter(({ url }) => {
    const resolution = resolutions[url];
    return resolution && resolution !== "Unknown";
  });
  if (confirmedMasters.length) return confirmedMasters;

  const likelyMasters = entries.filter(({ url }) => isLikelyMasterHls(url));
  return likelyMasters.length ? likelyMasters : entries.slice(0, 1);
}

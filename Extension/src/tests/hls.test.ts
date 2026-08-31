import { expect, test } from "vitest";
import {
  findMarkedVideoHlsUrls,
  preferTopFrameHls,
  selectPrimaryHls,
} from "../shared/hls";
import type { HlsUrl } from "../shared/messages";

const entry = (url: string): HlsUrl => ({ url, frameId: 0, seenAt: 0 });

test("shows the master playlist instead of its HLS renditions", () => {
  const master = entry("https://stream.example/video.m3u8?token=1");
  const rendition = entry("https://cdn.example/rendition.m3u8?token=1");

  expect(
    selectPrimaryHls([rendition, master], {
      [master.url]: "1280×720, 1920×1080",
      [rendition.url]: "Unknown",
    }),
  ).toEqual([master]);
  expect(selectPrimaryHls([rendition], {})).toEqual([rendition]);
});

test("prefers page HLS over unrelated iframe streams", () => {
  const page = entry("https://surrit.com/video/playlist.m3u8");
  const ad = {
    ...entry("https://ads.example/master.m3u8"),
    frameId: 7,
  };

  expect(preferTopFrameHls([ad, page])).toEqual([page]);
  expect(
    selectPrimaryHls([ad, page], {
      [ad.url]: "1920×1080",
      [page.url]: "Unknown",
    }),
  ).toEqual([page]);
  expect(preferTopFrameHls([ad])).toEqual([ad]);
});

test("finds the HLS instance attached to the selected video", () => {
  const attributes = new Map([["data-custom-pip-hls-target", "marker-1"]]);
  const video = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    removeAttribute: (name: string) => attributes.delete(name),
  };
  const scope = {
    hls: { media: video, url: "/main/playlist.m3u8" },
    adHls: { media: {}, url: "/ads/stream.m3u8" },
  };
  const root = { querySelectorAll: () => [video] } as unknown as ParentNode;

  expect(
    findMarkedVideoHlsUrls(
      "marker-1",
      scope,
      root,
      "https://example.com/watch",
    ),
  ).toEqual(["https://example.com/main/playlist.m3u8"]);
  expect(attributes.has("data-custom-pip-hls-target")).toBe(false);
});

import { expect, test } from "vitest";
import { selectPrimaryHls } from "../shared/hls";
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

import type { SubtitleCue, SubtitleTrack } from "./types";

const time = (value: string): number | undefined => {
  // Accept common SRT variants: optional hours, comma/dot separator and 1-3
  // millisecond digits (".5" means 500 ms, not 5 ms).
  const match = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) return undefined;
  const [, h = "0", m = "0", s = "0", ms = "0"] = match;
  const result =
    Number(h) * 3600 +
    Number(m) * 60 +
    Number(s) +
    Number(ms.padEnd(3, "0")) / 1000;
  return Number.isFinite(result) ? result : undefined;
};

export function parseSrt(input: string): SubtitleTrack {
  const cues: SubtitleCue[] = [];
  // Normalize UTF-8 BOM and platform newlines before splitting cue blocks.
  for (const block of input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)) {
    // Locate the timing row instead of assuming a numeric cue ID is present.
    const lines = block.split("\n").filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;
    const [start, end] = lines[timingIndex]!.split("-->").map(time);
    const text = lines
      .slice(timingIndex + 1)
      .join("\n")
      .trim();
    // Subtitle files are untrusted local input. Ignore malformed blocks while
    // preserving valid cues from the rest of the file.
    if (start === undefined || end === undefined || end < start || !text)
      continue;
    cues.push({
      id: timingIndex ? lines[0] : undefined,
      startTime: start,
      endTime: end,
      text,
    });
  }
  // Sorting is the contract required by the binary-search renderer.
  return {
    cues: cues.sort(
      (a, b) => a.startTime - b.startTime || a.endTime - b.endTime,
    ),
  };
}

const vttTime = (seconds: number): string => {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remaining = milliseconds % 60_000;
  const secs = Math.floor(remaining / 1_000);
  const ms = remaining % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};

export function srtToVtt(input: string): string {
  const cues = parseSrt(input).cues;
  if (!cues.length) throw new Error("The SRT file has no valid subtitle cues.");

  return `WEBVTT\n\n${cues
    .map(
      (cue, index) =>
        `${cue.id ?? String(index + 1)}\n${vttTime(cue.startTime)} --> ${vttTime(
          cue.endTime,
        )}\n${cue.text}`,
    )
    .join("\n\n")}\n`;
}

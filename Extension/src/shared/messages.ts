// Messages must stay serializable because popup and content script live in
// separate extension execution contexts. Candidate IDs stand in for DOM nodes.
export type Candidate = {
  id: string;
  width: number;
  height: number;
  duration: number;
  playing: boolean;
  score: number;
};
export type Reply<T> = { ok: true; value: T } | { ok: false; error: string };
export type Message =
  | { type: "GET_CANDIDATES" }
  | { type: "OPEN_PIP"; id: string; subtitles?: string; subtitleName?: string }
  | { type: "SET_OFFSET"; offset: number };

// Runtime messages are an input boundary even though internal callers use the
// TypeScript union. Handlers still sanitize individual payload values before use.
export function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const message = value as { type?: unknown };
  return (
    message.type === "GET_CANDIDATES" ||
    message.type === "SET_OFFSET" ||
    (message.type === "OPEN_PIP" &&
      typeof (value as { id?: unknown }).id === "string")
  );
}

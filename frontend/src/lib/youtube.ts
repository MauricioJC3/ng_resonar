/** Pull a video id out of a pasted YouTube URL (or a bare 11-char id). */
export function extractYouTubeId(input: string): string | null {
  const s = input.trim();

  if (/^[\w-]{11}$/.test(s)) return s;

  let url: URL;
  try {
    url = new URL(s.includes("://") ? s : `https://${s}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com"
  ) {
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = url.pathname.match(/\/(?:shorts|live|embed|v)\/([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

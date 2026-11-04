// One rule for every link built from stored or imported text (AI reports, articles, attachments, profiles).
// Internal paths must be a single leading "/" — "//host" and "/\host" are other sites to a browser.
// External links: http(s) and mailto only; javascript:, data:, and anything unparseable are refused.

export type SafeLink = { kind: "internal" | "external"; href: string };

export function safeLink(raw: string): SafeLink | null {
  const url = raw.trim();
  // Control characters and backslashes are how "javascript:" and "//host" get disguised.
  if (!url || /[\u0000-\u001f\u007f\\]/.test(url)) return null;
  if (url.startsWith("#")) return { kind: "internal", href: url };
  if (url.startsWith("/")) return url.startsWith("//") ? null : { kind: "internal", href: url };
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:" ? { kind: "external", href: u.href } : null;
  } catch {
    return null;
  }
}

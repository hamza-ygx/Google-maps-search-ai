export function safeUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const { protocol } = new URL(u);
    return protocol === "https:" || protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

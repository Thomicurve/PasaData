import "server-only";

// This identifies a local development request, not its TCP origin. Keep dev bound to loopback.
export function localExtractionBypass(host: string | null): boolean {
  if (process.env.LOCAL_EXTRACTION_BYPASS !== "true" || process.env.NODE_ENV !== "development" ||
    process.env.VERCEL !== undefined || process.env.VERCEL_ENV !== undefined || !host) return false;
  const match = /^(localhost|127\.0\.0\.1|\[[0-9a-fA-F:]+\])(?::([0-9]{1,5}))?$/.exec(host);
  if (!match || (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))) return false;
  if (match[1] === "localhost" || match[1] === "127.0.0.1") return true;
  try { return new URL(`http://${match[1]}/`).hostname === "[::1]"; }
  catch { return false; }
}

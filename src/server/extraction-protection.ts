import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Buffer } from "node:buffer";
import { ExtractionError } from "./gemini";
import { localExtractionBypass } from "./local-development";

const DAY_MS = 86_400_000;
const TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 8192;
type ProtectionConfig = { secret: string; hostnames: string[]; redisUrl: string; redisToken: string; namespace: string; hmacSecret: string };

export function protectionConfig(): ProtectionConfig;
export function protectionConfig(request: Request): ProtectionConfig | null;
export function protectionConfig(request?: Request): ProtectionConfig | null {
  if (process.env.EXTRACTION_ENABLED !== "true") throw new ExtractionError("EXTRACTION_DISABLED");
  const required = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value || /[\r\n]/.test(value)) throw new ExtractionError("CONFIGURATION");
    return value;
  };
  required("GEMINI_TOKEN");
  // Next may normalize its URL to the bound hostname. Check the direct Host too, never a forwarded host.
  if (request && localExtractionBypass(new URL(request.url).host) &&
    localExtractionBypass(request.headers.get("host") ?? new URL(request.url).host)) return null;
  if (process.env.VERCEL !== "1" || !["production", "preview", "development"].includes(process.env.VERCEL_ENV ?? "") ||
    (process.env.VERCEL_ENV === "preview" && process.env.EXTRACTION_PREVIEW_ENABLED !== "true")) throw new ExtractionError("CONFIGURATION");
  const secret = required("TURNSTILE_SECRET_KEY");
  const hostnames = required("TURNSTILE_HOSTNAMES").split(",").map((hostname) => hostname.trim());
  if (hostnames.some((hostname) => hostname.length > 253 || !hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) throw new ExtractionError("CONFIGURATION");
  const redisUrl = required("UPSTASH_REDIS_REST_URL");
  let url: URL;
  try { url = new URL(redisUrl); } catch { throw new ExtractionError("CONFIGURATION"); }
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.upstash\.io$/.test(url.hostname) || url.username || url.password ||
    url.port || url.pathname !== "/" || url.search || url.hash) throw new ExtractionError("CONFIGURATION");
  const redisToken = required("UPSTASH_REDIS_REST_TOKEN");
  const namespace = required("EXTRACTION_NAMESPACE");
  const hmacSecret = required("EXTRACTION_IP_HMAC_SECRET");
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(namespace) || hmacSecret.length < 32) throw new ExtractionError("CONFIGURATION");
  return { secret, hostnames, redisUrl: url.origin, redisToken, namespace, hmacSecret };
}

// Buenos Aires uses UTC-03:00 year-round. Redis independently checks the supplied window against its clock.
export function dailyWindow(date: Date) {
  const shifted = new Date(date.getTime() - 10_800_000);
  const day = shifted.toISOString().slice(0, 10);
  const start = Date.parse(`${day}T03:00:00.000Z`);
  const end = start + DAY_MS;
  return { day, start, end, expires: end + 2 * DAY_MS };
}

// Validate every existing value and expiry before any write: Redis script errors do not roll back writes.
export const RESERVE_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local start = tonumber(ARGV[1])
local finish = tonumber(ARGV[2])
local expires = tonumber(ARGV[3])
if not start or not finish or not expires or finish - start ~= 86400000 or expires - finish ~= 172800000 or now < start or now >= finish then return {4, 0} end
local count = redis.call('GET', KEYS[1])
local n = 0
if count then
  n = tonumber(count)
  local ttl = redis.call('PTTL', KEYS[1])
  if not n or n < 0 or n > 10 or n ~= math.floor(n) or tostring(n) ~= count or math.abs(ttl - (expires - now)) > 1000 then return {4, 0} end
end
local ip = redis.call('GET', KEYS[2])
local ipttl = redis.call('PTTL', KEYS[2])
if ip and (ip ~= '1' or ipttl < 1 or ipttl > 60000) then return {4, 0} end
if n >= 10 then return {3, math.ceil((finish - now) / 1000)} end
if ip then return {2, math.ceil(ipttl / 1000)} end
redis.call('SET', KEYS[1], tostring(n + 1))
redis.call('PEXPIREAT', KEYS[1], expires)
redis.call('SET', KEYS[2], '1', 'PX', 60000)
return {1, 0}
`;

async function boundedJson(url: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
  if (signal.aborted) throw new ExtractionError("PROTECTION_UNAVAILABLE");
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let rejectDeadline: (reason: unknown) => void = () => {};
  const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
  const abort = () => {
    controller.abort();
    void reader?.cancel().catch(() => {});
    rejectDeadline(new ExtractionError("PROTECTION_UNAVAILABLE"));
  };
  const timer = setTimeout(abort, TIMEOUT_MS);
  signal.addEventListener("abort", abort, { once: true });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetch(url, { ...init, signal: controller.signal, redirect: "error", cache: "no-store" });
      if (controller.signal.aborted || !response.ok || response.redirected || !response.body) throw new ExtractionError("PROTECTION_UNAVAILABLE");
      reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (controller.signal.aborted) throw new ExtractionError("PROTECTION_UNAVAILABLE");
          if (done) break;
          size += value.byteLength;
          if (size > MAX_RESPONSE_BYTES) { void reader.cancel().catch(() => {}); throw new ExtractionError("PROTECTION_UNAVAILABLE"); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    })()]);
  } catch { throw new ExtractionError("PROTECTION_UNAVAILABLE"); }
  finally { clearTimeout(timer); signal.removeEventListener("abort", abort); }
}

export async function protectExtraction(request: Request, token: string, config: ProtectionConfig) {
  if (!token || token.length > 2048 || token.trim() !== token) throw new ExtractionError("BOT_VERIFICATION");
  // Vercel overwrites this header. No fallback to client-supplied forwarding headers outside verified Vercel configuration.
  const ip = request.headers.get("x-vercel-forwarded-for");
  if (!ip || !isIP(ip)) throw new ExtractionError("PROTECTION_UNAVAILABLE");
  const challenge = await boundedJson("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: config.secret, response: token }).toString(),
  }, request.signal);
  if (!challenge || typeof challenge !== "object" || !("success" in challenge) || challenge.success !== true ||
    !("hostname" in challenge) || typeof challenge.hostname !== "string" || !config.hostnames.includes(challenge.hostname) ||
    !("action" in challenge) || challenge.action !== "extract") throw new ExtractionError("BOT_VERIFICATION");
  if (request.signal.aborted) throw new ExtractionError("PROTECTION_UNAVAILABLE");
  // Canonicalize equivalent IPv6 spellings before hashing. Node URL normalizes the IPv6 host.
  const identity = isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
  const digest = createHmac("sha256", config.hmacSecret).update(identity).digest("hex");
  const window = dailyWindow(new Date());
  const prefix = `extraction:{${config.namespace}}`;
  const reservation = await boundedJson(config.redisUrl, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.redisToken}` },
    body: JSON.stringify(["EVAL", RESERVE_SCRIPT, "2", `${prefix}:day:${window.day}`, `${prefix}:ip:${digest}`,
      String(window.start), String(window.end), String(window.expires)]),
  }, request.signal);
  const result = reservation && typeof reservation === "object" && "result" in reservation ? reservation.result : undefined;
  if (!Array.isArray(result) || result.length !== 2 || !result.every(Number.isInteger) ||
    (reservation && typeof reservation === "object" && "error" in reservation)) throw new ExtractionError("PROTECTION_UNAVAILABLE");
  const [status, retry] = result;
  if (status === 1 && retry === 0) return;
  if (status === 2 && retry >= 1 && retry <= 60) throw new ExtractionError("RATE_LIMITED", retry);
  if (status === 3 && retry >= 1 && retry <= 86400) throw new ExtractionError("DAILY_LIMIT", retry);
  throw new ExtractionError("PROTECTION_UNAVAILABLE");
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "./route";
const MAX_IMAGE_BYTES = 3_000_000;
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 16_384;
import { DOCUMENT_FIELDS } from "../../../lib/document-fields";

const fields = Object.fromEntries(DOCUMENT_FIELDS.map((key) => [key, null]));
const fetchMock = vi.fn();
const httpMock = vi.fn();
const jpeg = new Uint8Array([255, 216, 255, 224]);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function form(bytes: Uint8Array = jpeg, type = "image/jpeg") {
  const value = new FormData();
  value.append("image", new Blob([new Uint8Array(bytes).buffer], { type }), "synthetic");
  value.append("processingAcknowledged", "true");
  value.append("turnstileToken", "synthetic-challenge");
  return value;
}
function request(value: FormData) { return new Request("http://localhost/api/extract", { method: "POST", body: value, headers: { "x-vercel-forwarded-for": "203.0.113.4" } }); }
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", undefined); vi.stubEnv("GEMINI_TOKEN", "synthetic-key"); vi.stubGlobal("fetch", httpMock);
  for (const [name, value] of Object.entries({ EXTRACTION_ENABLED: "true", VERCEL: "1", VERCEL_ENV: "production", TURNSTILE_SECRET_KEY: "synthetic", TURNSTILE_HOSTNAMES: "app.example.test", UPSTASH_REDIS_REST_URL: "https://synthetic.upstash.io", UPSTASH_REDIS_REST_TOKEN: "synthetic", EXTRACTION_NAMESPACE: "synthetic", EXTRACTION_IP_HMAC_SECRET: "s".repeat(32) })) vi.stubEnv(name, value);
  httpMock.mockImplementation((url, init) => {
    if (String(url).includes("cloudflare.com")) return Promise.resolve(Response.json({ success: true, hostname: "app.example.test", action: "extract" }));
    if (String(url).includes("upstash.io")) return Promise.resolve(Response.json({ result: [1, 0] }));
    return fetchMock(url, init);
  });
  fetchMock.mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(fields) }] } }] }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("single-image extraction route", () => {
  it.each([[jpeg, "image/jpeg"], [png, "image/png"]])("accepts declared and matching image signatures", async (bytes, type) => {
    const response = await POST(request(form(bytes as Uint8Array, type as string)));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ fields });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("accepts exactly 3 MB and rejects one byte over", async () => {
    const bytes = new Uint8Array(MAX_IMAGE_BYTES); bytes.set(jpeg);
    expect((await POST(request(form(bytes)))).status).toBe(200);
    fetchMock.mockClear();
    const larger = new Uint8Array(MAX_IMAGE_BYTES + 1); larger.set(jpeg);
    expect((await POST(request(form(larger)))).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([[jpeg, "image/gif"], [jpeg, "image/png"], [png, "image/jpeg"], [new Uint8Array(), "image/jpeg"], [new Uint8Array([1, 2, 3]), "image/jpeg"]])("rejects empty, unsupported or mismatched image", async (bytes, type) => {
    expect((await POST(request(form(bytes as Uint8Array, type as string)))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["missing", "duplicate", "unknown", "text", "noAcknowledgement", "falseAcknowledgement", "duplicateAcknowledgement"])("rejects invalid multipart %s", async (variant) => {
    const value = form();
    if (variant === "missing") value.delete("image");
    if (variant === "duplicate") value.append("image", new Blob([jpeg], { type: "image/jpeg" }));
    if (variant === "unknown") value.append("extra", "private");
    if (variant === "text") value.set("image", "private");
    if (variant === "noAcknowledgement") value.delete("processingAcknowledged");
    if (variant === "falseAcknowledgement") value.set("processingAcknowledged", "false");
    if (variant === "duplicateAcknowledgement") value.append("processingAcknowledged", "true");
    expect((await POST(request(value))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([undefined, "1", String(MAX_BODY_BYTES + 1)])("bounds actual body before multipart parsing despite length %s", async (length) => {
    let cancelled = false;
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1)); }, cancel() { cancelled = true; } });
    const headers = new Headers({ "content-type": "multipart/form-data; boundary=synthetic" });
    if (length) headers.set("content-length", length);
    const req = new Request("http://localhost/api/extract", { method: "POST", headers, body, duplex: "half" } as RequestInit);
    expect((await POST(req)).status).toBe(413);
    expect(cancelled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects malformed multipart and other content types", async () => {
    for (const type of ["text/plain", "multipart/form-data; boundary=synthetic"]) {
      const response = await POST(new Request("http://localhost/api/extract", { method: "POST", headers: { "content-type": type }, body: "private" }));
      expect(response.status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
    }
  });
  it("returns sanitized configuration and upstream errors with no fields or logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("GEMINI_TOKEN", "");
    const missing = await POST(request(form()));
    expect(missing.status).toBe(503); expect(fetchMock).not.toHaveBeenCalled();
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect(await missing.json()).toEqual({ error: {
      code: "CONFIGURATION", message: "La extracción no está configurada. Contactá al responsable de la aplicación.",
    } });
    vi.stubEnv("GEMINI_TOKEN", "synthetic-key");
    fetchMock.mockRejectedValueOnce(new Error("private-key-image"));
    const failed = await POST(request(form()));
    expect(failed.status).toBe(502);
    expect(failed.headers.get("cache-control")).toBe("no-store");
    const payload = await failed.text();
    expect(payload).not.toMatch(/private-key-image|synthetic-key|fields/);
    expect(log).not.toHaveBeenCalled(); log.mockRestore();
  });
  it("never returns fields after malformed extraction", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "{}" }] } }] }));
    const response = await POST(request(form()));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: {
      code: "INVALID_EXTRACTION", message: "No se obtuvo una extracción válida. Probá con una fotografía más clara.",
    } });
  });
});

it.each(["missing", "duplicate", "file", "empty", "oversized"])("rejects invalid Turnstile multipart %s without Google", async (variant) => {
  const value = form();
  if (variant === "missing") value.delete("turnstileToken");
  if (variant === "duplicate") value.append("turnstileToken", "synthetic");
  if (variant === "file") value.set("turnstileToken", new Blob(["synthetic"]));
  if (variant === "empty") value.set("turnstileToken", "");
  if (variant === "oversized") value.set("turnstileToken", "x".repeat(2049));
  const response = await POST(request(value));
  expect(response.status).toBe(400); expect(fetchMock).not.toHaveBeenCalled(); expect(httpMock).not.toHaveBeenCalled();
});
it.each([
  ["disabled", 503, "EXTRACTION_DISABLED"], ["bot", 400, "BOT_VERIFICATION"],
  ["ip", 429, "RATE_LIMITED"], ["daily", 429, "DAILY_LIMIT"], ["store", 503, "PROTECTION_UNAVAILABLE"],
])("never calls Google after %s protection failure", async (variant, status, code) => {
  if (variant === "disabled") vi.stubEnv("EXTRACTION_ENABLED", "false");
  if (variant === "bot") httpMock.mockResolvedValueOnce(Response.json({ success: false }));
  if (["ip", "daily", "store"].includes(String(variant))) {
    httpMock.mockResolvedValueOnce(Response.json({ success: true, hostname: "app.example.test", action: "extract" }));
    httpMock.mockResolvedValueOnce(Response.json({ result: variant === "ip" ? [2, 45] : variant === "daily" ? [3, 120] : [4, 0] }));
  }
  const response = await POST(request(form()));
  expect(response.status).toBe(status); expect(await response.json()).toMatchObject({ error: { code } });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("retry-after")).toBe(variant === "ip" ? "45" : variant === "daily" ? "120" : null);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("does not refund or retry reservation after Google failure", async () => {
  fetchMock.mockRejectedValueOnce(new Error("private"));
  const response = await POST(request(form()));
  expect(response.status).toBe(502); expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(httpMock.mock.calls.map(([url]) => String(url))).toEqual([
    "https://challenges.cloudflare.com/turnstile/v0/siteverify", "https://synthetic.upstash.io",
    expect.stringContaining("generativelanguage.googleapis.com"),
  ]);
});

describe("explicit local extraction", () => {
  beforeEach(() => {
    vi.stubEnv("LOCAL_EXTRACTION_BYPASS", "true"); vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", undefined); vi.stubEnv("VERCEL_ENV", undefined);
    for (const key of ["TURNSTILE_SECRET_KEY", "TURNSTILE_HOSTNAMES", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "EXTRACTION_NAMESPACE", "EXTRACTION_IP_HMAC_SECRET"]) vi.stubEnv(key, undefined);
  });
  it.each(["localhost", "127.0.0.1", "[::1]"])("extracts without token or protection credentials at %s", async (host) => {
    const value = form(); value.delete("turnstileToken");
    const response = await POST(new Request(`http://${host}:3000/api/extract`, { method: "POST", body: value }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ fields });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(httpMock).toHaveBeenCalledTimes(1); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(httpMock.mock.calls[0][0])).toContain("generativelanguage.googleapis.com");
  });
  it.each(["disabled", "key", "newlineKey", "consent", "signature", "size", "aborted"])("retains the local %s barrier", async (barrier) => {
    const value = form(); value.delete("turnstileToken");
    if (barrier === "disabled") vi.stubEnv("EXTRACTION_ENABLED", "false");
    if (barrier === "key") vi.stubEnv("GEMINI_TOKEN", " ");
    if (barrier === "newlineKey") vi.stubEnv("GEMINI_TOKEN", "synthetic\nkey");
    if (barrier === "consent") value.delete("processingAcknowledged");
    if (barrier === "signature") value.set("image", new Blob(["invalid"], { type: "image/jpeg" }), "synthetic");
    if (barrier === "size") value.set("image", new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: "image/jpeg" }), "synthetic");
    const controller = new AbortController(); if (barrier === "aborted") controller.abort();
    const response = await POST(new Request("http://localhost:3000/api/extract", { method: "POST", body: value, signal: controller.signal }));
    expect(response.status).toBe(barrier === "size" ? 413 : ["consent", "signature"].includes(barrier) ? 400 : 503);
    expect(httpMock).not.toHaveBeenCalled();
  });
  it.each(["production", "preview", "vercel", "remote", "falseSuffix", "flagAbsent", "forwarded"])("does not bypass for %s even when the client omits verification", async (variant) => {
    if (variant === "production") vi.stubEnv("NODE_ENV", "production");
    if (variant === "preview") vi.stubEnv("VERCEL_ENV", "preview");
    if (variant === "vercel") vi.stubEnv("VERCEL", "1");
    if (variant === "flagAbsent") vi.stubEnv("LOCAL_EXTRACTION_BYPASS", undefined);
    const host = variant === "falseSuffix" ? "localhost.evil.test" : ["remote", "forwarded"].includes(variant) ? "app.example.test" : "localhost";
    const value = form(); value.delete("turnstileToken");
    const response = await POST(new Request(`http://${host}/api/extract`, { method: "POST", body: value, headers: { "origin": "http://localhost", "x-forwarded-host": "localhost" } }));
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ error: { code: "CONFIGURATION" } });
    expect(httpMock).not.toHaveBeenCalled();
  });
  it("rejects a remote direct Host even when the server normalizes the URL to loopback", async () => {
    const value = form(); value.delete("turnstileToken");
    const response = await POST(new Request("http://127.0.0.1:3000/api/extract", { method: "POST", body: value, headers: { host: "app.example.test", "x-forwarded-host": "localhost" } }));
    expect(response.status).toBe(503); expect(httpMock).not.toHaveBeenCalled();
  });
});

it("preserves Cloudflare and Redis in production with the local flag accidentally enabled", async () => {
  vi.stubEnv("LOCAL_EXTRACTION_BYPASS", "true"); vi.stubEnv("NODE_ENV", "production");
  expect((await POST(request(form()))).status).toBe(200);
  expect(httpMock.mock.calls.map(([url]) => String(url))).toEqual([
    "https://challenges.cloudflare.com/turnstile/v0/siteverify", "https://synthetic.upstash.io", expect.stringContaining("generativelanguage.googleapis.com"),
  ]);
});
it("still requires a token in production on loopback with flag=true", async () => {
  vi.stubEnv("LOCAL_EXTRACTION_BYPASS", "true"); vi.stubEnv("NODE_ENV", "production");
  const value = form(); value.delete("turnstileToken");
  const response = await POST(request(value));
  expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ error: { code: "BOT_VERIFICATION" } });
  expect(httpMock).not.toHaveBeenCalled();
});

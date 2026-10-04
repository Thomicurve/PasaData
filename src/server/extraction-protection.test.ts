import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { protectionConfig, protectExtraction, dailyWindow, RESERVE_SCRIPT } from "./extraction-protection";

const fetchMock = vi.fn();
const environment = {
  GEMINI_TOKEN: "synthetic-google", EXTRACTION_ENABLED: "true", VERCEL: "1", VERCEL_ENV: "production",
  TURNSTILE_SECRET_KEY: "synthetic-turnstile", TURNSTILE_HOSTNAMES: "app.example.test",
  UPSTASH_REDIS_REST_URL: "https://synthetic.upstash.io", UPSTASH_REDIS_REST_TOKEN: "synthetic-redis",
  EXTRACTION_NAMESPACE: "synthetic-production", EXTRACTION_IP_HMAC_SECRET: "s".repeat(32),
};
function request(ip = "203.0.113.4") {
  return new Request("https://app.example.test/api/extract", { headers: { "x-vercel-forwarded-for": ip } });
}
function successful() {
  fetchMock.mockResolvedValueOnce(Response.json({ success: true, hostname: "app.example.test", action: "extract" }));
  fetchMock.mockResolvedValueOnce(Response.json({ result: [1, 0] }));
}
beforeEach(() => { for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); vi.useRealTimers(); });

describe("extraction protection", () => {
  it("verifies before atomic reservation with private HMAC identity", async () => {
    successful();
    await protectExtraction(request(), "synthetic-challenge", protectionConfig());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [turnstile, redis] = fetchMock.mock.calls;
    expect(turnstile[0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(turnstile[1].body).not.toContain("203.0.113.4");
    const command = JSON.parse(redis[1].body);
    expect(command.slice(0, 3)).toEqual(["EVAL", RESERVE_SCRIPT, "2"]);
    expect(command[4]).toMatch(/:ip:[a-f0-9]{64}$/);
    expect(redis[1].body).not.toContain("203.0.113.4");
    for (const call of fetchMock.mock.calls) expect(call[1]).toMatchObject({ redirect: "error", cache: "no-store" });
  });
  it.each(Object.keys(environment))("fails closed on missing %s", (key) => {
    vi.stubEnv(key, ""); expect(() => protectionConfig()).toThrow(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("disables previews unless explicitly enabled with the production namespace", () => {
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("EXTRACTION_PREVIEW_ENABLED", undefined);
    expect(() => protectionConfig()).toThrow();
    vi.stubEnv("EXTRACTION_PREVIEW_ENABLED", "true"); expect(protectionConfig().namespace).toBe(environment.EXTRACTION_NAMESPACE);
  });
  it.each([
    ["EXTRACTION_ENABLED", "false"], ["VERCEL", "true"], ["VERCEL_ENV", "untrusted"],
    ["UPSTASH_REDIS_REST_URL", "http://synthetic.upstash.io"], ["UPSTASH_REDIS_REST_URL", "https://evil.test"],
    ["UPSTASH_REDIS_REST_URL", "https://user:secret@synthetic.upstash.io"], ["UPSTASH_REDIS_REST_URL", "https://synthetic.upstash.io/path"],
    ["TURNSTILE_HOSTNAMES", "https://app.example.test"], ["TURNSTILE_HOSTNAMES", "*.example.test"],
    ["EXTRACTION_NAMESPACE", "bad namespace"], ["EXTRACTION_IP_HMAC_SECRET", "short"],
  ])("rejects invalid %s", (key, value) => { vi.stubEnv(key, value); expect(() => protectionConfig()).toThrow(); });
  it.each(["", "unknown", "203.0.113.4, 198.51.100.2", "203.0.113.4:80", "[::1]", "203.0. 113.4"])("rejects ambiguous trusted IP %j", async (ip) => {
    await expect(protectExtraction(request(ip), "synthetic", protectionConfig())).rejects.toMatchObject({ code: "PROTECTION_UNAVAILABLE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("ignores arbitrary forwarded headers", async () => {
    const req = new Request("https://app.example.test", { headers: { "x-forwarded-for": "203.0.113.4" } });
    await expect(protectExtraction(req, "synthetic", protectionConfig())).rejects.toMatchObject({ code: "PROTECTION_UNAVAILABLE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["", " ", "x".repeat(2049)])("rejects invalid token %j", async (token) => {
    await expect(protectExtraction(request(), token, protectionConfig())).rejects.toMatchObject({ code: "BOT_VERIFICATION" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    { success: false }, { success: true, hostname: "other.test", action: "extract" },
    { success: true, hostname: "app.example.test", action: "other" }, { success: "true", hostname: "app.example.test", action: "extract" }, {},
  ])("never reserves after failed or mismatched challenge", async (result) => {
    fetchMock.mockResolvedValueOnce(Response.json(result));
    await expect(protectExtraction(request(), "synthetic", protectionConfig())).rejects.toMatchObject({ code: "BOT_VERIFICATION" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not retry a replay rejected by Turnstile", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] }));
    await expect(protectExtraction(request(), "used", protectionConfig())).rejects.toMatchObject({ code: "BOT_VERIFICATION" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([[2, 60, "RATE_LIMITED"], [3, 123, "DAILY_LIMIT"]])("reports sanitized reservation rejection %s", async (status, retry, code) => {


    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, hostname: "app.example.test", action: "extract" }));
    fetchMock.mockResolvedValueOnce(Response.json({ result: [status, retry] }));
    await expect(protectExtraction(request(), "synthetic", protectionConfig())).rejects.toMatchObject({ code, retryAfter: retry });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([{ result: [4, 0] }, { result: [1] }, { result: [1, 60] }, { result: [2, 0] }, { result: [3, 86401] }, { result: ["1", 0] }, { error: "private" }, {}])("fails closed on ambiguous Redis reply", async (reply) => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, hostname: "app.example.test", action: "extract" }));
    fetchMock.mockResolvedValueOnce(Response.json(reply));
    await expect(protectExtraction(request(), "synthetic", protectionConfig())).rejects.toMatchObject({ code: "PROTECTION_UNAVAILABLE" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(["turnstile", "redis"])("bounds %s response and transport failures", async (service) => {
    for (const response of [new Response("x".repeat(8193)), new Response("private", { status: 503 }), new Response("{}", { status: 302, headers: { location: "https://evil.test" } })]) {
      fetchMock.mockReset();
      if (service === "redis") fetchMock.mockResolvedValueOnce(Response.json({ success: true, hostname: "app.example.test", action: "extract" }));
      fetchMock.mockResolvedValueOnce(response);
      await expect(protectExtraction(request(), "synthetic", protectionConfig())).rejects.toMatchObject({ code: "PROTECTION_UNAVAILABLE" });
      expect(fetchMock).toHaveBeenCalledTimes(service === "redis" ? 2 : 1);
    }
  });
  it.each(["turnstile", "redis"])("bounds %s timeout without retry even if transport ignores abort", async (service) => {
    vi.useFakeTimers();
    if (service === "redis") fetchMock.mockResolvedValueOnce(Response.json({ success: true, hostname: "app.example.test", action: "extract" }));
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const result = expect(protectExtraction(request(), "synthetic", protectionConfig())).rejects.toMatchObject({ code: "PROTECTION_UNAVAILABLE" });
    await vi.advanceTimersByTimeAsync(5000); await result;
    expect(fetchMock).toHaveBeenCalledTimes(service === "redis" ? 2 : 1);
  });
  it("bounds a stalled response body", async () => {
    vi.useFakeTimers(); fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ start() {} })));
    const result = expect(protectExtraction(request(), "synthetic", protectionConfig())).rejects.toMatchObject({ code: "PROTECTION_UNAVAILABLE" });
    await vi.advanceTimersByTimeAsync(5000); await result;
  });
  it("does not reserve on an aborted request", async () => {
    const controller = new AbortController(); controller.abort();
    const req = new Request("https://app.example.test", { signal: controller.signal, headers: { "x-vercel-forwarded-for": "203.0.113.4" } });
    await expect(protectExtraction(req, "synthetic", protectionConfig())).rejects.toMatchObject({ code: "PROTECTION_UNAVAILABLE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("resets at Buenos Aires midnight with expiration 48 hours after close", () => {
    const before = dailyWindow(new Date("2026-10-04T02:59:59.999Z"));
    const after = dailyWindow(new Date("2026-10-04T03:00:00.000Z"));
    expect(before.day).toBe("2026-10-03"); expect(after.day).toBe("2026-10-04");
    expect(after.start).toBe(before.end); expect(after.expires - after.end).toBe(172800000);
  });
});


// Opt-in proof. The executable must be a real local Redis compatible runtime; mocks never satisfy this suite.
describe.runIf(process.env.EXTRACTION_TEST_REDIS_EXECUTABLE)("real Redis atomic script", () => {
  it("reserves concurrent daily/IP budgets and rejects corrupt state using the production Lua", async () => {
    const { spawn } = await import("node:child_process");
    const { createServer, createConnection } = await import("node:net");
    const { randomUUID } = await import("node:crypto");
    const listener = createServer();
    await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
    const address = listener.address();
    if (!address || typeof address === "string") throw new Error("No loopback port");
    const port = address.port;
    await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    const executable = process.env.EXTRACTION_TEST_REDIS_EXECUTABLE!;
    const child = spawn(executable, ["--bind", "127.0.0.1", "--port", String(port), "--save", "", "--appendonly", "no"], { windowsHide: true, stdio: "pipe", cwd: process.env.TEMP });
    let startupError: Error | undefined;
    child.on("error", (error) => { startupError = error; });
    const command = (args: (string | number)[]): Promise<unknown> => new Promise((resolve, reject) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      const timer = setTimeout(() => { socket.destroy(); reject(new Error("Redis command deadline")); }, 2000);
      let buffer = Buffer.alloc(0);
      const parse = (offset: number): { value: unknown; end: number } | undefined => {
        const end = buffer.indexOf("\r\n", offset);
        if (end < 0) return;
        const text = buffer.toString("utf8", offset + 1, end); const next = end + 2;
        const type = String.fromCharCode(buffer[offset]);
        if (type === "-") throw new Error(text);
        if (type === "+") return { value: text, end: next };
        if (type === ":") return { value: Number(text), end: next };
        if (type === "$") {
          const size = Number(text); if (size === -1) return { value: null, end: next };
          if (buffer.length < next + size + 2) return;
          return { value: buffer.toString("utf8", next, next + size), end: next + size + 2 };
        }
        if (type === "*") {
          const values = []; let cursor = next;
          for (let i = 0; i < Number(text); i++) { const result = parse(cursor); if (!result) return; values.push(result.value); cursor = result.end; }
          return { value: values, end: cursor };
        }
        throw new Error("Invalid Redis protocol");
      };
      const finish = () => { clearTimeout(timer); socket.destroy(); };
      socket.on("error", (error) => { finish(); reject(error); });
      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, typeof chunk === "string" ? Buffer.from(chunk) : chunk]);
        try { const result = parse(0); if (result) { finish(); resolve(result.value); } } catch (error) { finish(); reject(error); }
      });
      socket.on("connect", () => socket.write(`*${args.length}\r\n` + args.map((arg) => { const value = String(arg); return `$${Buffer.byteLength(value)}\r\n${value}\r\n`; }).join("")));
    });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (startupError) throw startupError;
        try { ready = await command(["PING"]) === "PONG"; if (ready) break; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
      }
      if (!ready) throw new Error("Redis failed to start");
      const window = dailyWindow(new Date());
      const prefix = `synthetic-task001-${randomUUID()}`;
      const daily = `${prefix}:day:${window.day}`;
      const reserve = (ip: string, day = daily, date = window) => command(["EVAL", RESERVE_SCRIPT, 2, day, `${prefix}:ip:${ip}`, date.start, date.end, date.expires]);
      for (let i = 0; i < 9; i++) expect(await reserve(`initial-${i}`)).toEqual([1, 0]);
      const contenders = await Promise.all(Array.from({ length: 20 }, (_, i) => reserve(`race-${i}`)));
      expect(contenders.filter((result) => JSON.stringify(result) === "[1,0]")).toHaveLength(1);
      expect(contenders.filter((result) => Array.isArray(result) && result[0] === 3)).toHaveLength(19);
      expect(await command(["GET", daily])).toBe("10");
      const newInstance = await reserve("new-instance-new-ip") as number[];
      expect(newInstance[0]).toBe(3);
      expect(Math.abs(newInstance[1] - Math.ceil((window.end - Date.now()) / 1000))).toBeLessThanOrEqual(1);
      const ttl = await command(["PTTL", daily]);
      expect(Number(ttl)).toBeGreaterThan(window.end - Date.now() + 172799000);
      expect(Number(ttl)).toBeLessThanOrEqual(window.expires - Date.now() + 1000);
      const ipday = `${prefix}:ipday`;
      expect(await reserve("same", ipday)).toEqual([1, 0]);
      const sameIp = await Promise.all(Array.from({ length: 10 }, () => reserve("same", ipday)));
      expect(sameIp.every((result) => Array.isArray(result) && result[0] === 2 && result[1] >= 1 && result[1] <= 60)).toBe(true);
      expect(await command(["GET", ipday])).toBe("1");
      for (const corrupt of ["-1", "11", "1.5", "01", "private", "NaN"]) {
        const key = `${prefix}:corrupt-${corrupt}`;
        await command(["SET", key, corrupt]); await command(["PEXPIREAT", key, window.expires]);
        expect(await reserve(`corrupt-${corrupt}`, key)).toEqual([4, 0]);
        expect(await command(["GET", key])).toBe(corrupt);
        expect(await command(["EXISTS", `${prefix}:ip:corrupt-${corrupt}`])).toBe(0);
      }
      for (const expiration of [0, 1000]) {
        const key = `${prefix}:badttl-${expiration}`; await command(["SET", key, "1"]);
        if (expiration) await command(["PEXPIRE", key, expiration]);
        expect(await reserve(`badttl-${expiration}`, key)).toEqual([4, 0]);
      }
      await command(["SET", `${prefix}:ip:badip`, "1"]);
      expect(await reserve("badip", `${prefix}:badipday`)).toEqual([4, 0]);
      expect(await command(["EXISTS", `${prefix}:badipday`])).toBe(0);
      await command(["SET", `${prefix}:ip:badvalue`, "private", "PX", 60000]);
      expect(await reserve("badvalue", `${prefix}:badvalueday`)).toEqual([4, 0]);
      await command(["LPUSH", `${prefix}:wrongtype`, "private"]);
      await expect(reserve("wrongtype", `${prefix}:wrongtype`)).rejects.toThrow("WRONGTYPE");
      expect(await command(["EXISTS", `${prefix}:ip:wrongtype`])).toBe(0);
      // A stale/future client calendar never selects an unmetered daily bucket.
      for (const offset of [-86400000, 86400000]) {
        const other = dailyWindow(new Date(Date.now() + offset));
        expect(await reserve(`wrongdate-${offset}`, `${prefix}:${other.day}`, other)).toEqual([4, 0]);
      }
      expect(await command(["SHUTDOWN", "NOSAVE"]).catch(() => "closed")).toBe("closed");
    } finally {
      if (child.exitCode === null) child.kill();
      await new Promise<void>((resolve) => { if (child.exitCode !== null || startupError) resolve(); else child.once("exit", () => resolve()); });
    }
  }, 20000);
});

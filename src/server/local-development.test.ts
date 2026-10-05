import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { localExtractionBypass } from "./local-development";

beforeEach(() => {
  vi.stubEnv("LOCAL_EXTRACTION_BYPASS", "true");
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", undefined); vi.stubEnv("VERCEL_ENV", undefined);
});
afterEach(() => vi.unstubAllEnvs());

it.each(["localhost", "localhost:3000", "127.0.0.1:3000", "[::1]:3000", "[0:0:0:0:0:0:0:1]:3000"])("permits explicit loopback development at %s", (host) => {
  expect(localExtractionBypass(host)).toBe(true);
});
it.each([null, "", "localhost.evil.test", "evil.localhost", "localhost.", "127.0.0.2", "0.0.0.0", "127.1", "localhost@evil.test", "evil.test@localhost", "localhost/path", "localhost:bad", " localhost", "localhost:3000,evil.test", "[::ffff:127.0.0.1]", "app.example.test", "localhost\n", "localhost:0", "localhost:65536"])("rejects nonexact or malformed host %s", (host) => {
  expect(localExtractionBypass(host)).toBe(false);
});
it.each([
  ["LOCAL_EXTRACTION_BYPASS", undefined], ["LOCAL_EXTRACTION_BYPASS", "false"], ["LOCAL_EXTRACTION_BYPASS", "TRUE"],
  ["NODE_ENV", "production"], ["NODE_ENV", "test"], ["NODE_ENV", undefined],
  ["VERCEL", "1"], ["VERCEL", ""], ["VERCEL", "0"],
  ["VERCEL_ENV", "production"], ["VERCEL_ENV", "preview"], ["VERCEL_ENV", "development"], ["VERCEL_ENV", ""],
])("rejects overridden gate %s=%s", (key, value) => {
  vi.stubEnv(key, value); expect(localExtractionBypass("localhost:3000")).toBe(false);
});

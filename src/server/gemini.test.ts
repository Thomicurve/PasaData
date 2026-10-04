import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { extractInterview, ExtractionError, GEMINI_MODEL } from "./gemini";
import { DOCUMENT_FIELDS } from "../lib/document-fields";

const fields = Object.fromEntries(DOCUMENT_FIELDS.map((key) => [key, null]));
const image = { bytes: new Uint8Array([255, 216, 255]), mimeType: "image/jpeg" };
const envelope = (value: unknown) => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] });
const fetchMock = vi.fn();
beforeEach(() => { vi.stubEnv("GEMINI_API_KEY", "synthetic-key"); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("Gemini server adapter", () => {
  it("sends one inline image, header credential, uncertainty instructions and required schema", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(envelope({ ...fields, dni: "00123456", ingresos: "$ 1.234,50" })));
    expect(await extractInterview(image)).toEqual({ ...fields, dni: "00123456", ingresos: "$ 1.234,50" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`);
    expect(url).not.toContain("synthetic-key");
    expect(init.headers["x-goog-api-key"]).toBe("synthetic-key");
    expect(init.cache).toBe("no-store");
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts).toHaveLength(1);
    expect(body.contents[0].parts[0].inlineData).toEqual({ mimeType: "image/jpeg", data: "/9j/" });
    expect(body.systemInstruction.parts[0].text).toMatch(/uncertain.*null/);
    expect(body.generationConfig.responseJsonSchema.required).toEqual(DOCUMENT_FIELDS);
    expect(body.generationConfig.responseJsonSchema.additionalProperties).toBe(false);
  });
  it("rejects missing configuration before sending an image", async () => {
    vi.stubEnv("GEMINI_API_KEY", " ");
    await expect(extractInterview(image)).rejects.toMatchObject({ code: "CONFIGURATION", status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([{}, { ...fields, nombre: 9 }, { ...fields, extra: null }, []])("rejects incomplete or invalid provider data %j", async (value) => {
    fetchMock.mockResolvedValueOnce(Response.json(envelope(value)));
    await expect(extractInterview(image)).rejects.toMatchObject({ code: "INVALID_EXTRACTION", status: 502 });
  });
  it("normalizes blanks while preserving nulls", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(envelope({ ...fields, nombre: "  " })));
    expect(await extractInterview(image)).toEqual(fields);
  });
  it.each(DOCUMENT_FIELDS)("requires a valid explicit provider value for %s", async (key) => {
    const incomplete = { ...fields }; delete incomplete[key];
    for (const invalid of [incomplete, { ...fields, [key]: false }]) {
      fetchMock.mockResolvedValueOnce(Response.json(envelope(invalid)));
      await expect(extractInterview(image)).rejects.toMatchObject({ code: "INVALID_EXTRACTION" });
    }
  });
  it("rejects invalid envelopes, thought parts and oversized provider bodies", async () => {
    for (const value of [null, {}, { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(fields), thought: true }] } }] }]) {
      fetchMock.mockResolvedValueOnce(Response.json(value));
      await expect(extractInterview(image)).rejects.toMatchObject({ code: "INVALID_EXTRACTION" });
    }
    fetchMock.mockResolvedValueOnce(new Response("x".repeat(65_537)));
    await expect(extractInterview(image)).rejects.toMatchObject({ code: "INVALID_EXTRACTION" });
  });
  it.each([
    { promptFeedback: { blockReason: "SAFETY" } },
    { candidates: [{ finishReason: "SAFETY", content: { parts: [{ text: "private" }] } }] },
    { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: JSON.stringify(fields) }] } }] },
    { candidates: [] },
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not JSON" }] } }] },
  ])("rejects blocked, truncated or malformed responses", async (value) => {
    fetchMock.mockResolvedValueOnce(Response.json(value));
    await expect(extractInterview(image)).rejects.toBeInstanceOf(ExtractionError);
  });
  it("sanitizes upstream and network failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("private-key-image", { status: 429 }));
    await expect(extractInterview(image)).rejects.toMatchObject({ code: "PROVIDER_FAILURE", status: 502 });
    fetchMock.mockRejectedValueOnce(new Error("private-key-image"));
    await expect(extractInterview(image)).rejects.toMatchObject({ code: "PROVIDER_FAILURE", status: 502 });
  });
  it("aborts a timed-out request and sanitizes the result", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason));
    }));
    const result = expect(extractInterview(image)).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", status: 504 });
    await vi.advanceTimersByTimeAsync(30_000);
    await result;
  });
});

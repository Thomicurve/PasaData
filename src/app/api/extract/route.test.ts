import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "./route";
const MAX_IMAGE_BYTES = 3_000_000;
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 16_384;
import { DOCUMENT_FIELDS } from "../../../lib/document-fields";

const fields = Object.fromEntries(DOCUMENT_FIELDS.map((key) => [key, null]));
const fetchMock = vi.fn();
const jpeg = new Uint8Array([255, 216, 255, 224]);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
function form(bytes: Uint8Array = jpeg, type = "image/jpeg") {
  const value = new FormData();
  value.append("image", new Blob([new Uint8Array(bytes).buffer], { type }), "synthetic");
  value.append("processingAcknowledged", "true");
  return value;
}
function request(value: FormData) { return new Request("http://localhost/api/extract", { method: "POST", body: value }); }
beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "synthetic-key"); vi.stubGlobal("fetch", fetchMock);
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
    vi.stubEnv("GEMINI_API_KEY", "");
    const missing = await POST(request(form()));
    expect(missing.status).toBe(503); expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("GEMINI_API_KEY", "synthetic-key");
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

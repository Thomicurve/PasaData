import { Buffer } from "node:buffer";
import { extractInterview, ExtractionError } from "../../../server/gemini";

export const runtime = "nodejs";
const MAX_IMAGE_BYTES = 3_000_000;
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 16_384;
const responseHeaders = { "Cache-Control": "no-store" };

async function readForm(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new ExtractionError("INVALID_REQUEST");
  const reader = request.body?.getReader();
  if (!reader) throw new ExtractionError("INVALID_REQUEST");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new ExtractionError("TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  // Parse only the bounded bytes. Content-Length is intentionally not trusted.
  try { return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new ExtractionError("INVALID_REQUEST"); }
}

export async function POST(request: Request) {
  try {
    const form = await readForm(request);
    if ([...form.keys()].some((key) => !["image", "processingAcknowledged"].includes(key)) ||
      form.getAll("image").length !== 1 || form.getAll("processingAcknowledged").length !== 1 ||
      form.get("processingAcknowledged") !== "true") throw new ExtractionError("INVALID_REQUEST");
    const image = form.get("image");
    if (!(image instanceof File) || image.size === 0 || !["image/jpeg", "image/png"].includes(image.type)) throw new ExtractionError("INVALID_IMAGE");
    if (image.size > MAX_IMAGE_BYTES) throw new ExtractionError("TOO_LARGE");
    const bytes = new Uint8Array(await image.arrayBuffer());
    const signature = image.type === "image/jpeg" ? [255, 216, 255] : [137, 80, 78, 71, 13, 10, 26, 10];
    if (!signature.every((value, index) => bytes[index] === value)) throw new ExtractionError("INVALID_IMAGE");
    const fields = await extractInterview({ bytes, mimeType: image.type });
    return Response.json({ fields }, { headers: responseHeaders });
  } catch (error) {
    const failure = error instanceof ExtractionError ? error : new ExtractionError("INVALID_REQUEST");
    return Response.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers: responseHeaders });
  }
}

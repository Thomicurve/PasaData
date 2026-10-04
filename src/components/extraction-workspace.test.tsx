// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExtractionWorkspace from "./extraction-workspace";
import { DOCUMENT_FIELDS } from "../lib/document-fields";

const sample = Object.fromEntries(DOCUMENT_FIELDS.map((key) => [key, null]));
const labels = ["Nombre", "Apellido", "DNI", "Estado civil", "Domicilio", "Situación laboral", "Ingresos", "Motivo de solicitud", "Observaciones"];
const fetchMock = vi.fn();
const revoke = vi.fn();
let urlCount = 0;
function file(name = "synthetic.jpg", type = "image/jpeg", size = 4) {
  return new File([new Uint8Array(size)], name, { type });
}
async function select(image = file()) {
  fireEvent.change(screen.getByLabelText("Imagen de la entrevista"), { target: { files: [image] } });
  fireEvent.load(await screen.findByAltText("Vista previa de la entrevista seleccionada"));
}
async function submit() {
  await userEvent.click(screen.getByRole("checkbox", { name: /Entiendo que/ }));
  await userEvent.click(screen.getByRole("button", { name: "Procesar imagen" }));
}
beforeEach(() => {
  urlCount = 0;
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => `blob:synthetic-${++urlCount}`) });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true, json: async () => ({ fields: sample }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetAllMocks(); });

describe("single interview workspace", () => {
  it("starts empty with ordered steps and a keyboard accessible picker", async () => {
    render(<ExtractionWorkspace />);
    expect(screen.getAllByRole("listitem").map((node) => node.textContent)).toEqual([
      "1Elegir imagen", "2Procesar", "3Revisar", "4Descargar Excel",
    ]);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Elegir imagen" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["image/jpeg", "image/png"])("previews %s locally and gates submission on decoding and acknowledgement", async (type) => {
    render(<ExtractionWorkspace />);
    fireEvent.change(screen.getByLabelText("Imagen de la entrevista"), { target: { files: [file("synthetic", type)] } });
    const process = screen.getByRole("button", { name: "Procesar imagen" }) as HTMLButtonElement;
    expect(process.disabled).toBe(true);
    expect(screen.getByText(/La imagen con datos personales se enviará a Google/)).toBeTruthy();
    fireEvent.load(screen.getByAltText("Vista previa de la entrevista seleccionada"));
    expect(process.disabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(process.disabled).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("submits only the acknowledged image and shows nine editable ordered fields", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ fields: { ...sample, dni: "00123456" } }) });
    render(<ExtractionWorkspace />);
    await select(); await submit();
    await screen.findByLabelText("DNI");
    expect(screen.getAllByRole("textbox").map((node) => node.getAttribute("name"))).toEqual(DOCUMENT_FIELDS);
    expect((screen.getByLabelText("DNI") as HTMLInputElement).value).toBe("00123456");
    expect(screen.getByText("8 campos vacíos")).toBeTruthy();
    expect(screen.getAllByText("Sin dato. Revisá este campo.")).toHaveLength(8);
    expect((screen.getByRole("button", { name: "Descargar Excel" }) as HTMLButtonElement).disabled).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/extract"); expect(init.method).toBe("POST");
    expect([...init.body.keys()]).toEqual(["image", "processingAcknowledged"]);
    expect(init.body.get("processingAcknowledged")).toBe("true");
    await userEvent.type(screen.getByLabelText("Nombre"), "Synthetic");
    expect(screen.getByText("7 campos vacíos")).toBeTruthy();
    await userEvent.clear(screen.getByLabelText("DNI"));
    expect(screen.getByText("8 campos vacíos")).toBeTruthy();
    expect(labels.every((label) => screen.getByLabelText(label))).toBe(true);
  });
  it.each([file("bad.gif", "image/gif"), file("empty.jpg", "image/jpeg", 0), file("large.jpg", "image/jpeg", 3_000_001)])("rejects invalid selection without provider calls", async (image) => {
    render(<ExtractionWorkspace />);
    fireEvent.change(screen.getByLabelText("Imagen de la entrevista"), { target: { files: [image] } });
    expect(screen.getByRole("alert").textContent).toMatch(/JPEG o PNG/);
    expect(screen.queryByAltText("Vista previa de la entrevista seleccionada")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("accepts exactly 3 MB and handles decode failure", async () => {
    render(<ExtractionWorkspace />);
    await select(file("boundary.jpg", "image/jpeg", 3_000_000));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.error(screen.getByAltText("Vista previa de la entrevista seleccionada"));
    expect(screen.getByRole("alert").textContent).toMatch(/abrir/);
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("accepts a single dropped image and rejects multiple files", async () => {
    render(<ExtractionWorkspace />);
    fireEvent.drop(screen.getByRole("region", { name: "Carga de imagen" }), { dataTransfer: { files: [file()] } });
    fireEvent.load(screen.getByAltText("Vista previa de la entrevista seleccionada"));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByLabelText("Imagen de la entrevista"), { target: { files: [file(), file("second.jpg")] } });
    expect(screen.getByRole("alert").textContent).toMatch(/una sola/);
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([{ fields: {} }, { fields: { ...sample, extra: "private" } }, { fields: { ...sample, dni: 123 } }, null])("discards invalid successful response %j", async (payload) => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => payload });
    render(<ExtractionWorkspace />); await select(); await submit();
    expect((await screen.findByRole("alert")).textContent).toMatch(/formato esperado/);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it.each(["CONFIGURATION", "PROVIDER_TIMEOUT", "PROVIDER_FAILURE", "INVALID_EXTRACTION"])("shows sanitized actionable %s failure and supports retry", async (code) => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: { code, message: "private-untrusted-text" } }) });
    render(<ExtractionWorkspace />); await select(); await submit();
    expect((await screen.findByRole("alert")).textContent).not.toContain("private-untrusted-text");
    const title = code === "INVALID_EXTRACTION" ? "La respuesta no tenía el formato esperado" :
      code === "CONFIGURATION" ? "El procesamiento no está disponible" :
      code === "PROVIDER_TIMEOUT" ? "El procesamiento tardó demasiado" : "El proveedor no respondió";
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar procesamiento" }));
    expect(await screen.findByLabelText("Nombre")).toBeTruthy();
  });
  it("sanitizes network or malformed JSON errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error("private-network"));
    render(<ExtractionWorkspace />); await select(); await submit();
    expect((await screen.findByRole("alert")).textContent).not.toContain("private-network");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => { throw new Error("private-json"); } });
    await userEvent.click(screen.getByRole("button", { name: "Reintentar procesamiento" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).not.toContain("private-json"));
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("clears edits/results/acknowledgement and revokes preview when replacing", async () => {
    render(<ExtractionWorkspace />); await select(); await submit(); await screen.findByLabelText("Nombre");
    await userEvent.type(screen.getByLabelText("Nombre"), "Synthetic edit");
    await userEvent.click(screen.getByRole("button", { name: "Reemplazar imagen" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-1");
    await select(file("replacement.png", "image/png"));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });
  it("blocks duplicate submit, hides processing actions and ignores success after a late file event", async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<ExtractionWorkspace />); await select();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.dblClick(screen.getByRole("button", { name: "Procesar imagen" }));
    expect(screen.getByRole("status").textContent).toMatch(/Extrayendo/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Procesar imagen" })).toBeNull();
    expect(screen.getByText("Puede tardar unos segundos. No cierres esta página ni reemplaces la imagen durante el proceso.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reemplazar imagen" })).toBeNull();
    await select(file("new.jpg"));
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => resolve({ ok: true, json: async () => ({ fields: { ...sample, nombre: "Stale" } }) }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("new.jpg")).toBeTruthy();
  });
  it("aborts on unmount and revokes object URLs", async () => {
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const view = render(<ExtractionWorkspace />); await select(); await submit();
    view.unmount();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-1");
  });
  it("clears prior reviewed values after an invalid new selection", async () => {
    render(<ExtractionWorkspace />); await select(); await submit(); await screen.findByLabelText("Nombre");
    await userEvent.type(screen.getByLabelText("Nombre"), "Synthetic edit");
    fireEvent.change(screen.getByLabelText("Imagen de la entrevista"), { target: { files: [file("invalid", "text/plain")] } });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("focuses the review title and associates blank hints with labeled text controls", async () => {
    render(<ExtractionWorkspace />); await select(); await submit();
    const title = await screen.findByRole("heading", { name: "Revisá antes de descargar" });
    expect(document.activeElement).toBe(title);
    const income = screen.getByLabelText("Ingresos");
    expect(income.getAttribute("aria-describedby")).toBe("hint-ingresos");
    expect(document.getElementById("hint-ingresos")?.textContent).toBe("Sin dato. Revisá este campo.");
    expect(screen.getByLabelText("Revisión de los nueve campos")).toBeTruthy();
  });
  it("ignores a stale failure after a late file event", async () => {
    let reject!: (value: Error) => void;
    fetchMock.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    render(<ExtractionWorkspace />); await select(); await submit();
    expect(screen.queryByRole("button", { name: "Reemplazar imagen" })).toBeNull();
    await select(file("new.jpg"));
    await act(async () => reject(new Error("private-old-failure")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("new.jpg")).toBeTruthy();
  });
});

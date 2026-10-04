"use client";

import { useEffect, useRef, useState } from "react";
import { DOCUMENT_FIELDS, documentFieldsSchema, type DocumentFields, type DocumentField } from "../lib/document-fields";

const fieldLabels: Record<DocumentField, string> = {
  nombre: "Nombre", apellido: "Apellido", dni: "DNI", estadoCivil: "Estado civil",
  domicilio: "Domicilio", situacionLaboral: "Situación laboral", ingresos: "Ingresos",
  motivoSolicitud: "Motivo de solicitud", observaciones: "Observaciones",
};
const errorMessages: Record<string, string> = {
  CONFIGURATION: "El procesamiento no está disponible. Contactá al responsable de la aplicación.",
  PROVIDER_TIMEOUT: "El procesamiento tardó demasiado. Intentá nuevamente.",
  PROVIDER_FAILURE: "No pudimos procesar la imagen. Revisá tu conexión y reintentá en unos minutos.",
  INVALID_EXTRACTION: "La respuesta no tenía el formato esperado. Descartamos el resultado. Probá de nuevo con una fotografía clara.",
  INVALID_IMAGE: "No pudimos usar esta imagen. Elegí un archivo JPEG o PNG válido de hasta 3 MB.",
  TOO_LARGE: "La imagen es demasiado grande. Elegí un JPEG o PNG de hasta 3 MB.",
  INVALID_REQUEST: "Revisá la imagen y confirmá el aviso antes de procesarla.",
};
const errorTitles: Record<string, string> = {
  INVALID_IMAGE: "No pudimos usar esta imagen",
  TOO_LARGE: "No pudimos usar esta imagen",
  INVALID_EXTRACTION: "La respuesta no tenía el formato esperado",
  CONFIGURATION: "El procesamiento no está disponible",
  PROVIDER_TIMEOUT: "El procesamiento tardó demasiado",
};
type Selection = { file: File; url: string; version: number };
type Stage = "empty" | "ready" | "processing" | "review" | "error";

function parseFields(payload: unknown): DocumentFields {
  if (!payload || typeof payload !== "object" || !("fields" in payload)) throw new Error("INVALID_EXTRACTION");
  const fields = payload.fields;
  if (!fields || typeof fields !== "object" || Array.isArray(fields) ||
    Object.keys(fields).length !== DOCUMENT_FIELDS.length ||
    !DOCUMENT_FIELDS.every((key) => Object.hasOwn(fields, key) &&
      (Reflect.get(fields, key) === null || typeof Reflect.get(fields, key) === "string"))) {
    throw new Error("INVALID_EXTRACTION");
  }
  return documentFieldsSchema.parse(fields);
}

export default function ExtractionWorkspace() {
  const [stage, setStage] = useState<Stage>("empty");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [decoded, setDecoded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [fields, setFields] = useState<DocumentFields | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const version = useRef(0);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => { if (selection) URL.revokeObjectURL(selection.url); }, [selection]);
  useEffect(() => () => { version.current++; pending.current?.abort(); }, []);
  useEffect(() => { if (stage === "review" || stage === "error") heading.current?.focus(); }, [stage]);

  function clearSelection() {
    version.current++;
    pending.current?.abort();
    pending.current = null;
    setSelection(null);
    setFields(null);
    setDecoded(false);
    setAcknowledged(false);
    setError("");
    setErrorCode("");
    setStage("empty");
  }

  function selectFiles(files: FileList | File[]) {
    if (files.length === 0) return;
    clearSelection();
    const file = files[0];
    if (files.length !== 1 || !["image/jpeg", "image/png"].includes(file.type) || file.size === 0 || file.size > 3_000_000) {
      setError("Elegí una sola imagen JPEG o PNG de hasta 3 MB (3.000.000 bytes), que no esté vacía.");
      setErrorCode("INVALID_IMAGE");
      setStage("error");
      return;
    }
    try {
      setSelection({ file, url: URL.createObjectURL(file), version: version.current });
      setStage("ready");
    } catch {
      setError("No pudimos abrir la imagen. Elegí otra fotografía y volvé a intentarlo.");
      setErrorCode("INVALID_IMAGE");
      setStage("error");
    }
  }

  function replaceImage() {
    clearSelection();
    input.current?.click();
  }

  async function processImage() {
    if (!selection || !decoded || !acknowledged || pending.current) return;
    const current = selection.version;
    const controller = new AbortController();
    pending.current = controller;
    setFields(null);
    setError("");
    setStage("processing");
    const body = new FormData();
    body.append("image", selection.file);
    body.append("processingAcknowledged", "true");
    try {
      const response = await fetch("/api/extract", { method: "POST", body, signal: controller.signal, cache: "no-store" });
      let payload: unknown;
      try { payload = await response.json(); }
      catch { throw new Error("INVALID_EXTRACTION"); }
      if (current !== version.current || controller.signal.aborted) return;
      if (!response.ok) {
        const code = payload && typeof payload === "object" && "error" in payload &&
          payload.error && typeof payload.error === "object" && "code" in payload.error ? payload.error.code : null;
        throw new Error(typeof code === "string" && Object.hasOwn(errorMessages, code) ? code : "PROVIDER_FAILURE");
      }
      setFields(parseFields(payload));
      setStage("review");
    } catch (failure) {
      if (current !== version.current || controller.signal.aborted) return;
      setFields(null);
      const code = failure instanceof Error && Object.hasOwn(errorMessages, failure.message) ? failure.message : "PROVIDER_FAILURE";
      setError(errorMessages[code]);
      setErrorCode(code);
      setStage("error");
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }

  const step = stage === "review" ? 3 : stage === "processing" ? 2 : 1;
  const emptyCount = fields ? DOCUMENT_FIELDS.filter((key) => !fields[key]?.trim()).length : 0;
  const title = stage === "review" ? "Revisá antes de descargar" : stage === "processing" ? "Estamos leyendo la entrevista" :
    stage === "error" ? errorTitles[errorCode] ?? "El proveedor no respondió" : selection ? "Revisá la foto antes de procesarla." : "Pasá notas manuscritas a Excel.";

  const preview = selection && (
    <figure className="preview-panel">
      <div className="image-preview">
        {/* Local object URLs must remain local; Next's optimizer would require uploading the image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selection.url} alt="Vista previa de la entrevista seleccionada"
          onLoad={() => { if (selection.version === version.current) setDecoded(true); }}
          onError={() => {
            if (selection.version !== version.current) return;
            clearSelection();
            setError("No pudimos abrir la imagen. Elegí otra fotografía y volvé a intentarlo.");
            setErrorCode("INVALID_IMAGE");
            setStage("error");
          }} />
      </div>
      <figcaption><strong>{selection.file.name}</strong><span>{(selection.file.size / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} MB</span></figcaption>
    </figure>
  );

  return (
    <>
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>PasaData</div>
        <span className="header-privacy">Sin cuentas · Sin historial</span>
        <span className="mobile-step">Paso {step} de 4</span>
      </header>
      <main className={`workspace stage-${stage}`}>
        <nav aria-label="Etapas de la entrevista">
          <ol className="workflow-steps">
            {["Elegir imagen", "Procesar", "Revisar", "Descargar Excel"].map((label, index) => (
              <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={step >= index + 1 ? "step-active" : ""}>
                <span className="step-marker" aria-hidden="true">{index + 1}</span><span>{label}</span>
              </li>
            ))}
          </ol>
        </nav>
        <input ref={input} type="file" accept="image/jpeg,image/png" className="file-input" tabIndex={-1}
          aria-label="Imagen de la entrevista" onChange={(event) => {
            if (event.target.files) selectFiles(event.target.files);
            event.target.value = "";
          }} />

        {stage === "processing" ? (
          <section className="processing-stage" aria-labelledby="workspace-title" aria-busy="true">
            <span className="spinner" aria-hidden="true" />
            <h1 id="workspace-title" ref={heading} tabIndex={-1}>{title}</h1>
            <p>Puede tardar unos segundos. No cierres esta página ni reemplaces la imagen durante el proceso.</p>
            <p className="processing-status" role="status">Extrayendo los 9 campos acordados…</p>
            <button disabled aria-describedby="export-availability">Descargar Excel</button>
            <p id="export-availability" className="small">Descarga disponible próximamente.</p>
          </section>
        ) : stage === "review" && fields ? (
          <section className="review-stage" aria-labelledby="workspace-title">
            <div className="review-heading"><div><h1 id="workspace-title" ref={heading} tabIndex={-1}>{title}</h1>
              <p>Corregí cualquier dato. Los campos ilegibles quedan vacíos y marcados; podés completarlos o dejarlos en blanco.</p></div>
              <span className="review-count" aria-live="polite">{emptyCount} {emptyCount === 1 ? "campo vacío" : "campos vacíos"}</span>
            </div>
            <form className="field-grid" aria-label="Revisión de los nueve campos" onSubmit={(event) => event.preventDefault()}>
              {DOCUMENT_FIELDS.map((key) => {
                const blank = !fields[key]?.trim();
                return <div className={`field ${blank ? "field-empty" : ""}`} key={key}>
                  <label htmlFor={`field-${key}`}>{fieldLabels[key]}</label>
                  <input id={`field-${key}`} name={key} type="text" autoComplete="off" value={fields[key] ?? ""}
                    placeholder={blank ? "Sin dato" : undefined} aria-describedby={blank ? `hint-${key}` : undefined}
                    onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />
                  {blank && <p id={`hint-${key}`} className="field-hint">Sin dato. Revisá este campo.</p>}
                </div>;
              })}
            </form>
            <p className="review-summary">La planilla tendrá 1 hoja, 9 columnas en este orden y 1 fila de entrevista. Los campos vacíos quedarán en blanco.</p>
            <div className="review-actions"><p className="small">Tus cambios permanecen solo en esta página.</p><div className="actions">
              <button className="secondary" onClick={replaceImage}>Reemplazar imagen</button>
              <button disabled aria-describedby="export-availability">Descargar Excel</button>
            </div></div>
            <p id="export-availability" className="small">Descarga disponible próximamente.</p>
          </section>
        ) : (
          <div className={selection ? "ready-layout" : "upload-layout"}>
            {selection && preview}
            <section className="intro" aria-labelledby="workspace-title">
              <p className="kicker">{selection ? "Imagen lista" : "Una foto. Una planilla."}</p>
              <h1 id="workspace-title" ref={heading} tabIndex={-1}>{title}</h1>
              {stage === "error" ? <div className="error-panel" role="alert"><p>{error}</p><p className="small">No hay resultados disponibles para exportar.</p></div> :
                <p className="description">{selection ? "Asegurate de que el texto se vea completo y con buena luz. Reemplazar la imagen descarta cualquier resultado anterior." : "Elegí una imagen clara de la entrevista. Vas a poder corregir cada dato antes de preparar la planilla."}</p>}
              {selection ? <>
                <div className="provider-notice"><h2>Antes de continuar</h2>
                  <p>La imagen con datos personales se enviará a Google para extraerlos. La app no guarda la imagen, los datos ni el historial. La retención del proveedor debe verificarse antes de producción.</p>
                  <label className="acknowledgement"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />Entiendo que la imagen se enviará a Google.</label>
                </div>
                <div className="actions"><button disabled={!decoded || !acknowledged} onClick={processImage}>{stage === "error" ? "Reintentar procesamiento" : "Procesar imagen"}</button>
                  <button className="secondary" onClick={replaceImage}>Reemplazar imagen</button></div>
              </> : <p className="privacy-summary">La app no guarda la imagen ni los datos.</p>}
            </section>
            {!selection && <section className="upload-dropzone" aria-label="Carga de imagen"
              onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFiles(event.dataTransfer.files); }}>
              <span className="upload-symbol" aria-hidden="true">↑</span>
              <h2>Arrastrá una imagen o elegila desde tu equipo</h2>
              <p>Una sola imagen. JPEG o PNG de hasta 3 MB.</p>
              <button onClick={() => input.current?.click()}>{stage === "error" ? "Elegir otra imagen" : "Elegir imagen"}</button>
              <p className="small">También podés activar este control con el teclado.</p>
            </section>}
          </div>
        )}
      </main>
    </>
  );
}

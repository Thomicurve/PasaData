import { DOCUMENT_FIELDS, documentFieldsSchema, type DocumentFields } from "./document-fields";

export async function createInterviewWorkbook(fields: DocumentFields): Promise<ArrayBuffer> {
  const values = documentFieldsSchema.parse(fields);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Entrevista");
  sheet.addRow([...DOCUMENT_FIELDS]);
  const row = sheet.addRow(DOCUMENT_FIELDS.map((key) => values[key] ?? null));
  // Keep the interview row present even when every cell is blank.
  row.height = 18;
  const bytes = await workbook.xlsx.writeBuffer();
  return new Uint8Array(bytes).buffer;
}

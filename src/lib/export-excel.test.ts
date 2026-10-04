import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { DOCUMENT_FIELDS, documentFieldsSchema } from "./document-fields";
import { createInterviewWorkbook } from "./export-excel";

async function readback(input: unknown) {
  const bytes = await createInterviewWorkbook(documentFieldsSchema.parse(input));
  expect(bytes).toBeInstanceOf(ArrayBuffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  expect(workbook.worksheets).toHaveLength(1);
  const sheet = workbook.worksheets[0];
  expect(sheet.name).toBe("Entrevista");
  expect(sheet.rowCount).toBe(2);
  expect(sheet.columnCount).toBe(9);
  expect(DOCUMENT_FIELDS.map((_key, index) => sheet.getCell(1, index + 1).value)).toEqual(DOCUMENT_FIELDS);
  return sheet;
}

describe("reviewed Excel serialization", () => {
  it("round-trips all nine current values as text and preserves source formatting", async () => {
    const values = Object.fromEntries(DOCUMENT_FIELDS.map((key) => [key, ` ${key} synthetic `]));
    values.dni = "00123456";
    values.ingresos = "$ 1.234,50 mensuales";
    const sheet = await readback(values);
    DOCUMENT_FIELDS.forEach((key, index) => {
      const cell = sheet.getCell(2, index + 1);
      expect(cell.value).toBe(values[key]);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(cell.formula).toBeUndefined();
    });
  });
  it("keeps null and whitespace blank, including an entirely blank interview row", async () => {
    const sheet = await readback({ nombre: " \t\n ", apellido: null });
    DOCUMENT_FIELDS.forEach((_key, index) => expect(sheet.getCell(2, index + 1).value).toBeNull());
  });
  it("writes formula-like and URL-like text as literal strings without formulas or hyperlinks", async () => {
    const values = ["=1+1", "+SUM(A1:A2)", "-12", "@SUM(A1)", "https://example.invalid", "001", "0", "=HYPERLINK(\"https://example.invalid\")", " Text "];
    const sheet = await readback(Object.fromEntries(DOCUMENT_FIELDS.map((key, index) => [key, values[index]])));
    values.forEach((value, index) => {
      const cell = sheet.getCell(2, index + 1);
      expect(cell.value).toBe(value);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(cell.formula).toBeUndefined();
      expect(cell.hyperlink).toBeUndefined();
    });
  });
  it("does not mutate the reviewed input", async () => {
    const fields = Object.freeze(documentFieldsSchema.parse({ dni: "00123456", observaciones: " " }));
    await createInterviewWorkbook(fields);
    expect(fields.dni).toBe("00123456");
    expect(fields.observaciones).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { DOCUMENT_FIELDS, documentFieldsSchema } from "./document-fields";

const orderedFields = [
  "nombre", "apellido", "dni", "estadoCivil", "domicilio",
  "situacionLaboral", "ingresos", "motivoSolicitud", "observaciones",
];

describe("fixed interview contract", () => {
  it("produces exactly the agreed nine fields in export order", () => {
    expect(DOCUMENT_FIELDS).toEqual(orderedFields);
    const result = documentFieldsSchema.parse({});
    expect(Object.keys(result)).toEqual(orderedFields);
    expect(Object.values(result)).toEqual(Array(9).fill(null));
  });

  it("accepts all text fields and preserves source formatting", () => {
    const input = Object.fromEntries(orderedFields.map((key) => [key, ` ${key} `]));
    input.dni = "00123456";
    input.ingresos = "$ 1.234,50 mensuales";
    expect(documentFieldsSchema.parse(input)).toEqual(input);
  });

  it.each(orderedFields)("normalizes missing, undefined, blank and null %s", (key) => {
    for (const value of [undefined, "", " \t\n ", null]) {
      const result = documentFieldsSchema.parse({ [key]: value });
      expect(result).toEqual(Object.fromEntries(orderedFields.map((field) => [field, null])));
    }
  });

  it.each(orderedFields)("rejects invalid types for %s without coercion", (key) => {
    for (const value of [123, false, [], {}, ["text"]]) {
      expect(documentFieldsSchema.safeParse({ [key]: value }).success).toBe(false);
    }
  });

  it("rejects unexpected fields and invalid root values", () => {
    for (const input of [{ extra: "value" }, { nombre: "Test", extra: null }, null, [], "text", 42]) {
      expect(documentFieldsSchema.safeParse(input).success).toBe(false);
    }
  });

  it("does not mutate caller input while normalizing", () => {
    const input = Object.freeze({ nombre: " ", dni: "00123456" });
    documentFieldsSchema.parse(input);
    expect(input).toEqual({ nombre: " ", dni: "00123456" });
  });
});

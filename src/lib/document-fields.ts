import { z } from "zod";

export const DOCUMENT_FIELDS = [
  "nombre", "apellido", "dni", "estadoCivil", "domicilio",
  "situacionLaboral", "ingresos", "motivoSolicitud", "observaciones",
] as const;

const fieldValueSchema = z.string().nullish().transform((value) =>
  value == null || value.trim() === "" ? null : value,
);

export const documentFieldsSchema = z.strictObject({
  nombre: fieldValueSchema,
  apellido: fieldValueSchema,
  dni: fieldValueSchema,
  estadoCivil: fieldValueSchema,
  domicilio: fieldValueSchema,
  situacionLaboral: fieldValueSchema,
  ingresos: fieldValueSchema,
  motivoSolicitud: fieldValueSchema,
  observaciones: fieldValueSchema,
});

export type DocumentField = (typeof DOCUMENT_FIELDS)[number];
export type DocumentFields = z.output<typeof documentFieldsSchema>;

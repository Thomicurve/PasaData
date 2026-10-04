# PasaData

This checkout contains the TASK-001 foundation for handwritten interview extraction: Next.js App Router, TypeScript and a fixed Zod contract. The current page is a temporary placeholder. Image upload, provider processing, review controls and Excel export are not implemented yet. No provider requests are made by this scaffold.

Use Node.js 22.12 or newer and npm:

```sh
npm ci
npm run dev
```

Required checks:

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

`DOCUMENT_FIELDS` defines the nine export columns in order. `documentFieldsSchema` returns every field as `string | null`, normalizes omitted, undefined and whitespace-only values to `null`, and rejects unexpected keys or non-string values. Nonblank text is preserved, including leading zeroes in DNI and formatting in ingresos. Tests use synthetic values only.

Keep credentials and private interview data out of source control, tests and logs. Local environment and workflow data are ignored without being deleted. The canonical feature plan is `specs/handwritten-interview-export/spec.md`; the approved material design is `PasaDataDesign.pen`.

# @sherizan/proto-manifest

The declarative JSON contract for shareable Prototo prototypes.

A manifest describes a prototype as **data** — which Proto components to render, with which props, wired by a fixed set of enumerated actions. No code crosses the wire, so an App Clip renderer that already passed App Store review can render any manifest without downloading or executing JavaScript (the constraint behind Apple Guideline 2.5.2).

This package is the machine-readable side of that contract, shared by the compile step (`proto share`) and the renderer:

- `src/types.ts` — TypeScript types (the renderer-agnostic source of truth)
- `schema/manifest.schema.json` — JSON Schema (draft 2020-12)
- `src/validate.ts` — `validateManifest(input)` → structural + referential validation
- `fixtures/` — compile-target manifests for the six `new-screen` templates, plus an interactive example

The human-readable spec is `docs/MANIFEST.md` at the repo root.

## Usage

```ts
import { validateManifest, type Manifest } from '@sherizan/proto-manifest';

const result = validateManifest(json);
if (result.ok) {
  const manifest: Manifest = result.manifest;
} else {
  console.error(result.errors); // string[]
}
```

## Develop

```bash
pnpm --filter @sherizan/proto-manifest test       # vitest
pnpm --filter @sherizan/proto-manifest typecheck
pnpm --filter @sherizan/proto-manifest build
```

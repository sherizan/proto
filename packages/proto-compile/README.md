# @sherizan/proto-compile

Compiles a Prototo screen (`.tsx`) into a validated manifest (`@sherizan/proto-manifest`). This is the gate between local prototyping fidelity and shareable fidelity — it **fails loudly at creation time** on anything outside the manifest schema, rather than shipping a malformed manifest to the App Clip viewer.

Built on [`ts-morph`](https://ts-morph.com). The renderer never sees this package — only the validated JSON manifest it produces.

## What compiles (shared fidelity)

A screen that imports **only** from the Proto component barrel (`../components/proto`) and uses the component surface in `docs/MANIFEST.md`: `Screen`, `Stack`, `Row`, `Text`, `Card`, `Button`, `Toggle`, `Divider`, `Modal`, with literal props.

Interactions compile via the enumerated authoring surface (spec: `2026-06-10-shareable-interaction-authoring-surface-design.md`):

- `onTap` on `Button`/`Card` — `"navigate:Detail"`, `"dismiss"`, `"toggle:key"`, `"showModal:key"`, `"hideModal:key"`, `"set:key:value"` → manifest actions
- `bind` on `Toggle`/`Modal` — two-way binding to a boolean state key
- `<Screen state={{ darkMode: true }}>` — optional initial values, lifted to the manifest's top-level `state`; every bound/actioned key is otherwise inferred as `false`

## What is rejected (local-only fidelity)

Loudly, with a clear message:

- imports from anything other than the proto barrel — `react` (`useState`/hooks), `react-native` (raw primitives), the `motion`/`gestures`/`canvas`/`svg`/`lottie` subpaths, data libraries
- callback handlers (`onPress`/`onChange`/`onClose`) — `onTap`/`bind` are the shareable forms; arbitrary code is not
- `onTap` strings outside the grammar, or non-literal `onTap` values
- unknown components, unknown props, dynamic text/children, spread props
- a root element that isn't `<Screen>`

These are fine in a local prototype; they just don't cross into a shared App Clip. See the two-tier model in `docs/MANIFEST.md`.

## Usage

```ts
import { compileScreen, compileManifest } from '@sherizan/proto-compile';

const one = compileScreen(tsxSource);
// { ok: true, screen } | { ok: false, errors: string[] }

const manifest = compileManifest(
  [{ name: 'Home', source: homeTsx }, { name: 'Detail', source: detailTsx }],
  { name: 'MyApp', theme: 'liquidGlass', colorScheme: 'system', initialScreen: 'Home' },
);
// { ok: true, manifest } | { ok: false, errors: string[] }  (validated end-to-end)
```

Errors are technical strings; the CLI (`proto share`, Phase F) routes them through the error-translation layer into designer-friendly copy.

## Develop

```bash
pnpm --filter @sherizan/proto-compile test       # vitest — fixtures in ./fixtures compile to the proto-manifest JSON fixtures
pnpm --filter @sherizan/proto-compile typecheck
pnpm --filter @sherizan/proto-compile build
```

# Proto — Project Rules for Claude

> Source of product truth: `docs/proto-master.md`. Foundation design: `docs/superpowers/specs/2026-05-20-proto-foundation-design.md`.
> When this file and the master doc disagree, the master doc wins — update this file to match.

## 1. Product invariants

Proto is a native-prototype tool for product designers. Every choice serves a designer with zero engineering background.

- **Designer-first copy.** Anything a designer can see (terminal output, error messages, prompts, screen titles, README) must be free of engineering jargon. No stack traces, package names, version numbers, file paths in user-facing output. Errors flow through the translation layer in master doc §12.
- **Proto component library only.** Outside `packages/proto-components/`, never import raw React Native primitives (`View`, `Text`, `TouchableOpacity`, `ScrollView`, etc.). Hand-written and generated screens use `Screen`, `Stack`, `Row`, `Text`, `Card`, `Button`, `Toggle`, `Divider`, `Nav`, `Modal` only.
- **`proto.config.js` is the only designer surface.** Anything else is "managed by Proto." Never instruct a designer to edit another file.
- **No comments in generated screens.** The Claude generation prompt enforces this; do not add them when hand-editing either.
- **Write to disk, not runtime eval.** Generated `.tsx` files land in `screens/`; Metro hot-reloads. Never introduce runtime JSX evaluation.
- **Full-file rewrites for `proto edit`, not diffs.** Files are small; diffs are fragile with LLM output.

## 2. Repo conventions

- **Workspaces:** pnpm. Root `package.json` is private. Packages under `packages/`, apps under `apps/`.
- **Language:** TypeScript, ESM (`"type": "module"`). Target Node 18+.
- **Tests:** Vitest, beside source as `*.test.ts`. No tests for `proto-components` — on-device validation only.
- **Lint / format:** Biome. One config at root.
- **No CI yet.** Added once the first package has real tests.
- **Commit style:** short imperative subject, body explains *why* if non-obvious. No emoji.

## 3. Skill mandates

Invoke these proactively — do not wait for the user to ask.

| When | Skill |
|---|---|
| Before any new feature, behavior change, or creative work | `superpowers:brainstorming` |
| Writing CLI commands, prompt server, error translation, file generation, Claude API integration | `superpowers:test-driven-development` (tests first) |
| Touching `@anthropic-ai/sdk` or the prompt server | `claude-api` |
| Before claiming work complete | `superpowers:verification-before-completion` |
| On any bug, test failure, or unexpected output | `superpowers:systematic-debugging` |
| Editing or creating skills themselves | `superpowers:writing-skills` |
| Phase 3 `proto.run` web UI work only | `frontend-design` |

**Skip TDD for:** React Native components in `packages/proto-components/`. Visual validation happens on device, not in a test runner.

**Skip frontend-design for:** RN components. That skill is for web; RN components follow the Proto design tokens in `packages/proto-components/tokens/`.

## 4. MCP usage rules

| MCP | Use for | Don't use for |
|---|---|---|
| `context7` | Current docs on Expo SDK 53, expo-router, react-native-reanimated 3, react-native-gesture-handler, `@react-native-community/blur`, `@anthropic-ai/sdk`. Check before non-trivial integration — training data may be stale. | General programming questions, internal Proto code. |
| `figma-console` | Design token parity checks (Liquid Glass / Material You against `packages/proto-components/tokens/`), mockups during brainstorm sessions. | Anything outside design surface. |
| `playwright` | Reserved for Phase 3 — `proto.run` web app E2E. | Phase 1 / Phase 2 work. |
| `ide` | TypeScript diagnostics on changed files before completion. | — |

## 5. Implementation phases (pointer)

`docs/proto-master.md` §15 lists the Claude Code prompts for each Phase 1 buildable unit. Use them as the prompt scaffolding when implementing — they encode the right constraints.

- Phase 1: scaffolding + preview (`create-proto`, `proto-components`, `proto-cli start/new-screen/reset`)
- Phase 2: prompt layer (`proto add`, `proto edit`) + custom dev client (`apps/prototo-app`)
- Phase 3: share + `proto.run` web app

## 6. Risk tracking

Every new design spec under `docs/superpowers/specs/` MUST include an `## Open risks` section. List each risk with a clear mitigation or next action. Open risks are not blocking — they're a deliberate record of what we know we don't yet know.

After a spec lands, sweep its cross-cutting risks into `docs/RISKS.md` (the backlog). Risks that affect only that spec's immediate scope stay inline; risks that span multiple features, depend on external factors, or require follow-up work outside the spec get promoted to the backlog.

Promote a risk to `docs/RISKS.md` when **any** of these apply:
- It touches more than one area (cross-cutting infrastructure, multiple files, multiple specs).
- It has long-tail consequences (a decision that's hard to reverse later).
- It depends on something outside our control (Apple review, third-party API, cloud provider).
- It's a known follow-up we explicitly chose to defer.

Risks that stay inline-only are typically: single-file consequences, validated-during-DoD checks, or "this exact mitigation is already in the next task."

When the user asks "what risks are we tracking?" — `docs/RISKS.md` is the answer.

## 7. Things to never do

- Surface raw Metro / npm / pnpm / Node errors to the designer.
- Add a config file or environment variable the designer must edit beyond `proto.config.js` (`PROTO_API_KEY` is the one allowed exception, and Phase 2 will move it into a keychain via `proto login`).
- Use Expo's default branding once we have the custom dev client.
- Import raw RN primitives in screens or generated output.
- Push to `origin` without explicit user confirmation.
- Add TypeScript types or interfaces inside generated screen files.

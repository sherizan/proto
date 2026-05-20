# Proto — Foundation Design

> Date: 2026-05-20
> Scope: Pre-build setup. CLAUDE rules, skills, MCPs, repo scaffolding, memory seeds.
> Source of product truth: `docs/proto-master.md`

## Goal

Land the project foundation before writing any product code so that future sessions (and contributors) inherit consistent rules, the right tooling, and a clean monorepo shell.

## Decisions locked

| Decision | Choice | Reason |
|---|---|---|
| Workspace manager | pnpm workspaces | Matches master doc §15 Prompt 1 |
| Language | TypeScript, ESM | Master doc §15 |
| Node version | 18+ (pin via .nvmrc) | Master doc §3 |
| TDD rigor | Strict on CLI/server/error-translation logic; skip RN component tests | Pragmatic for a prototyping tool — on-device validation matters more than render tests |
| Custom dev client workspace | Scaffold empty stub at `apps/proto-app` | Reserves slot for Phase 2 |
| Test runner | Vitest | Fast, ESM-native, no transpile config |
| Linter / formatter | Biome | Single tool, zero config, fast |
| Remote | `git@github.com:sherizan/proto.git` | Provided by user |

## Repo shape

```
proto/
├── CLAUDE.md
├── README.md
├── package.json                 (private, workspaces root)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── .gitignore
├── .nvmrc
├── docs/
│   ├── proto-master.md          (source of product truth)
│   └── superpowers/specs/2026-05-20-proto-foundation-design.md
├── packages/
│   ├── create-proto/            (npm create scaffolding CLI)
│   ├── proto-cli/               (proto start/add/edit/reset)
│   └── proto-components/        (RN component library)
└── apps/
    └── proto-app/               (custom dev client — stub, Phase 2)
```

Each package directory ships only a `package.json` stub for now. No src, no tests. Phase 1 prompts in `docs/proto-master.md` §15 drive the actual implementation.

## CLAUDE.md contents (summary)

Four sections:

1. **Product invariants** — designer-first copy, no engineering jargon in user-facing output, Proto component library only outside `proto-components`, `proto.config.js` is the sole designer-touchable file, no generated-code comments.
2. **Repo conventions** — pnpm workspaces, TS+ESM, Node 18+, Vitest beside source as `*.test.ts`, Biome for lint/format.
3. **Skill mandates** — brainstorming (always before creative work), TDD (CLI/server/error-translation only), verification-before-completion, systematic-debugging, claude-api (when touching `@anthropic-ai/sdk`), frontend-design (Phase 3 web only).
4. **MCP usage rules** — context7 for Expo/RN/Anthropic SDK docs, figma-console for token parity and mockups, playwright reserved for Phase 3 `proto.run`, ide for TS diagnostics.

## Memory seeds

Four entries under `/Users/sherizan/.claude/projects/-Users-sherizan-Public-proto/memory/`:

- `user_sheri.md` — role and design taste, builds designer-facing tools
- `project_proto.md` — what Proto is, 3-phase roadmap, remote location, source-of-truth doc pointer
- `feedback_tdd_scope.md` — TDD strict on logic, skip RN components, why
- `reference_master_doc.md` — `docs/proto-master.md` is canonical, §15 has Claude Code prompts indexed by phase

Plus a `MEMORY.md` index.

## Out of scope (deferred)

- Any source code in `packages/*` or `apps/proto-app/` — Phase 1 work.
- CI / GitHub Actions — added once first package has tests.
- Husky / pre-commit hooks — not until lint config is exercised.
- `proto.run` repo — separate concern, Phase 3.

## Acceptance

- `git status` is clean after the initial commit.
- `CLAUDE.md` is present at project root and references all relevant skills and MCPs.
- `pnpm install` runs cleanly with the workspace shell (no packages to build yet).
- Memory directory has 4 seed files plus a `MEMORY.md` index.
- Remote `origin` points to `git@github.com:sherizan/proto.git`. Nothing is pushed.

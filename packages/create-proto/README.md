# create-proto

Scaffold a new Prototo prototype:

```bash
npm create proto@latest myapp
```

> The npm package is `create-proto` (and the CLI bin is `proto`) for historical reasons. The brand and product name is **Prototo** — that's what designers see in the banner, in the iOS nav bar, and at [prototo.app](https://prototo.app).

## What Prototo is

A prompt-native design environment. The iOS Simulator is the canvas. Claude Code CLI is the design tool. The designer describes what they want; native iOS UI appears in the Simulator, with Apple's real Liquid Glass on iOS 26+.

No canvas. No IDE. No engineering concepts.

## What this command does

1. Scaffolds the project: `DESIGN.md` (design system source-of-truth), `CLAUDE.md` (Claude Code instructions for Prototo-aware generation), Prototo component library, a starter Welcome screen
2. Installs dependencies (Expo SDK 55, React Native, Reanimated 4, `@expo/ui`, `expo-glass-effect`, `expo-clipboard`)
3. Auto-launches Metro and opens the iOS Simulator

Then in another terminal:

```bash
cd myapp
claude
> add a liquid glass bottom tab bar with Home, Explore, Library, Profile tabs
```

Claude reads `CLAUDE.md`, generates `app/_layout.tsx` using Apple's native `UITabBar` via `expo-router/unstable-native-tabs`, and the Simulator hot-reloads.

## Requirements

- macOS with Xcode + iOS Simulator (Simulator is the canvas)
- Node.js 18+
- Claude Code installed (`npm i -g @anthropic-ai/claude-cli`)

## Learn more

- Website: [prototo.app](https://prototo.app)
- Source: [github.com/sherizan/proto](https://github.com/sherizan/proto)

## License

MIT

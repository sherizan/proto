# Prototo App — Custom Dev Client

The custom Expo dev client published as **Prototo**. Required for rendering Apple's real Liquid Glass material on physical iOS devices — Expo Go's stock binary doesn't paint it even when the JS-side detection succeeds.

See spec: `docs/superpowers/specs/2026-05-25-prototo-app-dev-client-design.md`.

## Status

Scaffolding ready. First EAS Build pending — needs manual `eas login` and an EAS project ID (one-time).

## Native modules baked in

All from Expo SDK 55 (same versions as the project template, so any Proto prototype runs identically in this dev client):

- `expo-glass-effect` — Liquid Glass (`GlassView`, `isLiquidGlassAvailable`)
- `expo-blur` — fallback blur for iOS <26
- `@expo/ui` — SwiftUI primitives
- `expo-haptics`
- `expo-router`
- `react-native-reanimated` + `react-native-worklets`
- `react-native-screens`
- `react-native-gesture-handler`
- `react-native-safe-area-context`

## One-time setup

```bash
# 1. Install eas-cli globally
npm install -g eas-cli

# 2. Log in with your Apple-linked Expo account
eas login

# 3. Initialise the EAS project (creates a projectId in eas.json's owner field)
cd apps/prototo-app
eas init

# 4. Install JS deps
pnpm install
```

## Build for your device (first time)

```bash
cd apps/prototo-app
pnpm build:ios
```

This calls `eas build --platform ios --profile development`. EAS Build returns an internal-distribution URL after ~15-30 minutes. Open the URL on your iPhone in Safari → tap Install → Prototo appears on your home screen.

Phone must be registered with your Apple Developer account first. EAS will walk you through registering UDIDs on first build.

## Test in iOS Simulator (faster iteration)

```bash
cd apps/prototo-app
pnpm build:ios:sim
```

Builds a Simulator-compatible binary (`development-simulator` profile). EAS returns a tarball; install with `xcrun simctl install booted path/to/Prototo.app`. Faster than device for iterating on native config.

## Launching a Proto prototype in Prototo App

Once Prototo App is installed on your device:

```bash
cd path/to/your/prototype
proto start
```

The Step 2 QR uses the `prototo://` scheme — scanning it with Camera opens Prototo App directly, no Expo Go required. Prototo App connects to Metro on your Mac and renders the prototype with real Liquid Glass.

(`proto start --simulator` opens the prototype in iOS Simulator instead. Useful for fast iteration without rebuilding the dev client.)

## Files

| Path | What |
|---|---|
| `app.json` | Prototo branding: name, `com.sherizan.prototo` bundle ID, `prototo://` scheme, iOS 26 deployment target |
| `eas.json` | `development` and `development-simulator` build profiles |
| `app/index.tsx` | Landing screen shown when no dev server is connected. Includes a Liquid Glass diagnostic so you can verify the binary actually paints the material. |
| `babel.config.js` | Standard Expo babel + worklets plugin (required by Reanimated 4) |
| `metro.config.js` | Standard Expo Metro defaults |

## Updating bundled SDK versions

When Expo SDK 55 bumps to 56: re-pin deps in `package.json`, run `npx expo install --check`, then `pnpm build:ios` to publish a new dev client build. Each major bump requires re-install on your device.

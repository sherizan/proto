# @sherizan/proto-cli

The Proto CLI. Inside a Proto project, runs Metro and opens the iOS Simulator with your prototype.

> **You usually don't install this directly.** It's a transitive dependency of `create-proto` and ships pre-wired in every Proto project scaffold. Just run `npm create proto@latest myapp` and you have `proto` available.

## Commands

```bash
proto start         # boot Metro + open iOS Simulator with the prototype
proto new-screen    # scaffold a new screen
proto reset         # clear caches if Metro misbehaves
proto design        # interactive: theme + accent + component library
```

## Requirements

- macOS with Xcode + iOS Simulator (for the Simulator preview)
- Node.js 18+
- Run from inside a Proto project (one created via `npm create proto@latest`)

## What `proto start` does

1. Kills any stale Metro on port 8081
2. Starts Proto's prompt server on port 3001
3. Spawns `npx expo start --ios` — Expo's native output prints below

That's it. Designers see Expo's real QR + dev menu. No wrapper theater.

## Learn more

- Product overview and architecture: see the [Proto repo](https://github.com/sherizan/proto)

## License

MIT

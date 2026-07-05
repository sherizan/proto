# Changelog — what shipped

> **Designer-facing release notes for Prototo (the CLI + iOS app).** This file is the source of truth
> for the "Release notes" section on the prototo.app landing page — the website's `update-changelog`
> skill copies new dated entries from here into its `RELEASES` array. Curate entries *here*, when the
> work is fresh, so the website just mirrors them.
>
> For engineering state → `STATUS.md`. For future ideas → `BACKLOG.md`. For risks → `RISKS.md`.

## How to write entries

- **Designer voice. Lead with what the designer gets, not how it works.** "Add libraries safely with one
  command." not "wrap expo install with peer-resolution." If a change is purely internal (refactors,
  tests, token plumbing, doc edits), it does **not** belong here.
- Each item is one tight sentence, typed **New** / **Improved** / **Fixed**. Within a day, list New first,
  then Improved, then Fixed.
- No em dashes, no "not X but Y", no AI tells (seamless, elevate, unlock, powerful, robust). Sentence case.
- Newest first. Work that hasn't shipped to designers yet lives under **Unreleased**; on release, move it
  under a dated heading (format: `May 28, 2026`) and bump the version.

## July 5, 2026

- **Improved:** proto share publishes your prototype straight to your account, so sharing works as soon as you sign in.
- **Fixed:** proto start sets up the iPhone Simulator on a new Mac for you, instead of stopping with an error.
- **Fixed:** Signing in from proto login now completes every time, including with Google.

## June 18, 2026

- **New:** Rotate your prototype to landscape, or lock a screen to portrait or landscape, with screen orientation.

## June 17, 2026

- **New:** Run `proto upgrade` to update Prototo to the latest version in one step.
- **New:** Prototo now tells you when an update is ready, and what's new, when you run proto start.

## June 16, 2026

- **New:** Record your prototype right in the Simulator with `proto record`. It captures the screen, then opens Studio where you wrap it and export a clip to share. Free records up to 30 seconds, Plus up to 3 minutes.

## June 14, 2026

- **New:** Share a prototype with `proto share`. It gives you a link anyone can open in their browser to watch the real thing run live, no install needed.

## June 13, 2026

- **New:** Sign in with `proto login` so the prototypes you share are saved to your account.
- **Fixed:** Sharing a prototype works again now that it signs you in first.

## June 11, 2026

- **Improved:** Prototo now runs on the newest Expo and React Native, so prototypes get the latest native components and fixes.
- **Improved:** Existing projects keep working as they are. To pick up the new foundation, create a fresh project with `npm create proto@latest`.

## June 10, 2026

- **New:** Add images, video, maps, location, the camera, and sound to any prototype — no setup needed.
- **New:** Add extra tools to a prototype safely — Prototo picks the right version for you and lets you know if it needs a newer app first.
- **New:** Use vector graphics and SVG icons anywhere in your designs.
- **New:** Dark mode: every prototype automatically matches the device's light or dark setting.
- **Improved:** Prototo now checks its own screens and catches layout and contrast problems before you see them.
- **Improved:** Choose from three built-in themes, including a clean, minimal one.

## May 28, 2026

- **Fixed:** Fixed broken placeholder images that stopped fresh projects from building.
- **Fixed:** Fixed a packaging issue that could break installs of new projects.

## May 27, 2026

- **New:** Motion, gestures, Lottie animations, and canvas drawing, built into every new prototype.
- **New:** New projects scaffold with a DESIGN.md so Claude Code follows your design system from the first prompt.
- **Fixed:** Deep imports inside your project resolve correctly again.

## May 26, 2026

- **Improved:** Cleaner welcome screen with copy written for designers.
- **Improved:** Cold launch drops you straight to your running dev servers.
- **Fixed:** Live preview connects reliably on the same Wi-Fi network.

## May 25, 2026

- **New:** Viewer mode: open a shared prototype straight from a link on your device.
- **New:** Real app icon and splash screen.
- **Fixed:** New project setup works smoothly with the latest pnpm.

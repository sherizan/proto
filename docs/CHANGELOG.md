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

## June 10, 2026

- **New:** Images, video, maps, location, the camera, and audio now work in every prototype with no setup.
- **New:** Add libraries the safe way with `proto add` — it installs the version that fits your project and tells you if something needs a newer Prototo.
- **New:** Draw with SVG: use vector shapes in a screen or drop in an `.svg` file.
- **New:** Dark mode: every prototype follows the device's light or dark setting automatically, or pin one in `proto.config.js`.
- **Improved:** Prototo now checks its own work on the Simulator, so overlap and contrast problems get caught before you see them.
- **Improved:** Pick from three themes that actually render what the design notes describe, including a clean Base theme.

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

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

## Unreleased


## September 25, 2026

- **Improved:** Your flow link shows which button goes where. Export flow again and each link leaves the screen at its button, outlined on the picture; several links into one screen join into a single arrow, and a header button counts too.
- **Fixed:** Adding a library that needs a build step (like Skia) no longer leaves your project reporting an error on every install. `proto add` allows the build and installs again; `proto start` and `proto upgrade` repair projects that were already affected.
- **New:** A remix remembers where it came from. Publish a remix and the share page, the link preview, and your team page all say which prototype it was made from and by whom.
- **New:** Your share link shows the prototype itself. When you publish with the Simulator running, a picture of the screen goes with it, on the share page, in the link preview when you paste it into iMessage or Slack, and in your library.
- **New:** On a Team plan, publishing asks where it goes: Team, so everyone on your team sees it, or Just me. In the terminal, `proto share --private` keeps one to yourself.
- **New:** Remix a teammate's prototype. On a Team plan, every prototype anyone publishes shows up on your team page, and `proto remix <link>` gives you your own copy to build on. It gets its own link the first time you share it.
- **New:** Prototypes can react to motion. Tilt, shake, and step counting work in the Prototo app on iPhone. The Simulator has no motion sensors, so publish and open the link on your phone to feel it.
- **New:** Prototypes now run on Expo SDK 57 and React Native 0.86. New projects, the Simulator, and the Prototo app on iPhone all move together; run proto start once and the Simulator updates itself.
- **Improved:** Animations and gestures use less memory. The previous release could balloon memory use in prototypes with motion, which is fixed in this one.
- **Improved:** Sliders and toggles now follow the value your code sets, even after you have dragged them.
- **Fixed:** After this update, prototypes shared before it show "made with an older version of Prototo" in the app. Run proto share again on the project and the link works as before.
- **New:** Point and edit in Prototo Desktop. Turn on the preview's accessibility overlay, tap any element, and a tag naming it (with the screen file and line that draws it) appears right in the terminal prompt. Keep typing what you want changed and press Enter.
- **Improved:** Point and edit answers faster, so the screen file and line usually land before you start typing.
- **Improved:** In the Prototo app, a prototype that its designer has since removed is tagged Removed in Recently viewed instead of looking live until you tap it.
- **Fixed:** On the newest Xcode, proto start brings the Simulator window forward again after starting it.

## July 14, 2026

- **New:** New projects now work with OpenAI Codex as well as Claude Code. Both agents get the same design instructions and the same preview tools, so you can build with the AI subscription you already have.
- **Improved:** Your existing projects gain Codex support automatically the next time you run proto start. Nothing to reinstall or re-create.
- **Fixed:** Project notes now describe sharing correctly: your link opens in the free Prototo app on iPhone, running natively, instead of the retired browser stream.

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

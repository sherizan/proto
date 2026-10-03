# Coffee Club visual study

Hand-authored native fixture, not a fresh-model evaluation or a published prototype.
The original Coffee Club and both cloud studies remain unchanged.

Overlay `app/`, `screens/` and `components/shared/` onto a disposable current
scaffold with the profile typography and purchase-footer components. Write
`module.exports = <contents of config.json>;` to its `proto.config.js`.
Remove unrelated sample routes from the disposable scaffold. The configuration
is Warm 1.0.0 with explicit espresso/cream/forest overrides. No dependencies or
native modules are added; the inspected runtime uses Skia 2.6.2 / prototo-57.
If sharing a node_modules tree across temporary projects, clear Metro's export
cache to prevent stale router-context transforms from another fixture.

The menu and customizer use original Skia artwork and a static gradient/grain/contour
shader, rendered once to bounded CPU surfaces and displayed by expo-image. The
cup is rendered at 284×320 and textures at 768×768; a six-entry cache is keyed by
artwork/palette. Pictures, surfaces and snapshots are disposed after encoding.
No asset network calls or continuous animation clock are used. The shader compiles
once and retains a solid-background fallback. `/effects-off` disables the texture
while retaining the cup. This avoids the observed live-Canvas disappearance; it
does not fix or validate animated Skia canvas lifecycle behavior.

The menu uses native `headerLargeTitleEnabled` with a transparent header. Native
navigation colours follow the app theme. Drink detail stays on the outer stack,
and its back button uses the minimal system style. Labels and controls remain
native and scale with Dynamic Type. Large text simplifies decorative copy, stacks
fields and replaces overflowing count/segmented controls with native menus.
The four products and pricing formula are unchanged from Coffee Club.

## References inspected

- [Blue Bottle menu](https://mobbin.com/screens/65c88b8a-c071-4490-83e5-96de5acaa9c2):
  product rows, restrained hierarchy, thin separators. Adapted as a compact menu
  below one house-favourite feature, using original artwork instead of its images.
- [Blue Bottle customizer](https://mobbin.com/screens/1b5b278f-cff2-4ded-b621-db42f8ad2a86):
  short labels and compact choices with the final action below. Adapted with
  Prototo native pickers/steppers and the adaptive purchase footer.
- [Starbucks order review](https://mobbin.com/screens/fc1bb3fe-0d52-4819-a13a-526f9abc3ad4):
  strong pickup context and a prominent checkout total/action. Adapted as concise
  pickup copy and a visible derived total. No logo, screenshot or exact branded
  composition is embedded in this fixture.

The espresso gradient, contour shader and cup illustration are original design
choices; the reference captures do not establish Skia use or motion behavior.
The third search requested a Starbucks home screen but returned customization
and review screens; it is not evidence of Starbucks home artwork.

Skia API reference: [runtime shaders](https://shopify.github.io/react-native-skia/docs/shaders/overview/).

## Native verification, 2026-10-02

On isolated iPhone 17 Pro / iOS 26.5, runtime prototo-57, Expo Router 57.0.24,
react-native-screens 4.26.2:

- TypeScript and cleared iOS export pass.
- Native title expands, collapses on scrolling and expands again.
- Three programmatic push/back cycles, two native back-button cycles, two
  swipe-back cycles, native tab switching and dark-mode swipe-back pass.
- The static artwork remains visible after route replacement, push/back,
  appearance changes and the disabled-effect check.
- Maximum text size keeps labels within width, changes crowded controls to menus,
  and permits scrolling to the derived total and Review order action.
- An isolated same-stack detail control passed three push/back cycles with both
  current and deprecated title options. Therefore this test did not reproduce
  the old freeze or establish its cause. The temporary control route is removed.

The old guard remains in general scaffolds and ManifestRenderer. These local
passes are a scoped exception for this study, not proof that the historic freeze
is fixed everywhere. Phone acceptance, VoiceOver, fresh-model adherence and
broader runtime regression checks remain open. No native module upgrade or
runtime patch was made. No live project was changed or published.

Review: `docs/coffee-club-visual-review.html` at the repository root.
Native interaction recording: `docs/coffee-native-navigation.mp4`.

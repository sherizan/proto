# Shared loading primitive study

Copy `screen.tsx` to `app/loading-study.tsx` in a disposable scaffold containing
Skeleton/SkeletonBlock. This is an explicit state lab, not a network-backed menu.
Query modes: loading, static (shimmer disabled), inactive (region not visible),
fast (50 ms simulated initial response), loaded, refresh (retains content), error
(Retry simulates a successful response), and empty. Production examples must
connect state to a real request and never introduce these artificial delays.

Use `Skeleton` for initial data loading, with composed `SkeletonBlock` shapes in
`placeholder` and loaded UI in `children`. Children are unmounted while loading.
Keep loading images mounted beside an overlay so their load/error handlers fire.
Use `loading={pending && !data && !error}` to retain previous data on refresh.
The shapes' dimensions belong to the app composition, including Dynamic Type.

Native animation uses one clock per region, an 180 ms reveal threshold and a
1600 ms sweep. Reduce Motion defaults to enabled until the system check resolves;
live changes and app background state stop animation. `active` must reflect route
focus or list viewability; the component cannot infer whether its region is
outside a scroll viewport. `shimmer={false}` selects static shapes explicitly.
No minimum display duration delays ready content. Request cancellation, errors,
timeouts, retries and empty-state content remain the data layer's responsibility.

API references: [Animated](https://reactnative.dev/docs/animated),
[AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo),
[AppState](https://reactnative.dev/docs/appstate).


Verified locally, 2026-10-02: TypeScript and cleared iOS export; native iPhone 17
Pro/iOS 26.5 captures of loading, static, inactive, loaded, fast, refresh, error,
empty, dark and scrolled maximum text. Loading-region frame comparison changes
2,113,191 RGB channels between samples; static and inactive comparisons change
zero. This confirms motion/static behavior, not frame-rate or power performance.
Review and recording: `docs/skeleton-loading-review.html` and
`docs/skeleton-loading.mp4`. OS Reduce Motion switching, background/resume and
VoiceOver acceptance are still unverified interactively. No live prototype changed.

export const messages = {
  startingHeader: 'Proto',
  noConfig: 'Run this inside a Proto project.',
  portInUse:
    'Proto is already running in another window. Close it first, then try again.',
  stoppedPrevious: 'Stopped a previous Proto session.',
  componentNotFound:
    "A component couldn't be found. Run: proto reset",
  screenSyntax:
    'A screen has an error. Run: proto edit <screen-name> "fix any errors"',
  noDeviceConnection:
    "Can't reach your device. Check you're on the same WiFi.",
  generic: 'Something went wrong. Run: proto reset',
  noScreenName: 'Give your screen a name. Like: proto new-screen Profile',
  invalidScreenName:
    'That name has characters that cause trouble. Use letters and hyphens.',
  screenExists: (name: string) =>
    `A screen named "${name}" already exists. Pick a different name or delete it first.`,
  screenCreated: (name: string) => `${name} screen created → it's live on your device`,
  resetting: 'Resetting Proto',
  resetDone: 'Proto reset. Run: proto start',
  designIntro: 'Proto',
  designThemePrompt: 'Which theme?',
  designAccentPrompt: 'Accent colour?',
  designLibraryPrompt: 'Component library?',
  designCustomPackagePrompt: 'Custom library package name?',
  designCustomDocsPrompt: 'Docs URL (optional, press enter to skip)',
  designAppNamePrompt: 'App name?',
  designOverwritePrompt: 'Update existing design system?',
  designInstalling: 'Installing component library',
  designInstallDone: 'Component library installed',
  designInstallFailed: "Couldn't install the component library. Try again, or pick Proto.",
  designCustomInstallHint: (cmd: string) =>
    `When you're ready, tell Claude Code: "install the component library with ${cmd}"`,
  designReadyTitle: 'Design system ready',
  designReadyHint:
    'Open Claude Code and start designing. Try: "add a settings screen with a dark mode toggle"',
  designUpdateHint:
    "Tell Claude Code what to change, e.g. 'update DESIGN.md, change accent to indigo'",
  designCancelled: 'Cancelled.',
  designKeptExisting: 'Kept the existing design system.',
  step1Header: 'Step 1 — Install Proto on your phone (one-time)',
  step1Body:
    'Open Safari on your phone, scan the QR to install Proto.\nProto is signed by your developer account — first launch will need\na one-time Trust step in Settings → General → VPN & Device Management.\nAlready installed? Skip to Step 2.',
  step2Header: 'Step 2 — Open your prototype',
  step2Body:
    'Open Camera, scan the QR. Proto launches and loads your prototype.\nFirst load takes 10–30s while Metro bundles.',
  nextStepsHeader: 'Next, in another terminal:',
  nextStepsBody:
    '→ cd <project>\n→ claude\n→ Add liquid glass bottom toolbar with placeholder screens',
  metroRunning: 'Proto is running. Press Ctrl+C to stop.',
};

export type Messages = typeof messages;

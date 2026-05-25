export const messages = {
  startingHeader: 'Prototo',
  noConfig: 'Run this inside a Prototo project.',
  portInUse:
    'Prototo is already running in another window. Close it first, then try again.',
  stoppedPrevious: 'Stopped a previous Prototo session.',
  componentNotFound:
    "A component couldn't be found. Run: proto reset",
  screenSyntax:
    'A screen has an error. Run: proto edit <screen-name> "fix any errors"',
  noDeviceConnection:
    "Can't reach your device. Check you're on the same WiFi.",
  installingPrototoApp: 'Setting up Prototo on the Simulator…',
  startingSimulator: 'Starting iOS Simulator…',
  // Surfaced by Prototo App's in-app version check at bundle-load time. The
  // CLI-side trigger (silence detection after QR scan) is not implemented yet
  // — see 2026-05-25 dev-client spec § Version-mismatch handling.
  prototoAppOutdated:
    'This project needs a newer Prototo. Update Prototo from the App Store and try again.',
  prototoSimulatorOffline:
    "The Simulator's Prototo is older than this project. Connect to the internet, then run proto start to refresh it.",
  prototoHashMismatch:
    "Couldn't verify the downloaded Prototo (hash mismatch). Run proto start again to retry.",
  prototoInstallFailed:
    "Couldn't install Prototo on the Simulator. Run proto start again to retry.",
  shareStarting: 'Setting up your share…',
  shareTunnelStarting: 'Starting tunnel…',
  shareLive: (url: string) => `Your prototype is live\n  ${url}`,
  shareScanCopy: 'Scan to open on any device:',
  shareKeepRunning: 'Keep Prototo running while they view it.',
  shareDesignerNamePrompt: 'What should we call you when sharing prototypes?',
  shareRateLimited: "You've shared a lot recently. Try again in an hour.",
  shareApiUnreachable: "Can't reach Prototo's share service. Check your internet and try again.",
  shareTunnelFailed: "Couldn't start the share tunnel. Run proto share again to retry.",
  generic: 'Something went wrong. Run: proto reset',
  noScreenName: 'Give your screen a name. Like: proto new-screen Profile',
  invalidScreenName:
    'That name has characters that cause trouble. Use letters and hyphens.',
  screenExists: (name: string) =>
    `A screen named "${name}" already exists. Pick a different name or delete it first.`,
  screenCreated: (name: string) => `${name} screen created → it's live on your device`,
  resetting: 'Resetting Prototo',
  resetDone: 'Prototo reset. Run: proto start',
  designIntro: 'Prototo',
  designThemePrompt: 'Which theme?',
  designAccentPrompt: 'Accent colour?',
  designLibraryPrompt: 'Component library?',
  designCustomPackagePrompt: 'Custom library package name?',
  designCustomDocsPrompt: 'Docs URL (optional, press enter to skip)',
  designAppNamePrompt: 'App name?',
  designOverwritePrompt: 'Update existing design system?',
  designInstalling: 'Installing component library',
  designInstallDone: 'Component library installed',
  designInstallFailed: "Couldn't install the component library. Try again, or pick Prototo.",
  designCustomInstallHint: (cmd: string) =>
    `When you're ready, tell Claude Code: "install the component library with ${cmd}"`,
  designReadyTitle: 'Design system ready',
  designReadyHint:
    'Open Claude Code and start designing. Try: "add a settings screen with a dark mode toggle"',
  designUpdateHint:
    "Tell Claude Code what to change, e.g. 'update DESIGN.md, change accent to indigo'",
  designCancelled: 'Cancelled.',
  designKeptExisting: 'Kept the existing design system.',
};

export type Messages = typeof messages;

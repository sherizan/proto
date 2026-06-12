export const messages = {
  startingHeader: 'Prototo',
  noConfig: 'Run this inside a Prototo project.',
  portInUse: 'Prototo is already running in another window. Close it first, then try again.',
  stoppedPrevious: 'Stopped a previous Prototo session.',
  componentNotFound: "A component couldn't be found. Run: proto reset",
  screenSyntax: 'A screen has an error. Run: proto edit <screen-name> "fix any errors"',
  noDeviceConnection: "Can't reach your device. Check you're on the same WiFi.",
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
  sharePublishing: 'Publishing your prototype… this takes a moment.',
  sharePublishFailed:
    "Couldn't publish your prototype for sharing. Make sure it runs with proto start, then try again.",
  shareLive: (url: string) => `Your prototype is live\n  ${url}`,
  shareScanCopy: 'Scan to open on any device:',
  shareKeepRunning: 'Keep Prototo running while they view it.',
  shareDesignerNamePrompt: 'What should we call you when sharing prototypes?',
  shareRateLimited: "You've shared a lot recently. Try again in an hour.",
  shareApiUnreachable: "Can't reach Prototo's share service. Check your internet and try again.",
  shareBadInput:
    'Something looked off in your project. Check your proto.config.js name + theme, then run proto share again.',
  shareTunnelFailed: "Couldn't start the share tunnel. Run proto share again to retry.",
  shareCompileFailed: (errors: string[]) =>
    `Some screens can't be shared yet:\n${errors.map((e) => `  • ${e}`).join('\n')}\nA shared prototype only includes the parts that render the same for everyone. Adjust those screens, then run proto share again.`,
  shareWarnings: (warnings: string[]) => `Heads up:\n${warnings.map((w) => `  • ${w}`).join('\n')}`,
  nativeNeedsPrototoUpdate: (pkgs: string[]) =>
    `${pkgs.join(', ')} ${pkgs.length === 1 ? 'needs a feature' : 'need features'} this Prototo doesn't have yet — ${pkgs.length === 1 ? "it won't" : "they won't"} appear on your device. Ask the Proto team to add ${pkgs.length === 1 ? 'it' : 'them'}.`,
  addInstalling: (pkgs: string[]) => `Adding ${pkgs.join(', ')}…`,
  addDone: (pkgs: string[]) => `Added ${pkgs.join(', ')}.`,
  addNothing: 'Tell me what to add. Like: proto add react-native-svg',
  addFailed: "Couldn't add that. Check the name and your internet, then try again.",
  shotNoSimulator: 'No preview is running yet. Run proto start first, then capture the screen.',
  shotFailed:
    "Couldn't capture the Simulator screen. Make sure the preview is running, then try again.",
  shotSaved: (p: string) => `Captured the screen → ${p}`,
  generic: 'Something went wrong. Run: proto reset',
  noScreenName: 'Give your screen a name. Like: proto new-screen Profile',
  invalidScreenName: 'That name has characters that cause trouble. Use letters and hyphens.',
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

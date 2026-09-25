export const messages = {
  startingHeader: 'Prototo',
  noConfig: 'Run this inside a Prototo project.',
  portInUse: 'Prototo is already running in another window. Close it first, then try again.',
  stoppedPrevious: 'Stopped a previous Prototo session.',
  componentNotFound: 'A component couldn’t be found. Run: proto reset',
  screenSyntax: 'A screen has an error. Run: proto edit <screen-name> "fix any errors"',
  noDeviceConnection: 'Can’t reach your device. Check you’re on the same WiFi.',
  installingPrototoApp: 'Setting up Prototo on the Simulator…',
  startingSimulator: 'Starting iOS Simulator…',
  installingIOSRuntime:
    'Setting up the iOS 26 Simulator — a one-time step, needed for Liquid Glass. This downloads a few GB and can take several minutes…',
  iosRuntimeManualStep:
    'Prototo needs the iOS 26 Simulator (for Liquid Glass) and couldn’t set it up automatically.\n  1. Open Xcode once and let it finish installing.\n  2. In Terminal run: xcodebuild -downloadPlatform iOS\nThen run proto start again.',
  noIOSSimulatorDevice:
    'Couldn’t find an iPhone Simulator to open. In Xcode → Settings → Components, add an iPhone, then run proto start again.',
  // Surfaced by Prototo App's in-app version check at bundle-load time. The
  // CLI-side trigger (silence detection after QR scan) is not implemented yet
  // — see 2026-05-25 dev-client spec § Version-mismatch handling.
  prototoAppOutdated:
    'This project needs a newer Prototo. Update Prototo from the App Store and try again.',
  prototoSimulatorOffline:
    'The Simulator’s Prototo is older than this project. Connect to the internet, then run proto start to refresh it.',
  prototoHashMismatch:
    'Couldn’t verify the downloaded Prototo (hash mismatch). Run proto start again to retry.',
  prototoInstallFailed:
    'Couldn’t install Prototo on the Simulator. Run proto start again to retry.',
  loginOpening: 'Opening your browser to sign in…',
  loginSuccess: 'You’re signed in.',
  loginTimedOut: 'Sign-in timed out. Run proto login to try again.',
  loginFailed: 'Sign-in didn’t complete. Run proto login to try again.',
  shareStarting: 'Setting up your share…',
  sharePublishing: 'Publishing your prototype… this takes a moment.',
  shareUploading: 'Uploading your prototype…',
  flowStarting: 'Setting up your flow…',
  flowUploading: 'Uploading your flow…',
  flowEmpty: 'No screens in this project yet. Ask your agent to add one, then export again.',
  flowFailed: 'Couldn’t export your flow right now. Please try again in a moment.',
  // "Your flow is live" + the /f/ URL: Prototo Desktop parses this (CONTRACTS.md).
  flowLive: (url: string) => `Your flow is live\n  ${url}`,
  flowOwnerMismatch: 'That flow link belongs to another account.',
  shareCapturingScreens: (done: number, total: number) =>
    `Capturing your screens… ${done} of ${total}`,
  sharePublishFailed:
    'Couldn’t publish your prototype for sharing right now. Please try again in a moment.',
  shareLive: (url: string) => `Your prototype is live\n  ${url}`,
  shareScanCopy: 'Scan to open on any device:',
  shareNeedsLogin: 'First, let’s sign you in so your shares are saved to your account.',
  shareLoginExpired: 'Your sign-in expired. Run proto login, then share again.',
  // The phrase "publish trial has ended" is a contract: Prototo Desktop
  // regex-matches it in this command's stdout to show its upgrade modal
  // (CONTRACTS.md). Change it and the desktop must change with it.
  sharePublishTrialEnded: (url: string) =>
    `Your 7-day Publish trial has ended. Upgrade to Plus ($8/mo or $80/yr) to keep publishing.\n  Upgrade at ${url}`,
  // "Publish trial has started" is likewise a desktop stdout contract
  // (CONTRACTS.md): it turns into the trial caption on the publish modal.
  shareTrialStarted: (endsAt: string | undefined, url: string) => {
    const until = endsAt
      ? ` Publishing is free until ${new Date(endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.`
      : ' Publishing is free for 7 days.';
    return `Your free 7-day Publish trial has started.${until}\n  Upgrade anytime at ${url}`;
  },
  shareOwnerMismatch: 'That share link belongs to another account.',
  shareRateLimited: 'You’ve shared a lot recently. Try again in an hour.',
  shareApiUnreachable: 'Can’t reach Prototo’s share service. Check your internet and try again.',
  shareBadInput:
    'Something looked off in your project. Check your proto.config.js name + theme, then run proto share again.',
  shareCompileFailed: (errors: string[]) =>
    `Some screens can’t be shared yet:\n${errors.map((e) => `  • ${e}`).join('\n')}\nA shared prototype only includes the parts that render the same for everyone. Adjust those screens, then run proto share again.`,
  shareWarnings: (warnings: string[]) => `Heads up:\n${warnings.map((w) => `  • ${w}`).join('\n')}`,
  nativeNeedsPrototoUpdate: (pkgs: string[]) =>
    `${pkgs.join(', ')} ${pkgs.length === 1 ? 'needs a feature' : 'need features'} this Prototo doesn’t have yet — ${pkgs.length === 1 ? 'it won’t' : 'they won’t'} appear on your device. Ask the Proto team to add ${pkgs.length === 1 ? 'it' : 'them'}.`,
  addInstalling: (pkgs: string[]) => `Adding ${pkgs.join(', ')}…`,
  addDone: (pkgs: string[]) => `Added ${pkgs.join(', ')}.`,
  addNothing: 'Tell me what to add. Like: proto add react-native-svg',
  addFailed: 'Couldn’t add that. Check the name and your internet, then try again.',
  recordNeedsLogin: 'First, let’s sign you in so your recording saves to your account.',
  recordNoSimulator: 'No preview is running yet. Run proto start first, then record.',
  recordStarted: 'Recording — press Enter to stop early.',
  recordSaving: 'Saving recording…',
  recordUploading: 'Uploading your recording…',
  recordSaved: (url: string) =>
    `Recording saved — opening Studio\n  ${url}\n\nWrap it. Export it. Post it.`,
  recordFailed:
    'Couldn’t start recording. Close any other Simulator recording, then run proto record again.',
  recordUploadFailed: 'Couldn’t save recording. Check your connection and try again.',
  recordLoginExpired: 'Your sign-in expired. Run proto login, then record again.',
  recordRateLimited: 'You’ve recorded a lot recently. Try again in a bit.',
  shotNoSimulator: 'No preview is running yet. Run proto start first, then capture the screen.',
  shotFailed:
    'Couldn’t capture the Simulator screen. Make sure the preview is running, then try again.',
  shotSaved: (p: string) => `Captured the screen → ${p}`,
  // Proto MCP — designer-friendly compile_check results. Audience is Claude Code
  // (not the designer), so naming the screen file is intentional + helpful.
  compileNoErrors: 'No errors.',
  compileImportError: (file: string) =>
    `A component import couldn’t be resolved in ${file}. Check the import path.`,
  compilePropError: (file: string) => `A prop doesn’t match what the component expects in ${file}.`,
  compileTypeError: (file: string) => `A value type mismatch in ${file}.`,
  compileGenericError: (file: string) => `A type error in ${file}. Ask Claude Code to fix it.`,
  compileUnavailable:
    'Couldn’t type-check the project. Make sure proto start has run at least once, then try again.',
  metroClean: 'Metro is running cleanly. No active errors.',
  reloadDone: 'App restarted. The prototype is reloading from Metro.',
  reloadNoSimulator: 'No booted Simulator. Run proto start first.',
  reloadLaunchFailed: 'Couldn’t restart the app. Is the Prototo app installed? Run proto start.',
  generic: 'Something went wrong. Run: proto reset',
  noScreenName: 'Give your screen a name. Like: proto new-screen Profile',
  invalidScreenName: 'That name has characters that cause trouble. Use letters and hyphens.',
  screenExists: (name: string) =>
    `A screen named "${name}" already exists. Pick a different name or delete it first.`,
  screenCreated: (name: string) => `${name} screen created → it’s live on your device`,
  resetting: 'Resetting Prototo',
  resetDone: 'Prototo reset. Run: proto start',
  designIntro: 'Prototo',
  designThemePrompt: 'Which theme?',
  designAccentPrompt: 'Accent colour?',
  designLibraryPrompt: 'Component library?',
  designCustomPackagePrompt: 'Custom library package name?',
  designCustomDocsPrompt: 'Docs URL (optional, press enter to skip)',
  designPackageNameRequired: 'Enter a package name',
  designAppNameRequired: 'Enter an app name',
  designAppNamePrompt: 'App name?',
  designOverwritePrompt: 'Update existing design system?',
  designInstalling: 'Installing component library',
  designInstallDone: 'Component library installed',
  designInstallFailed: 'Couldn’t install the component library. Try again, or pick Prototo.',
  designCustomInstallHint: (cmd: string) =>
    `When you’re ready, tell Claude Code: "install the component library with ${cmd}"`,
  designReadyTitle: 'Design system ready',
  designReadyHint:
    'Open Claude Code and start designing. Try: "add a settings screen with a dark mode toggle"',
  designUpdateHint:
    'Tell Claude Code what to change, e.g. "update DESIGN.md, change accent to indigo"',
  designCancelled: 'Cancelled.',
  designKeptExisting: 'Kept the existing design system.',
  updateAvailable: (current: string, latest: string, highlights: string[]) => {
    const head = `✨ Prototo ${latest} is here — you have ${current}. Run proto upgrade to get it.`;
    const what = highlights.length ? `\n${highlights.map((h) => `   • ${h}`).join('\n')}` : '';
    return `${head}${what}`;
  },
  upgradeNotInProject: 'Run this inside a Prototo project to update it.',
  upgrading: 'Updating Prototo to the latest',
  upgradeDone:
    'Prototo is up to date. Run proto start to use it.\n   What’s new → https://prototo.app/changelog',
  upgradeFailed: 'Couldn’t update Prototo. Check your connection and try again.',
  runtimeStale:
    'Prototo has a new runtime. Run proto upgrade to update this project, then proto share to refresh your link.',
  runtimeUpgrading: 'Updating this project to the latest Prototo runtime… (about a minute)',
  runtimeUpgraded:
    'Project updated. Run proto share to refresh your link so it opens on the new Prototo.',
  runtimeUpgradeFailed:
    'Prototo updated, but this project couldn’t move to the new runtime. Check your connection and run proto upgrade again.',
  // Desktop-facing (`--json` reason): no terminal command, the desktop's Try
  // again button is the retry.
  runtimeUpgradeFailedRetry:
    'Prototo updated, but this project couldn’t move to the new runtime. Check your connection and try again.',
  upgradeVerifyFailed:
    'Prototo installed, but the project still has the old version. Try again in a minute.',
  shareRuntimeStale:
    'This project is on an older Prototo runtime, so the link wouldn’t open. Run proto upgrade first, then proto share.',
  shareSourceTooBig:
    'This prototype is too big for teammates to remix, so they can only view it. Publishing the link anyway.',
  remixBadLink: 'Paste a prototo.app/p/… link (or its code): proto remix <link>',
  remixStarting: (app: string, by: string) => `Remixing ${app} by ${by}…`,
  remixInstalling: 'Setting it up… (about a minute)',
  remixDone: (app: string, by: string, folder: string) =>
    `Your copy of ${app} by ${by} is ready in ${folder}.\n  cd ${folder} && proto start\nIt gets its own link the first time you share it.`,
  remixFolderExists: (folder: string) =>
    `A folder called ${folder} already exists here. Pick another name: proto remix <link> <folder>`,
  remixNotOnTeam: 'That prototype belongs to another team, so it can’t be remixed from here.',
  remixNoSource:
    'That one can’t be remixed yet. Ask its designer to publish it again with the latest Prototo.',
  remixNotFound: 'Couldn’t find a prototype at that link. Check it and try again.',
  remixFailed: 'Couldn’t finish the remix. Check your connection and try again.',
};

export type Messages = typeof messages;

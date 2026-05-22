export const messages = {
  header: 'Proto',
  settingUp: (name: string) => `Setting up ${name}...`,
  installed: (seconds: number) => `Installed in ${seconds}s`,
  folderExists: (name: string) =>
    `That folder already exists. Pick another name: npm create proto@latest <name> (currently: "${name}").`,
  installFailedHint: (name: string) =>
    `Couldn't install dependencies. Once your environment is ready: cd ${name} && pnpm install && proto start`,
  cancelled: 'Cancelled. Folder removed.',
  usingDefaultName: (name: string) =>
    `Using name: ${name} (pass a name as the first argument to override).`,
  bootingProto: 'Booting Proto...',
  protoCliNotFound: (name: string) =>
    `Couldn't find proto-cli. Run manually: cd ${name} && npx proto start`,
  howToRestart: (name: string) =>
    `Proto stopped. To restart: cd ${name} && npx proto start`,
  noNetwork:
    "Couldn't reach the package registry. Check your internet and try again.",
  noPermission:
    "Don't have permission to write here. Try a different folder.",
  noSpace: 'Out of disk space. Free some up and try again.',
  installFailed:
    "Couldn't get things installed. Try again, or visit proto.run/help",
};

export type Messages = typeof messages;

export const messages = {
  header: 'Proto',
  namePrompt: 'What is your prototype called?',
  settingUp: 'Setting things up',
  filesReady: 'Project files ready',
  installing: 'Installing',
  ready: 'Ready',
  folderExists: (name: string) =>
    `That folder already exists. Pick another name or delete "${name}" first.`,
  noNetwork:
    "Couldn't reach the package registry. Check your internet and try again.",
  noPermission:
    "Don't have permission to write here. Try a different folder.",
  noSpace: 'Out of disk space. Free some up and try again.',
  installFailed:
    "Couldn't get things installed. Try again, or visit proto.run/help",
  final:
    'Proto is ready. Scan the QR to preview on your device, or run: proto start',
};

export type Messages = typeof messages;

export const messages = {
  startingHeader: 'Proto',
  noConfig: 'Run this inside a Proto project.',
  starting: 'Starting',
  ready: 'Scan the QR to preview on your device',
  stopped: 'Proto stopped.',
  portInUse:
    'Proto is already running in another window. Close it first, then try again.',
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
};

export type Messages = typeof messages;

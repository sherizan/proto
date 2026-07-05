import { messages } from './messages.js';

export function translateMetroError(stderr: string): string {
  // Old Metro says "Unable to resolve module ./x"; modern Expo says
  // 'Unable to resolve "x" from "y"'. Match both.
  if (/Unable to resolve/.test(stderr)) return messages.componentNotFound;
  if (/SyntaxError/.test(stderr)) return messages.screenSyntax;
  if (/Network request failed/.test(stderr)) return messages.noDeviceConnection;
  if (/EADDRINUSE/.test(stderr)) return messages.portInUse;
  return messages.generic;
}

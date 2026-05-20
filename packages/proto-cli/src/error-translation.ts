import { messages } from './messages.js';

export function translateMetroError(stderr: string): string {
  if (/Unable to resolve module/.test(stderr)) return messages.componentNotFound;
  if (/SyntaxError/.test(stderr)) return messages.screenSyntax;
  if (/Network request failed/.test(stderr)) return messages.noDeviceConnection;
  if (/EADDRINUSE/.test(stderr)) return messages.portInUse;
  return messages.generic;
}

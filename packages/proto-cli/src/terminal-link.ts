// OSC 8 terminal hyperlink: `ESC ] 8 ; ; <uri> BEL <label> ESC ] 8 ; ; BEL`.
// Supporting terminals (iTerm2, VS Code, WezTerm, Kitty, GNOME Terminal) make the
// label single-click; others swallow the escape and fall back to the visible label.
// Off a TTY (piped/redirected) we emit the bare URL so logs and scripts stay clean.
const ESC = '';
const BEL = '';
const OSC8_OPEN = `${ESC}]8;;`;
const OSC8_CLOSE = `${ESC}]8;;${BEL}`;

export type TerminalLinkOptions = { isTTY?: boolean; label?: string };

export function terminalLink(url: string, opts: TerminalLinkOptions = {}): string {
  const isTTY = opts.isTTY ?? Boolean(process.stdout.isTTY);
  if (!isTTY) return url;
  const label = opts.label ?? url;
  return `${OSC8_OPEN}${url}${BEL}${label}${OSC8_CLOSE}`;
}

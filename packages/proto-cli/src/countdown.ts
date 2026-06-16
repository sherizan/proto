// The live recording countdown. `proto record` caps capture length by tier, so
// the designer sees how much time is left and the recording auto-stops at zero.

/** Format whole seconds as `M:SS` (e.g. 30 → "0:30", 180 → "3:00"). Clamps to 0. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export type Countdown = {
  /** Resolves when the timer reaches zero (recording should auto-stop + upload). */
  expired: Promise<void>;
  /** Stop the timer + clear the live line (called when the designer stops early). */
  stop: () => void;
};

/**
 * Start a 1-second-tick countdown from `capSeconds`, redrawing a single live line
 * in place. `expired` resolves at zero. `stop()` cancels it and wipes the line.
 * `write` is injectable for tests; it defaults to stdout.
 */
export function startCountdown(
  capSeconds: number,
  opts: { write?: (s: string) => void } = {},
): Countdown {
  const write = opts.write ?? ((s: string) => void process.stdout.write(s));
  let remaining = capSeconds;
  let resolveExpired!: () => void;
  const expired = new Promise<void>((resolve) => {
    resolveExpired = resolve;
  });

  let stopped = false;
  const render = () => {
    write(`\r  ● Recording  ${formatCountdown(remaining)} left · press Enter to stop  `);
  };
  const interval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      remaining = 0;
      cleanup();
      resolveExpired();
      return;
    }
    render();
  }, 1000);
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(interval);
    write('\r\x1b[K'); // carriage return + clear to end of line
  };

  render();
  return { expired, stop: cleanup };
}

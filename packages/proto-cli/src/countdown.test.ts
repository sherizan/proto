import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatCountdown, startCountdown } from './countdown.js';

describe('formatCountdown', () => {
  it('formats seconds as M:SS, padding the seconds', () => {
    expect(formatCountdown(30)).toBe('0:30');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(180)).toBe('3:00');
  });

  it('floors fractions and clamps negatives to 0:00', () => {
    expect(formatCountdown(29.8)).toBe('0:29');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-4)).toBe('0:00');
  });
});

describe('startCountdown', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the starting time and resolves expired after capSeconds', async () => {
    vi.useFakeTimers();
    const lines: string[] = [];
    const cd = startCountdown(3, { write: (s) => lines.push(s) });
    let done = false;
    void cd.expired.then(() => {
      done = true;
    });

    expect(lines.join('')).toContain('0:03');
    expect(done).toBe(false);

    await vi.advanceTimersByTimeAsync(3000);
    expect(done).toBe(true);
  });

  it('stop() cancels the timer so expired never resolves', async () => {
    vi.useFakeTimers();
    const cd = startCountdown(5, { write: () => {} });
    let done = false;
    void cd.expired.then(() => {
      done = true;
    });

    cd.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(done).toBe(false);
  });
});

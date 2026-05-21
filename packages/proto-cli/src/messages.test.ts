import { describe, expect, it } from 'vitest';
import { messages } from './messages';

describe('messages', () => {
  it('keeps Phase 1 + Phase 2 keys still in use', () => {
    expect(messages.noConfig).toBeTypeOf('string');
    expect(messages.portInUse).toBeTypeOf('string');
    expect(messages.stoppedPrevious).toBeTypeOf('string');
    expect(messages.noScreenName).toBeTypeOf('string');
    expect(messages.screenCreated('Home')).toContain('Home');
    expect(messages.resetDone).toBeTypeOf('string');
    expect(messages.designIntro).toBeTypeOf('string');
    expect(messages.designReadyTitle).toBeTypeOf('string');
  });

  it('exposes step 1 (install preview app) copy', () => {
    expect(messages.step1Header).toBe('Step 1 — Install Proto Preview (one-time)');
    expect(messages.step1Body).toContain('Open Camera on your phone');
    expect(messages.step1Body).toContain('published as Expo Go by Expo');
    expect(messages.step1Body).toContain('Skip to Step 2');
  });

  it('exposes step 2 (open project) copy', () => {
    expect(messages.step2Header).toBe('Step 2 — Open your prototype');
    expect(messages.step2Body).toContain('Open Proto Preview, scan');
    expect(messages.step2Body).toContain('10–30s the first time');
  });

  it('exposes next-step block referencing the liquid-glass-toolbar prompt', () => {
    expect(messages.nextStepsHeader).toBe('Next, in another terminal:');
    expect(messages.nextStepsBody).toContain('cd ');
    expect(messages.nextStepsBody).toContain('claude');
    expect(messages.nextStepsBody).toContain('Add liquid glass bottom toolbar with placeholder screens');
  });

  it('exposes footer running message', () => {
    expect(messages.metroRunning).toBe('Proto is running. Press Ctrl+C to stop.');
  });
});

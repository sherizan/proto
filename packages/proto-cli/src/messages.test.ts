import { describe, expect, it } from 'vitest';
import { messages } from './messages';

describe('messages', () => {
  it('exposes Phase 1 + Phase 2 keys still in use', () => {
    expect(messages.noConfig).toBeTypeOf('string');
    expect(messages.portInUse).toBeTypeOf('string');
    expect(messages.stoppedPrevious).toBeTypeOf('string');
    expect(messages.noScreenName).toBeTypeOf('string');
    expect(messages.screenCreated('Home')).toContain('Home');
    expect(messages.resetDone).toBeTypeOf('string');
    expect(messages.designIntro).toBeTypeOf('string');
    expect(messages.designReadyTitle).toBeTypeOf('string');
  });
});

describe('messages — Prototo dev-client copy', () => {
  it('installingPrototoApp is a short status string with no engineering jargon', () => {
    expect(messages.installingPrototoApp).toBe('Setting up Prototo on the Simulator…');
  });

  it('prototoAppOutdated tells the designer to update via App Store', () => {
    expect(messages.prototoAppOutdated).toBe(
      'This project needs a newer Prototo. Update Prototo from the App Store and try again.',
    );
  });

  it('prototoSimulatorOffline gives a recovery path without engineering terms', () => {
    expect(messages.prototoSimulatorOffline).toBe(
      "The Simulator's Prototo is older than this project. Connect to the internet, then run proto start to refresh it.",
    );
  });

  it('startingHeader rebrand to Prototo', () => {
    expect(messages.startingHeader).toBe('Prototo');
  });

  it('designIntro rebrand to Prototo', () => {
    expect(messages.designIntro).toBe('Prototo');
  });

  it('does not surface Expo Go anywhere in copy', () => {
    for (const value of Object.values(messages)) {
      if (typeof value === 'string') {
        expect(value).not.toMatch(/expo go/i);
      }
    }
  });
});

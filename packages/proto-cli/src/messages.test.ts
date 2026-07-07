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
      'The Simulator’s Prototo is older than this project. Connect to the internet, then run proto start to refresh it.',
    );
  });

  it('startingHeader rebrand to Prototo', () => {
    expect(messages.startingHeader).toBe('Prototo');
  });

  it('designIntro rebrand to Prototo', () => {
    expect(messages.designIntro).toBe('Prototo');
  });

  it('prototoHashMismatch tells the designer to retry', () => {
    expect(messages.prototoHashMismatch).toBe(
      'Couldn’t verify the downloaded Prototo (hash mismatch). Run proto start again to retry.',
    );
  });

  it('prototoInstallFailed gives a clear retry path', () => {
    expect(messages.prototoInstallFailed).toBe(
      'Couldn’t install Prototo on the Simulator. Run proto start again to retry.',
    );
  });

  it('startingSimulator announces the boot step in designer language', () => {
    expect(messages.startingSimulator).toBe('Starting iOS Simulator…');
  });

  it('does not surface Expo Go anywhere in copy', () => {
    for (const value of Object.values(messages)) {
      if (typeof value === 'string') {
        expect(value).not.toMatch(/expo go/i);
      }
    }
  });

  it('shareStarting is a brief status string', () => {
    expect(messages.shareStarting).toBe('Setting up your share…');
  });

  it('shareLive renders the share URL', () => {
    expect(messages.shareLive('https://prototo.app/p/xk92m')).toBe(
      'Your prototype is live\n  https://prototo.app/p/xk92m',
    );
  });

  it('shareScanCopy invites scanning', () => {
    expect(messages.shareScanCopy).toBe('Scan to open on any device:');
  });


  it('shareRateLimited is a designer-friendly retry hint', () => {
    expect(messages.shareRateLimited).toBe('You’ve shared a lot recently. Try again in an hour.');
  });

  it('shareApiUnreachable says to check internet', () => {
    expect(messages.shareApiUnreachable).toBe(
      'Can’t reach Prototo’s share service. Check your internet and try again.',
    );
  });

  it('shareBadInput points the designer at proto.config.js', () => {
    expect(messages.shareBadInput).toBe(
      'Something looked off in your project. Check your proto.config.js name + theme, then run proto share again.',
    );
  });
});

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

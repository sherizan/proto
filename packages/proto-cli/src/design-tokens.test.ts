import { describe, expect, it } from 'vitest';
import { base } from '../../proto-components/src/tokens/base';
// Canonical source of truth lives in proto-components. These imports pull the real
// token objects (the same ones the RN components render with) so we can assert the
// CLI-local mirror in design-tokens.ts never drifts from them.
import { liquidGlass } from '../../proto-components/src/tokens/liquidGlass';
import { materialYou } from '../../proto-components/src/tokens/materialYou';
import { themeTokens } from './design-tokens.js';

describe('design-tokens mirror stays in sync with proto-components', () => {
  it('liquidGlass matches the canonical token', () => {
    expect(themeTokens.liquidGlass).toEqual(liquidGlass);
  });

  it('materialYou matches the canonical token', () => {
    expect(themeTokens.materialYou).toEqual(materialYou);
  });

  it('base matches the canonical token', () => {
    expect(themeTokens.base).toEqual(base);
  });
});

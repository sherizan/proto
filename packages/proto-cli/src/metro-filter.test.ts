import { describe, expect, it } from 'vitest';
import { filterMetroLine } from './metro-filter';

describe('filterMetroLine', () => {
  it('extracts the exp:// URL from a Metro line', () => {
    const line = '› Metro waiting on exp://192.168.1.42:8081';
    const result = filterMetroLine(line);
    expect(result.type).toBe('qr-url');
    if (result.type === 'qr-url') {
      expect(result.url).toBe('exp://192.168.1.42:8081');
    }
  });

  it('extracts the exp:// URL when prefixed differently', () => {
    const result = filterMetroLine('Started Metro at exp://10.0.0.5:19000');
    expect(result.type).toBe('qr-url');
    if (result.type === 'qr-url') expect(result.url).toBe('exp://10.0.0.5:19000');
  });

  it('classifies leading-arrow chrome as noise', () => {
    expect(filterMetroLine('› Logs for your project will appear below.').type).toBe('noise');
    expect(filterMetroLine('› Press ? │ show all commands').type).toBe('noise');
  });

  it('classifies "Logs for your project" banner as noise', () => {
    expect(filterMetroLine('Logs for your project will appear below.').type).toBe('noise');
  });

  it('classifies port banners as noise', () => {
    expect(filterMetroLine('› Metro running on port 8081').type).toBe('noise');
  });

  it('passes through unrecognised lines', () => {
    const result = filterMetroLine('Some unfamiliar string from a tool');
    expect(result.type).toBe('passthrough');
    if (result.type === 'passthrough') expect(result.line).toBe('Some unfamiliar string from a tool');
  });

  it('classifies empty lines as noise', () => {
    expect(filterMetroLine('').type).toBe('noise');
    expect(filterMetroLine('   ').type).toBe('noise');
  });
});

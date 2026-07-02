import { afterEach, describe, expect, it } from 'vitest';

import { isMdsWhiteLabelModeEnabled } from './mdsWhiteLabel';

afterEach(() => {
  delete window.chatwootConfig;
});

describe('isMdsWhiteLabelModeEnabled', () => {
  it('returns false when mdsWhiteLabelMode is undefined', () => {
    window.chatwootConfig = {};

    expect(isMdsWhiteLabelModeEnabled()).toBe(false);
  });

  it('returns false when mdsWhiteLabelMode is false', () => {
    window.chatwootConfig = { mdsWhiteLabelMode: false };

    expect(isMdsWhiteLabelModeEnabled()).toBe(false);
  });

  it('returns false when mdsWhiteLabelMode is "false"', () => {
    window.chatwootConfig = { mdsWhiteLabelMode: 'false' };

    expect(isMdsWhiteLabelModeEnabled()).toBe(false);
  });

  it('returns true when mdsWhiteLabelMode is true', () => {
    window.chatwootConfig = { mdsWhiteLabelMode: true };

    expect(isMdsWhiteLabelModeEnabled()).toBe(true);
  });

  it('returns true when mdsWhiteLabelMode is "true"', () => {
    window.chatwootConfig = { mdsWhiteLabelMode: 'true' };

    expect(isMdsWhiteLabelModeEnabled()).toBe(true);
  });
});

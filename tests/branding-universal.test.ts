import assert from 'node:assert/strict';
import test from 'node:test';
import { brandForeground, brandingTokens, brandingValues, DEFAULT_BRANDING } from '../src/lib/branding-values';

function ratio(a: string, b: string) {
  const luminance = (hex: string) => {
    const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2];
  };
  const [x, y] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (x + .05) / (y + .05);
}
for (const color of ['#ffffff', '#000000', '#ff8800', '#abcdef', '#123456', '#777777', '#00ff00']) {
  test(`palette foreground remains WCAG AA on ${color}`, () => {
    assert.ok(ratio(color, brandForeground(color)) >= 4.5);
    const tokens = brandingTokens({ ...DEFAULT_BRANDING, primaryColor: color, secondaryColor: color });
    assert.ok(ratio('#ffffff', tokens['--brand-link']) >= 4.5);
    assert.ok(ratio('#ffffff', tokens['--brand-focus']) >= 4.5);
  });
}
test('tokens sanitize persisted values and never retain another tenant palette', () => {
  const a = brandingTokens({ ...DEFAULT_BRANDING, primaryColor: '#ff8800' });
  const b = brandingTokens({ ...DEFAULT_BRANDING, primaryColor: '#123456' });
  assert.equal(a['--brand-primary'], '#ff8800');
  assert.equal(b['--brand-primary'], '#123456');
  const invalid = brandingValues({ primaryColor: '</style><script>x</script>', logo: 'javascript:alert(1)' });
  assert.equal(invalid.logo, DEFAULT_BRANDING.logo);
  assert.deepEqual(brandingTokens(invalid), brandingTokens(DEFAULT_BRANDING));
});

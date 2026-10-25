/** Canonical presentation values; safe to import in client components. */
export interface OrgBranding {
  name: string;
  logo: string | null;
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string;
}
export const DEFAULT_BRANDING: OrgBranding = {
  name: 'MDS CRM', logo: '/images/logo-fundo-escuro.png', favicon: '/images/favicon.png',
  primaryColor: '#2f3453', secondaryColor: '#374b89',
};
export function safeBrandAsset(value: unknown): string | null {
  if (typeof value !== 'string' || value !== value.trim() || /[\\\u0000-\u0020<>"']/.test(value)) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? value : null;
  } catch { return null; }
}
export function brandingValues(org: Partial<OrgBranding>): OrgBranding {
  const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  return {
    name: typeof org.name === 'string' && org.name.trim() ? org.name.trim().slice(0, 255) : DEFAULT_BRANDING.name,
    logo: safeBrandAsset(org.logo) ?? DEFAULT_BRANDING.logo,
    favicon: safeBrandAsset(org.favicon) ?? DEFAULT_BRANDING.favicon,
    primaryColor: color(org.primaryColor, DEFAULT_BRANDING.primaryColor),
    secondaryColor: color(org.secondaryColor, DEFAULT_BRANDING.secondaryColor),
  };
}
/** WCAG relative luminance; select the foreground with the greater contrast. */
export function brandForeground(color: string): string {
  const safe = /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BRANDING.primaryColor;
  const rgb = [1, 3, 5].map(offset => parseInt(safe.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}
export function brandingTokens(branding: OrgBranding): Record<string, string> {
  const safe = brandingValues(branding);
  const foreground = brandForeground(safe.primaryColor);
  const activeForeground = brandForeground(safe.secondaryColor);
  // Link/focus on the light surface must remain readable even with pale palettes.
  const readable = (color: string) => brandForeground(color) === '#ffffff' ? color : '#202938';
  return {
    '--color-primary': safe.primaryColor, '--color-secondary': safe.secondaryColor,
    '--brand-sidebar': safe.primaryColor, '--brand-sidebar-text': foreground,
    '--brand-active': safe.secondaryColor, '--brand-active-text': activeForeground,
    '--brand-hover': foreground === '#ffffff' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    '--brand-primary': safe.primaryColor, '--brand-primary-text': foreground,
    '--brand-secondary': safe.secondaryColor, '--brand-secondary-text': activeForeground,
    '--brand-link': readable(safe.primaryColor), '--brand-focus': readable(safe.secondaryColor),
    '--brand-border': '#cbd5e1', '--brand-surface': '#f6f8fc', '--brand-card': '#ffffff',
    '--brand-text': '#202938', '--brand-muted': '#475569',
  };
}
export function brandingCssVars(branding: OrgBranding): string {
  return `[data-crm-brand] { ${Object.entries(brandingTokens(branding)).map(([key, value]) => `${key}: ${value};`).join(' ')} }`;
}

/** Canonical presentation values; safe to import in client components. */
export interface OrgBranding {
  name: string;
  logo: string | null;
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string;
}
export const DEFAULT_BRANDING: OrgBranding = {
  name: 'MDS CRM', logo: '/images/logo-fundo-escuro.png', favicon: '/favicon.ico',
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
export function brandingCssVars(branding: OrgBranding): string {
  const safe = brandingValues(branding);
  return `:root { --color-primary: ${safe.primaryColor}; --color-secondary: ${safe.secondaryColor}; }`;
}

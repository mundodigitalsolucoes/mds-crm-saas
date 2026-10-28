import { PublicBrandingProvider } from '@/components/PublicBrandingProvider';
import { DEFAULT_BRANDING, brandingCssVars } from '@/lib/branding-values';
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  let branding = DEFAULT_BRANDING;
  let customDomain = false;
  if (process.env.CRM_CUSTOM_DOMAINS_ENABLED === 'true') {
    const { publicDomainBranding } = await import('@/lib/domains/request');
    const domainBrand = await publicDomainBranding();
    customDomain = domainBrand !== null;
    branding = domainBrand ?? DEFAULT_BRANDING;
  }
  return <PublicBrandingProvider branding={branding} customDomain={customDomain}>
    <div data-crm-brand className="crm-brand">
      <style dangerouslySetInnerHTML={{ __html: brandingCssVars(branding) }} />
      {children}
    </div>
  </PublicBrandingProvider>;
}

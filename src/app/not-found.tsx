import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { checkAuth } from '@/lib/checkPermission';
import { getOrgBranding, DEFAULT_BRANDING, brandingCssVars } from '@/lib/branding';

export default async function NotFound() {
  const auth = await checkAuth();
  const authenticated = auth.authenticated && auth.session;
  const branding = authenticated ? await getOrgBranding(auth.session!.user.organizationId) : DEFAULT_BRANDING;
  return <section data-crm-brand className="crm-brand flex min-h-screen flex-col items-center justify-center gap-5 p-6">
    <style dangerouslySetInnerHTML={{ __html: brandingCssVars(branding) }} />
    <div className="w-60 rounded p-4" style={{ background: branding.primaryColor }}><BrandLogo branding={branding} documentIcon /></div>
    <p>{branding.name}</p>
    <h1 className="text-2xl font-bold">Página não encontrada</h1>
    <Link className="rounded bg-primary px-4 py-2" href={authenticated ? '/dashboard' : '/auth/login'}>Voltar ao CRM</Link>
  </section>;
}

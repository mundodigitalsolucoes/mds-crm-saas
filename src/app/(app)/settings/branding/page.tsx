'use client';

import { useEffect, useState } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { brandingValues, DEFAULT_BRANDING, type OrgBranding } from '@/lib/branding-values';

/** Read-only for customers; operational settings remain in their existing pages. */
export default function BrandingPage() {
  const [brand, setBrand] = useState<OrgBranding | null>(null);
  const [status, setStatus] = useState('Carregando identidade visual...');
  useEffect(() => {
    let active = true;
    fetch('/api/organizations', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw Error('Não foi possível carregar a identidade');
      const org = await response.json();
      if (active) { setBrand(org.whiteLabelActive ? brandingValues(org) : DEFAULT_BRANDING); setStatus(''); }
    }).catch(error => { if (active) setStatus(error.message); });
    return () => { active = false; };
  }, []);
  return <section className="mx-auto max-w-3xl space-y-6 p-6">
    <h1 className="text-2xl font-bold">Identidade visual</h1>
    <p>A identidade comercial é administrada pela MDS. Para alterar nome, logo ou cores, entre em contato com o suporte.</p>
    {brand && <div className="space-y-3 rounded-xl border p-6" style={{ background: brand.primaryColor }}>
      <BrandLogo branding={brand} />
      <p className="rounded bg-white p-2 text-gray-900">{brand.name}</p>
    </div>}
    <p role="status">{status}</p>
  </section>;
}

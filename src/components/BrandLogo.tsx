'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_BRANDING, brandingValues, type OrgBranding } from '@/lib/branding-values';

/** Fail closed to local artwork; never retries a failed remote asset in a loop. */
export default function BrandLogo({ branding, compact = false, documentIcon = false }: { branding: OrgBranding; compact?: boolean; documentIcon?: boolean }) {
  const brand = brandingValues(branding);
  const source = (compact ? brand.favicon : brand.logo) ?? DEFAULT_BRANDING.logo!;
  const fallback = compact ? DEFAULT_BRANDING.favicon! : DEFAULT_BRANDING.logo!;
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    // Covers failures that happened before React hydrated the server-rendered img.
    let active = true;
    const probe = new window.Image();
    probe.referrerPolicy = 'no-referrer';
    probe.onerror = () => { if (active) setFailed(source); };
    probe.src = source;
    return () => { active = false; probe.onerror = null; };
  }, [source]);
  useEffect(() => {
    if (!documentIcon) return;
    let active = true;
    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')];
    const previous = links.map(link => link.getAttribute('href'));
    const icon = brand.favicon ?? DEFAULT_BRANDING.favicon!;
    links.forEach(link => { link.setAttribute('href', icon); });
    const probe = new window.Image();
    probe.referrerPolicy = 'no-referrer';
    probe.onerror = () => {
      if (!active) return;
      for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')) {
        if (link.getAttribute('href') === brand.favicon) link.href = DEFAULT_BRANDING.favicon!;
      }
    };
    probe.src = brand.favicon ?? DEFAULT_BRANDING.favicon!;
    return () => {
      active = false; probe.onerror = null;
      links.forEach((link, index) => {
        if ([icon, DEFAULT_BRANDING.favicon].includes(link.getAttribute('href'))) {
          if (previous[index] === null) link.removeAttribute('href'); else link.setAttribute('href', previous[index]!);
        }
      });
    };
  }, [brand.favicon, documentIcon]);
  return <img src={failed === source ? fallback : source} alt={brand.name}
    onError={event => { if (failed === source) event.currentTarget.style.visibility = 'hidden'; else setFailed(source); }}
    className={compact ? 'h-10 w-10 object-contain' : 'h-14 w-full max-w-[190px] object-contain'}
    referrerPolicy="no-referrer" />;
}

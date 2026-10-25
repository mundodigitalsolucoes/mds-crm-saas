'use client';
import { createContext, useContext } from 'react';
import { DEFAULT_BRANDING, type OrgBranding } from '@/lib/branding-values';
const Context = createContext({ branding: DEFAULT_BRANDING, customDomain: false });
export function PublicBrandingProvider({ branding, customDomain = false, children }: { branding: OrgBranding; customDomain?: boolean; children: React.ReactNode }) {
  return <Context.Provider value={{ branding, customDomain }}>{children}</Context.Provider>;
}
export const usePublicBranding = () => useContext(Context).branding;
export const usePublicDomain = () => useContext(Context).customDomain;

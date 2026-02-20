// src/lib/branding.ts
// Helper server-side para buscar branding da organização
// Usado por layouts, emails e qualquer contexto server

import { prisma } from '@/lib/prisma';

export interface OrgBranding {
  name:           string;
  logo:           string | null;
  favicon:        string | null;
  primaryColor:   string;
  secondaryColor: string;
}

export const DEFAULT_BRANDING: OrgBranding = {
  name:           'MDS CRM',
  logo:           null,
  favicon:        '/favicon.ico',
  primaryColor:   '#6366f1',
  secondaryColor: '#4f46e5',
};

/**
 * Busca o branding de uma organização pelo ID.
 * Retorna defaults se não encontrar ou em caso de erro.
 */
export async function getOrgBranding(organizationId: string): Promise<OrgBranding> {
  try {
    const org = await prisma.organization.findUnique({
      where:  { id: organizationId },
      select: {
        name:           true,
        logo:           true,
        favicon:        true,
        primaryColor:   true,
        secondaryColor: true,
      },
    });

    if (!org) return DEFAULT_BRANDING;

    return {
      name:           org.name           || DEFAULT_BRANDING.name,
      logo:           org.logo           || null,
      favicon:        org.favicon        || DEFAULT_BRANDING.favicon,
      primaryColor:   org.primaryColor   || DEFAULT_BRANDING.primaryColor,
      secondaryColor: org.secondaryColor || DEFAULT_BRANDING.secondaryColor,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

/**
 * Gera o bloco de CSS variables para injetar no <style> server-side.
 * Uso: <style dangerouslySetInnerHTML={{ __html: brandingCssVars(branding) }} />
 */
export function brandingCssVars(branding: OrgBranding): string {
  return `
    :root {
      --color-primary:   ${branding.primaryColor};
      --color-secondary: ${branding.secondaryColor};
    }
  `.trim();
}

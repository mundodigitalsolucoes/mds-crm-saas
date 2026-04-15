// src/app/(app)/layout.tsx
// Shell visual do app autenticado alinhado com a identidade MDS
// Sem tocar em auth, sessão, /atendimento ou comportamento do Chatwoot

import Sidebar from '@/components/Sidebar';
import PermissionSync from '@/components/PermissionSync';
import NextAuthSessionProvider from '@/providers/session-provider';
import { Providers } from '@/components/providers';
import NotificationBellWrapper from '@/components/NotificationBellWrapper';
import WhatsAppStatusBanner from '@/components/integrations/WhatsAppStatusBanner';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MDS CRM - Dashboard',
  description: 'Sistema de Gestão de Leads e Projetos',
};

async function getOrgBranding() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    const org = await prisma.organization.findUnique({
      where: { id: (session.user as any).organizationId },
      select: { favicon: true },
    });

    return org;
  } catch {
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getOrgBranding();

  const favicon = branding?.favicon ?? '/favicon.ico';

  const cssVars = `
    :root {
      --color-primary: #2f3453;
      --color-secondary: #374b89;
    }
  `;

  return (
    <NextAuthSessionProvider>
      <Providers>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
        <link rel="icon" href={favicon} />

        <PermissionSync />
        <WhatsAppStatusBanner />

        <div className="flex h-screen overflow-hidden bg-[#f6f8fc]">
          <Sidebar />

          <div className="flex min-w-0 min-h-0 flex-1 flex-col bg-[#f6f8fc]">
            <header className="sticky top-0 z-30 flex items-center justify-end border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
                <NotificationBellWrapper />
              </div>
            </header>

            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#f6f8fc]">
              {children}
            </main>
          </div>
        </div>
      </Providers>
    </NextAuthSessionProvider>
  );
}
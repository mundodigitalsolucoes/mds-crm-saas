// src/app/(app)/layout.tsx
// Shell visual do app autenticado alinhado com a identidade MDS
// Sem tocar em auth, sessão, /atendimento ou comportamento do Chatwoot

import Sidebar from '@/components/Sidebar';
import PermissionSync from '@/components/PermissionSync';
import NextAuthSessionProvider from '@/providers/session-provider';
import { Providers } from '@/components/providers';
import NotificationBellWrapper from '@/components/NotificationBellWrapper';
import WhatsAppStatusBanner from '@/components/integrations/WhatsAppStatusBanner';
import { checkAuth } from '@/lib/checkPermission';
import { getApplicationContext } from '@/lib/authorization/application-context';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MDS CRM - Dashboard',
  description: 'Sistema de Gestão de Leads e Projetos',
};

async function getOrgBranding(organizationId: string) {
  try {
    const org = await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
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
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.session) redirect('/auth/login');
  const context = await getApplicationContext();
  if (!context || context.userId !== auth.session.user.id ||
    context.organizationId !== auth.session.user.organizationId) redirect('/auth/login');
  const branding = await getOrgBranding(auth.session.user.organizationId);

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
          <Sidebar access={context} />

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
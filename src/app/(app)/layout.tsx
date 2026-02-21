// src/app/(app)/layout.tsx
// ✅ 3.4 White-label: injeta primaryColor/secondaryColor no <head> via branding da org

import Sidebar from '@/components/Sidebar';
import PermissionSync from '@/components/PermissionSync';
import NextAuthSessionProvider from '@/providers/session-provider';
import { Providers } from '@/components/providers';
import NotificationBellWrapper from '@/components/NotificationBellWrapper';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Metadata } from 'next';

// ✅ metadata estático (fallback)
export const metadata: Metadata = {
  title:       'MDS CRM - Dashboard',
  description: 'Sistema de Gestão de Leads e Projetos',
};

async function getOrgBranding() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    const org = await prisma.organization.findUnique({
      where:  { id: (session.user as any).organizationId },
      select: { primaryColor: true, secondaryColor: true, favicon: true, name: true },
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

  const primaryColor   = branding?.primaryColor   ?? '#6366f1';
  const secondaryColor = branding?.secondaryColor  ?? '#4f46e5';
  const favicon        = branding?.favicon         ?? '/favicon.ico';

  const cssVars = `:root { --color-primary: ${primaryColor}; --color-secondary: ${secondaryColor}; }`;

  return (
    <NextAuthSessionProvider>
      <Providers>
        {/* ✅ CSS vars white-label injetadas via <style> — correto */}
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />

        {/* ✅ favicon dinâmico via link no <head> do Next.js */}
        <link rel="icon" href={favicon} />

        <PermissionSync />

        <div className="flex min-h-screen bg-gray-50">
          <Sidebar />
          <div className="flex-1 flex flex-col lg:ml-0 min-w-0">

            <header className="sticky top-0 z-30 flex items-center justify-end gap-2 px-4 py-2.5 bg-gray-900/80 backdrop-blur border-b border-white/5">
              <NotificationBellWrapper />
            </header>

            <main className="flex-1">
              {children}
            </main>

          </div>
        </div>
      </Providers>
    </NextAuthSessionProvider>
  );
}

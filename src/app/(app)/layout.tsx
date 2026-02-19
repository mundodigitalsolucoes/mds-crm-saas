// src/app/(app)/layout.tsx

import Sidebar from '@/components/Sidebar';
import PermissionSync from '@/components/PermissionSync';
import NextAuthSessionProvider from '@/providers/session-provider';
import { Providers } from '@/components/providers';
import NotificationBellWrapper from '@/components/NotificationBellWrapper';

export const metadata = {
  title: "MDS CRM - Dashboard",
  description: "Sistema de Gestão de Leads e Projetos",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider>
      <Providers>
        <PermissionSync />
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar />
          <div className="flex-1 flex flex-col lg:ml-0 min-w-0">

            {/* ── TopBar ── */}
            <header className="sticky top-0 z-30 flex items-center justify-end gap-2 px-4 py-2.5 bg-gray-900/80 backdrop-blur border-b border-white/5">
              <NotificationBellWrapper />
            </header>

            {/* ── Conteúdo ── */}
            <main className="flex-1">
              {children}
            </main>

          </div>
        </div>
      </Providers>
    </NextAuthSessionProvider>
  );
}

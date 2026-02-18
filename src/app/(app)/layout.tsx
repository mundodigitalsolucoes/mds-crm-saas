// src/app/(app)/layout.tsx

import Sidebar from '@/components/Sidebar';
import PermissionSync from '@/components/PermissionSync';
import NextAuthSessionProvider from '@/providers/session-provider';

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
      <PermissionSync />
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 lg:ml-0">
          {children}
        </main>
      </div>
    </NextAuthSessionProvider>
  );
}

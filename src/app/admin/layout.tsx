'use client';

import { usePathname } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';

/**
 * Layout do painel SuperAdmin
 * Renderiza sidebar + conteúdo principal
 * NÃO renderiza sidebar na página de login
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Na página de login, renderiza sem sidebar
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto">
        {/* Header top bar */}
        <header className="sticky top-0 z-10 h-16 bg-gray-950/80 backdrop-blur-md border-b border-blue-900/30 flex items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-white">Painel SuperAdmin</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700/50">
              🔒 Acesso Restrito
            </span>
          </div>
        </header>

        {/* Conteúdo da página */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

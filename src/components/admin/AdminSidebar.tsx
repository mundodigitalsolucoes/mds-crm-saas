'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield,
  LayoutDashboard,
  Building2,
  CreditCard,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

/**
 * Sidebar do painel SuperAdmin
 * Tema: azul com preto
 */

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Organizações',
    href: '/admin/organizations',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Planos',
    href: '/admin/plans',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    label: 'Usuários',
    href: '/admin/users',
    icon: <Users className="w-5 h-5" />,
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Verifica se o item está ativo
  const isActive = (href: string) => pathname.startsWith(href);

  // Logout do SuperAdmin
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      router.push('/admin/login');
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <aside
      className={`h-screen bg-gray-950 border-r border-blue-900/30 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Header da Sidebar */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-blue-900/30">
        <div className="w-9 h-9 bg-blue-600/20 rounded-lg flex items-center justify-center border border-blue-500/30 flex-shrink-0">
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-white truncate">Super Admin</h2>
            <p className="text-[11px] text-gray-500 truncate">MDS CRM</p>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer: Collapse + Logout */}
      <div className="p-3 border-t border-blue-900/30 space-y-1">
        {/* Botão Collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-gray-800/50 transition-all"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          <span className="flex-shrink-0">
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </span>
          {!collapsed && <span>Recolher</span>}
        </button>

        {/* Botão Logout */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all disabled:opacity-50"
          title={collapsed ? 'Sair' : undefined}
        >
          <span className="flex-shrink-0">
            {loggingOut ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LogOut className="w-5 h-5" />
            )}
          </span>
          {!collapsed && <span>{loggingOut ? 'Saindo...' : 'Sair'}</span>}
        </button>
      </div>
    </aside>
  );
}

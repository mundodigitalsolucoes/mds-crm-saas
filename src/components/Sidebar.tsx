// src/components/Sidebar.tsx
// Sidebar com filtragem de menus por permissão do usuário

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Kanban,
  FileText,
  CheckSquare,
  Calendar,
  BarChart3,
  Menu,
  X,
  LogOut,
  Plug,
  Shield,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { usePermission } from '@/hooks/usePermission';
import type { PermissionModule } from '@/types/permissions';

// ============================================
// MENU ITEMS COM MÓDULO DE PERMISSÃO
// ============================================

interface MenuItem {
  name: string;
  icon: React.ComponentType<any>;
  path: string;
  module?: PermissionModule;
}

const menuItems: MenuItem[] = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Leads', icon: Users, path: '/leads', module: 'leads' },
  { name: 'Kanban', icon: Kanban, path: '/kanban', module: 'kanban' },
  { name: 'Projetos', icon: FolderKanban, path: '/projects', module: 'projects' },
  { name: 'OS', icon: FileText, path: '/os', module: 'os' },
  { name: 'Tarefas', icon: CheckSquare, path: '/tasks', module: 'tasks' },
  { name: 'Agenda', icon: Calendar, path: '/agenda', module: 'agenda' },
  { name: 'Relatórios', icon: BarChart3, path: '/reports', module: 'reports' },
];

const settingsItems: MenuItem[] = [
  { name: 'Integrações', icon: Plug, path: '/settings/integrations', module: 'integrations' },
  { name: 'Membros', icon: Shield, path: '/settings/members', module: 'users' },
];

// ============================================
// COMPONENTE
// ============================================

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { canAccess, isAdmin, isLoading } = usePermission();
  const [isOpen, setIsOpen] = useState(false);

  // Filtrar menus por permissão
  const visibleMenu = useMemo(() => {
    if (isLoading) return []; // Não mostrar nada enquanto carrega
    return menuItems.filter((item) => {
      if (!item.module) return true; // Dashboard sempre visível
      return canAccess(item.module);
    });
  }, [canAccess, isLoading]);

  const visibleSettings = useMemo(() => {
    if (isLoading) return [];
    return settingsItems.filter((item) => {
      if (!item.module) return true;
      // Membros: só admin/owner veem
      if (item.module === 'users') return isAdmin;
      return canAccess(item.module);
    });
  }, [canAccess, isAdmin, isLoading]);

  const handleLogout = () => {
    signOut({ callbackUrl: '/auth/login' });
  };

  // Dados do usuário da session
  const userName = session?.user?.name || 'Usuário';
  const userRole = session?.user?.role || 'user';
  const userInitial = userName.charAt(0).toUpperCase();

  const ROLE_DISPLAY: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gerente',
    user: 'Usuário',
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay para Mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 bg-gradient-to-b from-indigo-900 to-indigo-800 text-white flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-indigo-700">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex-shrink-0">
              <img
                src="/images/logo-fundo-escuro.png"
                alt="Mundo Digital Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-base leading-tight mb-0.5">Mundo Digital</h1>
              <p className="text-[10.5px] text-indigo-300 leading-tight">
                Soluções em Marketing e Vendas
              </p>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {visibleMenu.length > 0 && (
            <>
              <p className="text-xs font-semibold text-indigo-300 mb-3 px-3">MENU PRINCIPAL</p>
              <ul className="space-y-1">
                {visibleMenu.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path;

                  return (
                    <li key={item.path}>
                      <Link
                        href={item.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-indigo-700 text-white font-medium'
                            : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                        }`}
                      >
                        <Icon size={20} />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Configurações */}
          {visibleSettings.length > 0 && (
            <>
              <p className="text-xs font-semibold text-indigo-300 mb-3 px-3 mt-6">CONFIGURAÇÕES</p>
              <ul className="space-y-1">
                {visibleSettings.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');

                  return (
                    <li key={item.path}>
                      <Link
                        href={item.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-indigo-700 text-white font-medium'
                            : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                        }`}
                      >
                        <Icon size={20} />
                        <span>{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-indigo-700">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-800">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{userName}</p>
              <p className="text-xs text-indigo-300">{ROLE_DISPLAY[userRole] || userRole}</p>
            </div>
          </div>

          {/* Botão de Logout */}
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}

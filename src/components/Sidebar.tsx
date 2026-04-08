// src/components/Sidebar.tsx
// Sidebar reorganizada por blocos
// Menu recolhível no desktop
// "Aparência" oculto da navegação
// Branding fixo da MDS no menu (sem frase / sem nome textual)

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
  UserCog,
  CreditCard,
  Target,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { usePermission } from '@/hooks/usePermission';
import dynamic from 'next/dynamic';
import type { PermissionModule } from '@/types/permissions';

const UsageBanner = dynamic(() => import('@/components/UsageBanner'), {
  ssr: false,
});

interface MenuItem {
  name: string;
  icon: LucideIcon;
  path: string;
  module?: PermissionModule;
  ownerOnly?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const BRAND = {
  logo: '/images/logo-fundo-escuro.png',
  primary: '#2f3453',
  secondary: '#374b89',
  white: '#ffffff',
};

function makePalette() {
  return {
    bg: BRAND.primary,
    bgDark: '#28304c',
    bgDarker: '#252c45',
    active: BRAND.secondary,
    hover: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.10)',
    textMuted: 'rgba(255,255,255,0.78)',
    textLabel: 'rgba(255,255,255,0.42)',
  };
}

const salesItems: MenuItem[] = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Leads', icon: Users, path: '/leads', module: 'leads' },
  { name: 'Kanban', icon: Kanban, path: '/kanban', module: 'kanban' },
  { name: 'Agenda', icon: Calendar, path: '/agenda', module: 'agenda' },
  { name: 'Metas', icon: Target, path: '/goals', module: 'goals' },
];

const serviceItems: MenuItem[] = [
  { name: 'Atendimento', icon: MessageSquare, path: '/atendimento' },
];

const marketingItems: MenuItem[] = [
  { name: 'Projetos', icon: FolderKanban, path: '/projects', module: 'projects' },
  { name: 'OS', icon: FileText, path: '/os', module: 'os' },
  { name: 'Tarefas', icon: CheckSquare, path: '/tasks', module: 'tasks' },
  { name: 'Relatórios', icon: BarChart3, path: '/reports', module: 'reports' },
];

const settingsItems: MenuItem[] = [
  { name: 'Integrações', icon: Plug, path: '/settings/integrations', module: 'integrations' },
  { name: 'Membros', icon: Shield, path: '/settings/members', module: 'users' },
  { name: 'Assinatura', icon: CreditCard, path: '/settings/billing' },
  { name: 'Minha Conta', icon: UserCog, path: '/settings/account' },
];

function SidebarSkeleton({
  palette,
  isCollapsed,
}: {
  palette: ReturnType<typeof makePalette>;
  isCollapsed: boolean;
}) {
  return (
    <div className="animate-pulse">
      {!isCollapsed && (
        <>
          <p className="text-[11px] font-semibold mb-3 px-3 tracking-[0.18em]" style={{ color: palette.textLabel }}>
            ATENDIMENTO
          </p>
          <ul className="space-y-1 mb-5">
            {Array.from({ length: 1 }).map((_, i) => (
              <li key={`a-${i}`}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                  <div className="w-5 h-5 rounded" style={{ backgroundColor: palette.hover }} />
                  <div className="h-4 rounded flex-1" style={{ backgroundColor: palette.hover, maxWidth: '110px' }} />
                </div>
              </li>
            ))}
          </ul>

          <p className="text-[11px] font-semibold mb-3 px-3 tracking-[0.18em]" style={{ color: palette.textLabel }}>
            VENDAS
          </p>
        </>
      )}

      <ul className="space-y-1 mb-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={`v-${i}`}>
            <div
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl`}
            >
              <div className="w-5 h-5 rounded" style={{ backgroundColor: palette.hover }} />
              {!isCollapsed && (
                <div
                  className="h-4 rounded flex-1"
                  style={{ backgroundColor: palette.hover, maxWidth: `${70 + i * 12}px` }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      {!isCollapsed && (
        <>
          <p className="text-[11px] font-semibold mb-3 px-3 tracking-[0.18em]" style={{ color: palette.textLabel }}>
            MARKETING
          </p>
          <ul className="space-y-1 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={`m-${i}`}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                  <div className="w-5 h-5 rounded" style={{ backgroundColor: palette.hover }} />
                  <div
                    className="h-4 rounded flex-1"
                    style={{ backgroundColor: palette.hover, maxWidth: `${80 + i * 10}px` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <p className="text-[11px] font-semibold mb-3 px-3 tracking-[0.18em]" style={{ color: palette.textLabel }}>
            CONFIGURAÇÕES
          </p>
        </>
      )}

      <ul className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={`c-${i}`}>
            <div
              className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl`}
            >
              <div className="w-5 h-5 rounded" style={{ backgroundColor: palette.hover }} />
              {!isCollapsed && (
                <div
                  className="h-4 rounded flex-1"
                  style={{ backgroundColor: palette.hover, maxWidth: `${90 + i * 8}px` }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { canAccess, isAdmin, isLoading } = usePermission();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const palette = useMemo(() => makePalette(), []);

  useEffect(() => {
    const savedState = window.localStorage.getItem('mds:sidebar:collapsed');
    if (savedState === '1') {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('mds:sidebar:collapsed', isCollapsed ? '1' : '0');
  }, [isCollapsed]);

  const role = (session?.user as any)?.role ?? '';
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  const canViewItem = (item: MenuItem) => {
    if (item.ownerOnly) return isOwnerOrAdmin;
    if (!item.module) return true;
    if (item.module === 'users') return isAdmin;
    return canAccess(item.module);
  };

  const visibleSections = useMemo<MenuSection[]>(() => {
    if (isLoading) return [];

    const sections: MenuSection[] = [
      { title: 'Atendimento', items: serviceItems },
      { title: 'Vendas', items: salesItems },
      { title: 'Marketing', items: marketingItems },
      { title: 'Configurações', items: settingsItems },
    ];

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(canViewItem),
      }))
      .filter((section) => section.items.length > 0);
  }, [canAccess, isAdmin, isLoading, isOwnerOrAdmin]);

  const handleLogout = () => signOut({ callbackUrl: '/auth/login' });

  const userName = session?.user?.name || 'Usuário';
  const userRole = (session?.user as any)?.role || 'user';
  const userInitial = userName.charAt(0).toUpperCase();

  const ROLE_DISPLAY: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    manager: 'Gerente',
    user: 'Usuário',
  };

  const isDesktopCollapsed = isCollapsed;

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 text-white rounded-xl shadow-lg transition-opacity hover:opacity-80"
        style={{ backgroundColor: BRAND.primary }}
        aria-label={isMobileOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          text-white flex flex-col overflow-hidden
          transform transition-all duration-300 ease-in-out
          w-72 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isDesktopCollapsed ? 'lg:w-[88px]' : 'lg:w-72'}
        `}
        style={{ backgroundColor: palette.bg }}
      >
        <div
          className={`border-b transition-all duration-300 ${
            isDesktopCollapsed ? 'p-3' : 'p-5'
          }`}
          style={{ borderColor: palette.border }}
        >
          <div
            className={`flex ${
              isDesktopCollapsed ? 'flex-col items-center gap-3' : 'items-center justify-between gap-3'
            }`}
          >
            <div className="flex items-center justify-center">
              <img
                src={BRAND.logo}
                alt="MDS"
                className={`${isDesktopCollapsed ? 'w-10 h-10' : 'w-11 h-11'} object-contain`}
              />
            </div>

            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="hidden lg:inline-flex items-center justify-center rounded-xl border w-10 h-10 transition-colors"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.hover,
                color: BRAND.white,
              }}
              aria-label={isDesktopCollapsed ? 'Expandir menu' : 'Recolher menu'}
              title={isDesktopCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {isDesktopCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {isLoading ? (
            <SidebarSkeleton palette={palette} isCollapsed={isDesktopCollapsed} />
          ) : (
            <div className="space-y-5">
              {visibleSections.map((section) => (
                <div key={section.title}>
                  {!isDesktopCollapsed && (
                    <p
                      className="text-[11px] font-semibold mb-2 px-3 tracking-[0.18em] uppercase"
                      style={{ color: palette.textLabel }}
                    >
                      {section.title}
                    </p>
                  )}

                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        pathname === item.path || pathname?.startsWith(item.path + '/');

                      return (
                        <li key={item.path}>
                          <Link
                            href={item.path}
                            onClick={() => setIsMobileOpen(false)}
                            className={`flex items-center rounded-xl transition-colors ${
                              isDesktopCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5'
                            }`}
                            style={{
                              backgroundColor: isActive ? palette.active : 'transparent',
                              color: isActive ? BRAND.white : palette.textMuted,
                              fontWeight: isActive ? 600 : 500,
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = palette.hover;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                              }
                            }}
                            title={isDesktopCollapsed ? item.name : undefined}
                          >
                            <Icon size={20} />
                            {!isDesktopCollapsed && <span>{item.name}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </nav>

        {!isDesktopCollapsed && <UsageBanner />}

        <div className="p-3 border-t" style={{ borderColor: palette.border }}>
          <div
            className={`rounded-xl ${isDesktopCollapsed ? 'p-2' : 'p-3'}`}
            style={{ backgroundColor: palette.bgDarker }}
          >
            <div
              className={`flex items-center ${isDesktopCollapsed ? 'justify-center' : 'gap-3'}`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 text-sm"
                style={{ backgroundColor: palette.active }}
                title={userName}
              >
                {userInitial}
              </div>

              {!isDesktopCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-white">{userName}</p>
                  <p className="text-xs" style={{ color: palette.textMuted }}>
                    {ROLE_DISPLAY[userRole] || userRole}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className={`mt-3 w-full flex items-center justify-center gap-2 rounded-xl text-white font-medium transition-opacity hover:opacity-80 ${
                isDesktopCollapsed ? 'px-2 py-2.5' : 'px-3 py-2.5'
              }`}
              style={{ backgroundColor: '#c0392b' }}
              title={isDesktopCollapsed ? 'Sair' : undefined}
            >
              <LogOut size={18} />
              {!isDesktopCollapsed && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
// src/components/Sidebar.tsx
// Sidebar reorganizada por blocos
// Menu recolhível no desktop
// Blocos em acordeão
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
  ChevronDown,
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
  key: string;
  title: string;
  icon: LucideIcon;
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
    hoverSoft: 'rgba(255,255,255,0.05)',
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
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} rounded-xl px-3 py-3`}
          style={{ backgroundColor: palette.hover }}
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="h-5 w-5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
            {!isCollapsed && (
              <div
                className="h-4 rounded"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  width: `${95 + i * 12}px`,
                }}
              />
            )}
          </div>
          {!isCollapsed && (
            <div className="h-4 w-4 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { canAccess, isAdmin, isLoading } = usePermission();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

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
      {
        key: 'atendimento',
        title: 'Atendimento',
        icon: MessageSquare,
        items: serviceItems,
      },
      {
        key: 'vendas',
        title: 'Vendas',
        icon: LayoutDashboard,
        items: salesItems,
      },
      {
        key: 'marketing',
        title: 'Marketing',
        icon: FolderKanban,
        items: marketingItems,
      },
      {
        key: 'configuracoes',
        title: 'Configurações',
        icon: Shield,
        items: settingsItems,
      },
    ];

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(canViewItem),
      }))
      .filter((section) => section.items.length > 0);
  }, [canAccess, isAdmin, isLoading, isOwnerOrAdmin]);

  useEffect(() => {
    if (!visibleSections.length) return;

    const nextState: Record<string, boolean> = {};

    for (const section of visibleSections) {
      const hasActiveItem = section.items.some(
        (item) => pathname === item.path || pathname?.startsWith(item.path + '/')
      );
      nextState[section.key] = hasActiveItem;
    }

    setOpenSections((prev) => {
      const merged = { ...prev };

      for (const section of visibleSections) {
        if (typeof merged[section.key] === 'undefined') {
          merged[section.key] = nextState[section.key];
        } else if (nextState[section.key]) {
          merged[section.key] = true;
        }
      }

      return merged;
    });
  }, [pathname, visibleSections]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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
        className="fixed left-4 top-4 z-50 rounded-xl p-2 text-white shadow-lg transition-opacity hover:opacity-80 lg:hidden"
        style={{ backgroundColor: BRAND.primary }}
        aria-label={isMobileOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden text-white
          transform transition-all duration-300 ease-in-out
          w-72 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isDesktopCollapsed ? 'lg:w-[88px]' : 'lg:w-72'}
          lg:static
        `}
        style={{ backgroundColor: palette.bg }}
      >
        <div
          className={`border-b transition-all duration-300 ${isDesktopCollapsed ? 'p-3' : 'p-5'}`}
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
                className={`${isDesktopCollapsed ? 'h-10 w-10' : 'h-11 w-11'} object-contain`}
              />
            </div>

            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="hidden h-10 w-10 items-center justify-center rounded-xl border transition-colors lg:inline-flex"
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

        <nav className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <SidebarSkeleton palette={palette} isCollapsed={isDesktopCollapsed} />
          ) : (
            <div className="space-y-2">
              {visibleSections.map((section) => {
                const SectionIcon = section.icon;
                const isOpen = !!openSections[section.key];
                const hasActiveItem = section.items.some(
                  (item) => pathname === item.path || pathname?.startsWith(item.path + '/')
                );

                return (
                  <div
                    key={section.key}
                    className="overflow-hidden rounded-2xl"
                    style={{
                      backgroundColor: isOpen || hasActiveItem ? palette.hoverSoft : 'transparent',
                      border: `1px solid ${isOpen || hasActiveItem ? palette.border : 'transparent'}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className={`flex w-full items-center rounded-2xl transition-colors ${
                        isDesktopCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-3'
                      }`}
                      style={{
                        backgroundColor: hasActiveItem && !isOpen ? palette.hover : 'transparent',
                        color: BRAND.white,
                      }}
                      title={isDesktopCollapsed ? section.title : undefined}
                    >
                      <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center' : 'gap-3'}`}>
                        <SectionIcon size={20} />
                        {!isDesktopCollapsed && (
                          <span className="text-sm font-semibold tracking-[0.01em]">{section.title}</span>
                        )}
                      </div>

                      {!isDesktopCollapsed && (
                        <ChevronDown
                          size={18}
                          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>

                    {!isDesktopCollapsed && isOpen && (
                      <ul className="space-y-1 px-2 pb-2">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const isActive =
                            pathname === item.path || pathname?.startsWith(item.path + '/');

                          return (
                            <li key={item.path}>
                              <Link
                                href={item.path}
                                onClick={() => setIsMobileOpen(false)}
                                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
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
                              >
                                <Icon size={18} />
                                <span className="text-sm">{item.name}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {!isDesktopCollapsed && <UsageBanner />}

        <div className="border-t p-3" style={{ borderColor: palette.border }}>
          <div
            className={`rounded-xl ${isDesktopCollapsed ? 'p-2' : 'p-3'}`}
            style={{ backgroundColor: palette.bgDarker }}
          >
            <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center' : 'gap-3'}`}>
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: palette.active }}
                title={userName}
              >
                {userInitial}
              </div>

              {!isDesktopCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{userName}</p>
                  <p className="text-xs" style={{ color: palette.textMuted }}>
                    {ROLE_DISPLAY[userRole] || userRole}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl text-white font-medium transition-opacity hover:opacity-80 ${
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
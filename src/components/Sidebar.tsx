// src/components/Sidebar.tsx
// Sidebar reorganizada por blocos
// Menu recolhível no desktop
// Blocos em acordeão
// "Aparência" oculto da navegação
// Identidade resolvida no servidor por organização e contrato White-Label.

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
  Shield,
  UserCog,
  CreditCard,
  Target,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { useState, useMemo, useEffect, useSyncExternalStore } from 'react';
import { usePermission } from '@/hooks/usePermission';
import dynamic from 'next/dynamic';
import { DEFAULT_BRANDING, brandingValues, brandForeground, type OrgBranding } from '@/lib/branding-values';
import BrandLogo from '@/components/BrandLogo';
import type { ApplicationContext } from '@/lib/authorization/application-context';
import type { CommercialModuleId } from '@/lib/entitlements/catalog';
import type { PermissionModule } from '@/types/permissions';

const UsageBanner = dynamic(() => import('@/components/UsageBanner'), {
  ssr: false,
});

interface MenuItem {
  name: string;
  icon: LucideIcon;
  path: string;
  module?: PermissionModule;
  additionalPermission?: PermissionModule;
  commercialModule?: CommercialModuleId;
}

interface MenuSection {
  key: string;
  title: string;
  icon: LucideIcon;
  items: MenuItem[];
  commercialModule?: CommercialModuleId;
}

function makePalette(brand: OrgBranding) {
  const text = brandForeground(brand.primaryColor);
  return {
    bg: brand.primaryColor, bgDark: brand.primaryColor, bgDarker: 'var(--brand-hover)',
    active: brand.secondaryColor, activeText: brandForeground(brand.secondaryColor), text,
    hover: 'var(--brand-hover)', hoverSoft: 'var(--brand-hover)',
    border: 'currentColor', textMuted: text, textLabel: text,
  };
}

const salesItems: MenuItem[] = [
  { name: 'Leads', icon: Users, path: '/leads', module: 'leads' },
  { name: 'Kanban', icon: Kanban, path: '/kanban', module: 'kanban' },
  { name: 'Agenda', icon: Calendar, path: '/agenda', module: 'agenda' },
  { name: 'Follow-ups', icon: CheckSquare, path: '/follow-ups', module: 'leads', additionalPermission: 'tasks' },
  { name: 'Metas', icon: Target, path: '/goals', module: 'goals' },
];

const serviceItems: MenuItem[] = [
  { name: 'Atendimento', icon: MessageSquare, path: '/atendimento', module: 'atendimento' },
];

const marketingItems: MenuItem[] = [
  { name: 'Projetos', icon: FolderKanban, path: '/projects', module: 'projects' },
  { name: 'OS', icon: FileText, path: '/os', module: 'os' },
  { name: 'Tarefas', icon: CheckSquare, path: '/tasks', module: 'tasks' },
  { name: 'Relatórios', icon: BarChart3, path: '/reports', module: 'reports', commercialModule: 'vendas', additionalPermission: 'leads' },
];

const settingsItems: MenuItem[] = [
  { name: 'Atendimento', icon: MessageSquare, path: '/settings/atendimento', module: 'integrations', commercialModule: 'atendimento' },
  { name: 'Membros', icon: Shield, path: '/settings/members', module: 'users' },
  { name: 'Assinatura', icon: CreditCard, path: '/settings/billing' },
  { name: 'Minha Conta', icon: UserCog, path: '/settings/account' },
];

const helpItems: MenuItem[] = [
  { name: 'Central de Ajuda', icon: HelpCircle, path: '/help' },
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

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('mds:sidebar:collapsed', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('mds:sidebar:collapsed', onChange);
  };
}

export default function Sidebar({ access, branding = DEFAULT_BRANDING }: { access: ApplicationContext; branding?: OrgBranding }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { canAccess, isAdmin, isLoading } = usePermission();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isCollapsed = useSyncExternalStore(subscribeCollapsed,
    () => window.localStorage.getItem('mds:sidebar:collapsed') === '1', () => false);
  const toggleCollapsed = () => {
    window.localStorage.setItem('mds:sidebar:collapsed', isCollapsed ? '0' : '1');
    window.dispatchEvent(new Event('mds:sidebar:collapsed'));
  };
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const brand = useMemo(() => brandingValues(branding), [branding]);
  const palette = useMemo(() => makePalette(brand), [brand]);

  useEffect(() => {
    const width = isCollapsed ? '88px' : '288px';
    document.documentElement.style.setProperty('--app-sidebar-width', width);

    window.dispatchEvent(
      new CustomEvent('mds:sidebar-width-change', {
        detail: { collapsed: isCollapsed, width },
      })
    );
  }, [isCollapsed]);

  const sameIdentity = session?.user?.id === access.userId && session?.user?.organizationId === access.organizationId;
  const dashboardItem: MenuItem = { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' };

  const visibleSections = useMemo<MenuSection[]>(() => {
    if (isLoading || !sameIdentity) return [];

    const canViewItem = (item: MenuItem) => {
      if (item.commercialModule && !access.modules.includes(item.commercialModule)) return false;
      if (item.module && !access.views[item.module]) return false;
      if (item.additionalPermission && (!access.views[item.additionalPermission] || !canAccess(item.additionalPermission))) return false;
      if (!item.module) return true;
      if (item.module === 'users') return isAdmin;
      return canAccess(item.module);
    };

    const sections: MenuSection[] = [
      {
        key: 'atendimento',
        commercialModule: 'atendimento',
        title: 'Atendimento',
        icon: MessageSquare,
        items: serviceItems,
      },
      {
        key: 'vendas',
        commercialModule: 'vendas',
        title: 'Vendas',
        icon: LayoutDashboard,
        items: salesItems,
      },
      {
        key: 'marketing',
        commercialModule: 'marketing',
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
      {
        key: 'ajuda',
        title: 'Ajuda',
        icon: HelpCircle,
        items: helpItems,
      },
    ];

    return sections
      .filter(section => !section.commercialModule || access.modules.includes(section.commercialModule))
      .map((section) => ({
        ...section,
        items: section.items.filter(canViewItem),
      }))
      .filter((section) => section.items.length > 0);
  }, [canAccess, isAdmin, isLoading, access, sameIdentity]);

  const toggleSection = (key: string) => {
    const section = visibleSections.find(section => section.key === key);
    const active = section?.items.some(item => pathname === item.path || pathname?.startsWith(item.path + '/')) ?? false;
    setOpenSections(prev => ({ ...prev, [key]: !(prev[key] ?? active) }));
  };

  const handleLogout = () => signOut({ callbackUrl: '/auth/login' });

  const userName = session?.user?.name || 'Usuário';
  const userRole = session?.user?.role || 'user';
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
        style={{ backgroundColor: brand.primaryColor, color: palette.text }}
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
        style={{ backgroundColor: palette.bg, color: palette.text }}
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
            <div className="flex min-w-0 flex-1 items-center justify-center">
              <BrandLogo key={brand.logo + ':' + brand.favicon} branding={brand} compact={isDesktopCollapsed} documentIcon />
            </div>

            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden h-10 w-10 items-center justify-center rounded-xl border transition-colors lg:inline-flex"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.hover,
                color: palette.text,
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
              <Link
                href={dashboardItem.path}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center rounded-2xl transition-colors ${
                  isDesktopCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-3'
                }`}
                style={{
                  backgroundColor:
                    pathname === dashboardItem.path || pathname?.startsWith(dashboardItem.path + '/')
                      ? palette.active
                      : 'transparent',
                  color:
                    pathname === dashboardItem.path || pathname?.startsWith(dashboardItem.path + '/')
                      ? palette.activeText
                      : palette.textMuted,
                  fontWeight:
                    pathname === dashboardItem.path || pathname?.startsWith(dashboardItem.path + '/')
                      ? 600
                      : 500,
                }}
                title={isDesktopCollapsed ? dashboardItem.name : undefined}
              >
                <LayoutDashboard size={20} />
                {!isDesktopCollapsed && <span className="text-sm">Dashboard</span>}
              </Link>

              {visibleSections.map((section) => {
                const SectionIcon = section.icon;
                const hasActiveItem = section.items.some(
                  (item) => pathname === item.path || pathname?.startsWith(item.path + '/')
                );
                const isOpen = openSections[section.key] ?? hasActiveItem;

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
                        color: palette.text,
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
                                  color: isActive ? palette.activeText : palette.textMuted,
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
                style={{ backgroundColor: palette.active, color: palette.activeText }}
                title={userName}
              >
                {userInitial}
              </div>

              {!isDesktopCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: palette.text }}>{userName}</p>
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

// src/components/Sidebar.tsx
// Sidebar com filtragem de menus por permissão do usuário
// Skeleton loading enquanto carrega permissões (evita flash visual)
// ✅ Inclui UsageBanner com indicador de uso do plano
// ✅ 3.4 White-label: logo e cores dinâmicas da organização

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
  Paintbrush,
  Target,
  MessageSquare,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { usePermission } from '@/hooks/usePermission';
import dynamic from 'next/dynamic';

const UsageBanner = dynamic(() => import('@/components/UsageBanner'), {
  ssr: false,
});
import type { PermissionModule } from '@/types/permissions';

// Paleta da marca
const BRAND = {
  bg:         '#2f3453',
  bgDark:     '#252a43',
  bgDarker:   '#1e2236',
  active:     '#3d4466',
  hover:      '#363c5e',
  border:     'rgba(255,255,255,0.08)',
  textMuted:  'rgba(255,255,255,0.5)',
  textLabel:  'rgba(255,255,255,0.35)',
};

interface MenuItem {
  name:      string;
  icon:      React.ComponentType<any>;
  path:      string;
  module?:   PermissionModule;
  ownerOnly?: boolean;
}

interface OrgBranding {
  name:           string;
  logo:           string | null;
  primaryColor:   string;
  secondaryColor: string;
}

const menuItems: MenuItem[] = [
  { name: 'Dashboard',   icon: LayoutDashboard, path: '/dashboard'                      },
  { name: 'Leads',       icon: Users,           path: '/leads',    module: 'leads'      },
  { name: 'Kanban',      icon: Kanban,          path: '/kanban',   module: 'kanban'     },
  { name: 'Projetos',    icon: FolderKanban,    path: '/projects', module: 'projects'   },
  { name: 'OS',          icon: FileText,        path: '/os',       module: 'os'         },
  { name: 'Tarefas',     icon: CheckSquare,     path: '/tasks',    module: 'tasks'      },
  { name: 'Agenda',      icon: Calendar,        path: '/agenda',   module: 'agenda'     },
  { name: 'Metas',       icon: Target,          path: '/goals',    module: 'goals'      },
  { name: 'Atendimento', icon: MessageSquare,   path: '/atendimento'                    },
  { name: 'Relatórios',  icon: BarChart3,       path: '/reports',  module: 'reports'    },
];

const settingsItems: MenuItem[] = [
  { name: 'Integrações', icon: Plug,       path: '/settings/integrations', module: 'integrations' },
  { name: 'Membros',     icon: Shield,     path: '/settings/members',      module: 'users'        },
  { name: 'Aparência',   icon: Paintbrush, path: '/settings/branding',     ownerOnly: true        },
  { name: 'Assinatura',  icon: CreditCard, path: '/settings/billing'                              },
  { name: 'Minha Conta', icon: UserCog,    path: '/settings/account'                              },
];

function SidebarSkeleton() {
  return (
    <div className="animate-pulse">
      <p className="text-xs font-semibold mb-3 px-3" style={{ color: BRAND.textLabel }}>MENU PRINCIPAL</p>
      <ul className="space-y-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={i}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-5 h-5 rounded" style={{ backgroundColor: BRAND.hover }} />
              <div className="h-4 rounded flex-1" style={{ backgroundColor: BRAND.hover, maxWidth: `${60 + i * 10}px` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs font-semibold mb-3 px-3 mt-6" style={{ color: BRAND.textLabel }}>CONFIGURAÇÕES</p>
      <ul className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="w-5 h-5 rounded" style={{ backgroundColor: BRAND.hover }} />
              <div className="h-4 rounded flex-1" style={{ backgroundColor: BRAND.hover, maxWidth: `${70 + i * 15}px` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar() {
  const pathname              = usePathname();
  const { data: session }     = useSession();
  const { canAccess, isAdmin, isLoading } = usePermission();
  const [isOpen, setIsOpen]   = useState(false);

  const [branding, setBranding] = useState<OrgBranding>({
    name:           'Mundo Digital',
    logo:           null,
    primaryColor:   '#2f3453',
    secondaryColor: '#252a43',
  });

  useEffect(() => {
    fetch('/api/organizations')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        setBranding({
          name:           data.name           ?? 'Mundo Digital',
          logo:           data.logo           ?? null,
          primaryColor:   data.primaryColor   ?? '#2f3453',
          secondaryColor: data.secondaryColor ?? '#252a43',
        });
        document.documentElement.style.setProperty('--color-primary',   data.primaryColor   ?? '#2f3453');
        document.documentElement.style.setProperty('--color-secondary', data.secondaryColor ?? '#252a43');
      })
      .catch(() => {});
  }, []);

  const role           = (session?.user as any)?.role ?? '';
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  const visibleMenu = useMemo(() => {
    if (isLoading) return [];
    return menuItems.filter((item) => !item.module || canAccess(item.module));
  }, [canAccess, isLoading]);

  const visibleSettings = useMemo(() => {
    if (isLoading) return [];
    return settingsItems.filter((item) => {
      if (item.ownerOnly)          return isOwnerOrAdmin;
      if (!item.module)            return true;
      if (item.module === 'users') return isAdmin;
      return canAccess(item.module);
    });
  }, [canAccess, isAdmin, isLoading, isOwnerOrAdmin]);

  const handleLogout = () => signOut({ callbackUrl: '/auth/login' });

  const userName    = session?.user?.name          || 'Usuário';
  const userRole    = (session?.user as any)?.role || 'user';
  const userInitial = userName.charAt(0).toUpperCase();

  const ROLE_DISPLAY: Record<string, string> = {
    owner:   'Proprietário',
    admin:   'Administrador',
    manager: 'Gerente',
    user:    'Usuário',
  };

  return (
    <>
      {/* Mobile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 text-white rounded-lg shadow-lg transition-opacity hover:opacity-80"
        style={{ backgroundColor: BRAND.bg }}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay Mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-72 text-white flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ backgroundColor: BRAND.bg }}
      >
        {/* ── Logo / Branding ── */}
        <div className="p-6" style={{ borderBottom: `1px solid ${BRAND.border}` }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex-shrink-0">
              {branding.logo ? (
                <img
                  src={branding.logo}
                  alt={`${branding.name} logo`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/logo-fundo-escuro.png';
                  }}
                />
              ) : (
                <img
                  src="/images/logo-fundo-escuro.png"
                  alt="Mundo Digital Logo"
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-base leading-tight mb-0.5 truncate text-white">
                {branding.name}
              </h1>
              <p className="text-[10.5px] leading-tight" style={{ color: BRAND.textMuted }}>
                Soluções em Marketing e Vendas
              </p>
            </div>
          </div>
        </div>

        {/* ── Nav ── */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {isLoading ? (
            <SidebarSkeleton />
          ) : (
            <>
              {visibleMenu.length > 0 && (
                <>
                  <p className="text-xs font-semibold mb-3 px-3 tracking-wider" style={{ color: BRAND.textLabel }}>
                    MENU PRINCIPAL
                  </p>
                  <ul className="space-y-0.5">
                    {visibleMenu.map((item) => {
                      const Icon     = item.icon;
                      const isActive = pathname === item.path;
                      return (
                        <li key={item.path}>
                          <Link
                            href={item.path}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                            style={{
                              backgroundColor: isActive ? BRAND.active : 'transparent',
                              color: isActive ? '#ffffff' : BRAND.textMuted,
                              fontWeight: isActive ? 600 : 400,
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = BRAND.hover;
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            }}
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

              {visibleSettings.length > 0 && (
                <>
                  <p className="text-xs font-semibold mb-3 px-3 mt-6 tracking-wider" style={{ color: BRAND.textLabel }}>
                    CONFIGURAÇÕES
                  </p>
                  <ul className="space-y-0.5">
                    {visibleSettings.map((item) => {
                      const Icon     = item.icon;
                      const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
                      return (
                        <li key={item.path}>
                          <Link
                            href={item.path}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                            style={{
                              backgroundColor: isActive ? BRAND.active : 'transparent',
                              color: isActive ? '#ffffff' : BRAND.textMuted,
                              fontWeight: isActive ? 600 : 400,
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = BRAND.hover;
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            }}
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
            </>
          )}
        </nav>

        {/* ── Usage Banner ── */}
        <UsageBanner />

        {/* ── User Profile ── */}
        <div className="p-4" style={{ borderTop: `1px solid ${BRAND.border}` }}>
          <div
            className="flex items-center gap-3 p-3 rounded-lg"
            style={{ backgroundColor: BRAND.bgDarker }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 text-sm"
              style={{ backgroundColor: BRAND.active }}
            >
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate text-white">{userName}</p>
              <p className="text-xs" style={{ color: BRAND.textMuted }}>
                {ROLE_DISPLAY[userRole] || userRole}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-white font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#c0392b' }}
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { LayoutDashboard, Users, FolderKanban, Kanban, FileText, CheckSquare, Calendar, BarChart3, Menu, X } from 'lucide-react';
import { useState } from 'react';

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Leads', icon: Users, path: '/dashboard/leads' },
  { name: 'Projetos', icon: FolderKanban, path: '/dashboard/projects' },
  { name: 'Kanban', icon: Kanban, path: '/dashboard/kanban' },
  { name: 'OS', icon: FileText, path: '/dashboard/os' },
  { name: 'Tarefas', icon: CheckSquare, path: '/dashboard/tasks' },
  { name: 'Agenda', icon: Calendar, path: '/dashboard/agenda' },
  { name: 'Relatórios', icon: BarChart3, path: '/dashboard/reports' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

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
          <p className="text-xs font-semibold text-indigo-300 mb-3 px-3">MENU PRINCIPAL</p>
          <ul className="space-y-1">
            {menuItems.map((item) => {
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
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-indigo-700">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-800">
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0">
              F
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">Fábio Alves Ramos</p>
              <p className="text-xs text-indigo-300">Usuário</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

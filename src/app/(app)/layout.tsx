// src/app/(app)/layout.tsx

import { Metadata } from 'next';
import Sidebar from '@/components/Sidebar'; // ✅ Importe sua Sidebar

export const metadata: Metadata = {
  title: "MDS CRM - Dashboard", // Pode ajustar o título padrão para estas rotas
  description: "Sistema de Gestão de Leads e Projetos",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50"> {/* O div principal que organiza sidebar e conteúdo */}
      <Sidebar /> {/* ✅ Renderiza sua Sidebar */}
      <main className="flex-1 lg:ml-0"> {/* A área de conteúdo principal */}
        {children} {/* ✅ Renderiza o conteúdo da página (ex: LeadsPage, DashboardPage) */}
      </main>
    </div>
  );
}

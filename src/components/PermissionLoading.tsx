// src/components/PermissionLoading.tsx
// Loading padrão enquanto verifica permissões

'use client';

import { Loader2 } from 'lucide-react';

export default function PermissionLoading() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-indigo-600 mr-3" size={28} />
        <span className="text-gray-600 text-lg">Verificando permissões...</span>
      </div>
    </div>
  );
}

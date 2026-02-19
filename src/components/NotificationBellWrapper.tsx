// src/components/NotificationBellWrapper.tsx
// Wrapper client-side para permitir dynamic import com ssr: false no layout (Server Component)
'use client';

import dynamic from 'next/dynamic';

const NotificationBell = dynamic(() => import('@/components/NotificationBell'), {
  ssr: false,
  loading: () => <div className="w-9 h-9" />, // placeholder do tamanho do sino
});

export default function NotificationBellWrapper() {
  return <NotificationBell />;
}

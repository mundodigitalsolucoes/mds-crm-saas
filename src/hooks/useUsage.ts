// src/hooks/useUsage.ts
// Hook centralizado para buscar usage/limites da organização
// Usa TanStack Query com cache de 60s e refetch em focus
'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

// ============================================
// TIPO QUE REFLETE O RETORNO REAL DA API
// ============================================

interface ResourceInfo {
  current: number;
  max: number;
  percentage: number;
}

export interface UsageData {
  plan: string;
  planStatus: string;
  trialEndsAt: string | null;
  resources: {
    users: ResourceInfo;
    leads: ResourceInfo;
    projects: ResourceInfo;
    os: ResourceInfo;
  };
}

async function fetchUsage(): Promise<UsageData> {
  const { data } = await axios.get('/api/usage');
  return data;
}

export function useUsage() {
  const query = useQuery<UsageData>({
    queryKey: ['organization-usage'],
    queryFn: fetchUsage,
    staleTime: 60 * 1000, // 60s cache
    refetchOnWindowFocus: true,
    retry: 1,
  });

  /** Verifica se um recurso atingiu o limite (-1 = ilimitado) */
  const isAtLimit = (resource: keyof UsageData['resources']): boolean => {
    if (!query.data) return false;
    const r = query.data.resources[resource];
    if (r.max <= 0) return false; // ilimitado
    return r.current >= r.max;
  };

  /** Verifica se o plano está inativo */
  const isPlanInactive = (): boolean => {
    if (!query.data) return false;
    return !['active', 'trial'].includes(query.data.planStatus);
  };

  /** Retorna texto amigável do limite: "45 / 100" ou "45 / ∞" */
  const formatUsage = (resource: keyof UsageData['resources']): string => {
    if (!query.data) return '...';
    const r = query.data.resources[resource];
    return r.max <= 0 ? `${r.current} / ∞` : `${r.current} / ${r.max}`;
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isAtLimit,
    isPlanInactive,
    formatUsage,
  };
}

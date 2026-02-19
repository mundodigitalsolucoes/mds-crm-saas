// src/hooks/useUsage.ts
// Hook centralizado para buscar usage/limites da organização
// Usa TanStack Query com cache de 60s e refetch em focus
'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export interface UsageData {
  organization: {
    id: string;
    name: string;
    plan: string;
    planStatus: string;
    trialEndsAt: string | null;
  };
  limits: {
    maxUsers: number;
    maxLeads: number;
    maxProjects: number;
    maxOs: number;
  };
  usage: {
    users: number;
    leads: number;
    projects: number;
    serviceOrders: number;
  };
  percentages: {
    users: number;
    leads: number;
    projects: number;
    serviceOrders: number;
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
  const isAtLimit = (resource: 'users' | 'leads' | 'projects' | 'serviceOrders'): boolean => {
    if (!query.data) return false;

    const limitMap: Record<string, number> = {
      users: query.data.limits.maxUsers,
      leads: query.data.limits.maxLeads,
      projects: query.data.limits.maxProjects,
      serviceOrders: query.data.limits.maxOs,
    };

    const limit = limitMap[resource];
    if (limit === -1) return false; // ilimitado
    return query.data.usage[resource] >= limit;
  };

  /** Verifica se o plano está inativo */
  const isPlanInactive = (): boolean => {
    if (!query.data) return false;
    return !['active', 'trial'].includes(query.data.organization.planStatus);
  };

  /** Retorna texto amigável do limite: "45 / 100" ou "45 / ∞" */
  const formatUsage = (resource: 'users' | 'leads' | 'projects' | 'serviceOrders'): string => {
    if (!query.data) return '...';

    const limitMap: Record<string, number> = {
      users: query.data.limits.maxUsers,
      leads: query.data.limits.maxLeads,
      projects: query.data.limits.maxProjects,
      serviceOrders: query.data.limits.maxOs,
    };

    const usage = query.data.usage[resource];
    const limit = limitMap[resource];

    return limit === -1 ? `${usage} / ∞` : `${usage} / ${limit}`;
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

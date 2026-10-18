import { notFound, redirect } from 'next/navigation';
import { evaluateModuleAccess } from './server';
import { recordAuthorizationObservation } from './guards';
import type { ModuleAccessRequest } from './authorize';

export async function checkModulePage(request: ModuleAccessRequest) {
  const { decision, block } = await evaluateModuleAccess(request);
  recordAuthorizationObservation(request, decision);
  // Authentication is required for this protected page even while commercial decisions are observed.
  if (!decision.allowed && decision.reason === 'unauthenticated') redirect('/auth/login');
  if (!block) return;
  if (!decision.allowed && decision.reason === 'infrastructure_error') throw new Error('Authorization unavailable');
  notFound();
}

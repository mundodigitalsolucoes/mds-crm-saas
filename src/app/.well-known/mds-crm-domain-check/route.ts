import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveRequestDomain, domainFeatureEnabled } from '@/lib/domains/request';
import { readDomainState } from '@/lib/domains/model';
import { proxySecret, routingProof } from '@/lib/domains/network';

/** Public routing attestation only. No user identity, files, provider config or secret. */
export async function GET(req: NextRequest) {
  if (!domainFeatureEnabled()) return new NextResponse(null, { status: 404 });
  const context = await resolveRequestDomain(req.headers);
  const nonce = req.nextUrl.searchParams.get('nonce') || '';
  const secret = proxySecret();
  if (context.kind !== 'custom' || !secret || !/^[a-f0-9]{64}$/.test(nonce)) return new NextResponse(null, { status: 404 });
  const org = await prisma.organization.findFirst({ where: { id: context.organizationId, domain: context.hostname, deletedAt: null }, select: { settings: true } });
  const state = org && readDomainState(org.settings);
  if (!state || state.status === 'disabled') return new NextResponse(null, { status: 404 });
  return NextResponse.json({ proof: routingProof(secret, context.hostname, state.challenge, nonce) }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

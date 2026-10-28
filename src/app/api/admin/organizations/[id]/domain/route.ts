import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { domainCommandSchema } from '@/lib/domains/model';
import { createDomainManager, domainView, DomainError } from '@/lib/domains/manager';

const privateHeaders = { 'Cache-Control': 'private, no-store' };
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const { id } = await params;
  const org = await prisma.organization.findFirst({ where: { id, deletedAt: null }, select: { id: true, domain: true, plan: true, features: true, settings: true } });
  if (!org) return NextResponse.json({ error: 'Organização indisponível' }, { status: 404 });
  return NextResponse.json(domainView(org), { headers: privateHeaders });
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdminToken();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  try {
    if (Number(req.headers.get('content-length') || 0) > 4096) return NextResponse.json({ error: 'Payload excessivo' }, { status: 413 });
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    if (reader) {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.byteLength;
        if (size > 4096) { void reader.cancel().catch(() => {}); return NextResponse.json({ error: 'Payload excessivo' }, { status: 413 }); }
        chunks.push(item.value);
      }
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
    const parsed = domainCommandSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Comando de domínio inválido' }, { status: 400 });
    const { id } = await params;
    const result = await createDomainManager(prisma)(id, admin.id, parsed.data);
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    const status = error instanceof DomainError ? error.status : 503;
    return NextResponse.json({ error: error instanceof DomainError ? error.code : 'DOMAIN_SERVICE_UNAVAILABLE' }, { status, headers: privateHeaders });
  }
}

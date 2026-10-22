// src/app/api/attachments/route.ts
// API de Attachments — Listagem e Upload com permissões granulares dinâmicas por entityType
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { commercialEntityDenial } from '@/lib/authorization/guards';
import { checkAuth, checkPermission } from '@/lib/checkPermission';
import { attachmentDownloadUrl, writePrivateAttachment, removePrivateAttachment, AttachmentStorageError, MAX_ATTACHMENT_BYTES, type AttachmentFile } from '@/lib/attachments/storage';
import { randomUUID } from 'crypto';
import { setTimeout, clearTimeout } from 'node:timers';
import type { PermissionModule } from '@/types/permissions';

// Mapa: entityType → módulo de permissão
const entityTypeToModule: Record<string, PermissionModule> = {
  task: 'tasks',
  lead: 'leads',
  kanban_card: 'tasks',
  goal: 'projects',
  comment: 'tasks', // attachments em comments herdam permissão de tasks
};

class AttachmentAccessError extends Error {
  constructor(readonly status: number) { super('Recurso indisponível ou não autorizado'); }
}
function attachmentError(error: unknown) {
  if (error instanceof AttachmentStorageError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof AttachmentAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && (['P2025', 'P2034'].includes(error.code) || (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))) return NextResponse.json({ error: 'Conflito de atualização; tente novamente' }, { status: 409 });
  return null;
}

// GET /api/attachments?entityType=task&entityId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType e entityId são obrigatórios' },
        { status: 400 }
      );
    }

    // ✅ Permissão granular dinâmica: entityType → módulo.view
    const permissionModule = entityTypeToModule[entityType];
    if (!permissionModule) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 });
    }

    const { allowed, session, errorResponse } = await checkPermission(permissionModule, 'view');
    if (!allowed) return errorResponse!;

    const attachments = await prisma.$transaction(async tx => {
      const denied = await commercialEntityDenial(tx, session!, entityType, entityId, 'view');
      if (denied) throw new AttachmentAccessError(denied.status);
      return tx.attachment.findMany({
      where: {
        organizationId: session!.user.organizationId,
        entityType,
        entityId,
        uploadedBy: { organizationId: session!.user.organizationId },
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    return NextResponse.json(
      attachments.map(a => ({
        ...a,
        url: attachmentDownloadUrl(a.id),
        createdAt: a.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    const denied = attachmentError(error);
    if (denied) return denied;
    console.error('Erro ao buscar attachments:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Cap the entire multipart envelope before invoking its parser, even without Content-Length.
const MAX_UPLOAD_BODY_BYTES = MAX_ATTACHMENT_BYTES + 64 * 1024;
async function boundedMultipart(request: NextRequest): Promise<FormData> {
  const type = request.headers.get('content-type') || '';
  if (!/^multipart\/form-data(?:\s*;|$)/i.test(type)) throw new AttachmentAccessError(415);
  if (!/;\s*boundary=(?:"[^"]+"|[^;\s]+)(?:\s*;|\s*$)/i.test(type)) throw new AttachmentAccessError(400);
  const declared = request.headers.get('content-length');
  if (declared !== null && !/^\d+$/.test(declared)) throw new AttachmentAccessError(400);
  if (declared !== null && BigInt(declared) > BigInt(MAX_UPLOAD_BODY_BYTES)) throw new AttachmentAccessError(413);
  if (!request.body) throw new AttachmentAccessError(400);
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => undefined);
    reject(new AttachmentAccessError(408));
  }, 15000); });
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (expired) throw new AttachmentAccessError(408);
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new AttachmentAccessError(413);
      }
      if (value.byteLength) chunks.push(Buffer.from(value));
    }
    try {
      return await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { 'content-type': type } }).formData();
    } catch { throw new AttachmentAccessError(400); }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

// POST /api/attachments (multipart/form-data)
export async function POST(request: NextRequest) {
  let pendingFile: AttachmentFile | undefined;
  try {
    const auth = await checkAuth();
    if (!auth.authenticated) return auth.errorResponse!;
    // Entity lives in the body: deny actors with no applicable edit permission before reading it.
    // Specific entity/module authorization remains mandatory after bounded parsing and under lock.
    const admission = await Promise.all(['tasks', 'leads', 'projects'].map(module => checkPermission(module as PermissionModule, 'edit')));
    if (!admission.some(result => result.allowed)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    const formData = await boundedMultipart(request);
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string;
    const entityId = formData.get('entityId') as string;

    if (!file || typeof file.arrayBuffer !== 'function' || typeof file.name !== 'string' || typeof entityType !== 'string' || !entityType || typeof entityId !== 'string' || !entityId) {
      return NextResponse.json(
        { error: 'file, entityType e entityId são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar tipo de entidade
    const validEntityTypes = ['task', 'lead', 'kanban_card', 'goal', 'comment'];
    if (!validEntityTypes.includes(entityType)) {
      return NextResponse.json(
        { error: 'entityType inválido' },
        { status: 400 }
      );
    }

    // ✅ Permissão granular dinâmica: entityType → módulo.edit
    // Upload requer permissão de edição no módulo-pai
    const permissionModule = entityTypeToModule[entityType];
    if (!permissionModule) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 });
    }

    const { allowed, session, errorResponse } = await checkPermission(permissionModule, 'edit');
    if (!allowed) return errorResponse!;

    // Validar tamanho (max 10MB)
    const MAX_SIZE = MAX_ATTACHMENT_BYTES;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo: 10MB' },
        { status: 413 }
      );
    }

    const attachment = await prisma.$transaction(async tx => {
      const denied = await commercialEntityDenial(tx, session!, entityType, entityId, 'edit');
      if (denied) throw new AttachmentAccessError(denied.status);
      const id = randomUUID();
      const filename = `${id}.bin`;
      const url = attachmentDownloadUrl(id);
      const bytes = Buffer.from(await file.arrayBuffer());
      const storedFile = { id, organizationId: session!.user.organizationId, filename, url };
      await writePrivateAttachment(storedFile, bytes);
      pendingFile = storedFile;

    // Criar registro no banco
    return tx.attachment.create({
      data: {
        id,
        organizationId: session!.user.organizationId,
        entityType,
        entityId,
        filename,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        url,
        uploadedById: session!.user.id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    pendingFile = undefined;

    return NextResponse.json({
      ...attachment,
      createdAt: attachment.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (pendingFile) await removePrivateAttachment(pendingFile).catch(() => console.error('Falha na limpeza do upload não confirmado'));
    const denied = attachmentError(error);
    if (denied) return denied;
    console.error('Erro ao criar attachment:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

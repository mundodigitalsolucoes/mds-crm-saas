// src/app/api/attachments/route.ts
// API de Attachments — Listagem e Upload com permissões granulares dinâmicas por entityType
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { commercialEntityDenial } from '@/lib/authorization/guards';
import { checkPermission } from '@/lib/checkPermission';
import { attachmentDownloadUrl, writePrivateAttachment, removePrivateAttachment, AttachmentStorageError, type AttachmentFile } from '@/lib/attachments/storage';
import { randomUUID } from 'crypto';
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

// POST /api/attachments (multipart/form-data)
export async function POST(request: NextRequest) {
  let pendingFile: AttachmentFile | undefined;
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string;
    const entityId = formData.get('entityId') as string;

    if (!file || typeof file.arrayBuffer !== 'function' || typeof file.name !== 'string' || !entityType || !entityId) {
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
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo: 10MB' },
        { status: 400 }
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

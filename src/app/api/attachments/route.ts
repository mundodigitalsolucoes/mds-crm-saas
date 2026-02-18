// src/app/api/attachments/route.ts
// API de Attachments — Listagem e Upload com permissões granulares dinâmicas por entityType
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
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
    const module = entityTypeToModule[entityType];
    if (!module) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 });
    }

    const { allowed, session, errorResponse } = await checkPermission(module, 'view');
    if (!allowed) return errorResponse!;

    const attachments = await prisma.attachment.findMany({
      where: {
        organizationId: session!.user.organizationId,
        entityType,
        entityId,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      attachments.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('Erro ao buscar attachments:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST /api/attachments (multipart/form-data)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string;
    const entityId = formData.get('entityId') as string;

    if (!file || !entityType || !entityId) {
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
    const module = entityTypeToModule[entityType];
    if (!module) {
      return NextResponse.json({ error: 'entityType inválido' }, { status: 400 });
    }

    const { allowed, session, errorResponse } = await checkPermission(module, 'edit');
    if (!allowed) return errorResponse!;

    // Validar tamanho (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo: 10MB' },
        { status: 400 }
      );
    }

    // Gerar nome único
    const ext = file.name.split('.').pop() || 'bin';
    const filename = `${randomUUID()}.${ext}`;

    // Criar diretório de uploads se não existir
    const uploadDir = join(process.cwd(), 'public', 'uploads', session!.user.organizationId);
    await mkdir(uploadDir, { recursive: true });

    // Salvar arquivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadDir, filename);
    await writeFile(filePath, buffer);

    // URL pública
    const url = `/uploads/${session!.user.organizationId}/${filename}`;

    // Criar registro no banco
    const attachment = await prisma.attachment.create({
      data: {
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

    return NextResponse.json({
      ...attachment,
      createdAt: attachment.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar attachment:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Espera payload:
 * {
 *   "organizationId": "uuid-da-org",
 *   "leads": [
 *     {
 *       "nome" | "name": "...",
 *       "email": "...",
 *       "telefone" | "phone": "...",
 *       "empresa" | "company": "...",
 *       "status": "new" | "contacted" | ...,
 *       "origem" | "source": "chatwoot" | "website" | ...
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leads, organizationId } = body ?? {};

    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json(
        { error: 'organizationId é obrigatório' },
        { status: 400 }
      );
    }

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // (Opcional) valida se org existe para evitar FK/erro silencioso
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'organizationId inválido (organização não encontrada)' },
        { status: 404 }
      );
    }

    let sucesso = 0;
    let falhas = 0;

    for (const lead of leads) {
      try {
        const name =
          (typeof lead?.name === 'string' && lead.name) ||
          (typeof lead?.nome === 'string' && lead.nome) ||
          '';

        if (!name.trim()) {
          falhas++;
          continue;
        }

        const email = typeof lead?.email === 'string' ? lead.email : null;

        const phone =
          (typeof lead?.phone === 'string' && lead.phone) ||
          (typeof lead?.telefone === 'string' && lead.telefone) ||
          null;

        const company =
          (typeof lead?.company === 'string' && lead.company) ||
          (typeof lead?.empresa === 'string' && lead.empresa) ||
          null;

        const source =
          (typeof lead?.source === 'string' && lead.source) ||
          (typeof lead?.origem === 'string' && lead.origem) ||
          null;

        const status =
          typeof lead?.status === 'string' && lead.status
            ? lead.status
            : 'new';

        await prisma.lead.create({
          data: {
            organizationId,
            name: name.trim(),
            email,
            phone,
            company,
            source,
            status,
            // createdAt é automático no schema (@default(now()))
          },
        });

        sucesso++;
      } catch (error) {
        console.error('Erro ao inserir lead:', error);
        falhas++;
      }
    }

    return NextResponse.json({
      sucesso,
      falhas,
      total: leads.length,
      message: `${sucesso} leads importados com sucesso, ${falhas} falharam`,
    });
  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json({ error: 'Erro ao importar leads' }, { status: 500 });
  } finally {
    // Em serverless, desconectar sempre pode ser ruim, mas no seu caso (Coolify/Node) ok.
    // Se você tiver muitos requests concorrentes, depois a gente melhora usando singleton.
    await prisma.$disconnect();
  }
}

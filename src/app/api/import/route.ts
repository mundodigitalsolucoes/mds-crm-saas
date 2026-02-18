// src/app/api/import/route.ts
// Importação de leads via CSV/JSON com permissões granulares
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';

/**
 * Espera payload:
 * {
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
    // ✅ Permissão granular: leads.create (importar é criar leads em massa)
    const { allowed, session, errorResponse } = await checkPermission('leads', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    const body = await request.json();
    const { leads } = body ?? {};

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
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
  }
}

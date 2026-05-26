// src/app/api/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkPermission } from '@/lib/checkPermission';
import { parseBody, importLeadsSchema } from '@/lib/validations';

function getString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return null;
}

function getNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number' && !Number.isNaN(value)) return value;

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').trim();
    if (normalized === '') return null;
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function getScore(value: unknown): number {
  const parsed = getNumber(value);
  if (parsed === null) return 0;
  const score = Math.round(parsed);
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

export async function POST(request: NextRequest) {
  try {
    const { allowed, session, errorResponse } = await checkPermission('leads', 'create');
    if (!allowed) return errorResponse!;

    const organizationId = session!.user.organizationId;

    const body = await request.json();
    const parsed = parseBody(importLeadsSchema, body);
    if (!parsed.success) return parsed.response;
    const { leads } = parsed.data;

    let sucesso = 0;
    let falhas = 0;

    for (const lead of leads) {
      try {
        const name = getString(lead?.name, lead?.nome);

        if (!name) {
          falhas++;
          continue;
        }

        const email = getString(lead?.email);
        const phone = getString(lead?.phone, lead?.telefone, lead?.telefone_fixo);
        const whatsapp = getString(lead?.whatsapp);
        const company = getString(lead?.company, lead?.empresa);
        const source = getString(lead?.source, lead?.origem) || 'csv_import';
        const status = getString(lead?.status) || 'new';
        const score = getScore(lead?.score);
        const value = getNumber(lead?.value ?? lead?.valor);
        const productOrService = getString(lead?.product_or_service, lead?.produto_servico);
        const city = getString(lead?.city, lead?.cidade);
        const website = getString(lead?.website, lead?.site);
        const instagram = getString(lead?.instagram);
        const facebook = getString(lead?.facebook);
        const linkedin = getString(lead?.linkedin);

        const inKanban =
          typeof lead?.inKanban === 'boolean'
            ? lead.inKanban
            : true;

        await prisma.lead.create({
          data: {
            organizationId,
            name,
            email,
            phone,
            whatsapp,
            company,
            source,
            status,
            inKanban,
            score,
            value,
            productOrService,
            city,
            website,
            instagram,
            facebook,
            linkedin,
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
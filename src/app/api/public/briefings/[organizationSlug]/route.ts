import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { applyRateLimit, API_RATE_LIMIT } from '@/lib/rate-limit';

const payloadSchema = z.object({
  formulario: z.string().max(100).default('briefing-sites-profissionais'),
  versao: z.number().int().positive().default(1),
  enviadoEm: z.string().optional(),
  respostas: z.record(z.any()),
  rastreamento: z.record(z.string()).optional().default({}),
});

function normalizePhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

function normalizeEmail(value?: string | null) {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return email || null;
}

function safeJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ organizationSlug: string }> }
) {
  try {
    const blocked = applyRateLimit(req, 'api', API_RATE_LIMIT);
    if (blocked) return blocked;

    const { organizationSlug } = await context.params;
    const organization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
      select: { id: true, slug: true, planStatus: true, deletedAt: true },
    });

    if (!organization || organization.deletedAt || organization.planStatus !== 'active') {
      return NextResponse.json({ error: 'Organização não disponível' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload inválido', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { respostas, rastreamento, formulario, versao } = parsed.data;

    const name = typeof respostas.nome === 'string' ? respostas.nome.trim() : '';
    const email = normalizeEmail(typeof respostas.email === 'string' ? respostas.email : null);
    const whatsapp = normalizePhone(
      typeof respostas.whatsapp === 'string' ? respostas.whatsapp : null
    );
    const company = typeof respostas.empresa === 'string' ? respostas.empresa.trim() : null;
    const city = typeof respostas.cidade === 'string' ? respostas.cidade.trim() : null;
    const website = typeof respostas.siteAtual === 'string' ? respostas.siteAtual.trim() : null;
    const position = typeof respostas.cargo === 'string' ? respostas.cargo.trim() : null;
    const projectId = typeof respostas.projectId === 'string' ? respostas.projectId.trim() : null;

    if (!name || (!email && !whatsapp)) {
      return NextResponse.json(
        { error: 'Nome e pelo menos e-mail ou WhatsApp são obrigatórios' },
        { status: 400 }
      );
    }

    const identityFilters: Array<Record<string, unknown>> = [];
    if (whatsapp) identityFilters.push({ whatsapp });
    if (email) identityFilters.push({ email: { equals: email, mode: 'insensitive' } });

    const existingLead = await prisma.lead.findFirst({
      where: {
        organizationId: organization.id,
        OR: identityFilters as any,
      },
      select: { id: true, customFields: true },
    });

    const submittedAt = new Date().toISOString();
    const briefingData = {
      formulario,
      versao,
      submittedAt,
      projectId,
      respostas,
      rastreamento,
    };

    let lead;

    if (existingLead) {
      const customFields = safeJsonObject(existingLead.customFields);
      const previousBriefings = Array.isArray(customFields.briefings)
        ? customFields.briefings
        : [];

      lead = await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          ...(name ? { name } : {}),
          ...(email ? { email } : {}),
          ...(whatsapp ? { whatsapp } : {}),
          ...(company ? { company } : {}),
          ...(position ? { position } : {}),
          ...(city ? { city } : {}),
          ...(website ? { website } : {}),
          source: 'briefing_site',
          utmSource: rastreamento.utm_source ?? undefined,
          utmMedium: rastreamento.utm_medium ?? undefined,
          utmCampaign: rastreamento.utm_campaign ?? undefined,
          utmContent: rastreamento.utm_content ?? undefined,
          utmTerm: rastreamento.utm_term ?? undefined,
          customFields: JSON.stringify({
            ...customFields,
            briefingStatus: 'submitted',
            briefingSubmittedAt: submittedAt,
            latestBriefing: briefingData,
            briefings: [...previousBriefings, briefingData].slice(-10),
          }),
        },
        select: { id: true, name: true, email: true, whatsapp: true, company: true },
      });
    } else {
      lead = await prisma.lead.create({
        data: {
          organizationId: organization.id,
          name,
          email,
          whatsapp,
          company,
          position,
          city,
          website,
          source: 'briefing_site',
          inKanban: false,
          productOrService: 'Site Profissional',
          utmSource: rastreamento.utm_source ?? null,
          utmMedium: rastreamento.utm_medium ?? null,
          utmCampaign: rastreamento.utm_campaign ?? null,
          utmContent: rastreamento.utm_content ?? null,
          utmTerm: rastreamento.utm_term ?? null,
          customFields: JSON.stringify({
            briefingStatus: 'submitted',
            briefingSubmittedAt: submittedAt,
            latestBriefing: briefingData,
            briefings: [briefingData],
          }),
        },
        select: { id: true, name: true, email: true, whatsapp: true, company: true },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        organization: organization.slug,
        leadId: lead.id,
        submittedAt,
      },
      { status: existingLead ? 200 : 201 }
    );
  } catch (error) {
    console.error('Erro ao receber briefing público:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

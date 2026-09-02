import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  applyPublicBookingRateLimit,
  getPublicBookingProfile,
  normalizeWhatsapp,
  publicBookingJson,
  publicBookingOptionsResponse,
} from '@/lib/public-booking';

const leadSchema = z.object({
  name: z.string().trim().min(2).max(255),
  company: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  whatsapp: z.string().trim().min(10).max(50),
  flow: z.enum(['consultoria', 'automacao']).default('consultoria'),
  qualification: z
    .record(z.union([z.string().max(1000), z.array(z.string().max(300)).max(20)]))
    .optional()
    .default({}),
  utmSource: z.string().trim().max(255).optional(),
  utmMedium: z.string().trim().max(255).optional(),
  utmCampaign: z.string().trim().max(255).optional(),
  utmContent: z.string().trim().max(255).optional(),
  utmTerm: z.string().trim().max(255).optional(),
  landingPage: z.string().trim().max(1000).optional(),
  referrer: z.string().trim().max(1000).optional(),
  honeypot: z.string().max(0).optional(),
});

function safeObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function OPTIONS() {
  return publicBookingOptionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationSlug: string; userSlug: string }> }
) {
  const blocked = applyPublicBookingRateLimit(request, 'capture-lead');
  if (blocked) return blocked;

  const { organizationSlug, userSlug } = await params;
  const profile = await getPublicBookingProfile(organizationSlug, userSlug);
  if (!profile) {
    return publicBookingJson({ error: 'Agenda pública não encontrada.' }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return publicBookingJson({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return publicBookingJson(
      { error: 'Revise os dados informados.', fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const whatsapp = normalizeWhatsapp(data.whatsapp);

  try {
    let existingLead = await prisma.lead.findFirst({
      where: { organizationId: profile.organizationId, whatsapp },
      orderBy: { updatedAt: 'desc' },
    });

    if (!existingLead) {
      existingLead = await prisma.lead.findFirst({
        where: {
          organizationId: profile.organizationId,
          email: { equals: data.email, mode: 'insensitive' },
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    const bookingContext = {
      ...(existingLead ? safeObject(existingLead.customFields) : {}),
      linkBio: {
        flow: data.flow,
        qualification: data.qualification,
        landingPage: data.landingPage || null,
        referrer: data.referrer || null,
        capturedAt: new Date().toISOString(),
        bookingStatus: 'pending',
      },
    };

    const lead = existingLead
      ? await prisma.lead.update({
          where: { id: existingLead.id },
          data: {
            name: data.name,
            email: data.email,
            whatsapp,
            company: data.company,
            assignedToId: existingLead.assignedToId || profile.userId,
            customFields: JSON.stringify(bookingContext),
            utmSource: existingLead.utmSource || data.utmSource || 'instagram',
            utmMedium: existingLead.utmMedium || data.utmMedium || 'organic_social',
            utmCampaign: existingLead.utmCampaign || data.utmCampaign || 'link_bio_mds',
            utmContent: existingLead.utmContent || data.utmContent || null,
            utmTerm: existingLead.utmTerm || data.utmTerm || null,
          },
        })
      : await prisma.lead.create({
          data: {
            organizationId: profile.organizationId,
            name: data.name,
            email: data.email,
            whatsapp,
            company: data.company,
            source: 'instagram',
            status: 'new',
            inKanban: true,
            productOrService:
              data.flow === 'automacao'
                ? 'Agentes de IA e automações'
                : 'Consultoria de marketing e vendas',
            assignedToId: profile.userId,
            createdById: profile.userId,
            customFields: JSON.stringify(bookingContext),
            utmSource: data.utmSource || 'instagram',
            utmMedium: data.utmMedium || 'organic_social',
            utmCampaign: data.utmCampaign || 'link_bio_mds',
            utmContent: data.utmContent || null,
            utmTerm: data.utmTerm || null,
          },
        });

    return publicBookingJson({ success: true, leadId: lead.id }, { status: 201 });
  } catch (error) {
    console.error('[PUBLIC_BOOKING] Erro ao capturar lead:', error);
    return publicBookingJson({ error: 'Não foi possível salvar seus dados.' }, { status: 500 });
  }
}

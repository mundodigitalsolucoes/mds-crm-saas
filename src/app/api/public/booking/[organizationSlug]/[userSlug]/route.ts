import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  addDays,
  applyPublicBookingRateLimit,
  dateWeekday,
  getPublicBookingProfile,
  hasBookingConflict,
  minutesToTime,
  normalizeWhatsapp,
  parseDateSafe,
  publicBookingJson,
  publicBookingOptionsResponse,
  timeToMinutes,
  todayInTimezone,
  zonedDateTimeToUtc,
} from '@/lib/public-booking';

const bookingSchema = z.object({
  name: z.string().trim().min(2).max(255),
  company: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  whatsapp: z.string().trim().min(10).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
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
  {
    params,
  }: {
    params: Promise<{ organizationSlug: string; userSlug: string }>;
  }
) {
  const blocked = applyPublicBookingRateLimit(request, 'create');
  if (blocked) return blocked;

  const { organizationSlug, userSlug } = await params;
  const profile = await getPublicBookingProfile(organizationSlug, userSlug);

  if (!profile) {
    return publicBookingJson(
      { error: 'Agenda pública não encontrada.' },
      { status: 404 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return publicBookingJson({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return publicBookingJson(
      {
        error: 'Revise os dados informados.',
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const today = todayInTimezone(profile.timezone);
  const maxDate = addDays(today, profile.maxAdvanceDays);

  if (data.date < today || data.date > maxDate) {
    return publicBookingJson(
      { error: 'A data selecionada não está disponível.' },
      { status: 400 }
    );
  }

  const schedule = profile.availability.find(
    (item) => item.weekday === dateWeekday(data.date)
  );

  if (!schedule) {
    return publicBookingJson(
      { error: 'A data selecionada não está disponível.' },
      { status: 400 }
    );
  }

  const startMinutes = timeToMinutes(data.startTime);
  const endMinutes = startMinutes + profile.durationMinutes;
  const scheduleStart = timeToMinutes(schedule.startTime);
  const scheduleEnd = timeToMinutes(schedule.endTime);

  if (
    startMinutes < scheduleStart ||
    endMinutes > scheduleEnd ||
    (startMinutes - scheduleStart) % profile.slotIntervalMinutes !== 0
  ) {
    return publicBookingJson(
      { error: 'O horário selecionado não está disponível.' },
      { status: 400 }
    );
  }

  const startsAt = zonedDateTimeToUtc(
    data.date,
    data.startTime,
    profile.timezone
  );
  const earliestStart = new Date(
    Date.now() + profile.minNoticeMinutes * 60_000
  );

  if (startsAt < earliestStart) {
    return publicBookingJson(
      { error: 'O horário selecionado não está mais disponível.' },
      { status: 409 }
    );
  }

  const endTime = minutesToTime(endMinutes);
  const whatsapp = normalizeWhatsapp(data.whatsapp);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const conflict = await hasBookingConflict(
          tx,
          profile,
          data.date,
          data.startTime,
          endTime
        );

        if (conflict) {
          throw new Error('BOOKING_CONFLICT');
        }

        let existingLead = await tx.lead.findFirst({
          where: {
            organizationId: profile.organizationId,
            whatsapp,
          },
          orderBy: { updatedAt: 'desc' },
        });

        if (!existingLead) {
          existingLead = await tx.lead.findFirst({
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
          },
        };

        const lead = existingLead
          ? await tx.lead.update({
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
                utmCampaign:
                  existingLead.utmCampaign || data.utmCampaign || 'link_bio_mds',
                utmContent: existingLead.utmContent || data.utmContent || null,
                utmTerm: existingLead.utmTerm || data.utmTerm || null,
              },
            })
          : await tx.lead.create({
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

        const event = await tx.agendaEvent.create({
          data: {
            organizationId: profile.organizationId,
            title:
              data.flow === 'automacao'
                ? `Diagnóstico de automação — ${data.name}`
                : `Consultoria — ${data.name}`,
            description: `Empresa: ${data.company}\nOrigem: link da bio MDS`,
            date: parseDateSafe(data.date),
            startTime: data.startTime,
            endTime,
            allDay: false,
            type: 'meeting',
            status: 'agendado',
            color: '#374b89',
            reminderMinutes: 60,
            leadId: lead.id,
            assignedToId: profile.userId,
            createdById: profile.userId,
          },
        });

        return { lead, event };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return publicBookingJson(
      {
        success: true,
        leadId: result.lead.id,
        appointment: {
          id: result.event.id,
          date: data.date,
          startTime: data.startTime,
          endTime,
          timezone: profile.timezone,
          professional: profile.user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      (error instanceof Error && error.message === 'BOOKING_CONFLICT') ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
    ) {
      return publicBookingJson(
        {
          error: 'Este horário acabou de ser reservado. Escolha outro horário.',
          code: 'BOOKING_CONFLICT',
        },
        { status: 409 }
      );
    }

    console.error('[PUBLIC_BOOKING] Erro ao criar agendamento:', error);
    return publicBookingJson(
      { error: 'Não foi possível concluir o agendamento.' },
      { status: 500 }
    );
  }
}

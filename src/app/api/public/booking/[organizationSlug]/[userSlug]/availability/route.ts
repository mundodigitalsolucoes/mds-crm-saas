import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  addDays,
  applyPublicBookingRateLimit,
  availableSlotsForDate,
  getBusyEventsForPeriod,
  getPublicBookingProfile,
  publicBookingJson,
  publicBookingOptionsResponse,
  todayInTimezone,
} from '@/lib/public-booking';

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function OPTIONS() {
  return publicBookingOptionsResponse();
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ organizationSlug: string; userSlug: string }>;
  }
) {
  const blocked = applyPublicBookingRateLimit(request, 'availability');
  if (blocked) return blocked;

  const { organizationSlug, userSlug } = await params;
  const profile = await getPublicBookingProfile(organizationSlug, userSlug);

  if (!profile) {
    return publicBookingJson(
      { error: 'Agenda pública não encontrada.' },
      { status: 404 }
    );
  }

  const parsed = querySchema.safeParse({
    startDate: request.nextUrl.searchParams.get('startDate') || undefined,
    endDate: request.nextUrl.searchParams.get('endDate') || undefined,
  });

  if (!parsed.success) {
    return publicBookingJson(
      { error: 'Período de consulta inválido.' },
      { status: 400 }
    );
  }

  const today = todayInTimezone(profile.timezone);
  const startDate = parsed.data.startDate || today;
  const requestedEndDate = parsed.data.endDate || addDays(startDate, 14);
  const maxEndDate = addDays(today, profile.maxAdvanceDays);
  const endDate = requestedEndDate > maxEndDate ? maxEndDate : requestedEndDate;

  if (startDate < today || endDate < startDate) {
    return publicBookingJson(
      { error: 'Período de consulta inválido.' },
      { status: 400 }
    );
  }

  const daysBetween = Math.round(
    (new Date(`${endDate}T12:00:00Z`).getTime() -
      new Date(`${startDate}T12:00:00Z`).getTime()) /
      86_400_000
  );

  if (daysBetween > 31) {
    return publicBookingJson(
      { error: 'Consulte no máximo 31 dias por requisição.' },
      { status: 400 }
    );
  }

  const availability: Array<{ date: string; slots: string[] }> = [];
  const busyEvents = await getBusyEventsForPeriod(profile, startDate, endDate);

  for (let offset = 0; offset <= daysBetween; offset += 1) {
    const date = addDays(startDate, offset);
    const slots = await availableSlotsForDate(profile, date, new Date(), busyEvents);

    if (slots.length > 0) {
      availability.push({ date, slots });
    }
  }

  return publicBookingJson({
    profile: {
      organization: profile.organization.name,
      professional: profile.user.name,
      avatarUrl: profile.user.avatarUrl,
      timezone: profile.timezone,
      durationMinutes: profile.durationMinutes,
      slotIntervalMinutes: profile.slotIntervalMinutes,
    },
    period: { startDate, endDate },
    availability,
  });
}

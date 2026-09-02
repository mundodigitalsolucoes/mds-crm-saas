import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const PUBLIC_BOOKING_RATE_LIMIT = {
  limit: 30,
  windowMs: 60_000,
};

export function publicBookingCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

export function publicBookingOptionsResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: publicBookingCorsHeaders(),
  });
}

export function publicBookingJson(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: {
      ...publicBookingCorsHeaders(),
      ...init?.headers,
    },
  });
}

export function applyPublicBookingRateLimit(
  request: NextRequest,
  action: string
): NextResponse | null {
  const result = checkRateLimit(
    `public-booking:${action}:${getClientIp(request)}`,
    PUBLIC_BOOKING_RATE_LIMIT
  );

  if (result.allowed) return null;

  return publicBookingJson(
    {
      error: 'Muitas tentativas. Aguarde alguns instantes.',
      retryAfter: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
        'Retry-After': String(result.retryAfterSeconds),
      },
    }
  );
}

export function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

export function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseDateSafe(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

export function dateWeekday(date: string): number {
  return parseDateSafe(date).getUTCDay();
}

export function addDays(date: string, amount: number): string {
  const value = parseDateSafe(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timezone: string
): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(utcGuess))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return new Date(utcGuess - (representedAsUtc - utcGuess));
}

export async function getPublicBookingProfile(
  organizationSlug: string,
  userSlug: string
) {
  return prisma.bookingProfile.findFirst({
    where: {
      slug: userSlug,
      isActive: true,
      organization: {
        slug: organizationSlug,
        deletedAt: null,
      },
      user: {
        deletedAt: null,
      },
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
      user: {
        select: { id: true, name: true, avatarUrl: true },
      },
      availability: {
        where: { isActive: true },
        orderBy: { weekday: 'asc' },
      },
    },
  });
}

type BookingProfileWithRelations = NonNullable<
  Awaited<ReturnType<typeof getPublicBookingProfile>>
>;

type AgendaReader = Pick<Prisma.TransactionClient, 'agendaEvent'>;

type BusyAgendaEvent = {
  date: Date;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
};

export async function getBusyEventsForPeriod(
  profile: BookingProfileWithRelations,
  startDate: string,
  endDate: string
): Promise<BusyAgendaEvent[]> {
  return prisma.agendaEvent.findMany({
    where: {
      organizationId: profile.organizationId,
      date: {
        gte: parseDateSafe(startDate),
        lte: parseDateSafe(endDate),
      },
      status: { not: 'cancelado' },
      OR: [
        { assignedToId: profile.userId },
        { assignedToId: null, createdById: profile.userId },
      ],
    },
    select: {
      date: true,
      startTime: true,
      endTime: true,
      allDay: true,
    },
  });
}

export async function hasBookingConflict(
  db: AgendaReader,
  profile: BookingProfileWithRelations,
  date: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const conflict = await db.agendaEvent.findFirst({
    where: {
      organizationId: profile.organizationId,
      date: parseDateSafe(date),
      status: { not: 'cancelado' },
      OR: [
        { assignedToId: profile.userId },
        { assignedToId: null, createdById: profile.userId },
      ],
      AND: [
        {
          OR: [
            { allDay: true },
            {
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
            {
              startTime,
              endTime: null,
            },
          ],
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(conflict);
}

export async function availableSlotsForDate(
  profile: BookingProfileWithRelations,
  date: string,
  now = new Date(),
  busyEvents?: BusyAgendaEvent[]
): Promise<string[]> {
  const weekday = dateWeekday(date);
  const window = profile.availability.find((item) => item.weekday === weekday);

  if (!window) return [];

  const start = timeToMinutes(window.startTime);
  const end = timeToMinutes(window.endTime);
  const slots: string[] = [];

  for (
    let cursor = start;
    cursor + profile.durationMinutes <= end;
    cursor += profile.slotIntervalMinutes
  ) {
    const startTime = minutesToTime(cursor);
    const endTime = minutesToTime(cursor + profile.durationMinutes);
    const startsAt = zonedDateTimeToUtc(date, startTime, profile.timezone);
    const earliestStart = new Date(now.getTime() + profile.minNoticeMinutes * 60_000);

    if (startsAt < earliestStart) continue;

    const conflict = busyEvents
      ? busyEvents.some((event) => {
          if (event.date.toISOString().slice(0, 10) !== date) return false;
          if (event.allDay) return true;
          if (!event.startTime) return false;
          if (!event.endTime) return event.startTime === startTime;
          return event.startTime < endTime && event.endTime > startTime;
        })
      : await hasBookingConflict(prisma, profile, date, startTime, endTime);

    if (!conflict) slots.push(startTime);
  }

  return slots;
}

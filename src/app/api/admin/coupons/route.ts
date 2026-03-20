// src/app/api/admin/coupons/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { z } from 'zod';

const couponCreateSchema = z.object({
  code:           z.string().min(1).max(50).transform(v => v.toUpperCase().trim()),
  description:    z.string().max(500).optional().nullable(),
  discountType:   z.enum(['percent', 'fixed']),
  discountValue:  z.coerce.number().positive(),
  durationMonths: z.coerce.number().int().min(1).max(36).optional().default(1),
  appliesToPlan:  z.string().optional().nullable(),
  maxUses:        z.coerce.number().int().positive().optional().nullable(),
  validFrom:      z.string().optional().nullable(),
  validUntil:     z.string().optional().nullable(),
  isActive:       z.boolean().optional().default(true),
}).refine(data => {
  if (data.discountType === 'percent' && (data.discountValue < 1 || data.discountValue > 100)) {
    return false;
  }
  return true;
}, { message: 'Percentual deve ser entre 1 e 100' });

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';
    const page   = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '15')));
    const skip   = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { code:        { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { usages: true } } },
      }),
      prisma.coupon.count({ where }),
    ]);

    return NextResponse.json({
      coupons: coupons.map((c: any) => ({
        ...c,
        discountValue: Number(c.discountValue),
        usedCount:     c._count.usages,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[ADMIN COUPONS] GET:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body   = await req.json();
    const parsed = couponCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
    if (existing) {
      return NextResponse.json({ error: 'Já existe um cupom com este código' }, { status: 409 });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code:           data.code,
        description:    data.description ?? null,
        discountType:   data.discountType,
        discountValue:  data.discountValue,
        durationMonths: data.durationMonths,
        appliesToPlan:  data.appliesToPlan ?? null,
        maxUses:        data.maxUses ?? null,
        validFrom:      data.validFrom  ? new Date(data.validFrom)  : new Date(),
        validUntil:     data.validUntil ? new Date(data.validUntil) : null,
        isActive:       data.isActive,
      },
    });

    return NextResponse.json({ ...coupon, discountValue: Number(coupon.discountValue) }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN COUPONS] POST:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
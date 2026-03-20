// src/app/api/admin/coupons/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import { z } from 'zod';

const couponUpdateSchema = z.object({
  code:            z.string().min(1).max(50).transform(v => v.toUpperCase().trim()).optional(),
  description:     z.string().max(500).nullable().optional(),
  discountType:    z.enum(['percentage', 'fixed']).optional(),
  discountValue:   z.coerce.number().positive().optional(),
  maxUses:         z.coerce.number().int().positive().nullable().optional(),
  validFrom:       z.string().nullable().optional(),
  validUntil:      z.string().nullable().optional(),
  isActive:        z.boolean().optional(),
  applicablePlans: z.array(z.string()).nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;

  try {
    const body   = await req.json();
    const parsed = couponUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 });

    // Se mudou o código, verifica duplicidade
    if (data.code && data.code !== existing.code) {
      const dup = await prisma.coupon.findUnique({ where: { code: data.code } });
      if (dup) return NextResponse.json({ error: 'Código já em uso' }, { status: 409 });
    }

    const updateData: any = {};
    if (data.code            !== undefined) updateData.code            = data.code;
    if (data.description     !== undefined) updateData.description     = data.description;
    if (data.discountType    !== undefined) updateData.discountType    = data.discountType;
    if (data.discountValue   !== undefined) updateData.discountValue   = data.discountValue;
    if (data.maxUses         !== undefined) updateData.maxUses         = data.maxUses;
    if (data.isActive        !== undefined) updateData.isActive        = data.isActive;
    if (data.validFrom       !== undefined) updateData.validFrom       = data.validFrom  ? new Date(data.validFrom)  : null;
    if (data.validUntil      !== undefined) updateData.validUntil      = data.validUntil ? new Date(data.validUntil) : null;
    if (data.applicablePlans !== undefined) updateData.applicablePlans = data.applicablePlans ? JSON.stringify(data.applicablePlans) : null;

    const coupon = await prisma.coupon.update({ where: { id }, data: updateData });
    return NextResponse.json(coupon);
  } catch (error) {
    console.error('[ADMIN COUPONS] PUT:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken();
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 });

    const usages = await prisma.couponUsage.count({ where: { couponId: id } });
    if (usages > 0) {
      // Desativa ao invés de deletar se já foi usado
      await prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ message: 'Cupom desativado (já foi utilizado e não pode ser excluído)' });
    }

    await prisma.coupon.delete({ where: { id } });
    return NextResponse.json({ message: 'Cupom excluído' });
  } catch (error) {
    console.error('[ADMIN COUPONS] DELETE:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// src/app/api/coupons/validate/route.ts
// Valida um cupom de desconto (público — usado no checkout/signup)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  code: z.string().min(1).transform(v => v.toUpperCase().trim()),
  plan: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ valid: false, error: 'Dados inválidos' }, { status: 400 });
    }
    const { code, plan } = parsed.data;

    const coupon = await prisma.coupon.findUnique({ where: { code } });

    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'Cupom não encontrado' });
    }

    if (!coupon.isActive) {
      return NextResponse.json({ valid: false, error: 'Cupom inativo' });
    }

    const now = new Date();
    if (coupon.validFrom && now < new Date(coupon.validFrom)) {
      return NextResponse.json({ valid: false, error: 'Cupom ainda não está válido' });
    }
    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
      return NextResponse.json({ valid: false, error: 'Cupom expirado' });
    }

    const usedCount = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
    if (coupon.maxUses != null && usedCount >= coupon.maxUses) {
      return NextResponse.json({ valid: false, error: 'Cupom esgotado' });
    }

    // Verifica planos aplicáveis
    if (plan && coupon.applicablePlans) {
      const plans = JSON.parse(coupon.applicablePlans as string) as string[];
      if (plans.length > 0 && !plans.includes(plan)) {
        return NextResponse.json({ valid: false, error: 'Cupom não aplicável a este plano' });
      }
    }

    return NextResponse.json({
      valid:         true,
      couponId:      coupon.id,
      code:          coupon.code,
      description:   coupon.description,
      discountType:  coupon.discountType,
      discountValue: Number(coupon.discountValue),
    });
  } catch (error) {
    console.error('[COUPON VALIDATE]:', error);
    return NextResponse.json({ valid: false, error: 'Erro interno' }, { status: 500 });
  }
}

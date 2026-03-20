// src/app/api/coupons/validate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { code, planName } = await req.json()
  if (!code) return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase().trim() },
  })

  if (!coupon || !coupon.isActive) {
    return NextResponse.json({ error: 'Cupom inválido ou inativo' }, { status: 404 })
  }

  const now = new Date()
  if (coupon.validFrom > now) {
    return NextResponse.json({ error: 'Cupom ainda não está válido' }, { status: 400 })
  }
  if (coupon.validUntil && coupon.validUntil < now) {
    return NextResponse.json({ error: 'Cupom expirado' }, { status: 400 })
  }

  if (coupon.maxUses && coupon.usesCount >= coupon.maxUses) {
    return NextResponse.json({ error: 'Cupom esgotado' }, { status: 400 })
  }

  if (coupon.appliesToPlan && planName && coupon.appliesToPlan !== planName) {
    return NextResponse.json(
      { error: `Cupom válido apenas para o plano ${coupon.appliesToPlan}` },
      { status: 400 }
    )
  }

  const alreadyUsed = await prisma.couponUsage.findUnique({
    where: {
      couponId_organizationId: {
        couponId:       coupon.id,
        organizationId: session.user.organizationId,
      },
    },
  })
  if (alreadyUsed) {
    return NextResponse.json({ error: 'Cupom já utilizado pela sua organização' }, { status: 400 })
  }

  return NextResponse.json({
    valid:          true,
    code:           coupon.code,
    discountType:   coupon.discountType,
    discountValue:  Number(coupon.discountValue),
    durationMonths: coupon.durationMonths,
    description:    coupon.description,
  })
}
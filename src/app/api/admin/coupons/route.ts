// src/app/api/admin/coupons/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/admin-auth'
import { z } from 'zod'

const couponCreateSchema = z.object({
  code:           z.string().min(2).max(50).transform(v => v.toUpperCase().trim()),
  description:    z.string().optional(),
  discountType:   z.enum(['percent', 'fixed']),
  discountValue:  z.coerce.number().positive(),
  durationMonths: z.coerce.number().int().min(1).max(3),
  appliesToPlan:  z.string().optional().nullable(),
  validFrom:      z.string().optional(),
  validUntil:     z.string().optional().nullable(),
  maxUses:        z.coerce.number().int().positive().optional().nullable(),
  isActive:       z.boolean().optional().default(true),
})

export async function GET() {
  const admin = await verifyAdminToken()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { usages: true } } },
  })

  return NextResponse.json(coupons)
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = couponCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  const existing = await prisma.coupon.findUnique({ where: { code: data.code } })
  if (existing) {
    return NextResponse.json({ error: 'Código já existe' }, { status: 409 })
  }

  const coupon = await prisma.coupon.create({
    data: {
      code:           data.code,
      description:    data.description,
      discountType:   data.discountType,
      discountValue:  data.discountValue,
      durationMonths: data.durationMonths,
      appliesToPlan:  data.appliesToPlan ?? null,
      validFrom:      data.validFrom ? new Date(data.validFrom) : new Date(),
      validUntil:     data.validUntil ? new Date(data.validUntil) : null,
      maxUses:        data.maxUses ?? null,
      isActive:       data.isActive,
    },
  })

  return NextResponse.json(coupon, { status: 201 })
}
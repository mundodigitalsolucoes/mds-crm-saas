// src/app/api/admin/coupons/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/admin-auth'
import { z } from 'zod'

const couponUpdateSchema = z.object({
  description:    z.string().optional(),
  discountType:   z.enum(['percent', 'fixed']).optional(),
  discountValue:  z.coerce.number().positive().optional(),
  durationMonths: z.coerce.number().int().min(1).max(3).optional(),
  appliesToPlan:  z.string().optional().nullable(),
  validFrom:      z.string().optional(),
  validUntil:     z.string().optional().nullable(),
  maxUses:        z.coerce.number().int().positive().optional().nullable(),
  isActive:       z.boolean().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = couponUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }
  const data = parsed.data

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...(data.description    !== undefined && { description:    data.description }),
      ...(data.discountType   !== undefined && { discountType:   data.discountType }),
      ...(data.discountValue  !== undefined && { discountValue:  data.discountValue }),
      ...(data.durationMonths !== undefined && { durationMonths: data.durationMonths }),
      ...(data.appliesToPlan  !== undefined && { appliesToPlan:  data.appliesToPlan }),
      ...(data.validFrom      !== undefined && { validFrom:      new Date(data.validFrom) }),
      ...(data.validUntil     !== undefined && { validUntil:     data.validUntil ? new Date(data.validUntil) : null }),
      ...(data.maxUses        !== undefined && { maxUses:        data.maxUses }),
      ...(data.isActive       !== undefined && { isActive:       data.isActive }),
    },
  })

  return NextResponse.json(coupon)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdminToken()
  if (!admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const usages = await prisma.couponUsage.count({ where: { couponId: id } })
  if (usages > 0) {
    return NextResponse.json(
      { error: `Cupom já foi usado ${usages} vez(es). Desative em vez de excluir.` },
      { status: 409 }
    )
  }

  await prisma.coupon.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
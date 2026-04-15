/**
 * src/app/api/integrations/evolution/instances/route.ts
 *
 * Lista as instâncias WhatsApp da organização para a UI de Integrações.
 * Compatível com o legado:
 * - se existir ConnectedAccount(provider='whatsapp') antigo e ainda não houver
 *   whatsapp_instances, espelha automaticamente para a tabela nova.
 *
 * CORREÇÃO:
 * - se a instância estiver ativa e conectada na Evolution, mas sem inbox válido no Chatwoot,
 *   auto-repara a amarração individual por instância
 */

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/checkPermission'
import { prisma } from '@/lib/prisma'
import {
  getInstanceState,
  fetchInstanceInfo,
} from '@/lib/integrations/evolutionClient'
import {
  doesChatwootInboxExist,
  setupChatwootEvolution,
} from '@/lib/integrations/chatwoot-evo'

type LegacyWhatsappData = {
  label?: string | null
  instanceName?: string
  serverUrl?: string | null
  phone?: string | null
  connectedAt?: string | null
  disconnectedAt?: string | null
  chatwootInboxId?: number | null
}

type InstanceStatus =
  | 'connected'
  | 'connecting'
  | 'offline'
  | 'missing'
  | 'disconnected'

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

async function ensureLegacyWhatsappMirrored(organizationId: string) {
  const legacy = await prisma.connectedAccount.findUnique({
    where: {
      provider_organizationId: { provider: 'whatsapp', organizationId },
    },
    select: {
      data: true,
      isActive: true,
      lastError: true,
    },
  })

  if (!legacy?.isActive) return

  const parsed = safeJsonParse<LegacyWhatsappData>(legacy.data)
  if (!parsed?.instanceName) return

  const exists = await prisma.whatsappInstance.findUnique({
    where: { instanceName: parsed.instanceName },
    select: { id: true },
  })

  if (exists) return

  await prisma.whatsappInstance.create({
    data: {
      organizationId,
      connectedById: null,
      label: parsed.label ?? 'WhatsApp principal',
      instanceName: parsed.instanceName,
      phoneNumber: parsed.phone ?? null,
      status: 'connecting',
      chatwootInboxId: parsed.chatwootInboxId ?? null,
      serverUrl: parsed.serverUrl ?? null,
      metadata: JSON.stringify(parsed),
      isActive: true,
      lastError: legacy.lastError,
      connectedAt: parsed.connectedAt ? new Date(parsed.connectedAt) : null,
      disconnectedAt: parsed.disconnectedAt ? new Date(parsed.disconnectedAt) : null,
    },
  })
}

function resolveStatus(params: {
  isActive: boolean
  state: string
}): InstanceStatus {
  const { isActive, state } = params

  if (!isActive) return 'disconnected'
  if (state === 'open') return 'connected'
  if (state === 'connecting') return 'connecting'
  if (state === 'not_found') return 'missing'
  return 'offline'
}

export async function GET() {
  const { allowed, session, errorResponse } = await checkPermission('integrations', 'view')
  if (!allowed) return errorResponse!

  const organizationId = session!.user.organizationId
  const EVO_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '') ?? ''
  const EVO_KEY = process.env.EVOLUTION_API_KEY ?? ''

  await ensureLegacyWhatsappMirrored(organizationId)

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      plan: true,
      maxWhatsappInstances: true,
      slug: true,
    },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
  }

  const dbInstances = await prisma.whatsappInstance.findMany({
    where: { organizationId },
    orderBy: [
      { isActive: 'desc' },
      { updatedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  const instances = await Promise.all(
    dbInstances.map(async (instance) => {
      let state = 'inactive'
      let isConnected = false
      let phoneNumber = instance.phoneNumber
      let connectedAt = instance.connectedAt
      let disconnectedAt = instance.disconnectedAt
      let lastError = instance.lastError
      let chatwootInboxId = instance.chatwootInboxId

      if (instance.isActive) {
        try {
          state = await getInstanceState(instance.instanceName)
        } catch {
          state = 'unknown'
        }

        isConnected = state === 'open'

        if (isConnected && !phoneNumber) {
          try {
            const info = await fetchInstanceInfo(instance.instanceName)
            const wuid = info?.instance?.wuid ?? null
            const fetchedPhone = wuid ? wuid.split('@')[0] ?? null : null

            if (fetchedPhone) {
              phoneNumber = fetchedPhone
              connectedAt = connectedAt ?? new Date()

              const parsedMetadata =
                safeJsonParse<Record<string, unknown>>(instance.metadata) ?? {}

              await prisma.whatsappInstance.update({
                where: { id: instance.id },
                data: {
                  phoneNumber: fetchedPhone,
                  connectedAt,
                  disconnectedAt: null,
                  lastError: null,
                  metadata: JSON.stringify({
                    ...parsedMetadata,
                    phone: fetchedPhone,
                    connectedAt: connectedAt.toISOString(),
                    disconnectedAt: null,
                  }),
                },
              })
            }
          } catch {
            // número opcional
          }
        }

        // AUTO-REPAIR: instância conectada na Evolution mas sem inbox válido no Chatwoot
        if (isConnected && EVO_URL && EVO_KEY) {
          let shouldRepairChatwoot = false

          if (!chatwootInboxId) {
            shouldRepairChatwoot = true
          } else {
            const inboxExists = await doesChatwootInboxExist(organizationId, chatwootInboxId)
            if (inboxExists === false) {
              shouldRepairChatwoot = true
            }
          }

          if (shouldRepairChatwoot) {
            try {
              const repair = await setupChatwootEvolution({
                organizationId,
                orgSlug: org.slug,
                instanceName: instance.instanceName,
                evoUrl: EVO_URL,
                evoKey: EVO_KEY,
                phoneNumber,
              })

              if (repair.chatwootInboxId) {
                chatwootInboxId = repair.chatwootInboxId
                lastError = null

                const parsedMetadata =
                  safeJsonParse<Record<string, unknown>>(instance.metadata) ?? {}

                await prisma.whatsappInstance.update({
                  where: { id: instance.id },
                  data: {
                    chatwootInboxId,
                    lastError: null,
                    metadata: JSON.stringify({
                      ...parsedMetadata,
                      phone: phoneNumber,
                      chatwootInboxId,
                      chatwootRepairedAt: new Date().toISOString(),
                    }),
                  },
                })

                console.log(
                  `[Instances] Auto-repair Chatwoot OK para ${instance.instanceName} | inboxId=${chatwootInboxId}`
                )
              }
            } catch (err) {
              console.warn(
                `[Instances] Auto-repair Chatwoot falhou para ${instance.instanceName}:`,
                err
              )
            }
          }
        }

        if (!isConnected && !disconnectedAt) {
          disconnectedAt = new Date()

          const parsedMetadata =
            safeJsonParse<Record<string, unknown>>(instance.metadata) ?? {}

          await prisma.whatsappInstance.update({
            where: { id: instance.id },
            data: {
              disconnectedAt,
              lastError: lastError ?? 'WhatsApp desconectado. Verifique o celular.',
              metadata: JSON.stringify({
                ...parsedMetadata,
                disconnectedAt: disconnectedAt.toISOString(),
              }),
            },
          })

          lastError = lastError ?? 'WhatsApp desconectado. Verifique o celular.'
        }

        if (isConnected && disconnectedAt) {
          connectedAt = connectedAt ?? new Date()
          disconnectedAt = null
          lastError = null

          const parsedMetadata =
            safeJsonParse<Record<string, unknown>>(instance.metadata) ?? {}

          await prisma.whatsappInstance.update({
            where: { id: instance.id },
            data: {
              connectedAt,
              disconnectedAt: null,
              lastError: null,
              metadata: JSON.stringify({
                ...parsedMetadata,
                connectedAt: connectedAt.toISOString(),
                disconnectedAt: null,
              }),
            },
          })
        }
      }

      const status = resolveStatus({
        isActive: instance.isActive,
        state,
      })

      return {
        id: instance.id,
        label: instance.label ?? 'WhatsApp sem nome',
        instanceName: instance.instanceName,
        phoneNumber,
        status,
        isActive: instance.isActive,
        isConnected,
        chatwootInboxId,
        connectedAt: connectedAt ? connectedAt.toISOString() : null,
        disconnectedAt: disconnectedAt ? disconnectedAt.toISOString() : null,
        lastError,
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
      }
    })
  )

  const activeCount = instances.filter((item) => item.isActive).length
  const isUnlimited = org.maxWhatsappInstances <= 0

  return NextResponse.json({
    plan: org.plan,
    usage: {
      current: activeCount,
      max: org.maxWhatsappInstances,
      isUnlimited,
      canAddMore: isUnlimited || activeCount < org.maxWhatsappInstances,
    },
    instances,
  })
}
// src/lib/trial.ts
// Helpers para cálculo e exibição do período de trial

/**
 * Retorna quantos dias restam no trial.
 * Retorna null se não for plano trial ou não tiver trialEndsAt.
 */
export function trialDaysLeft({
  plan,
  trialEndsAt,
}: {
  plan: string
  trialEndsAt?: string | Date | null
}): number | null {
  if (plan !== 'trial' || !trialEndsAt) return null

  const end  = new Date(trialEndsAt)
  const now  = new Date()
  const diff = end.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  return Math.max(0, days)
}

/**
 * Retorna mensagem amigável com base nos dias restantes.
 */
export function trialMessage(daysLeft: number): string {
  if (daysLeft === 0) return 'Seu período de trial expirou hoje.'
  if (daysLeft === 1) return 'Resta apenas 1 dia no seu trial.'
  return `Restam ${daysLeft} dias no seu trial.`
}

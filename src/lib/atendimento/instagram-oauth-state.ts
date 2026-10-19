import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_AGE_MS = 10 * 60 * 1000

type InstagramState = {
  organizationId: string
  userId: string
  source: 'mds_crm_instagram'
  issuedAt: number
}

function secret() {
  const value = process.env.NEXTAUTH_SECRET
  if (!value) throw new Error('NEXTAUTH_SECRET não configurado para OAuth')
  return value
}

export function signInstagramState(input: Pick<InstagramState, 'organizationId' | 'userId'>): string {
  const payload: InstagramState = { ...input, source: 'mds_crm_instagram', issuedAt: Date.now() }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyInstagramState(raw: string | null): InstagramState | null {
  if (!raw || raw.length > 2048) return null
  const parts = raw.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  const [encoded, signature] = parts
  const expected = createHmac('sha256', secret()).update(encoded).digest()
  let received: Buffer
  try { received = Buffer.from(signature, 'base64url') } catch { return null }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
  try {
    const value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<InstagramState>
    if (value.source !== 'mds_crm_instagram' ||
        typeof value.organizationId !== 'string' || !value.organizationId ||
        typeof value.userId !== 'string' || !value.userId ||
        typeof value.issuedAt !== 'number' || !Number.isFinite(value.issuedAt) ||
        value.issuedAt > Date.now() + 30_000 ||
        Date.now() - value.issuedAt > MAX_AGE_MS) return null
    return value as InstagramState
  } catch { return null }
}

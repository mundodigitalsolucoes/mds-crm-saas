// Server-owned organization mapping; never derived from request headers or query parameters.
export function selectChatwootSsoUrl(
  ssoUrl: string,
  apiBaseUrl: string,
  organizationId: string,
  rawOrigins?: string
): string {
  if (!rawOrigins) return ssoUrl
  let mapping: unknown
  try { mapping = JSON.parse(rawOrigins) } catch { throw new Error('invalid_chatwoot_sso_origins') }
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw new Error('invalid_chatwoot_sso_origins')
  }
  if (!Object.prototype.hasOwnProperty.call(mapping, organizationId)) return ssoUrl
  const configured = (mapping as Record<string, unknown>)[organizationId]
  if (typeof configured !== 'string') throw new Error('invalid_chatwoot_sso_origin')
  const target = new URL(configured)
  if (target.protocol !== 'https:' || target.username || target.password || target.port ||
      target.pathname !== '/' || target.search || target.hash) {
    throw new Error('invalid_chatwoot_sso_origin')
  }
  const source = new URL(ssoUrl)
  const canonical = new URL(apiBaseUrl)
  if (source.protocol !== 'https:' || source.origin !== canonical.origin ||
      source.username || source.password || source.pathname !== '/app/login' || source.hash ||
      !source.searchParams.get('sso_auth_token') || !source.searchParams.get('email')) {
    throw new Error('invalid_chatwoot_sso_payload')
  }
  // Preserve the official token and query unchanged; only change the trusted destination origin.
  return `${target.origin}${source.pathname}${source.search}`
}

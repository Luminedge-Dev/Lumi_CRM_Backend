const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '')

export const isLocalOrigin = (origin: string): boolean => {
  try {
    const parsed = new URL(origin)
    return LOCAL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export const isAllowedOrigin = (origin: string | undefined, allowedOrigins: Set<string>): boolean => {
  if (!origin) return true

  const normalizedOrigin = normalizeOrigin(origin)
  const frontendUrl = process.env.FRONTEND_URL?.trim()

  return (
    allowedOrigins.has(normalizedOrigin) ||
    (frontendUrl ? normalizeOrigin(frontendUrl) === normalizedOrigin : false) ||
    isLocalOrigin(normalizedOrigin)
  )
}

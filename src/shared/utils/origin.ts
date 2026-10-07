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

/**
 * `allowLocal` trusts any localhost origin (development convenience). It must be false in
 * production: there, a localhost origin is only accepted if it is explicitly configured.
 */
export const isAllowedOrigin = (
  origin: string | undefined,
  allowedOrigins: Set<string>,
  frontendUrl?: string,
  allowLocal = true,
): boolean => {
  if (!origin) return true

  const normalizedOrigin = normalizeOrigin(origin)
  const configuredFrontend = frontendUrl?.trim()

  return (
    allowedOrigins.has(normalizedOrigin) ||
    (configuredFrontend ? normalizeOrigin(configuredFrontend) === normalizedOrigin : false) ||
    (allowLocal && isLocalOrigin(normalizedOrigin))
  )
}

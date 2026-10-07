import { config } from '../../config/env';

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_REQUEST_TIMEOUT_MS = 8000;

export interface GoogleUserInfo {
  email?: string;
  name?: string;
  picture?: string;
  given_name?: string;
  [key: string]: unknown;
}

const getJson = async (url: string, headers?: Record<string, string>): Promise<Record<string, unknown> | null> => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(GOOGLE_REQUEST_TIMEOUT_MS) });
  if (!response.ok) return null;
  return (await response.json()) as Record<string, unknown>;
};

/**
 * Verifies a Google OAuth access token and returns the user's profile, or null if the token
 * must not be trusted. A token is accepted only if Google says it was issued to OUR client
 * (audience == GOOGLE_CLIENT_ID), is unexpired, and belongs to a verified email address, and the
 * profile returned for it carries that same email. Without this, an access token minted for any
 * other Google app would sign in as the victim whose address it returns.
 * Fails closed when GOOGLE_CLIENT_ID is not configured.
 */
export const verifyGoogleAccessToken = async (accessToken: string): Promise<GoogleUserInfo | null> => {
  const clientId = config.google.clientId;
  if (!clientId) {
    console.error('Google sign-in rejected: GOOGLE_CLIENT_ID is not configured');
    return null;
  }
  if (typeof accessToken !== 'string' || !accessToken) return null;

  const info = await getJson(`${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
  if (!info) return null;

  const audience = info.aud ?? info.azp;
  if (audience !== clientId) return null;
  if (String(info.email_verified) !== 'true') return null;
  if (typeof info.email !== 'string' || !info.email) return null;
  if (info.expires_in !== undefined && !(Number(info.expires_in) > 0)) return null;

  const profile = (await getJson(GOOGLE_USERINFO_URL, { Authorization: `Bearer ${accessToken}` })) as GoogleUserInfo | null;
  if (!profile || typeof profile.email !== 'string') return null;
  if (profile.email.toLowerCase() !== info.email.toLowerCase()) return null;

  return profile;
};

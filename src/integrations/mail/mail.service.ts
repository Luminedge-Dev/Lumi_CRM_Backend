import nodemailer from 'nodemailer';
import { config } from '../../config/env';
import { MailMessage } from './mail.types';

// The single SMTP integration. Controllers and services never build a transport themselves.
// A transport is created per send (as before) so SMTP settings are always read from the current
// configuration and tests can replace nodemailer wholesale.

const DEFAULT_FROM = 'noreply@luminedge.com';
const DEV_FRONTEND_URL = 'http://localhost:3000';

// Bounded waits so a slow or unreachable SMTP server fails the request (and frees it) in seconds
// instead of nodemailer's multi-minute defaults.
const SMTP_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
};

export const sendMail = async ({ to, subject, html }: MailMessage): Promise<void> => {
  // Without a host nodemailer silently targets localhost:587. Outside production that is a local
  // mail catcher; in production it can never deliver, so fail with a clear (server-side) reason.
  if (config.isProduction && !config.smtp.host) {
    throw new Error('Email is not configured: SMTP_HOST is not set');
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    // Only authenticate when a user is configured: an empty auth object makes nodemailer refuse
    // to talk to an open relay ("Missing credentials").
    ...(config.smtp.user && { auth: { user: config.smtp.user, pass: config.smtp.pass } }),
    ...SMTP_TIMEOUTS,
  });

  await transporter.sendMail({
    from: config.smtp.from || DEFAULT_FROM,
    to,
    subject,
    html,
  });
};

/**
 * Base URL used to build links inside emails. Production must configure FRONTEND_URL: a reset
 * link pointing at localhost would be useless to the recipient, so that is an error there.
 */
export const frontendBaseUrl = (): string => {
  const url = config.cors.frontendUrl?.replace(/\/+$/, '');
  if (url) return url;
  if (config.isProduction) throw new Error('FRONTEND_URL is not set: cannot build links for emails');
  return DEV_FRONTEND_URL;
};

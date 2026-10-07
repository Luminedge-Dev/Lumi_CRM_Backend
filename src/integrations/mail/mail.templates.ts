import { MailMessage } from './mail.types';

// Email bodies for the account flows. Wording and markup are unchanged from the controllers that
// previously inlined them.

const BUTTON_STYLE = 'background-color: #FACE39; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;';

/** Staff who signed up with Google and then tried password login: invite them to set a password. */
export const staffPasswordSetupEmail = (to: string, name: string, resetUrl: string): MailMessage => ({
  to,
  subject: 'Set Your Password - Luminedge CRM',
  html: `
            <h2>Set Your Password</h2>
            <p>Hello ${name},</p>
            <p>Your account was created with Google. Click below to set a password so you can also sign in with email:</p>
            <p><a href="${resetUrl}" style="${BUTTON_STYLE}">Set Password</a></p>
            <p>This link expires in 1 hour.</p>
            <br><p>Best regards,<br>Luminedge Team</p>
          `,
});

export const staffPasswordResetEmail = (to: string, name: string, resetUrl: string): MailMessage => ({
  to,
  subject: 'Password Reset Request - Luminedge CRM',
  html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>You requested to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="${BUTTON_STYLE}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <br>
        <p>Best regards,<br>Luminedge Team</p>
      `,
});

export const studentPasswordResetEmail = (to: string, name: string, resetUrl: string): MailMessage => ({
  to,
  subject: 'Reset Your Password - Luminedge Student Portal',
  html: `
          <h2>Password Reset</h2>
          <p>Hello ${name},</p>
          <p>Click the link below to reset your password:</p>
          <p><a href="${resetUrl}" style="background-color:#FACE39;color:#000;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Reset Password</a></p>
          <p>This link expires in 1 hour.</p>
          <p>Best regards,<br>Luminedge Team</p>
        `,
});

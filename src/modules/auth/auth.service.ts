import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AppError } from '../../core/errors';
import { isStaffRole, STAFF_ROLES, toStaffRole } from '../../shared/constants/roles';
import { BCRYPT_ROUNDS, RESET_TOKEN_TTL_MS, INACTIVE_MESSAGE } from '../../shared/constants/auth';
import { sha256 } from '../../shared/utils/crypto';
import { verifyGoogleAccessToken } from '../../integrations/google/googleAuth.service';
import { frontendBaseUrl, sendMail } from '../../integrations/mail/mail.service';
import { staffPasswordResetEmail, staffPasswordSetupEmail } from '../../integrations/mail/mail.templates';
import { createAndEmitNotification, createAndEmitToAdmins } from '../notifications/notification.service';
import { userRepository } from '../users/user.repository';
import { studentRepository } from '../students/student.repository';
import { signStaffToken } from './token.service';
import { CheckUserResult, LoginInput, LoginResult, RegisterInput, StaffSession } from './auth.types';

const RESET_REQUESTED_MESSAGE = 'If an account exists with this email, a password reset link has been sent.';

/** Fire-and-forget welcome/admin notifications for a freshly created staff account. */
const announceNewStaff = (userId: string, name: string, role: string): void => {
  createAndEmitToAdmins('New User Added', `${name} has been added as ${role}`, 'info').catch(console.error);
  createAndEmitNotification(
    userId,
    'Welcome to Luminedge CRM',
    `Your account has been created. Welcome aboard, ${name}!`,
    'success',
  ).catch(console.error);
};

export const authService = {
  async register({ name, email, password, role }: RegisterInput): Promise<StaffSession> {
    // Normalized the same way login() looks accounts up, so a mixed-case registration can still
    // sign in, and two accounts can't be created for the same address in different casing.
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) throw AppError.badRequest('User already exists');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await userRepository.create({ name, email: normalizedEmail, passwordHash, role });

    announceNewStaff(user._id.toString(), name, role);

    return { accessToken: signStaffToken(user._id, user.role), user: { id: user._id, name, email: normalizedEmail, role } };
  },

  async googleLogin(googleToken: string): Promise<StaffSession> {
    const payload = await verifyGoogleAccessToken(googleToken);
    if (!payload?.email) throw AppError.badRequest('Invalid Google token');

    const user = await userRepository.findByEmail(payload.email.toLowerCase());

    // User MUST exist as a staff account: no creation, no student fallthrough.
    if (!user || !isStaffRole(user.role)) {
      throw AppError.unauthorized('Account not found. Please sign up first.');
    }

    // Same rule as password login: a deactivated account cannot obtain a new token.
    if (user.isActive === false) throw AppError.forbidden(INACTIVE_MESSAGE);

    const role = toStaffRole(user.role);
    return {
      accessToken: signStaffToken(user._id, role),
      user: { id: user._id, name: user.name, email: user.email, role, avatarUrl: user.avatarUrl },
    };
  },

  async googleRegister(googleToken: string, requestedRole: unknown): Promise<StaffSession> {
    const payload = await verifyGoogleAccessToken(googleToken);
    if (!payload?.email) throw AppError.badRequest('Invalid Google token');

    const { email, name, picture } = payload;
    const role = (requestedRole as string) || 'bdm';
    if (!isStaffRole(role)) throw AppError.badRequest(`Invalid role. Allowed: ${STAFF_ROLES.join(', ')}`);

    if (await userRepository.findByEmail(email)) {
      throw AppError.badRequest('User already exists. Please sign in instead.');
    }

    const user = await userRepository.create({
      name: name || payload.given_name || 'User',
      email,
      role,
      avatarUrl: picture,
      isActive: true,
    });

    announceNewStaff(user._id.toString(), user.name, role);

    return {
      accessToken: signStaffToken(user._id, user.role),
      user: { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
    };
  },

  async login({ email, password }: LoginInput): Promise<LoginResult> {
    const user = await userRepository.findByEmail(email.toLowerCase().trim());
    if (!user || !isStaffRole(user.role)) throw AppError.unauthorized('Invalid credentials');

    if (!user.isActive) throw AppError.forbidden(INACTIVE_MESSAGE);

    if (!user.passwordHash) {
      // Google-only account: issue a reset token so they can set a password.
      const resetToken = crypto.randomBytes(32).toString('hex');
      try {
        await userRepository.setResetToken(user._id, sha256(resetToken), new Date(Date.now() + RESET_TOKEN_TTL_MS));
      } catch (saveErr) {
        console.error('Failed to save reset token:', saveErr);
      }

      try {
        const resetUrl = `${frontendBaseUrl()}/reset-password?token=${resetToken}`;
        await sendMail(staffPasswordSetupEmail(user.email, user.name, resetUrl));
      } catch (emailErr) {
        console.error('Failed to send setup email:', emailErr);
      }

      return { kind: 'password-setup-required', email: user.email };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw AppError.unauthorized('Invalid credentials');

    const role = toStaffRole(user.role);
    return {
      kind: 'session',
      accessToken: signStaffToken(user._id, role),
      user: { id: user._id, name: user.name, email: user.email, role },
    };
  },

  /** Always answers the same message so the endpoint cannot be used to discover accounts. */
  async forgetPassword(email: string): Promise<string> {
    const user = await userRepository.findByEmail(email.toLowerCase());
    if (!user) return RESET_REQUESTED_MESSAGE;

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = sha256(resetToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await userRepository.save(user);

    const resetUrl = `${frontendBaseUrl()}/reset-password?token=${resetToken}`;
    await sendMail(staffPasswordResetEmail(user.email, user.name, resetUrl));

    return RESET_REQUESTED_MESSAGE;
  },

  async resetPassword(token: string, password: string): Promise<void> {
    const user = await userRepository.findByValidResetToken(sha256(token));
    if (!user) throw AppError.badRequest('Invalid or expired reset token');

    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await userRepository.save(user);
  },

  /** Sets a first password for a Google-registered account via its emailed setup token. */
  async setPassword(token: string, password: string): Promise<StaffSession> {
    const user = await userRepository.findByValidResetToken(sha256(token));
    if (!user) {
      throw AppError.badRequest('Invalid or expired setup link. Please use Forgot Password to request a new one.');
    }

    // A deactivated account must not be able to set a password and receive a signed-in token.
    if (user.isActive === false) throw AppError.forbidden(INACTIVE_MESSAGE);

    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await userRepository.save(user);

    return {
      accessToken: signStaffToken(user._id, user.role),
      user: { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
    };
  },

  async changePassword(userId: unknown, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    // Google-only accounts have no password to change.
    if (!user.passwordHash) {
      throw AppError.badRequest('Cannot change password for Google-authenticated accounts');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw AppError.badRequest('Current password is incorrect');

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await userRepository.save(user);
  },

  /** Tells the login screen which portal an email belongs to. Never throws: any failure reads as "no account". */
  async checkUser(email: string | undefined): Promise<CheckUserResult> {
    try {
      if (!email) return { exists: false };
      const normalizedEmail = email.toLowerCase().trim();

      if (await userRepository.existsStaffByEmail(normalizedEmail, STAFF_ROLES)) {
        return { exists: true, type: 'staff' };
      }
      if (await studentRepository.existsByEmail(normalizedEmail)) {
        return { exists: true, type: 'student' };
      }
      return { exists: false };
    } catch (error) {
      console.error('Check user error:', error);
      return { exists: false };
    }
  },
};

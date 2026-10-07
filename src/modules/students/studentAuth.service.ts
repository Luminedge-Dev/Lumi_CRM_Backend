import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { HydratedDocument } from 'mongoose';
import type { IStudent } from '../../models/Student';
import { AppError } from '../../core/errors';
import { STAFF_ROLES } from '../../shared/constants/roles';
import { BCRYPT_ROUNDS, RESET_TOKEN_TTL_MS, INACTIVE_MESSAGE } from '../../shared/constants/auth';
import { sha256 } from '../../shared/utils/crypto';
import { verifyGoogleAccessToken } from '../../integrations/google/googleAuth.service';
import { frontendBaseUrl, sendMail } from '../../integrations/mail/mail.service';
import { studentPasswordResetEmail } from '../../integrations/mail/mail.templates';
import { signStudentToken } from '../auth/token.service';
import { leadRepository } from '../leads/lead.repository';
import { userRepository } from '../users/user.repository';
import { studentRepository } from './student.repository';
import { StudentRegisterInput, StudentSession } from './student.types';

const RESET_REQUESTED_MESSAGE = 'If an account with this email exists, a reset link has been sent.';

async function linkLeadByEmail(email: string): Promise<string | null> {
  const lead = await leadRepository.findIdByEmail(email.toLowerCase());
  return lead ? lead._id.toString() : null;
}

export const studentAuthService = {
  async register({ name, email, password, phone }: StudentRegisterInput): Promise<StudentSession> {
    const existing = await studentRepository.findByEmail(email.toLowerCase());
    if (existing) throw AppError.badRequest('An account with this email already exists');

    // Remove any wrongly-placed record in the users collection (non-staff role).
    await userRepository.deleteNonStaffByEmail(email.toLowerCase(), STAFF_ROLES);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const linkedLeadId = await linkLeadByEmail(email);

    const student = await studentRepository.create({
      name,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      linkedLeadId: linkedLeadId as any,
      role: 'student',
    });

    return {
      accessToken: signStudentToken(student._id.toString()),
      student: { id: student._id, name, email: student.email, role: 'student', hasLinkedLead: !!linkedLeadId },
    };
  },

  async login(email: string | undefined, password: string): Promise<StudentSession> {
    const student = await studentRepository.findByEmail(email?.toLowerCase());
    if (!student) throw AppError.unauthorized('Invalid credentials');

    if (!student.passwordHash) throw AppError.unauthorized('GOOGLE_ONLY_ACCOUNT');

    const isMatch = await bcrypt.compare(password, student.passwordHash);
    if (!isMatch) throw AppError.unauthorized('Invalid credentials');

    if (!student.isActive) throw AppError.forbidden(INACTIVE_MESSAGE);

    // Re-link the lead in case it was created after registration.
    if (!student.linkedLeadId) {
      const leadId = await linkLeadByEmail(student.email);
      if (leadId) await studentRepository.linkLead(student, leadId);
    }

    return {
      accessToken: signStudentToken(student._id.toString()),
      student: { id: student._id, name: student.name, email: student.email, role: 'student' },
    };
  },

  async googleAuth(googleToken: string): Promise<StudentSession> {
    const googleUser = await verifyGoogleAccessToken(googleToken);
    if (!googleUser) throw AppError.badRequest('Invalid Google token');

    const { email, name, picture } = googleUser;
    if (!email) throw AppError.badRequest('Could not retrieve email from Google');

    const existing = await studentRepository.findByEmail(email.toLowerCase());
    let student: HydratedDocument<IStudent>;

    if (!existing) {
      // Remove any wrongly-placed record in the users collection (non-staff role).
      await userRepository.deleteNonStaffByEmail(email.toLowerCase(), STAFF_ROLES);

      const linkedLeadId = await linkLeadByEmail(email);
      student = await studentRepository.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        avatarUrl: picture || undefined,
        role: 'student',
        linkedLeadId: linkedLeadId as any,
        isActive: true,
      });
    } else {
      student = existing;
      if (picture && !student.avatarUrl) {
        student.avatarUrl = picture;
        await studentRepository.save(student);
      }
    }

    if (!student.isActive) throw AppError.forbidden(INACTIVE_MESSAGE);

    return {
      accessToken: signStudentToken(student._id.toString()),
      student: { id: student._id, name: student.name, email: student.email, role: 'student', avatarUrl: student.avatarUrl },
    };
  },

  async changePassword(studentId: unknown, currentPassword: string, newPassword: string): Promise<void> {
    const student = await studentRepository.findById(studentId);
    if (!student || !student.passwordHash) throw AppError.notFound('Student not found');

    const isMatch = await bcrypt.compare(currentPassword, student.passwordHash);
    if (!isMatch) throw AppError.badRequest('Current password is incorrect');

    student.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await studentRepository.save(student);
  },

  /** Always answers the same message so the endpoint cannot be used to discover accounts. */
  async forgotPassword(email: string | undefined): Promise<string> {
    const student = await studentRepository.findByEmail(email?.toLowerCase());
    if (!student) return RESET_REQUESTED_MESSAGE;

    const resetToken = crypto.randomBytes(32).toString('hex');
    student.resetPasswordToken = sha256(resetToken);
    student.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await studentRepository.save(student);

    try {
      const resetUrl = `${frontendBaseUrl()}/student/reset-password?token=${resetToken}`;
      await sendMail(studentPasswordResetEmail(student.email, student.name, resetUrl));
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr);
    }

    return RESET_REQUESTED_MESSAGE;
  },

  async resetPassword(token: string, password: string): Promise<void> {
    const student = await studentRepository.findByValidResetToken(sha256(token));
    if (!student) throw AppError.badRequest('Invalid or expired reset token');

    student.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    student.resetPasswordToken = undefined;
    student.resetPasswordExpires = undefined;
    await studentRepository.save(student);
  },
};

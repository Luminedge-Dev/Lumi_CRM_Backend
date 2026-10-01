import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import Student from '../models/Student';
import User from '../models/User';
import Lead from '../models/Lead';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
};

// ── helpers ────────────────────────────────────────────────────────────────

function signToken(studentId: string) {
  return jwt.sign({ studentId, role: 'student' }, getJwtSecret(), { expiresIn: '7d' });
}

async function linkLeadByEmail(email: string): Promise<string | null> {
  const lead = await Lead.findOne({ email: email.toLowerCase() }).select('_id');
  return lead ? lead._id.toString() : null;
}

// ── controllers ────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: 'Name, email and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await Student.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(400).json({ message: 'An account with this email already exists' });
      return;
    }

    // Remove any wrongly-placed record in the users collection (non-staff role)
    await User.deleteOne({ email: email.toLowerCase(), role: { $nin: ['admin', 'bdm'] } });

    const passwordHash = await bcrypt.hash(password, 10);
    const linkedLeadId = await linkLeadByEmail(email);

    const student = new Student({ name, email: email.toLowerCase(), phone, passwordHash, linkedLeadId, role: 'student' });
    await student.save();

    const token = signToken(student._id.toString());

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      accessToken: token,
      student: { id: student._id, name, email: student.email, role: 'student', hasLinkedLead: !!linkedLeadId },
    });
  } catch (error) {
    console.error('Student register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const student = await Student.findOne({ email: email?.toLowerCase() });
    if (!student) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!student.passwordHash) {
      res.status(401).json({ message: 'GOOGLE_ONLY_ACCOUNT' });
      return;
    }

    const isMatch = await bcrypt.compare(password, student.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!student.isActive) {
      res.status(403).json({ message: 'Account is inactive. Please contact support.' });
      return;
    }

    // Re-link lead in case it was created after registration
    if (!student.linkedLeadId) {
      const leadId = await linkLeadByEmail(student.email);
      if (leadId) {
        student.linkedLeadId = new (require('mongoose').Types.ObjectId)(leadId);
        await student.save();
      }
    }

    const token = signToken(student._id.toString());

    res.json({
      accessToken: token,
      student: { id: student._id, name: student.name, email: student.email, role: 'student' },
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ message: 'Google token is required' });
      return;
    }

    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      res.status(400).json({ message: 'Invalid Google token' });
      return;
    }

    const { email, name, picture } = await response.json() as any;
    if (!email) {
      res.status(400).json({ message: 'Could not retrieve email from Google' });
      return;
    }

    let student = await Student.findOne({ email: email.toLowerCase() });

    if (!student) {
      // Remove any wrongly-placed record in the users collection (non-staff role)
      await User.deleteOne({ email: email.toLowerCase(), role: { $nin: ['admin', 'bdm'] } });

      const linkedLeadId = await linkLeadByEmail(email);
      student = new Student({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        avatarUrl: picture || undefined,
        role: 'student',
        linkedLeadId,
        isActive: true,
      });
      await student.save();
    } else if (picture && !student.avatarUrl) {
      student.avatarUrl = picture;
      await student.save();
    }

    if (!student.isActive) {
      res.status(403).json({ message: 'Account is inactive. Please contact support.' });
      return;
    }

    const jwtToken = signToken(student._id.toString());

    res.json({
      accessToken: jwtToken,
      student: { id: student._id, name: student.name, email: student.email, role: 'student', avatarUrl: student.avatarUrl },
    });
  } catch (error) {
    console.error('Student Google auth error:', error);
    res.status(500).json({ message: 'Google authentication failed' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = (req as any).student?.studentId;
    const student = await Student.findById(studentId).select('-passwordHash -resetPasswordToken -resetPasswordExpires');
    if (!student) {
      res.status(404).json({ message: 'Student not found' });
      return;
    }

    let lead = null;
    if (student.linkedLeadId) {
      lead = await Lead.findById(student.linkedLeadId)
        .populate('assignedTo', 'name')
        .select('fullName email phone source serviceInterest lifecycleStage notes followUps assignedTo createdAt');
    }

    // If not linked, try to find by email
    if (!lead) {
      lead = await Lead.findOne({ email: student.email })
        .populate('assignedTo', 'name')
        .select('fullName email phone source serviceInterest lifecycleStage notes followUps assignedTo createdAt');

      if (lead && !student.linkedLeadId) {
        student.linkedLeadId = lead._id as any;
        await student.save();
      }
    }

    res.json({ student, lead });
  } catch (error) {
    console.error('Student getProfile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = (req as any).student?.studentId;
    const { name, phone, address } = req.body;

    const updates: any = {};
    if (name) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (address !== undefined) updates.address = address.trim();

    const student = await Student.findByIdAndUpdate(studentId, updates, { new: true })
      .select('-passwordHash -resetPasswordToken -resetPasswordExpires');

    if (!student) {
      res.status(404).json({ message: 'Student not found' });
      return;
    }

    res.json({ success: true, student });
  } catch (error) {
    console.error('Student updateProfile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = (req as any).student?.studentId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters' });
      return;
    }

    const student = await Student.findById(studentId);
    if (!student || !student.passwordHash) {
      res.status(404).json({ message: 'Student not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, student.passwordHash);
    if (!isMatch) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    student.passwordHash = await bcrypt.hash(newPassword, 10);
    await student.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Student changePassword error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const student = await Student.findOne({ email: email?.toLowerCase() });

    if (!student) {
      res.json({ message: 'If an account with this email exists, a reset link has been sent.' });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    student.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    student.resetPasswordExpires = new Date(Date.now() + 3600000);
    await student.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/student/reset-password?token=${resetToken}`;

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@luminedge.com',
        to: student.email,
        subject: 'Reset Your Password - Luminedge Student Portal',
        html: `
          <h2>Password Reset</h2>
          <p>Hello ${student.name},</p>
          <p>Click the link below to reset your password:</p>
          <p><a href="${resetUrl}" style="background-color:#FACE39;color:#000;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Reset Password</a></p>
          <p>This link expires in 1 hour.</p>
          <p>Best regards,<br>Luminedge Team</p>
        `,
      });
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr);
    }

    res.json({ message: 'If an account with this email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Student forgotPassword error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const submitOnboarding = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = (req as any).studentId || (req as any).student?.studentId;
    const {
      // Personal
      dateOfBirth, gender, nationality, nativeLanguage, currentAddress,
      passportNumber, passportExpiry, emergencyContact,
      // Academic
      academicRecords, englishTest,
      // Financial
      financialInfo,
      // Study preferences
      studyPreferences,
    } = req.body;

    const student = await Student.findByIdAndUpdate(
      studentId,
      {
        dateOfBirth, gender, nationality, nativeLanguage, currentAddress,
        passportNumber, passportExpiry, emergencyContact,
        academicRecords, englishTest, financialInfo, studyPreferences,
        onboardingComplete: true,
      },
      { new: true }
    ).select('-passwordHash -resetPasswordToken -resetPasswordExpires');

    if (!student) {
      res.status(404).json({ message: 'Student not found' });
      return;
    }

    res.json({ success: true, student });
  } catch (error) {
    console.error('Student submitOnboarding error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllStudents = async (_req: Request, res: Response): Promise<void> => {
  try {
    const students = await Student.find()
      .select('-passwordHash -resetPasswordToken -resetPasswordExpires')
      .populate('assignedBDM', 'name role')
      .sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getStudentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const student = await Student.findById(req.params.id)
      .select('-passwordHash -resetPasswordToken -resetPasswordExpires')
      .populate('assignedBDM', 'name role email');

    if (!student) {
      res.status(404).json({ message: 'Student not found' });
      return;
    }
    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('studentToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ message: 'Token and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const student = await Student.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!student) {
      res.status(400).json({ message: 'Invalid or expired reset token' });
      return;
    }

    student.passwordHash = await bcrypt.hash(password, 10);
    student.resetPasswordToken = undefined;
    student.resetPasswordExpires = undefined;
    await student.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Student resetPassword error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

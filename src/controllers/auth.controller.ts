import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User';
import Lead from '../models/Lead';
import Student from '../models/Student';
import { createAndEmitNotification, createAndEmitToAdmins } from '../services/notification.service';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role = 'bdm' } = req.body;

    if (!['admin', 'bdm'].includes(role)) {
      res.status(400).json({ message: 'Invalid role. Allowed: admin, bdm' });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, passwordHash, role });
    await user.save();

    createAndEmitToAdmins(
      'New User Added',
      `${name} has been added as ${role}`,
      'info'
    ).catch(console.error);
    createAndEmitNotification(
      user._id.toString(),
      'Welcome to Luminedge CRM',
      `Your account has been created. Welcome aboard, ${name}!`,
      'success'
    ).catch(console.error);

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({ accessToken: token, user: { id: user._id, name, email, role } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    // Fetch user info using the access token
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      res.status(400).json({ message: 'Invalid Google token' });
      return;
    }

    const payload: any = await response.json();

    if (!payload.email) {
      res.status(400).json({ message: 'Invalid Google token' });
      return;
    }

    const { email, name, picture } = payload;
    const user = await User.findOne({ email: email.toLowerCase() });

    // User MUST exist as a staff account — no creation, no student fallthrough
    if (!user || !['admin', 'bdm'].includes(user.role as string)) {
      res.status(401).json({ message: 'Account not found. Please sign up first.' });
      return;
    }

    // Normalize legacy sub-roles
    const role: 'admin' | 'bdm' = (user.role as string) === 'admin' ? 'admin' : 'bdm';

    const jwtToken = jwt.sign(
      { userId: user._id, role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({ accessToken: jwtToken, user: { id: user._id, name: user.name, email: user.email, role, avatarUrl: user.avatarUrl } });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Google authentication failed' });
  }
};

export const googleRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    // Fetch user info using the access token
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      res.status(400).json({ message: 'Invalid Google token' });
      return;
    }

    const payload: any = await response.json();

    if (!payload.email) {
      res.status(400).json({ message: 'Invalid Google token' });
      return;
    }

    const { email, name, picture } = payload;
    const role = req.body.role || 'bdm';

    if (!['admin', 'bdm'].includes(role)) {
      res.status(400).json({ message: 'Invalid role. Allowed: admin, bdm' });
      return;
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      res.status(400).json({ message: 'User already exists. Please sign in instead.' });
      return;
    }

    // Create new user for signup
    user = new User({
      name: name || payload.given_name || 'User',
      email,
      role,
      avatarUrl: picture,
      isActive: true
    });
    await user.save();

    createAndEmitToAdmins(
      'New User Added',
      `${user.name} has been added as ${role}`,
      'info'
    ).catch(console.error);
    createAndEmitNotification(
      user._id.toString(),
      'Welcome to Luminedge CRM',
      `Your account has been created. Welcome aboard, ${user.name}!`,
      'success'
    ).catch(console.error);

    const jwtToken = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({ accessToken: jwtToken, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl }, message: 'Account created successfully' });
  } catch (error) {
    console.error('Google register error:', error);
    res.status(500).json({ message: 'Google registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !['admin', 'bdm'].includes(user.role as string)) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Account is inactive. Please contact support.' });
      return;
    }

    if (!user.passwordHash) {
      // Google-only account — save reset token so they can set a password
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      try {
        await User.findByIdAndUpdate(user._id, {
          resetPasswordToken: resetTokenHash,
          resetPasswordExpires: new Date(Date.now() + 3600000),
        });
      } catch (saveErr) {
        console.error('Failed to save reset token:', saveErr);
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@luminedge.com',
          to: user.email,
          subject: 'Set Your Password - Luminedge CRM',
          html: `
            <h2>Set Your Password</h2>
            <p>Hello ${user.name},</p>
            <p>Your account was created with Google. Click below to set a password so you can also sign in with email:</p>
            <p><a href="${resetUrl}" style="background-color: #FACE39; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Set Password</a></p>
            <p>This link expires in 1 hour.</p>
            <br><p>Best regards,<br>Luminedge Team</p>
          `,
        });
      } catch (emailErr) {
        console.error('Failed to send setup email:', emailErr);
      }

      res.status(200).json({ message: 'PASSWORD_SETUP_REQUIRED', email: user.email });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Normalize legacy sub-roles to canonical roles
    const rawRole = user.role as string;
    const role: 'admin' | 'bdm' = rawRole === 'admin' ? 'admin' : 'bdm';

    const token = jwt.sign(
      { userId: user._id, role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({ accessToken: token, user: { id: user._id, name: user.name, email: user.email, role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore - userId added by auth middleware
    const user = await User.findById(req.user?.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const forgetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists or not for security
      res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save token to user (expires in 1 hour)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    // Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@luminedge.com',
      to: user.email,
      subject: 'Password Reset Request - Luminedge CRM',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hello ${user.name},</p>
        <p>You requested to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="background-color: #FACE39; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <br>
        <p>Best regards,<br>Luminedge Team</p>
      `,
    });

    res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forget password error:', error);
    res.status(500).json({ message: 'Failed to send password reset email. Please try again.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ message: 'Token and password are required' });
      return;
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired reset token' });
      return;
    }

    // Update password
    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users (with optional role filter) — includes activeLeads + convertedLeads counts
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, limit } = req.query;

    const filter: any = { isActive: true };

    if (role) {
      const roles = (role as string).split(',');
      filter.role = { $in: roles };
    }

    let query = User.find(filter).select('-passwordHash -resetPasswordToken -resetPasswordExpires');

    if (limit) {
      query = query.limit(parseInt(limit as string));
    }

    const users = await query.sort({ createdAt: -1 });

    // Enrich with lead counts when fetching BDM-type users
    const isBDMQuery = role && (role as string).includes('bdm');
    if (isBDMQuery && users.length > 0) {
      const userIds = users.map(u => u._id);

      const leadCounts = await Lead.aggregate([
        { $match: { assignedTo: { $in: userIds } } },
        {
          $group: {
            _id: '$assignedTo',
            activeLeads: {
              $sum: { $cond: [{ $in: ['$lifecycleStage', ['Enrolled', 'Lost']] }, 0, 1] }
            },
            convertedLeads: {
              $sum: { $cond: [{ $eq: ['$lifecycleStage', 'Enrolled'] }, 1, 0] }
            }
          }
        }
      ]);

      const countMap = new Map(leadCounts.map(c => [c._id.toString(), c]));

      const enriched = users.map(u => {
        const counts = countMap.get(u._id.toString());
        return {
          ...(u as any).toObject(),
          activeLeads: counts?.activeLeads ?? 0,
          convertedLeads: counts?.convertedLeads ?? 0,
        };
      });

      res.json(enriched);
      return;
    }

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// Update user role
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'bdm'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    createAndEmitNotification(
      user._id.toString(),
      'Role Updated',
      `Your role has been updated to ${role}.`,
      'info'
    ).catch(console.error);

    res.json(user);
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
};

// Delete user (soft delete - set isActive to false)
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ message: 'User removed successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

// Update profile
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { firstName, lastName, phone, department } = req.body;

    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (department !== undefined) updateData.department = department;

    // Update name if firstName or lastName provided
    if (firstName || lastName) {
      const user = await User.findById(userId);
      if (user) {
        const newFirstName = firstName || user.firstName || '';
        const newLastName = lastName || user.lastName || '';
        updateData.name = `${newFirstName} ${newLastName}`.trim();
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-passwordHash -resetPasswordToken -resetPasswordExpires');

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: user, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current password and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Check if user has a password (not Google-only user)
    if (!user.passwordHash) {
      res.status(400).json({ success: false, message: 'Cannot change password for Google-authenticated accounts' });
      return;
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    // Hash and save new password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// Set password for Google-registered users (no auth required)
export const setPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token: resetToken, password } = req.body;

    if (!resetToken || !password) {
      res.status(400).json({ message: 'Reset token and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ message: 'Invalid or expired setup link. Please use Forgot Password to request a new one.' });
      return;
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    const jwtToken = jwt.sign(
      { userId: user._id, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({ accessToken: jwtToken, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl } });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const checkUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.json({ exists: false });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();

    const staffUser = await User.findOne({
      email: normalizedEmail,
      role: { $in: ['admin', 'bdm'] },
    }).select('_id');
    if (staffUser) {
      res.json({ exists: true, type: 'staff' });
      return;
    }

    const student = await Student.findOne({ email: normalizedEmail }).select('_id');
    if (student) {
      res.json({ exists: true, type: 'student' });
      return;
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Check user error:', error);
    res.json({ exists: false });
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.json({ success: true, message: 'Logged out successfully' });
};

// Get user stats for profile
export const getUserStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const Lead = require('../models/Lead').default;

    const totalLeads = await Lead.countDocuments({ assignedTo: userId });
    const convertedLeads = await Lead.countDocuments({ assignedTo: userId, lifecycleStage: 'Enrolled' });
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';

    res.json({
      success: true,
      data: {
        totalLeads,
        converted: convertedLeads,
        conversionRate: `${conversionRate}%`
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user stats' });
  }
};

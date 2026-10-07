import { asyncHandler } from '../../core/http';
import { userService } from './user.service';
import { parseProfileUpdate, parseRoleUpdate } from './user.validation';

// Error body shapes are per-endpoint and unchanged: `{ message }` for the user-admin endpoints,
// `{ success: false, message }` for the self-service profile/stats endpoints.

export const getProfile = asyncHandler(
  async (req, res) => {
    res.json(await userService.getProfile(req.user?.userId));
  },
  { shape: 'message', fallbackMessage: 'Server error', logLabel: 'Get profile error:' },
);

export const getUsers = asyncHandler(
  async (req, res) => {
    res.json(await userService.listUsers({ role: req.query.role as string, limit: req.query.limit as string }));
  },
  { shape: 'message', fallbackMessage: 'Failed to fetch users', logLabel: 'Error fetching users:' },
);

export const updateUserRole = asyncHandler(
  async (req, res) => {
    const role = parseRoleUpdate(req.body);
    res.json(await userService.updateRole(req.params.id, role));
  },
  { shape: 'message', fallbackMessage: 'Failed to update user role', logLabel: 'Error updating user role:' },
);

export const deleteUser = asyncHandler(
  async (req, res) => {
    await userService.deactivate(req.params.id);
    res.json({ message: 'User removed successfully' });
  },
  { shape: 'message', fallbackMessage: 'Failed to delete user', logLabel: 'Error deleting user:' },
);

export const updateProfile = asyncHandler(
  async (req, res) => {
    const user = await userService.updateProfile(req.user?.userId, parseProfileUpdate(req.body));
    res.json({ success: true, data: user, message: 'Profile updated successfully' });
  },
  { shape: 'success', fallbackMessage: 'Failed to update profile', logLabel: 'Error updating profile:' },
);

export const getUserStats = asyncHandler(
  async (req, res) => {
    res.json({ success: true, data: await userService.getStats(req.user?.userId) });
  },
  { shape: 'success', fallbackMessage: 'Failed to fetch user stats', logLabel: 'Error fetching user stats:' },
);

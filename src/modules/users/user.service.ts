import { found } from '../../core/errors';
import { conversionRate } from '../../shared/utils/conversionRate';
import { createAndEmitNotification } from '../notifications/notification.service';
import { leadRepository } from '../leads/lead.repository';
import { userRepository } from './user.repository';
import { ListUsersQuery, ProfileUpdateInput } from './user.types';

export const userService = {
  async getProfile(userId: unknown) {
    return found(await userRepository.findProfileById(userId), 'User not found');
  },

  /** Active users, optionally filtered by role; BDM-type queries also carry lead counts. */
  async listUsers({ role, limit }: ListUsersQuery) {
    const filter: Record<string, unknown> = {};
    if (role) filter.role = { $in: role.split(',') };

    const users = await userRepository.listActive(filter, limit ? parseInt(limit) : undefined);

    const isBDMQuery = role && role.includes('bdm');
    if (isBDMQuery && users.length > 0) {
      const leadCounts = await leadRepository.aggregateAssigneeCounts(users.map((u) => u._id));
      const countMap = new Map(leadCounts.map((c) => [c._id.toString(), c]));

      return users.map((u) => {
        const counts = countMap.get(u._id.toString());
        return {
          ...(u as any).toObject(),
          activeLeads: counts?.activeLeads ?? 0,
          convertedLeads: counts?.convertedLeads ?? 0,
        };
      });
    }

    return users;
  },

  async updateRole(id: string, role: string) {
    const user = found(await userRepository.updateRole(id, role), 'User not found');

    createAndEmitNotification(user._id.toString(), 'Role Updated', `Your role has been updated to ${role}.`, 'info').catch(
      console.error,
    );

    return user;
  },

  /** Soft delete: the account is kept but deactivated. */
  async deactivate(id: string): Promise<void> {
    found(await userRepository.deactivate(id), 'User not found');
  },

  async updateProfile(userId: unknown, input: ProfileUpdateInput) {
    const { firstName, lastName, phone, department } = input;

    const updateData: Record<string, unknown> = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (department !== undefined) updateData.department = department;

    // Keep the display name in step with the first/last name.
    if (firstName || lastName) {
      const existing = await userRepository.findById(userId);
      if (existing) {
        const newFirstName = (firstName as string) || existing.firstName || '';
        const newLastName = (lastName as string) || existing.lastName || '';
        updateData.name = `${newFirstName} ${newLastName}`.trim();
      }
    }

    return found(await userRepository.updateProfile(userId, updateData), 'User not found');
  },

  async getStats(userId: unknown) {
    const totalLeads = await leadRepository.countByAssignee(userId);
    const convertedLeads = await leadRepository.countByAssignee(userId, { lifecycleStage: 'Enrolled' });
    return {
      totalLeads,
      converted: convertedLeads,
      conversionRate: `${conversionRate(convertedLeads, totalLeads)}%`,
    };
  },
};

import { AppError, found } from '../../core/errors';
import type { IConversation } from '../../models/Conversation';
import { isInvalidInputError } from '../../shared/utils/mongooseErrors';
import { isObjectId } from '../../shared/validators/request';
import { conversationRepository } from './conversation.repository';

// Membership rules shared by the REST controllers and the Socket.IO handlers, so both enforce
// the same checks. No Express or Socket.IO types in here.

export interface ChatActor {
  /** studentId for students, userId for staff: the value stored in participants[].participantId */
  id: string;
  isStudent: boolean;
  role: string;
}

export const isParticipant = (conversation: Pick<IConversation, 'participants'>, actor: ChatActor): boolean =>
  conversation.participants.some((p) => p.participantId === actor.id);

/**
 * Loads a conversation the actor may access. Participants always may. Admins may only when the
 * caller opts in (read-only oversight, matching the admin conversation list); everyone else is refused.
 */
export const loadAccessibleConversation = async (
  conversationId: unknown,
  actor: ChatActor,
  { allowAdminOversight = false }: { allowAdminOversight?: boolean } = {},
): Promise<IConversation> => {
  if (!isObjectId(conversationId)) throw AppError.badRequest('Invalid conversation id');

  const conversation = found(await conversationRepository.findById(conversationId), 'Conversation not found');

  const isAdminOverseer = allowAdminOversight && !actor.isStudent && actor.role === 'admin';
  if (!isParticipant(conversation, actor) && !isAdminOverseer) {
    throw AppError.forbidden('You are not a participant of this conversation');
  }
  return conversation;
};

export const conversationService = {
  listForParticipant: (actor: ChatActor) => conversationRepository.listForParticipant(actor.id),

  /** Admin-created conversation. A malformed participant list or id is the caller's mistake (400). */
  async create(input: { participants: unknown; applicationId: unknown; title: unknown }) {
    try {
      return await conversationRepository.create(input);
    } catch (err) {
      if (isInvalidInputError(err)) {
        throw AppError.badRequest('Invalid conversation data');
      }
      throw err;
    }
  },

  listAllRecent: () => conversationRepository.listRecent(100),
};

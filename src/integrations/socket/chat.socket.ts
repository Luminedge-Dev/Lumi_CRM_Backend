import { AppError } from '../../core/errors';
import { ChatActor, loadAccessibleConversation } from '../../modules/conversations/conversation.service';
import { messageService } from '../../modules/messages/message.service';

// Socket.IO chat event handlers: transport only. Every event goes through the same membership and
// validation rules as the REST API (the conversation and message services); nothing the client
// sends can choose who the sender is or which rooms the socket joins.

/** The parts of a Socket.IO socket these handlers use (kept minimal so tests can use a fake). */
export interface ChatSocket {
  on(event: string, listener: (...args: any[]) => void): unknown;
  join(room: string): unknown;
  leave(room: string): unknown;
  emit(event: string, payload: unknown): unknown;
  to(room: string): { emit(event: string, payload: unknown): unknown };
}

export interface ChatServer {
  to(room: string): { emit(event: string, payload: unknown): unknown };
}

const roomFor = (conversationId: string) => `conv-${conversationId}`;

export const registerChatHandlers = (socket: ChatSocket, io: ChatServer, actor: ChatActor): void => {
  const fail = (event: string, err: unknown) => {
    if (err instanceof AppError) {
      socket.emit('chat-error', { event, message: err.message });
      return;
    }
    console.error(`${event} error:`, err);
    socket.emit('chat-error', { event, message: 'Internal server error' });
  };

  socket.on('join-conversation', async (conversationId: unknown) => {
    try {
      const conversation = await loadAccessibleConversation(conversationId, actor);
      socket.join(roomFor(String(conversation._id)));
    } catch (err) {
      fail('join-conversation', err);
    }
  });

  socket.on('leave-conversation', (conversationId: unknown) => {
    if (typeof conversationId === 'string') socket.leave(roomFor(conversationId));
  });

  socket.on('send-message', async (data: unknown) => {
    try {
      const payload = (data && typeof data === 'object' ? data : {}) as { conversationId?: unknown; content?: unknown };
      // Any senderName in the payload is ignored: the name comes from the stored participant record.
      const { conversation, message } = await messageService.sendViaSocket(actor, payload.conversationId, payload.content);

      io.to(roomFor(String(conversation._id))).emit('new-message', message);
    } catch (err) {
      fail('send-message', err);
    }
  });

  socket.on('message-read', async (conversationId: unknown) => {
    try {
      await messageService.markConversationRead(actor, conversationId);
      socket.to(roomFor(String(conversationId))).emit('messages-read', { conversationId, userId: actor.id });
    } catch (err) {
      fail('message-read', err);
    }
  });
};

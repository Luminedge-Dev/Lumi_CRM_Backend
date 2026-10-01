import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import Message from '../models/Message';
import Conversation from '../models/Conversation';
import { isAllowedOrigin } from '../utils/origin';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}
const JWT_SECRET_SAFE: string = JWT_SECRET;

const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : ['http://localhost:3000', 'http://localhost:3001']
    ).map(o => o.trim().replace(/\/+$/, ''))
);

class SocketService {
    private io: SocketIOServer | null = null;

    public init(server: HttpServer): void {
            this.io = new SocketIOServer(server, {
            pingInterval: 25000,  // send ping every 25s
            pingTimeout: 20000,   // wait 20s for pong before considering disconnected
            cors: {
                origin: (origin, callback) => {
                    if (isAllowedOrigin(origin, allowedOrigins)) {
                        callback(null, true);
                        return;
                    }
                    callback(new Error('Not allowed by CORS'));
                },
                methods: ['GET', 'POST'],
                credentials: true
            },
        });

        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (!token) return next(new Error('Authentication error'));

            try {
                const decoded = jwt.verify(token as string, JWT_SECRET_SAFE) as any;
                const isStudent = decoded?.role === 'student' || decoded?.type === 'student' || !!decoded?.studentId;
                const userId = isStudent ? decoded?.studentId : decoded?.userId;

                if (!userId) {
                    return next(new Error('Authentication error'));
                }

                if (isStudent) {
                    socket.data.user = {
                        userId: String(userId),
                        role: 'student',
                        isStudent: true,
                    };
                } else {
                    socket.data.user = {
                        userId: String(userId),
                        role: decoded.role,
                        isStudent: false,
                    };
                }
                next();
            } catch {
                next(new Error('Authentication error'));
            }
        });

        this.io.on('connection', (socket) => {
            const { userId, isStudent } = socket.data.user;

            // Personal room (notifications)
            const personalRoom = isStudent ? `student-${userId}` : userId;
            socket.join(personalRoom);
            console.log(`Socket connected: ${personalRoom} (id: ${socket.id})`);

            // Join a conversation room for real-time chat
            socket.on('join-conversation', (conversationId: string) => {
                socket.join(`conv-${conversationId}`);
            });

            // Leave a conversation room
            socket.on('leave-conversation', (conversationId: string) => {
                socket.leave(`conv-${conversationId}`);
            });

            // Send message via socket
            socket.on('send-message', async (data: {
                conversationId: string;
                content: string;
                senderName: string;
            }) => {
                try {
                    const msg = await Message.create({
                        conversationId: data.conversationId,
                        senderType: isStudent ? 'student' : 'staff',
                        senderId: userId,
                        senderName: data.senderName,
                        content: data.content,
                    });

                    await Conversation.findByIdAndUpdate(data.conversationId, {
                        lastMessage: data.content,
                        lastMessageAt: new Date(),
                        $inc: { [`unreadCounts.${userId}`]: 0 },
                    });

                    this.io!.to(`conv-${data.conversationId}`).emit('new-message', msg);
                } catch (err) {
                    console.error('send-message error:', err);
                }
            });

            // Mark messages as read
            socket.on('message-read', async (conversationId: string) => {
                try {
                    await Message.updateMany(
                        { conversationId, readBy: { $ne: userId } },
                        { $addToSet: { readBy: userId } }
                    );
                    socket.to(`conv-${conversationId}`).emit('messages-read', { conversationId, userId });
                } catch (err) {
                    console.error('message-read error:', err);
                }
            });

            socket.on('disconnect', () => {
                console.log(`Socket disconnected: ${socket.id}`);
            });
        });
    }

    public getIO(): SocketIOServer {
        if (!this.io) throw new Error('Socket.io not initialized');
        return this.io;
    }

    public emitToUser(userId: string, event: string, data: any) {
        if (this.io) {
            this.io.to(userId.toString()).emit(event, data);
        }
    }

    public emitToStudent(studentId: string, event: string, data: any) {
        if (this.io) {
            this.io.to(`student-${studentId}`).emit(event, data);
        }
    }

    public emitToConversation(conversationId: string, event: string, data: any) {
        if (this.io) {
            this.io.to(`conv-${conversationId}`).emit(event, data);
        }
    }
}

export const socketService = new SocketService();

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { socketOriginCheck } from '../../config/cors';
import { checkStaffAccount, checkStudentAccount } from '../../modules/auth/account.service';
import { verifyToken } from '../../modules/auth/token.service';
import { registerChatHandlers } from './chat.socket';

class SocketService {
    private io: SocketIOServer | null = null;

    public init(server: HttpServer): void {
        this.io = new SocketIOServer(server, {
            pingInterval: 25000,  // send ping every 25s
            pingTimeout: 20000,   // wait 20s for pong before considering disconnected
            cors: {
                origin: socketOriginCheck,
                methods: ['GET', 'POST'],
                credentials: true
            },
        });

        this.io.use(async (socket, next) => {
            // Token only from the auth payload, never the query string (URLs end up in access logs).
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Authentication error'));

            try {
                const decoded = verifyToken<any>(token as string);
                const isStudent = decoded?.role === 'student' || decoded?.type === 'student' || !!decoded?.studentId;
                const userId = isStudent ? decoded?.studentId : decoded?.userId;

                if (!userId) {
                    return next(new Error('Authentication error'));
                }

                // Same rule as the HTTP middleware: the account must still exist and be active,
                // and a staff member's role is the current one, not the one baked into the token.
                const account = isStudent ? await checkStudentAccount(userId) : await checkStaffAccount(userId);
                if (!account.ok) {
                    return next(new Error('Authentication error'));
                }

                socket.data.user = {
                    userId: String(userId),
                    role: account.role,
                    isStudent,
                };
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

            // Chat events: membership and input validation live in the conversation/message services
            registerChatHandlers(socket, this.io!, { id: userId, isStudent, role: socket.data.user.role });

            socket.on('disconnect', () => {
                console.log(`Socket disconnected: ${socket.id}`);
            });
        });
    }

    /** Closes every client connection (shutdown), so the HTTP server can finish closing. */
    public disconnectAll(): void {
        this.io?.disconnectSockets(true);
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

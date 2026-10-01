type BridgeNotificationPayload = {
    recipientId: string;
    notification: {
        _id: string;
        recipient: string;
        title: string;
        message: string;
        type: 'info' | 'success' | 'warning' | 'error';
        link?: string;
        isRead: boolean;
        createdAt?: string;
        updatedAt?: string;
    };
};

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL?.replace(/\/+$/, '');
const SOCKET_SERVER_SECRET = process.env.SOCKET_SERVER_SECRET;

export const forwardNotificationToSocketServer = async (payload: BridgeNotificationPayload) => {
    if (!SOCKET_SERVER_URL || !SOCKET_SERVER_SECRET) {
        return;
    }

    try {
        const response = await fetch(`${SOCKET_SERVER_URL}/api/internal/socket/notifications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-socket-server-secret': SOCKET_SERVER_SECRET,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Socket bridge failed (${response.status}): ${text || response.statusText}`);
        }
    } catch (error) {
        console.error('Failed to forward notification to socket server:', error);
    }
};

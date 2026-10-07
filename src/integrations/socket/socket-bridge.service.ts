import { config } from '../../config/env';

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

/** Forwards a notification to the dedicated socket host (serverless API deployments). A no-op when no bridge is configured. */
export const forwardNotificationToSocketServer = async (payload: BridgeNotificationPayload) => {
    const bridgeUrl = config.socket.bridgeUrl;
    const bridgeSecret = config.socket.bridgeSecret;
    if (!bridgeUrl || !bridgeSecret) {
        return;
    }

    try {
        const response = await fetch(`${bridgeUrl}/api/internal/socket/notifications`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-socket-server-secret': bridgeSecret,
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

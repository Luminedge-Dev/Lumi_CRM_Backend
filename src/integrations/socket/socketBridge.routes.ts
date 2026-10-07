import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { config } from '../../config/env';
import { socketService } from './socket.service';

// Internal endpoint for a split deployment: the API forwards a notification here and the dedicated
// socket host emits it to the recipient's live connection. Protected by a shared secret.

const secretsMatch = (supplied: string, expected: string): boolean => {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const router = Router();

router.post('/api/internal/socket/notifications', (req: Request, res: Response) => {
  const sharedSecret = config.socket.bridgeSecret;
  const incomingSecret = req.header('x-socket-server-secret');

  if (!sharedSecret) {
    res.status(503).json({ success: false, message: 'Socket bridge is not configured' });
    return;
  }

  if (!incomingSecret || !secretsMatch(incomingSecret, sharedSecret)) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }

  const { recipientId, notification } = req.body ?? {};

  if (!recipientId || !notification) {
    res.status(400).json({ success: false, message: 'recipientId and notification are required' });
    return;
  }

  socketService.emitToUser(recipientId, 'new-notification', notification);
  res.json({ success: true });
});

export default router;

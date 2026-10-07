import http from 'http';
import app from './app';
import { config, connectDB, disconnectDB, warnMissingProductionConfig } from './config';
import { socketService } from './integrations/socket/socket.service';
import { startFollowUpReminderJob } from './jobs/followUpReminder.job';
import { startKeepAliveJob } from './jobs/keepAlive.job';

const PORT = config.port;

warnMissingProductionConfig();

// Connect to MongoDB first, then start server
connectDB().then(() => {
  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.io
  socketService.init(server);

  // Start daily follow-up reminder cron job
  const followUpJob = startFollowUpReminderJob();

  // Keep the free-tier Render instance warm so it doesn't spin down
  const keepAliveTimer = startKeepAliveJob();

  // Start server
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // Graceful shutdown: stop the schedulers, drop realtime connections, stop accepting HTTP
  // connections, let in-flight requests finish, then close the DB.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received: shutting down`);
    followUpJob.stop();
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    socketService.disconnectAll();
    server.close(async () => {
      await disconnectDB().catch(() => undefined);
      process.exit(0);
    });
    // Do not hang forever on stuck keep-alive connections.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}).catch((err) => {
  console.error('Failed to connect to MongoDB, server not started:', err);
  process.exit(1);
});

// A rejected promise nobody handled is logged, not fatal (a single failed background task must not take the API down).
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

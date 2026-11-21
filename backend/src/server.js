import http from 'node:http';
import { env } from './config/env.js';
import app from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { closeValkeyConnections } from './config/valkey.js';
import { closeEmailQueue } from './queues/email.queue.js';
import { closeEmailWorker, startEmailWorker } from './queues/workers/email.worker.js';
import { startOrderExpiryScheduler } from './schedulers/orderExpiry.scheduler.js';
import { runOrderExpiry } from './services/orderExpiry.service.js';
import { initSockets } from './sockets/index.js';

try {
  await connectDb();
  console.log('MongoDB connected');
} catch (error) {
  console.error(`MongoDB connection failed: ${error.message}`);
  process.exit(1);
}

const httpServer = http.createServer(app);
const io = initSockets(httpServer);
startEmailWorker();
const stopScheduler = startOrderExpiryScheduler(runOrderExpiry, { intervalMs: env.ORDER_EXPIRY_INTERVAL_MINUTES * 60_000 });

httpServer.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), 10_000).unref();

  const steps = [
    ['HTTP', () => { httpServer.close(); httpServer.closeIdleConnections(); }],
    ['Socket.IO', () => io.close()],
    ['scheduler', stopScheduler],
    ['worker', closeEmailWorker],
    ['queue', closeEmailQueue],
    ['Valkey', closeValkeyConnections],
    ['Mongo', disconnectDb],
  ];
  for (const [name, step] of steps) {
    try {
      await step();
    } catch (error) {
      console.error(`[shutdown] ${name}: ${error.message}`);
    }
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

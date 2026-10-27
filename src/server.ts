import { buildApp } from './app.js';
import { env } from './config/env.js';

async function startServer() {
  const app = buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Received shutdown signal, closing server gracefully...');
    try {
      await app.close();
      app.log.info('Server closed successfully.');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    app.log.info(`QueueBite Backend is listening at ${address}`);
    app.log.info(`API Documentation available at ${address}/docs`);
  } catch (err) {
    app.log.fatal(err, 'Failed to start QueueBite Backend server');
    process.exit(1);
  }
}

startServer();

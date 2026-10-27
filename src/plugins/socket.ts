import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

const socketPluginCallback: FastifyPluginAsync = async (fastify) => {
  const allowedOrigins =
    env.CORS_ORIGIN === '*'
      ? true
      : env.CORS_ORIGIN.split(',').map((o) => o.trim());

  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    fastify.log.info({ socketId: socket.id }, 'Real-time WebSocket client connected');

    // Subscribe to restaurant live host room
    socket.on('join:restaurant', (data: { restaurantId: string }) => {
      if (data?.restaurantId) {
        const room = `restaurant:${data.restaurantId}`;
        socket.join(room);
        fastify.log.debug({ socketId: socket.id, room }, 'Client joined restaurant room');
      }
    });

    socket.on('leave:restaurant', (data: { restaurantId: string }) => {
      if (data?.restaurantId) {
        socket.leave(`restaurant:${data.restaurantId}`);
      }
    });

    // Subscribe to individual queue entry room (customer waiting screen)
    socket.on('join:queue', (data: { queueEntryId: string }) => {
      if (data?.queueEntryId) {
        const room = `queue:${data.queueEntryId}`;
        socket.join(room);
        fastify.log.debug({ socketId: socket.id, room }, 'Client joined queue room');
      }
    });

    socket.on('leave:queue', (data: { queueEntryId: string }) => {
      if (data?.queueEntryId) {
        socket.leave(`queue:${data.queueEntryId}`);
      }
    });

    // Subscribe to collaborative group session room
    socket.on('join:group', (data: { sessionId: string }) => {
      if (data?.sessionId) {
        const room = `group:${data.sessionId}`;
        socket.join(room);
        fastify.log.debug({ socketId: socket.id, room }, 'Client joined group room');
      }
    });

    socket.on('leave:group', (data: { sessionId: string }) => {
      if (data?.sessionId) {
        socket.leave(`group:${data.sessionId}`);
      }
    });

    // Subscribe to pre-order status room
    socket.on('join:order', (data: { orderId: string }) => {
      if (data?.orderId) {
        const room = `order:${data.orderId}`;
        socket.join(room);
        fastify.log.debug({ socketId: socket.id, room }, 'Client joined order room');
      }
    });

    socket.on('leave:order', (data: { orderId: string }) => {
      if (data?.orderId) {
        socket.leave(`order:${data.orderId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      fastify.log.info({ socketId: socket.id, reason }, 'Real-time WebSocket client disconnected');
    });
  });

  fastify.decorate('io', io);

  fastify.addHook('onClose', (instance, done) => {
    instance.io.close(() => {
      instance.log.info('Socket.IO server closed');
      done();
    });
  });
};

export const socketPlugin = fp(socketPluginCallback, {
  name: 'socket-plugin',
  fastify: '5.x',
});

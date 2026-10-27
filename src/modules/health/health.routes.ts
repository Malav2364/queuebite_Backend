import { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Liveness probe
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Liveness check to verify server is running',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    }
  );

  // Readiness probe
  fastify.get(
    '/ready',
    {
      schema: {
        description: 'Readiness check to verify database and dependency connectivity',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              database: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
          503: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              database: { type: 'string' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        await fastify.prisma.$queryRawUnsafe('SELECT 1');
        return reply.status(200).send({
          status: 'ready',
          database: 'connected',
          timestamp: new Date().toISOString(),
        });
      } catch (err: unknown) {
        fastify.log.error(err, 'Database readiness check failed');
        return reply.status(503).send({
          status: 'unready',
          database: 'disconnected',
          error: 'Database connection failed',
        });
      }
    }
  );
};

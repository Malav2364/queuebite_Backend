import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FastifyPluginAsync } from 'fastify';

export const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'QueueBite API',
        description:
          'Authoritative REST API and real-time virtual queue management platform for QueueBite.',
        version: '1.0.0',
      },
      servers: [
        {
          url: '/',
          description: 'Current server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter your Clerk JWT bearer token',
          },
        },
      },
      tags: [
        { name: 'Health', description: 'Liveness and dependency readiness probes' },
        { name: 'Auth', description: 'Authentication and user session resolution' },
        { name: 'Users', description: 'User profile and dining preferences' },
        { name: 'Restaurants', description: 'Restaurant discovery and hours' },
        { name: 'Queue', description: 'Customer queue operations' },
        { name: 'Staff', description: 'Staff operations, walk-ins, and seating' },
        { name: 'Favorites', description: 'Customer favorite restaurants' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
};

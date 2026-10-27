import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import fastify, { FastifyHttpOptions, FastifyInstance } from 'fastify';
import { Server } from 'node:http';
import { env } from './config/env.js';
import { errorHandler } from './errors/app-error.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { cuisineRoutes } from './modules/cuisines/cuisine.routes.js';
import { prismaPlugin } from './plugins/prisma.js';
import { swaggerPlugin } from './plugins/swagger.js';

export function buildApp(opts: FastifyHttpOptions<Server> = {}): FastifyInstance {
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
          };
        },
      },
    },
    requestIdHeader: 'x-request-id',
    ...opts,
  });

  // Centralized Error Handling
  app.setErrorHandler(errorHandler);

  // Register Core Plugins
  app.register(sensible);

  // CORS configuration
  app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'idempotency-key'],
  });

  // Database Plugin
  app.register(prismaPlugin);

  // OpenAPI / Swagger Documentation
  app.register(swaggerPlugin);

  // Routes
  app.register(healthRoutes);
  app.register(userRoutes);
  app.register(cuisineRoutes);

  return app;
}

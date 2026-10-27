import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../users/auth.middleware.js';
import {
  cancelQueueSchema,
  joinQueueSchema,
  noShowSchema,
  queueListQuerySchema,
  seatPartySchema,
} from './queue.schema.js';
import { QueueService } from './queue.service.js';
import { QueueRealtimeEmitter } from './queue.events.js';

export const queueRoutes: FastifyPluginAsync = async (fastify) => {
  const emitter = new QueueRealtimeEmitter(fastify.io, fastify.prisma);
  const queueService = new QueueService(fastify.prisma, emitter);

  /**
   * POST /api/v1/restaurants/:restaurantId/queue/join
   * Customer joins virtual queue for a restaurant.
   */
  fastify.post(
    '/api/v1/restaurants/:restaurantId/queue/join',
    {
      schema: {
        description: 'Join a restaurant virtual queue',
        tags: ['Virtual Queue Engine'],
        params: {
          type: 'object',
          required: ['restaurantId'],
          properties: {
            restaurantId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['guestName', 'guestPhone', 'partySize'],
          properties: {
            guestName: { type: 'string' },
            guestPhone: { type: 'string' },
            partySize: { type: 'number', minimum: 1 },
            notes: { type: 'string', nullable: true },
            idempotencyKey: { type: 'string', nullable: true },
          },
        },
      },
      preHandler: async (request, reply) => {
        // Optional user authentication: extract userId if Bearer token present
        if (request.headers.authorization) {
          try {
            await requireAuth(request, reply);
          } catch {
            // Non-blocking: continue as guest if token is invalid or guest mode
          }
        }
      },
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const parsedBody = joinQueueSchema.parse(request.body);
      const userId = request.user?.id;

      const entry = await queueService.joinQueue(
        restaurantId,
        parsedBody,
        userId
      );

      return reply.status(201).send({
        success: true,
        data: entry,
      });
    }
  );

  /**
   * GET /api/v1/queue/entries/:id
   * Get single queue entry with live position in line and wait calculation.
   */
  fastify.get(
    '/api/v1/queue/entries/:id',
    {
      schema: {
        description: 'Get queue entry details, current spot in line, and wait estimation',
        tags: ['Virtual Queue Engine'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const entry = await queueService.getQueueEntry(id);
      return reply.status(200).send({
        success: true,
        data: entry,
      });
    }
  );

  /**
   * POST /api/v1/queue/entries/:id/cancel
   * Cancel queue entry.
   */
  fastify.post(
    '/api/v1/queue/entries/:id/cancel',
    {
      schema: {
        description: 'Cancel a spot in the virtual queue',
        tags: ['Virtual Queue Engine'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string', nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsedBody = cancelQueueSchema.parse(request.body ?? {});
      const cancelled = await queueService.cancelQueueEntry(id, parsedBody);
      return reply.status(200).send({
        success: true,
        data: cancelled,
      });
    }
  );

  /**
   * GET /api/v1/restaurants/:restaurantId/queue
   * Host / Staff view: lists current queue entries with live summary.
   */
  fastify.get(
    '/api/v1/restaurants/:restaurantId/queue',
    {
      schema: {
        description: 'List active queue entries for restaurant host stand',
        tags: ['Virtual Queue Engine'],
        params: {
          type: 'object',
          required: ['restaurantId'],
          properties: {
            restaurantId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['WAITING', 'CALLED', 'SEATED', 'COMPLETED', 'CANCELLED', 'ALL'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const parsedQuery = queueListQuerySchema.parse(request.query);
      const queue = await queueService.listRestaurantQueue(
        restaurantId,
        parsedQuery.status
      );
      return reply.status(200).send({
        success: true,
        data: queue,
      });
    }
  );

  /**
   * POST /api/v1/queue/entries/:id/call
   * Host calls party to table stand.
   */
  fastify.post(
    '/api/v1/queue/entries/:id/call',
    {
      schema: {
        description: 'Host action: Call waiting party to host stand',
        tags: ['Virtual Queue Engine'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const called = await queueService.callParty(id);
      return reply.status(200).send({
        success: true,
        data: called,
      });
    }
  );

  /**
   * POST /api/v1/queue/entries/:id/seat
   * Host seats party at a designated table.
   */
  fastify.post(
    '/api/v1/queue/entries/:id/seat',
    {
      schema: {
        description: 'Host action: Seat party at designated table',
        tags: ['Virtual Queue Engine'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['tableId'],
          properties: {
            tableId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsedBody = seatPartySchema.parse(request.body);
      const seated = await queueService.seatParty(id, parsedBody);
      return reply.status(200).send({
        success: true,
        data: seated,
      });
    }
  );

  /**
   * POST /api/v1/queue/entries/:id/complete
   * Complete dining session, free table.
   */
  fastify.post(
    '/api/v1/queue/entries/:id/complete',
    {
      schema: {
        description: 'Host action: Mark dining as completed and free table',
        tags: ['Virtual Queue Engine'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const completed = await queueService.completeDining(id);
      return reply.status(200).send({
        success: true,
        data: completed,
      });
    }
  );

  /**
   * POST /api/v1/queue/entries/:id/no-show
   * Mark party as no-show.
   */
  fastify.post(
    '/api/v1/queue/entries/:id/no-show',
    {
      schema: {
        description: 'Host action: Mark party as no-show',
        tags: ['Virtual Queue Engine'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string', nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsedBody = noShowSchema.parse(request.body ?? {});
      const result = await queueService.markNoShow(id, parsedBody);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );
};

import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../users/auth.middleware.js';
import { OrderRealtimeEmitter } from './order.events.js';
import {
  createPreOrderSchema,
  updateOrderStatusSchema,
} from './order.schema.js';
import { OrderService } from './order.service.js';

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  const orderEmitter = new OrderRealtimeEmitter(fastify.io);
  const orderService = new OrderService(fastify.prisma, orderEmitter);

  /**
   * POST /api/v1/orders/pre-order
   * Places a queue-aware pre-order.
   */
  fastify.post(
    '/api/v1/orders/pre-order',
    {
      schema: {
        description: 'Place a queue-aware pre-order',
        tags: ['Pre-Ordering'],
        body: {
          type: 'object',
          required: ['restaurantId', 'items'],
          properties: {
            restaurantId: { type: 'string' },
            queueEntryId: { type: 'string' },
            groupSessionId: { type: 'string' },
            customerName: { type: 'string' },
            customerPhone: { type: 'string' },
            specialNotes: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['menuItemId', 'quantity'],
                properties: {
                  menuItemId: { type: 'string' },
                  quantity: { type: 'number', minimum: 1 },
                  specialNotes: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: async (request, reply) => {
        if (request.headers.authorization) {
          try {
            await requireAuth(request, reply);
          } catch {
            // Optional auth
          }
        }
      },
    },
    async (request, reply) => {
      const parsedBody = createPreOrderSchema.parse(request.body);
      const preOrder = await orderService.createPreOrder(
        parsedBody,
        request.user?.id
      );

      return reply.status(201).send({
        success: true,
        data: preOrder,
      });
    }
  );

  /**
   * GET /api/v1/orders/:id
   * Retrieves pre-order details by ID.
   */
  fastify.get(
    '/api/v1/orders/:id',
    {
      schema: {
        description: 'Get pre-order details by ID',
        tags: ['Pre-Ordering'],
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
      const order = await orderService.getOrderById(id);

      return reply.send({
        success: true,
        data: order,
      });
    }
  );

  /**
   * GET /api/v1/queue/entries/:queueEntryId/pre-orders
   * Retrieves all pre-orders linked to a queue entry.
   */
  fastify.get(
    '/api/v1/queue/entries/:queueEntryId/pre-orders',
    {
      schema: {
        description: 'Get pre-orders for a queue entry',
        tags: ['Pre-Ordering'],
        params: {
          type: 'object',
          required: ['queueEntryId'],
          properties: {
            queueEntryId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { queueEntryId } = request.params as { queueEntryId: string };
      const orders = await orderService.getOrdersByQueueEntry(queueEntryId);

      return reply.send({
        success: true,
        data: orders,
      });
    }
  );

  /**
   * GET /api/v1/groups/:sessionId/pre-orders
   * Retrieves all pre-orders for a group session.
   */
  fastify.get(
    '/api/v1/groups/:sessionId/pre-orders',
    {
      schema: {
        description: 'Get pre-orders for a group session',
        tags: ['Pre-Ordering'],
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const orders = await orderService.getOrdersByGroupSession(sessionId);

      return reply.send({
        success: true,
        data: orders,
      });
    }
  );

  /**
   * GET /api/v1/restaurants/:restaurantId/pre-orders
   * Retrieves restaurant kitchen order queue.
   */
  fastify.get(
    '/api/v1/restaurants/:restaurantId/pre-orders',
    {
      schema: {
        description: 'Get kitchen pre-orders for a restaurant',
        tags: ['Pre-Ordering'],
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
            status: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { restaurantId } = request.params as { restaurantId: string };
      const { status } = (request.query as { status?: any }) || {};
      const orders = await orderService.getOrdersByRestaurant(
        restaurantId,
        status
      );

      return reply.send({
        success: true,
        data: orders,
      });
    }
  );

  /**
   * PATCH /api/v1/orders/:id/status
   * Updates pre-order status (CONFIRMED, PREPARING, SERVED, CANCELLED).
   */
  fastify.patch(
    '/api/v1/orders/:id/status',
    {
      schema: {
        description: 'Update pre-order status',
        tags: ['Pre-Ordering'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsedBody = updateOrderStatusSchema.parse(request.body);
      const updated = await orderService.updateOrderStatus(
        id,
        parsedBody.status
      );

      return reply.send({
        success: true,
        data: updated,
      });
    }
  );
};

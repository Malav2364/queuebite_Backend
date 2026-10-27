import { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../users/auth.middleware.js';
import { QueueRealtimeEmitter } from '../queues/queue.events.js';
import { QueueService } from '../queues/queue.service.js';
import { GroupRealtimeEmitter } from './group.events.js';
import {
  createGroupSessionSchema,
  joinGroupSessionSchema,
  submitGroupQueueSchema,
  updateMemberReadySchema,
} from './group.schema.js';
import { GroupService } from './group.service.js';

export const groupRoutes: FastifyPluginAsync = async (fastify) => {
  const queueEmitter = new QueueRealtimeEmitter(fastify.io, fastify.prisma);
  const queueService = new QueueService(fastify.prisma, queueEmitter);
  const groupEmitter = new GroupRealtimeEmitter(fastify.io);
  const groupService = new GroupService(fastify.prisma, queueService, groupEmitter);

  /**
   * POST /api/v1/groups
   * Creates a new collaborative dining party session.
   */
  fastify.post(
    '/api/v1/groups',
    {
      schema: {
        description: 'Create a new group dining session with a shareable code',
        tags: ['Group Dining'],
        body: {
          type: 'object',
          required: ['restaurantId', 'creatorName'],
          properties: {
            restaurantId: { type: 'string' },
            creatorName: { type: 'string' },
            creatorPhone: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
      preHandler: async (request, reply) => {
        if (request.headers.authorization) {
          try {
            await requireAuth(request, reply);
          } catch {
            // Optional auth for guests
          }
        }
      },
    },
    async (request, reply) => {
      const parsedBody = createGroupSessionSchema.parse(request.body);
      const session = await groupService.createSession(
        parsedBody,
        request.user?.id
      );

      return reply.status(201).send({
        success: true,
        data: session,
      });
    }
  );

  /**
   * GET /api/v1/groups/:codeOrId
   * Retrieves group session details by 6-char share code or UUID.
   */
  fastify.get(
    '/api/v1/groups/:codeOrId',
    {
      schema: {
        description: 'Get group dining session by code or ID',
        tags: ['Group Dining'],
        params: {
          type: 'object',
          required: ['codeOrId'],
          properties: {
            codeOrId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { codeOrId } = request.params as { codeOrId: string };
      const session = await groupService.getSession(codeOrId);

      return reply.send({
        success: true,
        data: session,
      });
    }
  );

  /**
   * POST /api/v1/groups/:codeOrId/join
   * Joins an existing party using code or session ID.
   */
  fastify.post(
    '/api/v1/groups/:codeOrId/join',
    {
      schema: {
        description: 'Join a group dining party',
        tags: ['Group Dining'],
        params: {
          type: 'object',
          required: ['codeOrId'],
          properties: {
            codeOrId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            dietaryNotes: { type: 'string' },
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
      const { codeOrId } = request.params as { codeOrId: string };
      const parsedBody = joinGroupSessionSchema.parse(request.body);
      const result = await groupService.joinSession(
        codeOrId,
        parsedBody,
        request.user?.id
      );

      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  /**
   * PATCH /api/v1/groups/:sessionId/members/:memberId/ready
   * Toggles readiness / arrival of a group member.
   */
  fastify.patch(
    '/api/v1/groups/:sessionId/members/:memberId/ready',
    {
      schema: {
        description: 'Toggle member readiness or arrival',
        tags: ['Group Dining'],
        params: {
          type: 'object',
          required: ['sessionId', 'memberId'],
          properties: {
            sessionId: { type: 'string' },
            memberId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['isReady'],
          properties: {
            isReady: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId, memberId } = request.params as {
        sessionId: string;
        memberId: string;
      };
      const parsedBody = updateMemberReadySchema.parse(request.body);
      const member = await groupService.toggleMemberReady(
        sessionId,
        memberId,
        parsedBody.isReady
      );

      return reply.send({
        success: true,
        data: member,
      });
    }
  );

  /**
   * POST /api/v1/groups/:sessionId/queue
   * Host submits the collective group into the restaurant virtual queue.
   */
  fastify.post(
    '/api/v1/groups/:sessionId/queue',
    {
      schema: {
        description: 'Submit group party into restaurant virtual queue',
        tags: ['Group Dining'],
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const parsedBody = submitGroupQueueSchema.parse(request.body || {});
      const session = await groupService.submitGroupToQueue(
        sessionId,
        parsedBody.notes
      );

      return reply.status(200).send({
        success: true,
        data: session,
      });
    }
  );
};

import { FastifyPluginAsync } from 'fastify';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from './auth.middleware.js';
import {
  syncUserSchema,
  updateUserPreferencesSchema,
  updateUserProfileSchema,
} from './user.schema.js';
import { UserService } from './user.service.js';

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  const userService = new UserService(fastify.prisma);

  /**
   * POST /api/v1/users/sync
   * Authenticates / creates the user from Clerk token & profile info.
   */
  fastify.post(
    '/api/v1/users/sync',
    {
      schema: {
        description: 'Sync authenticated Clerk user with backend database',
        tags: ['Users & Auth'],
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            clerkId: { type: 'string', description: 'Clerk User ID (optional if Bearer token present)' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
      preHandler: async (request, reply) => {
        // If Bearer token is provided, extract clerkUserId
        if (request.headers.authorization) {
          await requireAuth(request, reply);
        }
      },
    },
    async (request, reply) => {
      const parsedBody = syncUserSchema.parse(request.body);
      const clerkId = request.clerkUserId || parsedBody.clerkId;

      if (!clerkId) {
        throw new AppError(
          'A valid Clerk User ID is required via Authorization token or clerkId field.',
          400,
          'MISSING_CLERK_ID'
        );
      }

      const user = await userService.syncUser(clerkId, parsedBody);
      return reply.status(200).send({
        success: true,
        data: user,
      });
    }
  );

  /**
   * GET /api/v1/users/me
   * Retrieve current user profile and preferences.
   */
  fastify.get(
    '/api/v1/users/me',
    {
      schema: {
        description: 'Get current user profile and preferences',
        tags: ['Users & Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      // If user is already loaded in request.user, use it, otherwise fetch
      const clerkId = request.clerkUserId!;
      const user = request.user ?? (await userService.getUserByClerkId(clerkId));

      return reply.status(200).send({
        success: true,
        data: user,
      });
    }
  );

  /**
   * PATCH /api/v1/users/me
   * Update current user profile fields (name, phone, avatar).
   */
  fastify.patch(
    '/api/v1/users/me',
    {
      schema: {
        description: 'Update current user basic profile',
        tags: ['Users & Auth'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
          },
        },
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = request.user ?? (await userService.getUserByClerkId(request.clerkUserId!));
      const parsedBody = updateUserProfileSchema.parse(request.body);

      const updated = await userService.updateProfile(user.id, parsedBody);
      return reply.status(200).send({
        success: true,
        data: updated,
      });
    }
  );

  /**
   * PUT /api/v1/users/me/preferences
   * Update party size, wait tolerances, notifications, and dietary/cuisine preferences.
   */
  fastify.put(
    '/api/v1/users/me/preferences',
    {
      schema: {
        description: 'Update user dining preferences and dietary filters',
        tags: ['Users & Auth'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            maxWaitMinutes: { type: 'number', nullable: true },
            preferredPartySize: { type: 'number' },
            pushNotifications: { type: 'boolean' },
            smsNotifications: { type: 'boolean' },
            dietaryTags: {
              type: 'array',
              items: { type: 'string' },
            },
            cuisineIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const user = request.user ?? (await userService.getUserByClerkId(request.clerkUserId!));
      const parsedBody = updateUserPreferencesSchema.parse(request.body);

      const updatedPreferences = await userService.updatePreferences(user.id, parsedBody);
      return reply.status(200).send({
        success: true,
        data: updatedPreferences,
      });
    }
  );
};

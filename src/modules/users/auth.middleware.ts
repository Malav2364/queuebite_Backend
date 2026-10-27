import { createClerkClient, verifyToken } from '@clerk/backend';
import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../errors/app-error.js';
import { PrismaClient, User, UserPreference, UserCuisinePreference, UserDietaryPreference, Cuisine } from '@prisma/client';

export type UserWithPreferences = User & {
  preferences:
    | (UserPreference & {
        cuisines: (UserCuisinePreference & { cuisine: Cuisine })[];
        dietary: UserDietaryPreference[];
      })
    | null;
};

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserWithPreferences;
    clerkUserId?: string;
  }
}

export const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
});

/**
 * Fastify preHandler hook to authenticate requests via Clerk JWT or Bearer token.
 * Extracts the user from the database or provides clerkId for provisioning.
 */
export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header. Expected Bearer token.');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    throw new UnauthorizedError('Token not provided in Authorization header.');
  }

  let clerkUserId: string | null = null;

  // 1. Verify via Clerk SDK if CLERK_SECRET_KEY is configured
  if (env.CLERK_SECRET_KEY) {
    try {
      const verified = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
      });
      clerkUserId = verified.sub;
    } catch (err: unknown) {
      request.log.warn({ err }, 'Clerk token verification failed');
      throw new UnauthorizedError('Invalid or expired authentication token');
    }
  } else {
    // 2. Development fallback: allow JWT decode or test token if secret key is not yet set
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        clerkUserId = payload.sub || payload.id || null;
      } else {
        // Plain ID passed in dev/testing (e.g., "user_test123")
        clerkUserId = token;
      }
    } catch {
      clerkUserId = token;
    }
  }

  if (!clerkUserId) {
    throw new UnauthorizedError('Unable to identify user from authentication token');
  }

  request.clerkUserId = clerkUserId;

  // 3. Load user from database if exists
  const prisma: PrismaClient = request.server.prisma;
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    include: {
      preferences: {
        include: {
          cuisines: {
            include: {
              cuisine: true,
            },
          },
          dietary: true,
        },
      },
    },
  });

  if (user) {
    request.user = user as UserWithPreferences;
  }
}

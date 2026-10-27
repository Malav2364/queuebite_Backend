import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../errors/app-error.js';
import { SyncUserInput, UpdateUserPreferencesInput, UpdateUserProfileInput } from './user.schema.js';

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Syncs a user authenticated via Clerk.
   * Creates the user and their default preferences if they don't exist yet,
   * or updates profile info if they do.
   */
  async syncUser(clerkId: string, input: SyncUserInput) {
    const user = await this.prisma.user.upsert({
      where: { clerkId },
      update: {
        email: input.email,
        name: input.name ?? undefined,
        phone: input.phone ?? undefined,
        avatarUrl: input.avatarUrl ?? undefined,
      },
      create: {
        clerkId,
        email: input.email,
        name: input.name,
        phone: input.phone,
        avatarUrl: input.avatarUrl,
        preferences: {
          create: {
            preferredPartySize: 2,
            pushNotifications: true,
            smsNotifications: false,
          },
        },
      },
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

    return user;
  }

  /**
   * Retrieves user profile by clerkId including preferences and taxonomy.
   */
  async getUserByClerkId(clerkId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId },
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

    if (!user) {
      throw new NotFoundError(`User with Clerk ID "${clerkId}" was not found. Please sync your account first.`);
    }

    return user;
  }

  /**
   * Updates basic profile details (name, phone, avatar).
   */
  async updateProfile(userId: string, input: UpdateUserProfileInput) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name ?? undefined,
        phone: input.phone ?? undefined,
        avatarUrl: input.avatarUrl ?? undefined,
      },
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

    return user;
  }

  /**
   * Updates user preferences, dietary tags, and cuisine selections.
   */
  async updatePreferences(userId: string, input: UpdateUserPreferencesInput) {
    // 1. Ensure user preferences record exists
    const pref = await this.prisma.userPreference.upsert({
      where: { userId },
      update: {
        maxWaitMinutes: input.maxWaitMinutes,
        preferredPartySize: input.preferredPartySize ?? undefined,
        pushNotifications: input.pushNotifications ?? undefined,
        smsNotifications: input.smsNotifications ?? undefined,
      },
      create: {
        userId,
        maxWaitMinutes: input.maxWaitMinutes,
        preferredPartySize: input.preferredPartySize ?? 2,
        pushNotifications: input.pushNotifications ?? true,
        smsNotifications: input.smsNotifications ?? false,
      },
    });

    const preferenceId = pref.id;

    // 2. Perform relation updates inside a transaction
    await this.prisma.$transaction(async (tx) => {
      // Handle dietary tags if provided
      if (input.dietaryTags !== undefined) {
        await tx.userDietaryPreference.deleteMany({
          where: { preferenceId },
        });

        if (input.dietaryTags.length > 0) {
          const uniqueTags = [...new Set(input.dietaryTags)];
          await tx.userDietaryPreference.createMany({
            data: uniqueTags.map((tag) => ({
              preferenceId,
              tag: tag.toUpperCase().trim(),
            })),
          });
        }
      }

      // Handle cuisine IDs if provided
      if (input.cuisineIds !== undefined) {
        await tx.userCuisinePreference.deleteMany({
          where: { preferenceId },
        });

        if (input.cuisineIds.length > 0) {
          const uniqueCuisineIds = [...new Set(input.cuisineIds)];
          await tx.userCuisinePreference.createMany({
            data: uniqueCuisineIds.map((cuisineId) => ({
              preferenceId,
              cuisineId,
            })),
          });
        }
      }
    });

    // 3. Return refreshed preferences with full relations
    return this.prisma.userPreference.findUnique({
      where: { id: preferenceId },
      include: {
        cuisines: {
          include: {
            cuisine: true,
          },
        },
        dietary: true,
      },
    });
  }
}

import { z } from 'zod';

export const syncUserSchema = z.object({
  clerkId: z.string().min(1, 'clerkId is required').optional(),
  email: z.string().email('Valid email is required'),
  name: z.string().min(1).max(100).optional().nullable(),
  phone: z.string().max(25).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export type SyncUserInput = z.infer<typeof syncUserSchema>;

export const updateUserProfileSchema = z.object({
  name: z.string().min(1).max(100).optional().nullable(),
  phone: z.string().max(25).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const dietaryTagsEnum = z.enum([
  'VEGETARIAN',
  'VEGAN',
  'HALAL',
  'KOSHER',
  'GLUTEN_FREE',
  'DAIRY_FREE',
  'NUT_FREE',
  'PESCATARIAN',
  'EGG_FREE',
  'JAIN',
]);

export const updateUserPreferencesSchema = z.object({
  maxWaitMinutes: z.number().int().min(1).max(300).optional().nullable(),
  preferredPartySize: z.number().int().min(1).max(30).optional(),
  pushNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  dietaryTags: z.array(z.string().min(1).max(50)).optional(),
  cuisineIds: z.array(z.string().uuid()).optional(),
});

export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;

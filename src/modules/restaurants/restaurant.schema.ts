import { z } from 'zod';

export const priceRangeEnum = z.enum(['BUDGET', 'MODERATE', 'EXPENSIVE', 'FINE_DINING']);

export const restaurantQuerySchema = z.object({
  search: z.string().optional(),
  cuisine: z.string().optional(),
  priceRange: priceRangeEnum.optional(),
  isQueueOpen: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  city: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(20).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RestaurantQuery = z.infer<typeof restaurantQuerySchema>;

export const createRestaurantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens'),
  description: z.string().max(1000).optional().nullable(),
  phone: z.string().max(25).optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(),
  priceRange: priceRangeEnum.default('MODERATE'),
  coverImageUrl: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  isQueueOpen: z.boolean().default(true),
  location: z.object({
    addressLine1: z.string().min(3),
    addressLine2: z.string().optional().nullable(),
    city: z.string().min(2),
    state: z.string().min(2),
    postalCode: z.string().min(3),
    country: z.string().default('IN'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  operatingSettings: z
    .object({
      minPartySize: z.number().int().min(1).default(1),
      maxPartySize: z.number().int().min(1).default(12),
      estimatedMinutesPerParty: z.number().int().min(1).default(15),
      callTimeoutMinutes: z.number().int().min(1).default(10),
      maxActiveQueueEntries: z.number().int().min(1).default(50),
      autoCallNextParty: z.boolean().default(false),
    })
    .optional(),
  cuisineIds: z.array(z.string().uuid()).optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

export const createMenuCategorySchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().default(0),
});

export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;

export const createMenuItemSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  price: z.number().min(0),
  imageUrl: z.string().url().optional().nullable(),
  isAvailable: z.boolean().default(true),
  isVegetarian: z.boolean().default(false),
  isSpicy: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

export const createTableSchema = z.object({
  tableNumber: z.string().min(1).max(20),
  capacity: z.number().int().min(1).max(30),
  minCapacity: z.number().int().min(1).default(1),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;

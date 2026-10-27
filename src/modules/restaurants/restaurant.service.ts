import { PriceRange, PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../errors/app-error.js';
import {
  CreateMenuCategoryInput,
  CreateMenuItemInput,
  CreateRestaurantInput,
  CreateTableInput,
  RestaurantQuery,
} from './restaurant.schema.js';

// Calculate Haversine distance in kilometers between two geo coordinates
function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export class RestaurantService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List restaurants with search, cuisine, price, geolocation, and queue filters.
   */
  async listRestaurants(query: RestaurantQuery) {
    const {
      search,
      cuisine,
      priceRange,
      isQueueOpen,
      city,
      lat,
      lng,
      radiusKm = 20,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { city: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (cuisine) {
      where.cuisines = {
        some: {
          cuisine: {
            OR: [
              { slug: { equals: cuisine, mode: 'insensitive' } },
              { name: { contains: cuisine, mode: 'insensitive' } },
              { id: cuisine },
            ],
          },
        },
      };
    }

    if (priceRange) {
      where.priceRange = priceRange as PriceRange;
    }

    if (isQueueOpen !== undefined) {
      where.isQueueOpen = isQueueOpen;
    }

    if (city) {
      where.location = {
        city: { contains: city, mode: 'insensitive' },
      };
    }

    // Fetch matching restaurants with relations
    const [total, rawRestaurants] = await Promise.all([
      this.prisma.restaurant.count({ where }),
      this.prisma.restaurant.findMany({
        where,
        include: {
          location: true,
          operatingSettings: true,
          cuisines: {
            include: {
              cuisine: true,
            },
          },
          photos: {
            orderBy: { sortOrder: 'asc' },
            take: 3,
          },
          _count: {
            select: {
              queueEntries: {
                where: {
                  status: { in: ['WAITING', 'CALLED'] },
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Format output and append live queue & distance info
    let restaurants = rawRestaurants.map((r) => {
      let distanceKm: number | null = null;
      if (lat !== undefined && lng !== undefined && r.location) {
        distanceKm = calculateDistanceKm(
          lat,
          lng,
          r.location.latitude,
          r.location.longitude
        );
      }

      const activeQueueCount = r._count.queueEntries;
      const estimatedMinutesPerParty =
        r.operatingSettings?.estimatedMinutesPerParty ?? 15;
      const estimatedWaitMinutes = r.isQueueOpen
        ? activeQueueCount * estimatedMinutesPerParty
        : 0;

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        phone: r.phone,
        email: r.email,
        website: r.website,
        priceRange: r.priceRange,
        coverImageUrl: r.coverImageUrl,
        logoUrl: r.logoUrl,
        isQueueOpen: r.isQueueOpen,
        location: r.location,
        cuisines: r.cuisines.map((c) => ({
          id: c.cuisine.id,
          name: c.cuisine.name,
          slug: c.cuisine.slug,
          iconUrl: c.cuisine.iconUrl,
        })),
        photos: r.photos,
        activeQueueCount,
        estimatedWaitMinutes,
        distanceKm,
      };
    });

    // If geolocation filtering requested, filter by radiusKm and sort by proximity
    if (lat !== undefined && lng !== undefined) {
      restaurants = restaurants
        .filter((r) => r.distanceKm !== null && r.distanceKm <= radiusKm)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      restaurants,
    };
  }

  /**
   * Retrieves full details for a single restaurant by ID or slug.
   */
  async getRestaurantById(idOrSlug: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug
      );

    const restaurant = await this.prisma.restaurant.findUnique({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        location: true,
        operatingSettings: true,
        hours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        cuisines: {
          include: {
            cuisine: true,
          },
        },
        photos: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            queueEntries: {
              where: {
                status: { in: ['WAITING', 'CALLED'] },
              },
            },
            tables: true,
          },
        },
      },
    });

    if (!restaurant) {
      throw new NotFoundError(`Restaurant "${idOrSlug}" not found`);
    }

    const activeQueueCount = restaurant._count.queueEntries;
    const estimatedMinutesPerParty =
      restaurant.operatingSettings?.estimatedMinutesPerParty ?? 15;
    const estimatedWaitMinutes = restaurant.isQueueOpen
      ? activeQueueCount * estimatedMinutesPerParty
      : 0;

    return {
      ...restaurant,
      activeQueueCount,
      estimatedWaitMinutes,
      totalTables: restaurant._count.tables,
      cuisines: restaurant.cuisines.map((c) => ({
        id: c.cuisine.id,
        name: c.cuisine.name,
        slug: c.cuisine.slug,
        iconUrl: c.cuisine.iconUrl,
      })),
    };
  }

  /**
   * Retrieves the digital menu grouped by category.
   */
  async getRestaurantMenu(restaurantId: string) {
    // Verify restaurant exists
    const exists = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true },
    });

    if (!exists) {
      throw new NotFoundError(`Restaurant "${restaurantId}" not found`);
    }

    const categories = await this.prisma.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return {
      restaurantId: exists.id,
      restaurantName: exists.name,
      categories,
    };
  }

  /**
   * Creates a new restaurant with location, settings, and cuisines.
   */
  async createRestaurant(input: CreateRestaurantInput) {
    return this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          phone: input.phone,
          email: input.email,
          website: input.website,
          priceRange: input.priceRange as PriceRange,
          coverImageUrl: input.coverImageUrl,
          logoUrl: input.logoUrl,
          isQueueOpen: input.isQueueOpen,
          location: {
            create: input.location,
          },
          operatingSettings: {
            create: input.operatingSettings ?? {
              minPartySize: 1,
              maxPartySize: 12,
              estimatedMinutesPerParty: 15,
              callTimeoutMinutes: 10,
              maxActiveQueueEntries: 50,
              autoCallNextParty: false,
            },
          },
          cuisines: input.cuisineIds?.length
            ? {
                create: input.cuisineIds.map((cuisineId) => ({
                  cuisineId,
                })),
              }
            : undefined,
        },
        include: {
          location: true,
          operatingSettings: true,
          cuisines: {
            include: {
              cuisine: true,
            },
          },
        },
      });

      return restaurant;
    });
  }

  /**
   * Adds a new menu category for a restaurant.
   */
  async addMenuCategory(restaurantId: string, input: CreateMenuCategoryInput) {
    const exists = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundError(`Restaurant "${restaurantId}" not found`);
    }

    return this.prisma.menuCategory.create({
      data: {
        restaurantId,
        name: input.name,
        description: input.description,
        sortOrder: input.sortOrder,
      },
    });
  }

  /**
   * Adds a menu item under a category.
   */
  async addMenuItem(categoryId: string, input: CreateMenuItemInput) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundError(`Menu category "${categoryId}" not found`);
    }

    return this.prisma.menuItem.create({
      data: {
        categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        imageUrl: input.imageUrl,
        isAvailable: input.isAvailable,
        isVegetarian: input.isVegetarian,
        isSpicy: input.isSpicy,
        sortOrder: input.sortOrder,
      },
    });
  }

  /**
   * Lists all tables for a restaurant.
   */
  async getRestaurantTables(restaurantId: string) {
    const exists = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundError(`Restaurant "${restaurantId}" not found`);
    }

    return this.prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: 'asc' },
    });
  }

  /**
   * Creates a table for a restaurant.
   */
  async createTable(restaurantId: string, input: CreateTableInput) {
    const exists = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundError(`Restaurant "${restaurantId}" not found`);
    }

    return this.prisma.restaurantTable.create({
      data: {
        restaurantId,
        tableNumber: input.tableNumber,
        capacity: input.capacity,
        minCapacity: input.minCapacity,
      },
    });
  }
}

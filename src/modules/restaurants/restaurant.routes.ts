import { FastifyPluginAsync } from 'fastify';
import {
  createMenuCategorySchema,
  createMenuItemSchema,
  createRestaurantSchema,
  createTableSchema,
  restaurantQuerySchema,
} from './restaurant.schema.js';
import { RestaurantService } from './restaurant.service.js';
import { seedSampleRestaurants } from './seed-data.js';

export const restaurantRoutes: FastifyPluginAsync = async (fastify) => {
  const restaurantService = new RestaurantService(fastify.prisma);

  /**
   * GET /api/v1/restaurants
   * Browse and filter restaurants by search, cuisine, distance, price, and queue status.
   */
  fastify.get(
    '/api/v1/restaurants',
    {
      schema: {
        description: 'Browse, search, and filter restaurants with live queue statistics',
        tags: ['Restaurants & Menus'],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string' },
            cuisine: { type: 'string' },
            priceRange: { type: 'string', enum: ['BUDGET', 'MODERATE', 'EXPENSIVE', 'FINE_DINING'] },
            isQueueOpen: { type: 'string', enum: ['true', 'false'] },
            city: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            radiusKm: { type: 'number' },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const parsedQuery = restaurantQuerySchema.parse(request.query);
      const result = await restaurantService.listRestaurants(parsedQuery);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  /**
   * POST /api/v1/restaurants/seed
   * Seeds realistic demo restaurants, digital menus, and tables if database is empty.
   */
  fastify.post(
    '/api/v1/restaurants/seed',
    {
      schema: {
        description: 'Seed sample restaurants, digital menus, and tables for testing',
        tags: ['Restaurants & Menus'],
      },
    },
    async (_request, reply) => {
      const result = await seedSampleRestaurants(fastify.prisma);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    }
  );

  /**
   * GET /api/v1/restaurants/:id
   * Detailed restaurant profile with hours, photos, cuisines, and queue settings.
   */
  fastify.get(
    '/api/v1/restaurants/:id',
    {
      schema: {
        description: 'Get single restaurant details by UUID or slug',
        tags: ['Restaurants & Menus'],
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
      const restaurant = await restaurantService.getRestaurantById(id);
      return reply.status(200).send({
        success: true,
        data: restaurant,
      });
    }
  );

  /**
   * GET /api/v1/restaurants/:id/menu
   * Get restaurant digital menu organized by category.
   */
  fastify.get(
    '/api/v1/restaurants/:id/menu',
    {
      schema: {
        description: 'Get full digital menu grouped by category',
        tags: ['Restaurants & Menus'],
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
      const menu = await restaurantService.getRestaurantMenu(id);
      return reply.status(200).send({
        success: true,
        data: menu,
      });
    }
  );

  /**
   * GET /api/v1/restaurants/:id/tables
   * Get table list and capacity for a restaurant.
   */
  fastify.get(
    '/api/v1/restaurants/:id/tables',
    {
      schema: {
        description: 'List tables for a restaurant',
        tags: ['Restaurants & Menus'],
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
      const tables = await restaurantService.getRestaurantTables(id);
      return reply.status(200).send({
        success: true,
        data: tables,
      });
    }
  );

  /**
   * POST /api/v1/restaurants
   * Create a new restaurant with location, operating settings, and cuisines.
   */
  fastify.post(
    '/api/v1/restaurants',
    {
      schema: {
        description: 'Create a new restaurant',
        tags: ['Restaurants & Menus'],
      },
    },
    async (request, reply) => {
      const parsedBody = createRestaurantSchema.parse(request.body);
      const restaurant = await restaurantService.createRestaurant(parsedBody);
      return reply.status(201).send({
        success: true,
        data: restaurant,
      });
    }
  );

  /**
   * POST /api/v1/restaurants/:id/menu/categories
   * Add a menu category.
   */
  fastify.post(
    '/api/v1/restaurants/:id/menu/categories',
    {
      schema: {
        description: 'Add a menu category to a restaurant',
        tags: ['Restaurants & Menus'],
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
      const parsedBody = createMenuCategorySchema.parse(request.body);
      const category = await restaurantService.addMenuCategory(id, parsedBody);
      return reply.status(201).send({
        success: true,
        data: category,
      });
    }
  );

  /**
   * POST /api/v1/restaurants/menu/categories/:categoryId/items
   * Add a menu item to a category.
   */
  fastify.post(
    '/api/v1/restaurants/menu/categories/:categoryId/items',
    {
      schema: {
        description: 'Add a menu item to a category',
        tags: ['Restaurants & Menus'],
        params: {
          type: 'object',
          required: ['categoryId'],
          properties: {
            categoryId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const parsedBody = createMenuItemSchema.parse(request.body);
      const item = await restaurantService.addMenuItem(categoryId, parsedBody);
      return reply.status(201).send({
        success: true,
        data: item,
      });
    }
  );

  /**
   * POST /api/v1/restaurants/:id/tables
   * Add a table to a restaurant.
   */
  fastify.post(
    '/api/v1/restaurants/:id/tables',
    {
      schema: {
        description: 'Add a table to a restaurant',
        tags: ['Restaurants & Menus'],
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
      const parsedBody = createTableSchema.parse(request.body);
      const table = await restaurantService.createTable(id, parsedBody);
      return reply.status(201).send({
        success: true,
        data: table,
      });
    }
  );
};

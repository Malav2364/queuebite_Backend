import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const DEFAULT_CUISINES = [
  { name: 'Italian', slug: 'italian', iconUrl: '🍕' },
  { name: 'Japanese', slug: 'japanese', iconUrl: '🍣' },
  { name: 'Mexican', slug: 'mexican', iconUrl: '🌮' },
  { name: 'Indian', slug: 'indian', iconUrl: '🍛' },
  { name: 'Chinese', slug: 'chinese', iconUrl: '🥡' },
  { name: 'American', slug: 'american', iconUrl: '🍔' },
  { name: 'Thai', slug: 'thai', iconUrl: '🍜' },
  { name: 'Mediterranean', slug: 'mediterranean', iconUrl: '🥙' },
  { name: 'Korean', slug: 'korean', iconUrl: '🍲' },
  { name: 'Cafe & Bakery', slug: 'cafe-bakery', iconUrl: '☕' },
];

const createCuisineSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  iconUrl: z.string().optional().nullable(),
});

export const cuisineRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/cuisines
   * Returns list of cuisines. Seeds default taxonomy if database has none.
   */
  fastify.get(
    '/api/v1/cuisines',
    {
      schema: {
        description: 'Get all available cuisines and taxonomies for preference selection',
        tags: ['Cuisines & Taxonomy'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    iconUrl: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      let cuisines = await fastify.prisma.cuisine.findMany({
        orderBy: { name: 'asc' },
      });

      // Auto-seed default cuisines if table is empty
      if (cuisines.length === 0) {
        for (const item of DEFAULT_CUISINES) {
          await fastify.prisma.cuisine.upsert({
            where: { slug: item.slug },
            update: {},
            create: item,
          });
        }
        cuisines = await fastify.prisma.cuisine.findMany({
          orderBy: { name: 'asc' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: cuisines,
      });
    }
  );

  /**
   * POST /api/v1/cuisines
   * Create a new cuisine category.
   */
  fastify.post(
    '/api/v1/cuisines',
    {
      schema: {
        description: 'Add a new cuisine category',
        tags: ['Cuisines & Taxonomy'],
        body: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            iconUrl: { type: 'string', nullable: true },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createCuisineSchema.parse(request.body);

      const cuisine = await fastify.prisma.cuisine.create({
        data: parsed,
      });

      return reply.status(201).send({
        success: true,
        data: cuisine,
      });
    }
  );
};

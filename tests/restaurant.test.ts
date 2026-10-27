import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('Restaurant & Menu Routes', () => {
  let app: FastifyInstance;
  let seededRestaurantId: string;
  let testRestaurantId: string;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    // Clean up test created restaurant
    try {
      if (testRestaurantId) {
        await app.prisma.restaurant.delete({
          where: { id: testRestaurantId },
        });
      }
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  it('POST /api/v1/restaurants/seed populates sample restaurants and digital menus', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/restaurants/seed',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.count).toBeGreaterThan(0);
  });

  it('GET /api/v1/restaurants returns list of restaurants with live metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/restaurants',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.restaurants.length).toBeGreaterThanOrEqual(1);

    const first = body.data.restaurants[0];
    seededRestaurantId = first.id;
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('slug');
    expect(first).toHaveProperty('activeQueueCount');
    expect(first).toHaveProperty('estimatedWaitMinutes');
    expect(first.location).toBeDefined();
    expect(Array.isArray(first.cuisines)).toBe(true);
  });

  it('GET /api/v1/restaurants with cuisine filter returns matching restaurants', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/restaurants?cuisine=italian',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(
      body.data.restaurants.some((r: any) =>
        r.cuisines.some((c: any) => c.slug === 'italian')
      )
    ).toBe(true);
  });

  it('GET /api/v1/restaurants with search query returns matching results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/restaurants?search=Napoli',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.restaurants.length).toBeGreaterThanOrEqual(1);
    expect(body.data.restaurants[0].name).toContain('Bella Napoli');
  });

  it('GET /api/v1/restaurants/:id returns complete restaurant profile by slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/restaurants/bella-napoli-trattoria',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe('bella-napoli-trattoria');
    expect(body.data.operatingSettings).toBeDefined();
    expect(body.data.totalTables).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/restaurants/:id/menu returns categories and menu items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/restaurants/${seededRestaurantId}/menu`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.categories.length).toBeGreaterThan(0);

    const firstCat = body.data.categories[0];
    expect(firstCat).toHaveProperty('name');
    expect(firstCat.items.length).toBeGreaterThan(0);
    expect(firstCat.items[0]).toHaveProperty('price');
    expect(firstCat.items[0]).toHaveProperty('isVegetarian');
  });

  it('GET /api/v1/restaurants/:id/tables returns restaurant tables', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/restaurants/${seededRestaurantId}/tables`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toHaveProperty('tableNumber');
    expect(body.data[0]).toHaveProperty('capacity');
  });

  it('POST /api/v1/restaurants creates a new custom restaurant with location', async () => {
    const uniqueSlug = `test-bistro-${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/restaurants',
      payload: {
        name: 'The French Bistro',
        slug: uniqueSlug,
        description: 'Cozy neighborhood French dining experience.',
        priceRange: 'EXPENSIVE',
        location: {
          addressLine1: '12 Rue de Gourmet',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400050',
          country: 'IN',
          latitude: 19.0596,
          longitude: 72.8295,
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('The French Bistro');
    expect(body.data.slug).toBe(uniqueSlug);
    testRestaurantId = body.data.id;
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('User, Auth & Preference Routes', () => {
  let app: FastifyInstance;
  const testClerkId = `test_clerk_${Date.now()}`;
  const testEmail = `test_${Date.now()}@queuebite.dev`;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    // Clean up test user
    try {
      await app.prisma.user.deleteMany({
        where: { clerkId: testClerkId },
      });
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  it('GET /api/v1/cuisines returns available cuisines taxonomy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/cuisines',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]).toHaveProperty('slug');
    expect(body.data[0]).toHaveProperty('name');
  });

  it('POST /api/v1/users/sync provisions a new user with default preferences', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users/sync',
      headers: {
        authorization: `Bearer ${testClerkId}`,
      },
      payload: {
        email: testEmail,
        name: 'QueueBite Tester',
        phone: '+1234567890',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.clerkId).toBe(testClerkId);
    expect(body.data.email).toBe(testEmail);
    expect(body.data.name).toBe('QueueBite Tester');
    expect(body.data.preferences).toBeDefined();
    expect(body.data.preferences.preferredPartySize).toBe(2);
    expect(body.data.preferences.pushNotifications).toBe(true);
  });

  it('GET /api/v1/users/me returns authenticated user profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: {
        authorization: `Bearer ${testClerkId}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.clerkId).toBe(testClerkId);
    expect(body.data.email).toBe(testEmail);
  });

  it('GET /api/v1/users/me returns 401 if authorization header is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /api/v1/users/me updates profile details', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: {
        authorization: `Bearer ${testClerkId}`,
      },
      payload: {
        name: 'QueueBite Updated Name',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('QueueBite Updated Name');
  });

  it('PUT /api/v1/users/me/preferences updates dietary tags and party size', async () => {
    // First get a valid cuisine ID from taxonomy
    const cuisineRes = await app.inject({
      method: 'GET',
      url: '/api/v1/cuisines',
    });
    const cuisines = JSON.parse(cuisineRes.body).data;
    const testCuisineId = cuisines[0].id;

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/users/me/preferences',
      headers: {
        authorization: `Bearer ${testClerkId}`,
      },
      payload: {
        maxWaitMinutes: 45,
        preferredPartySize: 4,
        pushNotifications: true,
        smsNotifications: true,
        dietaryTags: ['VEGAN', 'GLUTEN_FREE'],
        cuisineIds: [testCuisineId],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.maxWaitMinutes).toBe(45);
    expect(body.data.preferredPartySize).toBe(4);
    expect(body.data.smsNotifications).toBe(true);
    expect(body.data.dietary.map((d: { tag: string }) => d.tag)).toEqual(
      expect.arrayContaining(['VEGAN', 'GLUTEN_FREE'])
    );
    expect(body.data.cuisines.map((c: { cuisineId: string }) => c.cuisineId)).toContain(
      testCuisineId
    );
  });
});

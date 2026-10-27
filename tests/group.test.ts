import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('Group Dining & Party Queue Routes', () => {
  let app: FastifyInstance;
  let restaurantId: string;
  let sessionId: string;
  let shareCode: string;
  let memberId: string;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Ensure sample restaurants are seeded
    await app.inject({
      method: 'POST',
      url: '/api/v1/restaurants/seed',
    });

    const restRes = await app.inject({
      method: 'GET',
      url: '/api/v1/restaurants/bella-napoli-trattoria',
    });
    const restBody = JSON.parse(restRes.body).data;
    restaurantId = restBody.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const creatorPhone = `+9198755${Math.floor(10000 + Math.random() * 90000)}`;

  it('POST /api/v1/groups creates a new collaborative party session with share code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/groups',
      payload: {
        restaurantId,
        creatorName: 'Rohan Sharma',
        creatorPhone,
        name: 'Friday Team Dinner',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.code).toMatch(/^QB-[A-Z0-9]{4}$/);
    expect(body.data.status).toBe('PLANNING');
    expect(body.data.members.length).toBe(1);
    expect(body.data.members[0].name).toBe('Rohan Sharma');
    expect(body.data.members[0].isReady).toBe(true);

    sessionId = body.data.id;
    shareCode = body.data.code;
  });

  it('GET /api/v1/groups/:codeOrId retrieves party details using 6-character code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/groups/${shareCode}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(sessionId);
    expect(body.data.restaurant.name).toBe('Bella Napoli Trattoria');
  });

  it('POST /api/v1/groups/:codeOrId/join allows friends to join via share code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${shareCode}/join`,
      payload: {
        name: 'Priya Patel',
        phone: '+919876543211',
        dietaryNotes: 'Vegetarian, nut allergy',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.member.name).toBe('Priya Patel');
    expect(body.data.member.isReady).toBe(false);
    expect(body.data.session.members.length).toBe(2);

    memberId = body.data.member.id;
  });

  it('PATCH /api/v1/groups/:sessionId/members/:memberId/ready updates readiness status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/groups/${sessionId}/members/${memberId}/ready`,
      payload: {
        isReady: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.isReady).toBe(true);
  });

  it('POST /api/v1/groups/:sessionId/queue submits collective group into restaurant queue', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${sessionId}/queue`,
      payload: {
        notes: 'Booth seating preferred',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('QUEUE_JOINED');
    expect(body.data.queueEntry).toBeDefined();
    expect(body.data.queueEntry.partySize).toBe(2);
    expect(body.data.queueEntry.status).toBe('WAITING');
  });

  it('POST /api/v1/groups/:sessionId/queue rejects queue submission if already queued', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/groups/${sessionId}/queue`,
      payload: {},
    });

    expect(res.statusCode).toBe(409);
  });
});

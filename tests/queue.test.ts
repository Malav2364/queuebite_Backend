import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('Virtual Queue Engine Routes', () => {
  let app: FastifyInstance;
  let restaurantId: string;
  let tableId: string;
  let queueEntryId1: string;
  let queueEntryId2: string;
  const guestPhone1 = `+9199999${Math.floor(10000 + Math.random() * 90000)}`;
  const guestPhone2 = `+9199998${Math.floor(10000 + Math.random() * 90000)}`;
  const guestPhone3 = `+9199997${Math.floor(10000 + Math.random() * 90000)}`;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Ensure sample restaurants are seeded
    await app.inject({
      method: 'POST',
      url: '/api/v1/restaurants/seed',
    });

    // Fetch Bella Napoli restaurant and its first table
    const restRes = await app.inject({
      method: 'GET',
      url: '/api/v1/restaurants/bella-napoli-trattoria',
    });
    const restBody = JSON.parse(restRes.body).data;
    restaurantId = restBody.id;

    const tablesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/restaurants/${restaurantId}/tables`,
    });
    const tablesBody = JSON.parse(tablesRes.body).data;
    tableId = tablesBody[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/restaurants/:id/queue/join allows a guest to join the virtual queue', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/restaurants/${restaurantId}/queue/join`,
      payload: {
        guestName: 'Alex Johnson',
        guestPhone: guestPhone1,
        partySize: 2,
        notes: 'Window seat if possible',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('WAITING');
    expect(body.data.guestName).toBe('Alex Johnson');
    expect(body.data.positionInLine).toBeGreaterThanOrEqual(1);
    expect(body.data.queueNumber).toBeGreaterThanOrEqual(1);
    queueEntryId1 = body.data.id;
  });

  it('POST /api/v1/restaurants/:id/queue/join with second guest increments queue position', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/restaurants/${restaurantId}/queue/join`,
      payload: {
        guestName: 'Maria Garcia',
        guestPhone: guestPhone2,
        partySize: 4,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('WAITING');
    expect(body.data.positionInLine).toBeGreaterThan(1);
    queueEntryId2 = body.data.id;
  });

  it('POST /api/v1/restaurants/:id/queue/join rejects duplicate active party', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/restaurants/${restaurantId}/queue/join`,
      payload: {
        guestName: 'Alex Johnson Duplicate',
        guestPhone: guestPhone1,
        partySize: 2,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('GET /api/v1/queue/entries/:id retrieves live spot and estimated wait', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/queue/entries/${queueEntryId1}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(queueEntryId1);
    expect(body.data.restaurant.name).toBe('Bella Napoli Trattoria');
    expect(body.data.positionInLine).toBeDefined();
  });

  it('GET /api/v1/restaurants/:id/queue returns host dashboard queue list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/restaurants/${restaurantId}/queue?status=ALL`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.summary.waitingCount).toBeGreaterThanOrEqual(2);
    expect(body.data.entries.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/v1/queue/entries/:id/call transitions party to CALLED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/queue/entries/${queueEntryId1}/call`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('CALLED');
    expect(body.data.calledAt).toBeDefined();
  });

  it('POST /api/v1/queue/entries/:id/seat assigns table and transitions to SEATED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/queue/entries/${queueEntryId1}/seat`,
      payload: {
        tableId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('SEATED');
    expect(body.data.tableAssignment).toBeDefined();
    expect(body.data.tableAssignment.tableId).toBe(tableId);

    // Verify table is now OCCUPIED
    const tableRes = await app.inject({
      method: 'GET',
      url: `/api/v1/restaurants/${restaurantId}/tables`,
    });
    const tables = JSON.parse(tableRes.body).data;
    const assignedTable = tables.find((t: any) => t.id === tableId);
    expect(assignedTable.status).toBe('OCCUPIED');
  });

  it('POST /api/v1/queue/entries/:id/complete frees table and completes dining', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/queue/entries/${queueEntryId1}/complete`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('COMPLETED');

    // Verify table is freed back to AVAILABLE
    const tableRes = await app.inject({
      method: 'GET',
      url: `/api/v1/restaurants/${restaurantId}/tables`,
    });
    const tables = JSON.parse(tableRes.body).data;
    const assignedTable = tables.find((t: any) => t.id === tableId);
    expect(assignedTable.status).toBe('AVAILABLE');
  });

  it('POST /api/v1/queue/entries/:id/cancel cancels queue spot', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/queue/entries/${queueEntryId2}/cancel`,
      payload: {
        reason: 'Change of plans',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('CANCELLED');
  });

  it('POST /api/v1/queue/entries/:id/no-show marks called guest as no-show', async () => {
    // First join a 3rd guest and call them
    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/restaurants/${restaurantId}/queue/join`,
      payload: {
        guestName: 'No Show Guest',
        guestPhone: guestPhone3,
        partySize: 2,
      },
    });
    const guest3Id = JSON.parse(joinRes.body).data.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/queue/entries/${guest3Id}/call`,
    });

    const noShowRes = await app.inject({
      method: 'POST',
      url: `/api/v1/queue/entries/${guest3Id}/no-show`,
      payload: {
        reason: 'Did not respond within 10 minutes',
      },
    });

    expect(noShowRes.statusCode).toBe(200);
    const body = JSON.parse(noShowRes.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('NO_SHOW');
  });
});

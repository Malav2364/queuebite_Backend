import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('Queue-Aware Pre-Ordering Routes', () => {
  let app: FastifyInstance;
  let restaurantId: string;
  let queueEntryId: string;
  let menuItem1Id: string;
  let menuItem2Id: string;
  let orderId: string;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Ensure sample restaurants are seeded
    await app.inject({
      method: 'POST',
      url: '/api/v1/restaurants/seed',
    });

    // Fetch Bella Napoli
    const restRes = await app.inject({
      method: 'GET',
      url: '/api/v1/restaurants/bella-napoli-trattoria',
    });
    const restBody = JSON.parse(restRes.body).data;
    restaurantId = restBody.id;

    // Fetch menu items
    const menuRes = await app.inject({
      method: 'GET',
      url: `/api/v1/restaurants/${restaurantId}/menu`,
    });
    const menuBody = JSON.parse(menuRes.body).data;
    const categories = menuBody.categories || [];
    const allItems = categories.flatMap((c: any) => c.items || []);
    menuItem1Id = allItems[0].id;
    menuItem2Id = allItems[1].id;

    // Join queue to get an active queue entry
    const queueRes = await app.inject({
      method: 'POST',
      url: `/api/v1/restaurants/${restaurantId}/queue/join`,
      payload: {
        guestName: 'Kavita Singh',
        guestPhone: `+9198711${Math.floor(10000 + Math.random() * 90000)}`,
        partySize: 2,
      },
    });
    const queueBody = JSON.parse(queueRes.body).data;
    queueEntryId = queueBody.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/orders/pre-order places a queue-synchronized pre-order', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/orders/pre-order',
      payload: {
        restaurantId,
        queueEntryId,
        customerName: 'Kavita Singh',
        specialNotes: 'Extra spicy please',
        items: [
          { menuItemId: menuItem1Id, quantity: 2, specialNotes: 'No onions' },
          { menuItemId: menuItem2Id, quantity: 1 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('SUBMITTED');
    expect(body.data.items.length).toBe(2);
    expect(body.data.totalAmount).toBeGreaterThan(0);
    expect(body.data.targetServeTime).toBeDefined();

    orderId = body.data.id;
  });

  it('GET /api/v1/orders/:id fetches pre-order details with line items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/orders/${orderId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(orderId);
    expect(body.data.items.length).toBe(2);
    expect(body.data.restaurant.name).toBe('Bella Napoli Trattoria');
  });

  it('GET /api/v1/queue/entries/:queueEntryId/pre-orders retrieves orders for a waiting party', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/queue/entries/${queueEntryId}/pre-orders`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].id).toBe(orderId);
  });

  it('GET /api/v1/restaurants/:restaurantId/pre-orders displays kitchen queue list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/restaurants/${restaurantId}/pre-orders`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    const found = body.data.some((o: any) => o.id === orderId);
    expect(found).toBe(true);
  });

  it('PATCH /api/v1/orders/:id/status updates kitchen preparation status', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/orders/${orderId}/status`,
      payload: {
        status: 'PREPARING',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('PREPARING');
  });
});

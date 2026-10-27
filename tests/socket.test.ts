import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { buildApp } from '../src/app.js';

describe('Real-Time WebSocket & Socket.IO Engine', () => {
  let app: FastifyInstance;
  let serverAddress: string;
  let restaurantSocket: ClientSocket;
  let customerSocket: ClientSocket;
  let restaurantId: string;
  let queueEntryId: string;
  const guestPhone = `+9199887${Math.floor(10000 + Math.random() * 90000)}`;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    // Listen on random port
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (typeof address === 'object' && address) {
      serverAddress = `http://127.0.0.1:${address.port}`;
    }

    // Ensure sample restaurants exist
    await app.inject({
      method: 'POST',
      url: '/api/v1/restaurants/seed',
    });

    const restRes = await app.inject({
      method: 'GET',
      url: '/api/v1/restaurants/bella-napoli-trattoria',
    });
    restaurantId = JSON.parse(restRes.body).data.id;
  });

  afterAll(async () => {
    if (restaurantSocket?.connected) restaurantSocket.disconnect();
    if (customerSocket?.connected) customerSocket.disconnect();
    await app.close();
  });

  it('connects to WebSocket server and joins restaurant room', async () => {
    restaurantSocket = ioc(serverAddress, {
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>((resolve) => {
      restaurantSocket.on('connect', () => {
        restaurantSocket.emit('join:restaurant', { restaurantId });
        resolve();
      });
    });

    expect(restaurantSocket.connected).toBe(true);
  });

  it('receives real-time queue:joined event when a customer joins line', async () => {
    const eventPromise = new Promise<any>((resolve) => {
      restaurantSocket.once('queue:joined', (payload) => {
        resolve(payload);
      });
    });

    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/restaurants/${restaurantId}/queue/join`,
      payload: {
        guestName: 'Realtime Tester',
        guestPhone,
        partySize: 2,
      },
    });

    const body = JSON.parse(joinRes.body);
    queueEntryId = body.data.id;

    const eventData = await eventPromise;
    expect(eventData).toBeDefined();
    expect(eventData.entry.id).toBe(queueEntryId);
    expect(eventData.entry.guestName).toBe('Realtime Tester');
  });

  it('receives queue:called event on customer room when host calls party', async () => {
    customerSocket = ioc(serverAddress, {
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise<void>((resolve) => {
      customerSocket.on('connect', () => {
        customerSocket.emit('join:queue', { queueEntryId });
        resolve();
      });
    });

    const callPromise = new Promise<any>((resolve) => {
      customerSocket.once('queue:called', (payload) => {
        resolve(payload);
      });
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/queue/entries/${queueEntryId}/call`,
    });

    const callData = await callPromise;
    expect(callData).toBeDefined();
    expect(callData.queueEntryId).toBe(queueEntryId);
    expect(callData.status).toBe('CALLED');
    expect(callData.message).toContain('Your table is ready');
  });
});

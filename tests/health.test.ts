import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';

describe('Health and System Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 and healthy status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
  });

  it('GET /docs returns 200 for OpenAPI Swagger UI', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs/',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('GET /ready returns 200 when database is connected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
    expect(body.timestamp).toBeDefined();
  });

  it('GET non-existent route returns 404 with structured JSON', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/non-existent-route',
    });

    expect(res.statusCode).toBe(404);
  });
});

import request from 'supertest';
import { startApp, stopApp } from './helpers/harness.js';

let app;
beforeAll(async () => {
  app = await startApp();
});
afterAll(stopApp);

describe('app basics', () => {
  it('reports healthy', async () => {
    const res = await request(app).get('/healthCheck');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'Server is healthy' });
  });

  it('answers unknown routes with the standard error shape', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, errors: [] });
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/v1/signin')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

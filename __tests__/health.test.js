import request from 'supertest';
import app from '../app.js';

describe('Health Check Endpoint', () => {
    it('should return a 200 OK status and a healthy message', async () => {
        const response = await request(app).get('/healthCheck');
        if (response.status !== 200) console.error(response.text);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Server is healthy');
    });
});

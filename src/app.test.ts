import request from 'supertest';
import { app } from './app';

describe('GET /health', () => {
  it('retorna status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

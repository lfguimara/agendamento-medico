import request from 'supertest';
import { app } from './app';

describe('GET /health', () => {
  it('retorna status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('CORS', () => {
  it('libera a origem do frontend', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('não libera origens desconhecidas', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://site-malicioso.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

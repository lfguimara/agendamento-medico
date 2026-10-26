import express from 'express';
import { routes } from './routes';
import { errorHandler } from './shared/middlewares/errorHandler';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(routes);

app.use((_req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// O errorHandler precisa ser o último middleware registrado
app.use(errorHandler);

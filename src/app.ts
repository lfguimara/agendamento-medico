import cors from 'cors';
import express from 'express';
import { routes } from './routes';
import { errorHandler } from './shared/middlewares/errorHandler';

// Origens que podem chamar a API pelo navegador (separadas por vírgula).
// Padrão: o frontend em desenvolvimento (Vite) e servido pelo Docker.
const origensPermitidas = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:8080')
  .split(',')
  .map((origem) => origem.trim());

export const app = express();

app.use(cors({ origin: origensPermitidas }));
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

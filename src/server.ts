import { app } from './app';
import { prisma } from './lib/prisma';

const PORT = Number(process.env.PORT) || 3333;

const server = app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

// Desligamento gracioso: o Docker envia SIGTERM ao parar o container.
// Paramos de aceitar conexões, terminamos as requisições em andamento e fechamos o banco.
function encerrar(sinal: string) {
  console.log(`${sinal} recebido, encerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));

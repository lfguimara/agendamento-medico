import { execSync } from 'node:child_process';
import { configurarBancoDeTeste } from './testDatabase';

// Roda uma única vez antes de todos os testes de integração:
// cria o banco de teste (se não existir) e aplica as migrations.
export default function globalSetup() {
  const url = configurarBancoDeTeste();

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}

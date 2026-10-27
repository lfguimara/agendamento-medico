import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

// Banco padrão dos testes de integração: o mesmo Postgres do docker-compose,
// mas num database separado (agendamento_test), que o `prisma migrate deploy` cria sozinho.
const URL_PADRAO = 'postgresql://app:app@localhost:5432/agendamento_test?schema=public';

// Define DATABASE_URL para o banco de teste. Prioridade:
// 1. variável TEST_DATABASE_URL (útil no CI)  2. arquivo .env.test  3. URL_PADRAO
// Precisa rodar ANTES de qualquer import de src/lib/prisma.ts.
export function configurarBancoDeTeste(): string {
  const caminho = resolve(__dirname, '../../../.env.test');
  const doArquivo = existsSync(caminho)
    ? config({ path: caminho, processEnv: {}, quiet: true }).parsed?.DATABASE_URL
    : undefined;

  const url = process.env.TEST_DATABASE_URL ?? doArquivo ?? URL_PADRAO;

  // Trava de segurança: os testes apagam todas as tabelas antes de cada caso.
  // Nunca rodar contra um banco que não seja explicitamente de teste.
  const nomeDoBanco = new URL(url).pathname.replace('/', '');
  if (!nomeDoBanco.endsWith('_test')) {
    throw new Error(
      `Os testes de integração apagam dados: o nome do banco deve terminar em "_test" (recebido: "${nomeDoBanco}").`,
    );
  }

  process.env.DATABASE_URL = url;
  return url;
}

# Agendamento Médico

API de agendamento de consultas médicas — projeto de DevOps.

## Stack
- Node.js + TypeScript
- Express
- Prisma (PostgreSQL)
- Jest + Supertest

## Escopo (MVP)
**Entidades:** Paciente, Médico, Consulta

**Regras de negócio:**
1. Médico não pode ter duas consultas no mesmo horário
2. Não é possível agendar consulta no passado
3. Cancelamento só com até 24h de antecedência

## Scripts
| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor em modo desenvolvimento |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Roda a versão compilada |
| `npm test` | Executa os testes |

## Como rodar localmente

Pré-requisitos: Node.js 20+ e Docker Desktop.

```bash
npm install                # instala dependências e gera o Prisma Client
cp .env.example .env       # variáveis de ambiente
npm run db:up              # sobe o Postgres no Docker
npm run db:migrate         # aplica as migrations
npm run dev                # http://localhost:3333/health
```

| Comando | Descrição |
|---|---|
| `npm run db:up` / `db:down` | Sobe / derruba o Postgres |
| `npm run db:migrate` | Cria e aplica migrations |
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:studio` | Interface visual do banco |

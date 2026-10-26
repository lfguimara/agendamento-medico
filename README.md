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

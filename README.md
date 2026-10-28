# 🏥 Agendamento Médico

[![CI/CD](https://github.com/lfguimara/agendamento-medico/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/lfguimara/agendamento-medico/actions/workflows/ci.yml)

API REST para agendamento de consultas médicas, com cadastro de pacientes e médicos e regras de negócio para evitar conflitos de horário. Projeto da disciplina de DevOps.

## Sumário

- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Regras de negócio](#regras-de-negócio)
- [Como rodar](#como-rodar)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Endpoints](#endpoints)
- [Testes](#testes)
- [Docker](#docker)
- [Scripts](#scripts)
- [CI/CD](#cicd)
- [Limitações conhecidas](#limitações-conhecidas)

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 24 + TypeScript |
| HTTP | Express 5 |
| Validação | Zod 4 |
| Banco | PostgreSQL 16 |
| ORM | Prisma 7.10.1 (driver adapter `@prisma/adapter-pg`) |
| Testes | Jest + Supertest |
| Containers | Docker (multi-stage) + Docker Compose |
| CI/CD | GitHub Actions + GitHub Container Registry (GHCR) |

## Arquitetura

```
src/
├── server.ts                 # sobe o servidor HTTP + desligamento gracioso
├── app.ts                    # configura o Express (separado do server para os testes)
├── routes.ts                 # agrega as rotas dos módulos
├── lib/prisma.ts             # instância única do PrismaClient
├── generated/prisma/         # Prisma Client gerado (não versionado)
├── shared/
│   ├── errors/AppError.ts    # erros de negócio com status HTTP
│   ├── middlewares/errorHandler.ts
│   └── schemas/idParam.schema.ts
└── modules/
    ├── pacientes/            # schema (zod) → controller → service → Prisma
    ├── medicos/
    └── consultas/
```

Cada módulo segue o mesmo fluxo de camadas:

```mermaid
flowchart LR
    R[Request] --> RT[routes]
    RT --> C[controller<br/>valida com zod]
    C --> S[service<br/>regras de negócio]
    S --> P[(Prisma / PostgreSQL)]
    C -. erro .-> E[errorHandler]
    S -. erro .-> E
```

- **controller**: traduz HTTP em chamadas ao service, validando `params`, `query` e `body` com zod.
- **service**: contém as regras de negócio e recebe o `PrismaClient` (e, em consultas, o relógio) pelo construtor, o que permite usar mocks nos testes.
- **errorHandler**: converte `AppError`, `ZodError` e erros conhecidos do Prisma em respostas JSON padronizadas.

### Modelo de dados

```mermaid
erDiagram
    PACIENTE ||--o{ CONSULTA : agenda
    MEDICO ||--o{ CONSULTA : atende
    PACIENTE {
        uuid id
        string nome
        string cpf UK
        string email UK
        string telefone
    }
    MEDICO {
        uuid id
        string nome
        string crm UK
        string especialidade
    }
    CONSULTA {
        uuid id
        datetime dataHora
        enum status "AGENDADA | CANCELADA | CONCLUIDA"
    }
```

## Regras de negócio

| # | Regra | Resposta quando violada |
|---|---|---|
| 1 | O médico não pode ter duas consultas **agendadas** com início a menos de **30 min** uma da outra | `409 Conflict` |
| 2 | Não é possível agendar consulta no passado | `400 Bad Request` |
| 3 | O cancelamento só é permitido com **24h** ou mais de antecedência | `400 Bad Request` |
| 4 | Só consultas `AGENDADA` podem ser canceladas ou concluídas | `400 Bad Request` |
| 5 | Só é possível concluir uma consulta cujo horário já passou | `400 Bad Request` |
| 6 | CPF, e-mail e CRM são únicos | `409 Conflict` |
| 7 | Paciente ou médico com consultas não pode ser excluído | `409 Conflict` |

As constantes `DURACAO_CONSULTA_MINUTOS` e `ANTECEDENCIA_CANCELAMENTO_HORAS` ficam em `src/modules/consultas/consulta.service.ts`.

## Como rodar

### Opção 1: tudo no Docker (recomendado)

Pré-requisito: Docker Desktop.

```bash
docker compose up -d --build
```

Isso sobe três serviços, nesta ordem:

1. `db`: PostgreSQL, que aguarda o healthcheck ficar `healthy`
2. `migrate`: aplica as migrations (`prisma migrate deploy`) e encerra
3. `app`: a API em http://localhost:3333

```bash
curl http://localhost:3333/health   # {"status":"ok"}
docker compose logs -f app          # acompanhar os logs
docker compose down                 # parar (os dados ficam no volume pgdata)
docker compose down -v              # parar e apagar os dados
```

### Opção 2: desenvolvimento local (hot reload)

Pré-requisitos: Node.js 24+ e Docker Desktop (só para o banco).

```bash
npm install                # instala dependências e gera o Prisma Client
cp .env.example .env       # variáveis de ambiente
npm run db:up              # sobe só o Postgres
npm run db:migrate         # aplica as migrations
npm run dev                # http://localhost:3333 com reload automático
```

> Se o container `app` estiver rodando, pare-o antes (`docker compose stop app`) para liberar a porta 3333.

## Variáveis de ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_URL` | Conexão com o PostgreSQL | `postgresql://app:app@localhost:5432/agendamento?schema=public` |
| `PORT` | Porta HTTP da API (padrão `3333`) | `3333` |

O `.env` não é versionado. Use o `.env.example` como modelo.

## Endpoints

Base URL: `http://localhost:3333`. Todas as requisições e respostas usam JSON.

### Health

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Verifica se a API está no ar |

### Pacientes

| Método | Rota | Descrição | Sucesso |
|---|---|---|---|
| GET | `/pacientes` | Lista pacientes (ordenados por nome) | 200 |
| GET | `/pacientes/:id` | Busca por ID | 200 |
| POST | `/pacientes` | Cadastra | 201 |
| PUT | `/pacientes/:id` | Atualiza (campos parciais) | 200 |
| DELETE | `/pacientes/:id` | Remove | 204 |

```json
POST /pacientes
{
  "nome": "Maria Silva",
  "cpf": "123.456.789-00",
  "email": "maria@email.com",
  "telefone": "11999990000"
}
```

O CPF é aceito com ou sem máscara e armazenado só com os dígitos.

### Médicos

| Método | Rota | Descrição | Sucesso |
|---|---|---|---|
| GET | `/medicos?especialidade=cardio` | Lista médicos (filtro opcional, sem diferenciar maiúsculas) | 200 |
| GET | `/medicos/:id` | Busca por ID | 200 |
| POST | `/medicos` | Cadastra | 201 |
| PUT | `/medicos/:id` | Atualiza (campos parciais) | 200 |
| DELETE | `/medicos/:id` | Remove | 204 |

```json
POST /medicos
{
  "nome": "Dr. João Souza",
  "crm": "CRM-SP 123456",
  "especialidade": "Cardiologia"
}
```

### Consultas

| Método | Rota | Descrição | Sucesso |
|---|---|---|---|
| GET | `/consultas?medicoId=&pacienteId=&status=` | Lista consultas (filtros opcionais) | 200 |
| GET | `/consultas/:id` | Busca por ID | 200 |
| POST | `/consultas` | Agenda | 201 |
| PATCH | `/consultas/:id/cancelar` | Cancela | 200 |
| PATCH | `/consultas/:id/concluir` | Conclui | 200 |

```json
POST /consultas
{
  "pacienteId": "7d5eca69-ae6d-4a4c-85a0-ad3f36736306",
  "medicoId": "53a71bf4-3458-4f4a-ae66-9c50b7c8f21d",
  "dataHora": "2026-11-10T14:30:00-03:00"
}
```

`dataHora` usa o formato ISO 8601 com fuso (`Z` ou `-03:00`).

### Formato de erro

```json
{ "erro": "Médico já possui consulta agendada nesse horário" }
```

Erros de validação trazem também os campos inválidos:

```json
{
  "erro": "Dados inválidos",
  "detalhes": [{ "campo": "cpf", "mensagem": "CPF deve ter 11 dígitos" }]
}
```

| Status | Quando |
|---|---|
| 400 | Dados inválidos ou regra de negócio violada |
| 404 | Recurso ou rota não encontrado |
| 409 | Conflito: dado único duplicado, horário ocupado ou registro com vínculos |
| 500 | Erro inesperado (detalhes só no log do servidor) |

## Testes

São dois tipos de teste, separados em dois projetos do Jest:

| Tipo | Onde | Banco | Comando |
|---|---|---|---|
| **Unitários** | `src/modules/**/*.service.test.ts` e `src/app.test.ts` | Não usa (Prisma mockado) | `npm test` |
| **Integração** | `src/tests/integration/*.int.test.ts` | PostgreSQL real (`agendamento_test`) | `npm run test:integration` |

```bash
npm test                    # só unitários: rápido, não precisa de banco
npm run db:up               # sobe o Postgres (necessário para a integração)
npm run test:integration    # rotas de ponta a ponta com supertest
npm run test:all            # tudo
npm run test:coverage       # tudo + relatório de cobertura em coverage/
```

### Unitários

Testam as regras de negócio dos services isoladamente. O `PrismaClient` é substituído por um mock (`src/tests/helpers/prismaMock.ts`) e o `ConsultaService` recebe um relógio fixo, então as regras de passado e de 24h são testadas sem depender da hora real, inclusive nos limites (exatamente 24h, exatamente agora).

```ts
const { mock, db } = criarPrismaMock();
const service = new ConsultaService(db, () => new Date('2026-11-01T10:00:00Z'));

mock.consulta.findUnique.mockResolvedValue(consulta);
await expect(service.cancelar(id)).rejects.toMatchObject({ statusCode: 400 });
```

### Integração

Fazem requisições HTTP reais ao `app` com `supertest`, passando por rotas, validação (zod), services, `errorHandler` e PostgreSQL. Cobrem status HTTP, corpo das respostas e as 7 regras de negócio de ponta a ponta.

- **Banco separado**: por padrão usam `postgresql://app:app@localhost:5432/agendamento_test`, no mesmo Postgres do `docker compose`. Para usar outro banco, copie `.env.test.example` para `.env.test` e ajuste, ou defina a variável `TEST_DATABASE_URL` (tem prioridade, útil no CI).
- **Migrations automáticas**: antes da suíte, o `globalSetup` roda `prisma migrate deploy`, que cria o banco `agendamento_test` se ele não existir.
- **Isolamento**: todas as tabelas são limpas antes de cada teste, e os arquivos rodam em sequência (`--runInBand`).
- **Trava de segurança**: os testes se recusam a rodar se o nome do banco não terminar em `_test`, para nunca apagar os dados de desenvolvimento.

### Estrutura

```
src/
├── app.test.ts                          # unitário: GET /health
├── modules/*/[nome].service.test.ts     # unitários dos services
└── tests/
    ├── helpers/
    │   ├── prismaMock.ts                # PrismaClient falso para os unitários
    │   └── db.ts                        # limpar banco, fábricas de paciente/médico/consulta, datas relativas
    ├── setup/                           # configuração do Jest para a integração
    └── integration/                     # pacientes, médicos e consultas
```

## Docker

O `Dockerfile` é **multi-stage**:

| Estágio | Conteúdo | Uso |
|---|---|---|
| `build` | Todas as dependências, Prisma CLI, compilação TypeScript | Compilar e rodar migrations (serviço `migrate`) |
| `runtime` | Só dependências de produção + `dist/` | Imagem final da API |

Boas práticas aplicadas na imagem `runtime`:

- **Imagem enxuta**: sem Prisma CLI, TypeScript e devDependencies (`npm ci --omit=dev --omit=optional`)
- **Usuário sem privilégios**: roda como `node`, não como root
- **HEALTHCHECK**: o Docker consulta `/health` a cada 10 s
- **Desligamento gracioso**: ao receber `SIGTERM`, a API termina as requisições em andamento e fecha a conexão com o banco
- **Cache de camadas**: `package*.json` e o schema são copiados antes do código-fonte, então o `npm ci` só roda de novo quando as dependências mudam

Para buildar só a imagem de produção:

```bash
docker build --target runtime -t agendamento-medico .
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor em desenvolvimento com reload (tsx) |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Roda a versão compilada |
| `npm test` | Testes unitários (sem banco) |
| `npm run test:integration` | Testes de integração (precisa do Postgres no ar) |
| `npm run test:all` | Todos os testes |
| `npm run test:coverage` | Todos os testes com relatório de cobertura |
| `npm run db:up` / `db:down` | Sobe / derruba o Postgres |
| `npm run db:migrate` | Cria e aplica migrations (desenvolvimento) |
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:studio` | Interface visual do banco |

## CI/CD

O pipeline fica em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) e roda no GitHub Actions.

```mermaid
flowchart LR
    PR[Pull request<br/>para main] --> CI
    PUSH[Push / merge<br/>na main] --> CI
    subgraph CI[Job: Validar aplicação]
        direction TB
        A[npm ci] --> B[npm audit]
        B --> C[tsc --noEmit]
        C --> D[Testes unitários]
        D --> E[Testes de integração<br/>Postgres service container]
        E --> F[npm run build]
        F --> G[docker build]
    end
    CI -->|só em push na main| CD
    subgraph CD[Job: Publicar imagem Docker]
        direction TB
        H[Login no GHCR] --> I[Build + push<br/>com cache do Buildx]
    end
    CD --> REG[(ghcr.io)]
```

### CI: job `ci`

Roda em **todo pull request e push para a `main`**. Se qualquer etapa falhar, o PR fica marcado em vermelho.

| Etapa | O que garante |
|---|---|
| `npm ci` | Instalação reproduzível, idêntica ao `package-lock.json`. Também gera o Prisma Client |
| `npm audit --audit-level=high` | Nenhuma dependência com vulnerabilidade alta ou crítica |
| `npx tsc --noEmit` | O código compila sem erros de tipo |
| `npm test` | Regras de negócio corretas (unitários, sem banco) |
| `npm run test:integration` | Rotas funcionando de ponta a ponta contra um PostgreSQL 16 real (service container) |
| `npm run build` | O build de produção é gerado |
| `docker build --target runtime` | O Dockerfile continua válido |

### CD: job `publish`

Roda **só em push na `main`** (ou seja, depois do merge de um PR) e **só se o CI passar** (`needs: ci`).

- Publica a imagem no **GitHub Container Registry** usando o `GITHUB_TOKEN` do próprio Actions, sem secrets extras
- Tags geradas:
  - `latest`: sempre a versão mais recente da `main`
  - `sha-<commit>`: uma tag fixa por commit, útil para rollback
- Usa o cache do Docker Buildx (`type=gha`), então builds seguintes reaproveitam as camadas que não mudaram

### Usando a imagem publicada

```bash
docker pull ghcr.io/lfguimara/agendamento-medico:latest
```

> O pacote no GHCR é **privado** por padrão. Para baixar, autentique-se com `docker login ghcr.io` usando um Personal Access Token com escopo `read:packages`, ou torne o pacote público em *GitHub → Packages → agendamento-medico → Package settings*.

Para rodar a imagem publicada no lugar do build local, troque `build:` por `image: ghcr.io/lfguimara/agendamento-medico:latest` no serviço `app` do `docker-compose.yml`.

### Fluxo de trabalho

1. Crie uma branch a partir da `main` (`feat/...`, `fix/...`, `docs/...`)
2. Abra um pull request: o CI valida automaticamente
3. Com o CI verde, faça o merge: o CD publica a nova imagem

## Limitações conhecidas

- A verificação de conflito de horário e a criação da consulta não acontecem numa transação. Em requisições simultâneas para o mesmo horário, duas consultas podem passar pela verificação. Uma evolução seria usar transação com isolamento `Serializable` ou uma exclusion constraint no PostgreSQL.

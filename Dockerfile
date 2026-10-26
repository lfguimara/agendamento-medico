# ---------- Estágio 1: build ----------
# Instala todas as dependências (inclusive dev), gera o Prisma Client e compila o TypeScript.
# Também é usado pelo serviço "migrate" do docker-compose, pois tem o Prisma CLI.
FROM node:24-alpine AS build
WORKDIR /app

# Copia primeiro só o necessário para o npm ci: o Docker reaproveita essa camada
# em cache enquanto package*.json e o schema não mudarem
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- Estágio 2: runtime ----------
# Imagem final enxuta: só dependências de produção e o JavaScript compilado
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# --ignore-scripts: o postinstall (prisma generate) não é necessário aqui,
#   o client gerado já vem compilado dentro de dist/
# --omit=optional: o Prisma CLI e o TypeScript são devDependencies mas também
#   peers opcionais do @prisma/client ("devOptional" no lockfile). O npm só os
#   remove omitindo dev E optional; sem isso ~300 MB iriam para a imagem.
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist

# Não roda como root dentro do container
USER node

EXPOSE 3333

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3333/health || exit 1

CMD ["node", "dist/server.js"]

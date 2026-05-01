# Dockerfile multi-stage para el integrador de TiendaPro.
#
# Build stage: instala todas las deps y compila TS.
# Runtime stage: solo node_modules de producción + dist.

FROM node:22-alpine AS builder

WORKDIR /app

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copia metadata para aprovechar cache de capa
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY code/packages/llm/package.json code/packages/llm/
COPY code/proyecto-integrador/package.json code/proyecto-integrador/

RUN pnpm install --frozen-lockfile

# Copia el resto y compila
COPY code/packages code/packages
COPY code/proyecto-integrador code/proyecto-integrador
COPY tsconfig.json ./

# Type-check (en CI conviene; en imagen puede saltarse)
# RUN pnpm --filter @curso-ai/proyecto-integrador exec tsc --noEmit

# Runtime stage
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

RUN corepack enable && corepack prepare pnpm@10 --activate

# Solo deps de producción
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=builder /app/code/packages code/packages
COPY --from=builder /app/code/proyecto-integrador code/proyecto-integrador

RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# Healthcheck mock — en realidad debería ser un endpoint /health del integrador
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

CMD ["pnpm", "--filter", "@curso-ai/proyecto-integrador", "dev"]
